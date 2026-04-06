'use strict';
/**
 * ============================================================
 * Bedrock+Polly Call Service
 * 
 * Handles outbound calls using Twilio with AWS Bedrock (LLM)
 * and AWS Polly (TTS). Uses existing Twilio credentials from
 * the database and AWS credentials from environment variables.
 * ============================================================
 */

import twilio from 'twilio';
import { db } from '../../../db';
import { 
  twilioOpenaiCalls, 
  agents, 
  phoneNumbers,
  flows,
  users,
  elevenLabsCredentials 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../../../utils/logger';
import { 
  getAnswerWebhookUrl, 
  getStatusWebhookUrl,
  getStreamWebhookUrl 
} from '../config/config';
import { BedrockAgentFactory } from './bedrock-agent-factory';
import { BedrockPollyAudioBridge } from './audio-bridge.service';
import { getTwilioClient } from '../../../services/twilio-connector';
import { 
  hydrateCompiledTools, 
  hydrateCompiledFlow,
  OpenAIVoiceAgentCompiler 
} from '../../../services/openai-voice-agent';
import { webhookDeliveryService } from '../../../services/webhook-delivery';
import type { AgentConfig, PollyVoiceId, BedrockModel, CompiledFlowConfig, TtsProvider } from '../types';
import type { CompiledFunctionTool, CompiledConversationState } from '@shared/schema';

export interface InitiateCallParams {
  userId: string;
  agentId: string;
  toNumber: string;
  fromNumberId: string;
  campaignId?: string;
  contactId?: string;
  flowId?: string;
  metadata?: Record<string, unknown>;
}

export interface CallResult {
  success: boolean;
  callId?: string;
  twilioCallSid?: string;
  error?: string;
}

export class BedrockPollyCallService {
  static async initiateCall(params: InitiateCallParams): Promise<CallResult> {
    const { userId, agentId, toNumber, fromNumberId, campaignId, contactId, flowId: overrideFlowId, metadata } = params;

    logger.info(`Initiating Bedrock+Polly call to ${toNumber} from number ${fromNumberId}`, undefined, 'BedrockPollyCall');

    try {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      const [phoneNumber] = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, fromNumberId))
        .limit(1);

      if (!phoneNumber) {
        return { success: false, error: 'Phone number not found' };
      }

      const [user] = await db
        .select({ credits: users.credits, planType: users.planType })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.credits < 1) {
        logger.warn(`Insufficient credits for user ${userId}`, undefined, 'BedrockPollyCall');
        return { success: false, error: 'Insufficient credits to make a call' };
      }

      const callId = nanoid();
      const userTier: 'free' | 'pro' = user.planType === 'pro' ? 'pro' : 'free';
      
      let agentConfig;
      
      const effectiveFlowId = overrideFlowId || agent.flowId;
      const defaultVoice: PollyVoiceId = 'Joanna';
      const rawModel = (agent.llmModel as BedrockModel) || 'claude-sonnet-4-6';
      const defaultModel: BedrockModel = BedrockAgentFactory.validateModel(rawModel, userTier);

      const ttsProvider: TtsProvider = agent.voiceProvider === 'elevenlabs' ? 'elevenlabs' : 'aws_polly';
      let elevenLabsApiKey: string | undefined;
      const elevenLabsVoiceId = agent.elevenLabsVoiceId || undefined;

      if (ttsProvider === 'elevenlabs') {
        if (agent.elevenLabsCredentialId) {
          const [cred] = await db
            .select()
            .from(elevenLabsCredentials)
            .where(eq(elevenLabsCredentials.id, agent.elevenLabsCredentialId))
            .limit(1);
          if (cred) {
            elevenLabsApiKey = cred.apiKey;
          }
        }
        if (!elevenLabsApiKey) {
          elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        }
        logger.info(`Using ElevenLabs TTS for agent ${agentId}, voice: ${elevenLabsVoiceId}`, undefined, 'BedrockPollyCall');
      }
      
      if (agent.type === 'flow' && effectiveFlowId) {
        logger.info(`Agent is flow-based, fetching flow ${effectiveFlowId}${overrideFlowId ? ' (override from test)' : ''}`, undefined, 'BedrockPollyCall');
        const [flow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, effectiveFlowId))
          .limit(1);
        
        if (flow) {
          const language = agent.language || 'en';
          
          if (flow.compiledSystemPrompt && flow.compiledTools) {
            logger.info(`Using pre-compiled flow data (${(flow.compiledTools as any[]).length} tools)`, undefined, 'BedrockPollyCall');
            
            const systemPrompt = flow.compiledSystemPrompt;
            const rawFirstMessage = flow.compiledFirstMessage || undefined;
            const firstMessage = await BedrockAgentFactory.localizeFirstMessage(rawFirstMessage, language);
            
            const compiledTools = flow.compiledTools as CompiledFunctionTool[];
            const hydratedTools = hydrateCompiledTools(compiledTools, {
              userId,
              agentId,
              callId,
              knowledgeBaseIds: agent.knowledgeBaseIds || [],
              transferPhoneNumber: agent.transferPhoneNumber || undefined,
            });
            
            agentConfig = {
              voice: (agent.awsPollyVoiceId || agent.openaiVoice as string) || defaultVoice,
              model: defaultModel,
              systemPrompt,
              firstMessage,
              temperature: agent.temperature ?? 0.7,
              tools: hydratedTools,
              ttsProvider,
              elevenLabsVoiceId,
              elevenLabsApiKey,
            };
          } else {
            logger.info(`Flow loaded with ${(flow.nodes as any[]).length} nodes, language: ${language}, compiling at runtime`, undefined, 'BedrockPollyCall');
            
            const compiledResult = OpenAIVoiceAgentCompiler.compileFlow(
              flow.nodes as any[],
              flow.edges as any[],
              {
                language,
                voice: (agent.openaiVoice as string) || defaultVoice,
                model: defaultModel,
                knowledgeBaseIds: agent.knowledgeBaseIds || [],
                transferEnabled: agent.transferEnabled || false,
                transferPhoneNumber: agent.transferPhoneNumber || undefined,
                endConversationEnabled: agent.endConversationEnabled ?? true,
              }
            );
            
            const localizedCompiledFirst = await BedrockAgentFactory.localizeFirstMessage(
              compiledResult.firstMessage ?? undefined,
              language
            );

            const hydratedFlowConfig = await hydrateCompiledFlow({
              compiledSystemPrompt: compiledResult.systemPrompt,
              compiledFirstMessage: localizedCompiledFirst ?? null,
              compiledTools: compiledResult.tools as CompiledFunctionTool[],
              compiledStates: compiledResult.conversationStates as CompiledConversationState[],
              voice: (agent.awsPollyVoiceId || agent.openaiVoice as string) || defaultVoice,
              model: defaultModel,
              temperature: agent.temperature ?? 0.7,
              toolContext: {
                userId,
                agentId,
                callId,
              },
              language,
              knowledgeBaseIds: agent.knowledgeBaseIds || [],
              transferPhoneNumber: agent.transferPhoneNumber || undefined,
              transferEnabled: agent.transferEnabled || false,
            });
            agentConfig = {
              ...hydratedFlowConfig,
              ttsProvider,
              elevenLabsVoiceId,
              elevenLabsApiKey,
            };
          }
        }
      }
      
      const isFlowAgent = agentConfig !== undefined;
      
      if (!agentConfig) {
        const agentLanguage = agent.language || 'en';
        const localizedFirstMessage = await BedrockAgentFactory.localizeFirstMessage(
          agent.firstMessage,
          agentLanguage
        );

        let effectiveSystemPrompt = agent.systemPrompt || 'You are a helpful AI assistant.';

        const contactName = metadata?.contactName as string | undefined;
        const contactFirstName = metadata?.contactFirstName as string | undefined;
        const contactLastName = metadata?.contactLastName as string | undefined;
        const contactEmail = metadata?.contactEmail as string | undefined;
        const contactPhone = metadata?.contactPhone as string | undefined;
        const contactCustomFields = (metadata?.contactCustomFields || {}) as Record<string, any>;

        const resolveTemplateVariables = (text: string): string => {
          if (!text) return text;
          let resolved = text;
          const replacements: Record<string, string> = {
            firstName: contactFirstName || contactName?.split(' ')[0] || '',
            lastName: contactLastName || '',
            email: contactEmail || '',
            phone: contactPhone || '',
            name: contactName || '',
            company: contactCustomFields.company || contactCustomFields.organization || '',
            organization: contactCustomFields.organization || contactCustomFields.company || '',
            industry: contactCustomFields.industry || '',
            city: contactCustomFields.city || '',
            title: contactCustomFields.title || '',
            role: contactCustomFields.role || contactCustomFields.title || '',
            department: contactCustomFields.department || '',
            notes: contactCustomFields.notes || '',
          };
          for (const [key, val] of Object.entries(contactCustomFields)) {
            if (!replacements[key]) {
              replacements[key] = String(val || '');
            }
          }
          for (const [key, val] of Object.entries(replacements)) {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
            resolved = resolved.replace(pattern, val || '');
          }
          resolved = resolved.replace(/\{\{[a-zA-Z0-9_.]+\}\}/g, '');
          return resolved;
        };

        if (contactName && contactName.trim()) {
          const contextParts = [`You are calling ${contactName.trim()}.`];
          if (contactCustomFields.company || contactCustomFields.organization) {
            contextParts.push(`They work at ${contactCustomFields.company || contactCustomFields.organization}.`);
          }
          if (contactCustomFields.industry) {
            contextParts.push(`Their industry is ${contactCustomFields.industry}.`);
          }
          if (contactCustomFields.title || contactCustomFields.role) {
            contextParts.push(`Their role is ${contactCustomFields.title || contactCustomFields.role}.`);
          }
          contextParts.push(`Use their name naturally 1-2 times during the conversation — not every sentence, just when it feels right.`);
          effectiveSystemPrompt += `\n\nCALL CONTEXT: ${contextParts.join(' ')}`;
          logger.info(`[Outbound] Personalized call for contact: ${contactName}`, undefined, 'BedrockPollyCall');
        }

        const callScript = metadata?.callScript as string | undefined;
        if (callScript && callScript.trim()) {
          const resolvedScript = resolveTemplateVariables(callScript.trim());
          const scriptSection = `CALL SCRIPT & CONVERSATION GUIDE (follow these points step-by-step as your playbook):\n${resolvedScript}\n\nIMPORTANT: Follow the script above as a GUIDE — cover each point in order but use your own natural words. Do NOT read it verbatim.`;

          const hasCampaignRole = /^You are an? (?:AI |phone |outbound |sales |calling |campaign )/i.test(resolvedScript);
          if (hasCampaignRole) {
            const agentNameFromPrompt = agent.name || 'an AI agent';
            const callContextMatch = effectiveSystemPrompt.match(/\n\nCALL CONTEXT:[\s\S]*/);
            const callContext = callContextMatch ? callContextMatch[0] : '';
            effectiveSystemPrompt = `${resolvedScript}\n\nYou are ${agentNameFromPrompt}. Focus ONLY on the campaign task above. Do NOT introduce topics outside this task.${callContext}`;
            logger.info(`[Outbound] Campaign script fully replaces agent prompt — clean campaign-only prompt (${resolvedScript.length} chars)`, undefined, 'BedrockPollyCall');
          } else {
            const existingScriptMatch = effectiveSystemPrompt.match(/CALL SCRIPT & CONVERSATION GUIDE[^:]*:\n[\s\S]*?(?=\n\n[A-Z]|$)/);
            if (existingScriptMatch) {
              effectiveSystemPrompt = effectiveSystemPrompt.replace(existingScriptMatch[0], scriptSection);
              logger.info(`[Outbound] Replaced existing call script with campaign script (${resolvedScript.length} chars)`, undefined, 'BedrockPollyCall');
            } else {
              effectiveSystemPrompt += `\n\n${scriptSection}`;
              logger.info(`[Outbound] Injected campaign call script (${resolvedScript.length} chars) into agent system prompt`, undefined, 'BedrockPollyCall');
            }
          }
        }

        if (!effectiveSystemPrompt.includes('OUTBOUND CONTEXT')) {
          effectiveSystemPrompt += `\n\nOUTBOUND CONTEXT: You initiated this call. State your purpose early. If the person declines, wrap up politely.`;
        }

        effectiveSystemPrompt = resolveTemplateVariables(effectiveSystemPrompt);

        let naturalConfig = BedrockAgentFactory.createAgentConfig({
          voice: (agent.awsPollyVoiceId || agent.openaiVoice as string) || defaultVoice,
          model: defaultModel,
          systemPrompt: effectiveSystemPrompt,
          firstMessage: resolveTemplateVariables(localizedFirstMessage || ''),
          temperature: agent.temperature ?? 0.7,
          userTier,
          ttsProvider,
          elevenLabsVoiceId,
          elevenLabsApiKey,
          language: agentLanguage,
          agentName: agent.name || undefined,
          toolContext: {
            userId,
            agentId,
            callId,
          },
        });

        if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
          naturalConfig = BedrockAgentFactory.addKnowledgeBaseTool(
            naturalConfig, 
            agent.knowledgeBaseIds, 
            userId
          );
        }

        const promptMentionsAppointment = effectiveSystemPrompt && /appointment|booking|schedule.*meeting|book.*slot|calendar/i.test(effectiveSystemPrompt);
        if (agent.appointmentBookingEnabled || metadata?.campaignAppointmentBooking || promptMentionsAppointment) {
          naturalConfig = BedrockAgentFactory.addAppointmentTool(naturalConfig, userId, agentId, callId);
          logger.info(`[Outbound] Added appointment tool (flag=${!!agent.appointmentBookingEnabled}, campaignFlag=${!!metadata?.campaignAppointmentBooking}, promptDetect=${!!promptMentionsAppointment})`, undefined, 'BedrockPollyCall');
        }

        const campaignFormId = metadata?.selectedFormId as string | undefined;
        if (campaignFormId) {
          try {
            const { forms, formFields: formFieldsTable } = await import('@shared/schema');
            const formRecord = await db.select().from(forms).where(eq(forms.id, campaignFormId)).limit(1);
            if (formRecord.length > 0) {
              const fieldsData = await db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, campaignFormId));
              if (fieldsData.length > 0) {
                naturalConfig = BedrockAgentFactory.addFormTool(
                  naturalConfig,
                  formRecord[0].id,
                  formRecord[0].name,
                  fieldsData.map(f => ({
                    id: f.id,
                    question: f.question,
                    fieldType: f.fieldType,
                    isRequired: f.isRequired ?? true,
                  })),
                  userId,
                  callId
                );
                logger.info(`[Outbound] Added form tool for campaign form "${formRecord[0].name}" (${fieldsData.length} fields)`, undefined, 'BedrockPollyCall');
              }
            }
          } catch (formErr: any) {
            logger.error(`[Outbound] Failed to add form tool: ${formErr.message}`, formErr, 'BedrockPollyCall');
          }
        }

        const campaignKbIds = metadata?.campaignKnowledgeBaseIds as string[] | undefined;
        if (campaignKbIds && campaignKbIds.length > 0 && (!agent.knowledgeBaseIds || agent.knowledgeBaseIds.length === 0)) {
          naturalConfig = BedrockAgentFactory.addKnowledgeBaseTool(
            naturalConfig,
            campaignKbIds,
            userId
          );
          logger.info(`[Outbound] Added campaign-level KB tool (${campaignKbIds.length} KBs)`, undefined, 'BedrockPollyCall');
        }

        if (agent.transferEnabled && agent.transferPhoneNumber) {
          naturalConfig = BedrockAgentFactory.addTransferTool(
            naturalConfig,
            agent.transferPhoneNumber,
            undefined
          );
        }

        if (agent.endConversationEnabled) {
          naturalConfig = BedrockAgentFactory.addEndCallTool(naturalConfig);
        }

        if (agent.detectLanguageEnabled) {
          naturalConfig = BedrockAgentFactory.enableLanguageDetection(naturalConfig);
        }
        
        agentConfig = naturalConfig;
      }

      logger.info(`[Outbound Config] Agent "${agent.name}" | Voice: ${agent.voiceProvider}/${agent.awsPollyVoiceId || 'default'} | TTS: ${ttsProvider} | Flow: ${isFlowAgent} | KB: ${agent.knowledgeBaseIds?.length || 0} | EndCall: ${agent.endConversationEnabled}`, undefined, 'BedrockPollyCall');
      logger.info(`[Outbound Config] System prompt: ${(agentConfig as any)?.systemPrompt?.substring(0, 200)}...`, undefined, 'BedrockPollyCall');
      logger.info(`[Outbound Config] First message: ${(agentConfig as any)?.firstMessage || '(none)'}`, undefined, 'BedrockPollyCall');
      logger.info(`[Outbound Config] Tools: ${(agentConfig as any)?.tools?.map((t: any) => t.name || t.function?.name).join(', ') || '(none)'}`, undefined, 'BedrockPollyCall');

      const normalizedFromNumber = phoneNumber.phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+?/, '+');
      const normalizedToNumber = toNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+?/, '+');

      await BedrockPollyAudioBridge.createSession({
        callSid: callId,
        agentConfig: agentConfig as any,
        fromNumber: normalizedFromNumber,
        toNumber: normalizedToNumber,
        callDirection: 'outbound',
      });

      const client = await getTwilioClient();
      
      const call = await client.calls.create({
        to: toNumber.startsWith('+') ? toNumber : `+${toNumber}`,
        from: phoneNumber.phoneNumber.startsWith('+') 
          ? phoneNumber.phoneNumber 
          : `+${phoneNumber.phoneNumber}`,
        url: getAnswerWebhookUrl(),
        statusCallback: getStatusWebhookUrl(),
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      BedrockPollyAudioBridge.remapSession(callId, call.sid);

      await db.insert(twilioOpenaiCalls).values({
        id: callId,
        userId,
        agentId,
        campaignId,
        contactId,
        twilioPhoneNumberId: phoneNumber.id,
        openaiCredentialId: null,
        twilioCallSid: call.sid,
        fromNumber: normalizedFromNumber,
        toNumber: normalizedToNumber,
        openaiVoice: (agent.awsPollyVoiceId || agent.openaiVoice as any) || defaultVoice,
        openaiModel: defaultModel,
        status: 'initiated',
        callDirection: 'outbound',
        startedAt: new Date(),
        metadata: {
          ...metadata,
          ttsProvider,
          elevenLabsVoiceId: elevenLabsVoiceId || null,
          elevenLabsApiKey: elevenLabsApiKey || null,
        },
      });

      logger.info(`Call initiated: ${callId} -> Twilio SID: ${call.sid}`, undefined, 'BedrockPollyCall');

      try {
        await webhookDeliveryService.triggerEvent(userId, 'call.started', {
          call: {
            id: callId,
            callSid: call.sid,
            direction: 'outbound',
            status: 'initiated',
            startedAt: new Date().toISOString(),
            fromNumber: normalizedFromNumber,
            toNumber: normalizedToNumber,
          },
          agent: {
            id: agentId,
            name: agent.name || null,
          },
          campaign: campaignId ? { id: campaignId } : null,
        });
        logger.info(`Triggered call.started webhook for call ${callId}`, undefined, 'BedrockPollyCall');
      } catch (webhookError: any) {
        logger.error(`Failed to trigger call.started webhook: ${webhookError.message}`, undefined, 'BedrockPollyCall');
      }

      if (isFlowAgent && effectiveFlowId) {
        try {
          const [flow] = await db
            .select()
            .from(flows)
            .where(eq(flows.id, effectiveFlowId))
            .limit(1);
          
          if (flow) {
            await webhookDeliveryService.triggerEvent(userId, 'flow.started', {
              flowId: flow.id,
              flowName: flow.name,
              callId: callId,
              callSid: call.sid,
              agentId: agentId,
              userId: userId,
            }, campaignId);
            logger.info(`Triggered flow.started webhook for call ${callId}, flow ${flow.name}`, undefined, 'BedrockPollyCall');
          }
        } catch (flowWebhookError: any) {
          logger.error(`Failed to trigger flow.started webhook: ${flowWebhookError.message}`, undefined, 'BedrockPollyCall');
        }
      }

      return {
        success: true,
        callId,
        twilioCallSid: call.sid,
      };

    } catch (error: any) {
      logger.error('Error initiating Bedrock+Polly call', error.message, 'BedrockPollyCall');
      return { success: false, error: error.message };
    }
  }

  static async hangupCall(callSid: string): Promise<boolean> {
    try {
      const [callRecord] = await db
        .select()
        .from(twilioOpenaiCalls)
        .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
        .limit(1);

      if (!callRecord) {
        logger.warn(`Call not found: ${callSid}`, undefined, 'BedrockPollyCall');
        return false;
      }

      const client = await getTwilioClient();
      await client.calls(callSid).update({ status: 'completed' });

      await BedrockPollyAudioBridge.endSession(callSid);

      logger.info(`Call hung up: ${callSid}`, undefined, 'BedrockPollyCall');
      return true;

    } catch (error: any) {
      logger.error('Error hanging up call', error.message, 'BedrockPollyCall');
      return false;
    }
  }

  static async getCallStatus(callId: string): Promise<any> {
    const [call] = await db
      .select()
      .from(twilioOpenaiCalls)
      .where(eq(twilioOpenaiCalls.id, callId))
      .limit(1);

    return call || null;
  }
}
