'use strict';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { BedrockPollyAudioBridge } from '../services/audio-bridge.service';
import { BedrockAgentFactory } from '../services/bedrock-agent-factory';
import { db } from '../../../db';
import { twilioOpenaiCalls, flowExecutions, users } from '@shared/schema';
import { storage } from '../../../storage';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { BEDROCK_POLLY_CONFIG } from '../config/config';
import { CallInsightsService } from '../../../services/call-insights.service';
import { liveCallRegistry } from '../../../services/live-call-registry';
import type { TwilioMediaStreamEvent, AgentConfig, PollyVoiceId, BedrockModel, TtsProvider } from '../types';

let sharedWss: WebSocketServer | null = null;

export function setupBedrockPollyStreamHandler(httpServer: HttpServer): void {
  if (!sharedWss) {
    sharedWss = new WebSocketServer({ noServer: true });
  }

  httpServer.on('upgrade', async (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';

    if (pathname.startsWith('/api/bedrock-polly/stream/')) {
      const callSid = pathname.split('/api/bedrock-polly/stream/')[1];

      if (!callSid) {
        console.error(`[BedrockPolly Stream] Invalid stream URL: ${pathname}`);
        socket.destroy();
        return;
      }

      try {
        const [existingCall] = await db
          .select({ id: twilioOpenaiCalls.id })
          .from(twilioOpenaiCalls)
          .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
          .limit(1);

        if (!existingCall) {
          console.error(`[BedrockPolly Stream] Security: Rejecting stream for unknown call SID: ${callSid}`);
          socket.destroy();
          return;
        }
      } catch (err: any) {
        console.error(`[BedrockPolly Stream] Security: Database error validating call SID: ${err.message}`);
        socket.destroy();
        return;
      }

      console.log(`[BedrockPolly Stream] Handling WebSocket upgrade for call: ${callSid}`);

      sharedWss!.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        console.log(`[BedrockPolly Stream] WebSocket connected for call: ${callSid}`);
        handleBedrockPollyStreamConnection(ws, callSid);
      });
    }
  });

  console.log('✅ Bedrock-Polly WebSocket stream endpoint registered');
}

function handleBedrockPollyStreamConnection(ws: WebSocket, callSid: string): void {
  let streamSid: string | null = null;
  let sessionInitialized = false;

  ws.on('message', async (message: Buffer | string) => {
    try {
      const data = typeof message === 'string' ? message : message.toString();
      const event: TwilioMediaStreamEvent = JSON.parse(data);

      if (event.event === 'connected') {
        console.log(`[BedrockPolly Stream] Connected event for ${callSid}`);
      }

      if (event.event === 'start' && event.start) {
        streamSid = event.start.streamSid;
        console.log(`[BedrockPolly Stream] Stream started: ${streamSid}`);

        const existingSession = BedrockPollyAudioBridge.getSession(callSid);
        if (existingSession) {
          if (existingSession.twilioWs !== ws) {
            existingSession.twilioWs = ws;
          }
          if (streamSid) {
            existingSession.streamSid = streamSid;
          }
          sessionInitialized = true;
        } else {
          console.log(`[BedrockPolly Stream] No existing session for ${callSid}, initializing for incoming call`);
          await initializeSession(callSid, ws, streamSid);
          sessionInitialized = true;
        }
      }

      if (sessionInitialized) {
        BedrockPollyAudioBridge.handleTwilioMedia(callSid, event);
      }

    } catch (error: any) {
      console.error(`[BedrockPolly Stream] Error processing message:`, error.message);
    }
  });

  ws.on('close', async (code: number, reason: Buffer) => {
    console.log(`[BedrockPolly Stream] WebSocket closed for ${callSid}: ${code} ${reason?.toString() || ''}`);

    liveCallRegistry.endCallByTwilioSid(callSid);

    let sessionResult: { duration: number; transcript: string } = { duration: 0, transcript: '' };
    try {
      sessionResult = await BedrockPollyAudioBridge.endSession(callSid);
      logger.info(`Session ended for ${callSid}: duration=${sessionResult.duration}s, transcript=${sessionResult.transcript.length} chars`, undefined, 'BedrockPolly Stream');
    } catch (err: any) {
      console.error(`[BedrockPolly Stream] Error ending audio session for ${callSid}:`, err.message);
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [callRecord] = await db
          .select()
          .from(twilioOpenaiCalls)
          .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
          .limit(1);

        if (callRecord) {
          const fallbackUpdates: Record<string, unknown> = {
            status: callRecord.status === 'completed' ? 'completed' : 'completed',
            endedAt: callRecord.endedAt || new Date(),
          };

          if (!callRecord.duration && sessionResult.duration > 0) {
            fallbackUpdates.duration = sessionResult.duration;
          } else if (!callRecord.duration && callRecord.startedAt) {
            const calcDuration = Math.max(0, Math.floor(
              ((callRecord.endedAt || new Date()).getTime() - new Date(callRecord.startedAt).getTime()) / 1000
            ));
            if (calcDuration > 0) {
              fallbackUpdates.duration = calcDuration;
            }
          }

          if (!callRecord.transcript && sessionResult.transcript.length > 0) {
            fallbackUpdates.transcript = sessionResult.transcript;
          }

          const hasUpdates = Object.keys(fallbackUpdates).some(
            k => k !== 'status' && k !== 'endedAt'
          ) || callRecord.status !== 'completed' || !callRecord.endedAt;

          if (hasUpdates) {
            await db
              .update(twilioOpenaiCalls)
              .set(fallbackUpdates)
              .where(eq(twilioOpenaiCalls.id, callRecord.id));
            logger.info(`Fallback DB update for call ${callRecord.id}: ${JSON.stringify(Object.keys(fallbackUpdates))}`, undefined, 'BedrockPolly Stream');
          }

          try {
            const [flowExec] = await db
              .select()
              .from(flowExecutions)
              .where(eq(flowExecutions.callId, callRecord.id))
              .limit(1);

            if (flowExec && flowExec.status === 'running') {
              await db
                .update(flowExecutions)
                .set({
                  status: 'completed',
                  completedAt: new Date(),
                })
                .where(eq(flowExecutions.id, flowExec.id));
              logger.info(`Updated flow execution ${flowExec.id} to completed`, undefined, 'BedrockPolly Stream');
            }
          } catch (flowExecError: any) {
            logger.warn(`Failed to update flow execution status: ${flowExecError.message}`, undefined, 'BedrockPolly Stream');
          }
        } else {
          logger.warn(`No call record found for twilioCallSid=${callSid}, cannot mark completed`, undefined, 'BedrockPolly Stream');
        }
        break;
      } catch (dbErr: any) {
        console.error(`[BedrockPolly Stream] Failed to update call record in DB for ${callSid} (attempt ${attempt}/${maxRetries}):`, dbErr.message);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error(`[BedrockPolly Stream] WebSocket error for ${callSid}:`, error.message);
  });
}

async function initializeSession(
  callSid: string,
  twilioWs: WebSocket,
  streamSid: string | null
): Promise<void> {
  try {
    logger.info(`Initializing session for incoming call ${callSid}`, undefined, 'BedrockPolly Stream');

    const [callRecord] = await db
      .select()
      .from(twilioOpenaiCalls)
      .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
      .limit(1);

    if (!callRecord) {
      logger.error(`Call record not found for: ${callSid}`, undefined, 'BedrockPolly Stream');
      twilioWs.close();
      return;
    }

    const metadata = callRecord.metadata as Record<string, unknown> | null;

    let userTier: 'free' | 'pro' = 'free';
    if (callRecord.userId) {
      try {
        const [user] = await db.select({ planType: users.planType }).from(users).where(eq(users.id, callRecord.userId)).limit(1);
        if (user?.planType === 'pro') userTier = 'pro';
      } catch (err: any) {
        console.warn(`[BedrockPolly Stream] Failed to lookup user tier: ${err.message}`);
      }
    }

    const isFlowAgent = metadata?.isFlowAgent === true;
    const compiledTools = metadata?.compiledTools as any[] | undefined;

    let agentConfig: AgentConfig;

    if (isFlowAgent && compiledTools && compiledTools.length > 0) {
      logger.info(`Initializing flow agent with ${compiledTools.length} compiled tools`, undefined, 'BedrockPolly Stream');

      const { hydrateCompiledTools } = await import('../../../services/openai-voice-agent');
      const hydratedTools = hydrateCompiledTools(compiledTools, {
        userId: callRecord.userId || '',
        agentId: callRecord.agentId || '',
        callId: callRecord.id,
        knowledgeBaseIds: metadata?.knowledgeBaseIds as string[] || [],
        transferPhoneNumber: metadata?.transferPhoneNumber as string || undefined,
      });

      const streamLanguage = (metadata?.language as string) || 'en';
      const localizedFlowFirstMsg = await BedrockAgentFactory.localizeFirstMessage(
        (metadata?.firstMessage as string) || undefined,
        streamLanguage
      );

      const flowExpertMode = !!(metadata?.expertMode);

      const factoryConfig = BedrockAgentFactory.createAgentConfig({
        voice: ((callRecord.openaiVoice as string) || BEDROCK_POLLY_CONFIG.defaultVoice),
        model: ((metadata?.bedrockModel as string) || (callRecord as any).bedrockModel || BEDROCK_POLLY_CONFIG.defaultModel) as BedrockModel,
        systemPrompt: (metadata?.systemPrompt as string) || 'You are a helpful AI assistant.',
        firstMessage: localizedFlowFirstMsg,
        temperature: (metadata?.temperature as number) ?? 0.7,
        language: streamLanguage,
        userTier,
        ttsProvider: (metadata?.ttsProvider as TtsProvider) || 'aws_polly',
        elevenLabsVoiceId: (metadata?.elevenLabsVoiceId as string) || undefined,
        elevenLabsApiKey: (metadata?.elevenLabsApiKey as string) || undefined,
        cartesiaVoiceId: (metadata?.ttsProvider === 'cartesia' ? ((metadata?.cartesiaVoiceId as string) || (callRecord.openaiVoice as string) || undefined) : undefined),
        expertMode: flowExpertMode,
      });
      agentConfig = {
        ...factoryConfig,
        tools: hydratedTools,
      };

      logger.info(`Flow agent initialized with ${hydratedTools.length} tools`, undefined, 'BedrockPolly Stream');
    } else {
      const streamLanguage = (metadata?.language as string) || 'en';
      const localizedNaturalFirstMsg = await BedrockAgentFactory.localizeFirstMessage(
        (metadata?.firstMessage as string) || undefined,
        streamLanguage
      );

      const metaBehaviorConfig = metadata?.behaviorConfig as Record<string, any> | undefined;
      const metaWaitingMessages = metadata?.waitingMessages as string[] | undefined;
      const metaDataSchema = metadata?.dataSchema as Array<{ name: string; type: string; description: string; required?: boolean }> | undefined;
      const metaAgentAssistConfig = metadata?.agentAssistConfig as AgentConfig['agentAssistConfig'] | undefined;

      const streamTtsProvider = (metadata?.ttsProvider as string) || undefined;

      const metaExpertMode = !!(metadata?.expertMode);

      agentConfig = BedrockAgentFactory.createAgentConfig({
        voice: ((callRecord.openaiVoice as string) || BEDROCK_POLLY_CONFIG.defaultVoice),
        model: ((metadata?.bedrockModel as string) || (callRecord as any).bedrockModel || BEDROCK_POLLY_CONFIG.defaultModel) as BedrockModel,
        systemPrompt: (metadata?.systemPrompt as string) || 'You are a helpful AI assistant.',
        firstMessage: localizedNaturalFirstMsg,
        temperature: (metadata?.temperature as number) ?? 0.7,
        language: streamLanguage,
        userTier,
        ttsProvider: streamTtsProvider as any,
        toolContext: {
          userId: callRecord.userId || '',
          agentId: callRecord.agentId || '',
          callId: callRecord.id,
        },
        behaviorConfig: metaBehaviorConfig || undefined,
        waitingMessages: metaWaitingMessages || undefined,
        dataSchema: metaDataSchema || undefined,
        agentAssistConfig: metaAgentAssistConfig || undefined,
        expertMode: metaExpertMode,
      });

      let knowledgeBaseIds = metadata?.knowledgeBaseIds as string[] | undefined;
      if (callRecord.userId) {
        const { enrichKnowledgeBaseIdsWithProducts } = await import('../../../utils/product-kb-enrichment');
        knowledgeBaseIds = await enrichKnowledgeBaseIdsWithProducts(knowledgeBaseIds || [], callRecord.userId);
      }
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && callRecord.userId) {
        agentConfig = BedrockAgentFactory.addKnowledgeBaseTool(
          agentConfig,
          knowledgeBaseIds,
          callRecord.userId,
          undefined,
          metaExpertMode
        );
      }

      if (callRecord.userId) {
        try {
          const callUser = await storage.getUser(callRecord.userId);
          if (callUser?.bedrockKbId && callUser.bedrockKbStatus === 'active') {
            agentConfig = BedrockAgentFactory.addBedrockKBTool(agentConfig, callUser.bedrockKbId);
            console.log(`[Stream] Added Bedrock KB tool for user ${callRecord.userId}, KB: ${callUser.bedrockKbId}`);
          }
        } catch (err: any) {
          console.warn(`[Stream] Failed to check Bedrock KB for user:`, err.message);
        }
      }

      if (metaDataSchema && metaDataSchema.length > 0) {
        agentConfig = BedrockAgentFactory.addDataCollectionTool(
          agentConfig,
          metaDataSchema,
          callRecord.id
        );
      }

      const incomingPromptMentionsAppointment = agentConfig.systemPrompt && /appointment|booking|schedule.*meeting|book.*slot|calendar/i.test(agentConfig.systemPrompt);
      if ((metadata?.appointmentBookingEnabled || incomingPromptMentionsAppointment) && callRecord.userId && callRecord.agentId) {
        agentConfig = BedrockAgentFactory.addAppointmentTool(
          agentConfig,
          callRecord.userId,
          callRecord.agentId,
          callRecord.id
        );
      }

      if (metadata?.transferEnabled && metadata?.transferPhoneNumber) {
        agentConfig = BedrockAgentFactory.addTransferTool(
          agentConfig,
          metadata.transferPhoneNumber as string,
          undefined
        );
      }

      if (metadata?.endConversationEnabled) {
        agentConfig = BedrockAgentFactory.addEndCallTool(agentConfig);
      }

      if (metadata?.detectLanguageEnabled) {
        agentConfig = BedrockAgentFactory.enableLanguageDetection(agentConfig);
      }

      if (metadata?.ttsProvider) {
        agentConfig.ttsProvider = metadata.ttsProvider as TtsProvider;
        agentConfig.elevenLabsVoiceId = (metadata.elevenLabsVoiceId as string) || undefined;
        agentConfig.elevenLabsApiKey = (metadata.elevenLabsApiKey as string) || undefined;
        if (metadata.ttsProvider === 'cartesia') {
          agentConfig.cartesiaVoiceId = (metadata.cartesiaVoiceId as string) || agentConfig.voice || undefined;
        }
      }
    }

    const hasFlowPrompt = metadata?.systemPrompt && (metadata.systemPrompt as string).includes('Conversation States');
    if (hasFlowPrompt && !agentConfig.tools?.some((t) => t.name === 'end_call')) {
      agentConfig = BedrockAgentFactory.addEndCallTool(agentConfig);
      logger.info(`Added end_call tool to flow agent for ${callSid}`, undefined, 'BedrockPolly Stream');
    }

    logger.info(`Creating session with ${agentConfig.tools?.length || 0} tools for ${callSid}`, undefined, 'BedrockPolly Stream');

    await BedrockPollyAudioBridge.createSession({
      callSid,
      agentConfig,
      twilioWs,
      streamSid: streamSid || undefined,
      fromNumber: callRecord.fromNumber || undefined,
      toNumber: callRecord.toNumber || undefined,
      callDirection: callRecord.callDirection as 'inbound' | 'outbound' || 'inbound',
    });

    logger.info(`Session created for incoming call ${callSid}`, undefined, 'BedrockPolly Stream');

    const callUserId = callRecord.userId;
    const callId = callRecord.id;
    const fromNumber = callRecord.fromNumber;
    const toNumber = callRecord.toNumber;

    BedrockPollyAudioBridge.onSessionEnd(callSid, async (sessionData) => {
      const updates: Record<string, unknown> = {
        status: 'completed',
        endedAt: new Date(),
      };

      if (sessionData?.transcript) {
        updates.transcript = sessionData.transcript;
      }
      if (sessionData?.duration && sessionData.duration > 0) {
        updates.duration = sessionData.duration;
      }
      if (sessionData?.bedrockSessionId) {
        updates.openaiSessionId = sessionData.bedrockSessionId;
      }

      const saveCoreToDB = async (data: Record<string, unknown>, retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await db
              .update(twilioOpenaiCalls)
              .set(data)
              .where(eq(twilioOpenaiCalls.id, callId));
            return true;
          } catch (dbErr: any) {
            logger.error(`DB update attempt ${attempt}/${retries} failed for call ${callId}: ${dbErr.message}`, dbErr, 'BedrockPolly Stream');
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        return false;
      };

      const coreSaved = await saveCoreToDB(updates);
      if (!coreSaved) {
        logger.error(`Failed to save core call data for ${callId} after retries`, undefined, 'BedrockPolly Stream');
        return;
      }
      logger.info(`Call ${callId} core data saved (duration=${updates.duration || 0}s, transcript=${(sessionData?.transcript || '').length} chars)`, undefined, 'BedrockPolly Stream');

      if (sessionData?.transcript && sessionData.transcript.length > 50) {
        try {
          const insights = await CallInsightsService.analyzeTranscript(
            sessionData.transcript,
            {
              callId: callId,
              fromNumber: fromNumber || undefined,
              toNumber: toNumber || undefined,
              duration: sessionData?.duration
            }
          );

          if (insights) {
            let aiSummary = insights.aiSummary || '';

            if (metaDataSchema && metaDataSchema.length > 0) {
              try {
                const dataSummary = await BedrockAgentFactory.generateCollectedDataSummary(callId, metaDataSchema);
                if (dataSummary) {
                  aiSummary += dataSummary;
                }
              } catch (dsErr: any) {
                logger.warn(`Failed to generate data collection summary: ${dsErr.message}`, undefined, 'BedrockPolly Stream');
              }
            }

            const insightUpdates: Record<string, unknown> = {
              aiSummary,
              sentiment: insights.sentiment,
              classification: insights.classification,
            };
            if (insights.keyPoints) insightUpdates.keyPoints = insights.keyPoints;
            if (insights.nextActions) insightUpdates.nextActions = insights.nextActions;

            await saveCoreToDB(insightUpdates, 2);
            logger.info(`Generated AI insights for call ${callId}`, {
              sentiment: insights.sentiment,
              classification: insights.classification
            }, 'BedrockPolly Stream');
          }
        } catch (insightError: any) {
          logger.error(`Failed to generate call insights for ${callId} (transcript already saved)`, insightError, 'BedrockPolly Stream');
        }
      }

      try {
        if (callUserId && sessionData?.duration && sessionData.duration >= 1) {
          const creditsToDeduct = Math.ceil(sessionData.duration / 60);

          if (creditsToDeduct > 0) {
            const { deductCallCredits } = await import('../../../services/credit-service');
            const creditResult = await deductCallCredits({
              userId: callUserId,
              creditsToDeduct,
              callId,
              fromNumber: fromNumber || 'Unknown',
              toNumber: toNumber || 'Unknown',
              durationSeconds: sessionData.duration,
              engine: 'bedrock-polly',
            });

            if (!creditResult.success && !creditResult.alreadyDeducted) {
              logger.error(`Credit deduction failed for call ${callId}: ${creditResult.error}`, undefined, 'BedrockPolly Stream');

              try {
                await db
                  .update(twilioOpenaiCalls)
                  .set({
                    status: 'credit_failed',
                    metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ creditError: creditResult.error, creditsRequired: creditsToDeduct })}::jsonb`
                  })
                  .where(eq(twilioOpenaiCalls.id, callId));
              } catch (updateError: any) {
                logger.error(`Failed to update call status for credit failure: ${updateError.message}`, updateError, 'BedrockPolly Stream');
              }
              return;
            } else if (creditResult.success && creditResult.creditsDeducted > 0) {
              logger.info(`Credits deducted for call ${callId}: ${creditResult.creditsDeducted} credits, new balance: ${creditResult.newBalance}`, undefined, 'BedrockPolly Stream');
            }
          }
        }
      } catch (creditErr: any) {
        logger.error(`Credit processing error for call ${callId}: ${creditErr.message}`, creditErr, 'BedrockPolly Stream');
      }

      if (callUserId) {
        try {
          const { CRMLeadProcessor } = await import('../../crm/lead-processor.service');
          const result = await CRMLeadProcessor.processTwilioOpenAICall(callId);
          if (result?.leadId) {
            logger.info(`CRM lead created: ${result.leadId}`, undefined, 'BedrockPolly Stream');
          }
        } catch (crmError: any) {
          logger.error(`Failed to create CRM lead: ${crmError.message}`, crmError, 'BedrockPolly Stream');
        }
      }
    });

  } catch (error: any) {
    logger.error(`Failed to initialize session for ${callSid}: ${error.message}`, error, 'BedrockPolly Stream');
  }
}
