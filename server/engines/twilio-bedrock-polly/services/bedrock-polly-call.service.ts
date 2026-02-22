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
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.credits < 1) {
        logger.warn(`Insufficient credits for user ${userId}`, undefined, 'BedrockPollyCall');
        return { success: false, error: 'Insufficient credits to make a call' };
      }

      const callId = nanoid();
      
      let agentConfig;
      
      const effectiveFlowId = overrideFlowId || agent.flowId;
      const defaultVoice: PollyVoiceId = 'Joanna';
      const defaultModel: BedrockModel = 'claude-3-5-sonnet';

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

            const hydratedFlowConfig = hydrateCompiledFlow({
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

        let naturalConfig = BedrockAgentFactory.createAgentConfig({
          voice: (agent.awsPollyVoiceId || agent.openaiVoice as string) || defaultVoice,
          model: defaultModel,
          systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
          firstMessage: localizedFirstMessage,
          temperature: agent.temperature ?? 0.7,
          ttsProvider,
          elevenLabsVoiceId,
          elevenLabsApiKey,
          language: agentLanguage,
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

        if (agent.appointmentBookingEnabled) {
          naturalConfig = BedrockAgentFactory.addAppointmentTool(naturalConfig, userId, agentId, callId);
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
