'use strict';
import { Router, Request, Response } from 'express';
import { db } from '../../../db';
import { agents, twilioOpenaiCalls, phoneNumbers, incomingConnections, users, flows, ivrConfigurations, calls } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  generateTwiML,
  getStreamWebhookUrl,
  getStatusWebhookUrl,
  getRecordingWebhookUrl,
  BEDROCK_POLLY_CONFIG
} from '../config/config';
import { BedrockAgentFactory } from '../services/bedrock-agent-factory';
import { BedrockPollyAudioBridge } from '../services/audio-bridge.service';
import { BedrockPollyCallService } from '../services/bedrock-polly-call.service';
import { getTwilioClient } from '../../../services/twilio-connector';
import { logger } from '../../../utils/logger';
import { webhookDeliveryService } from '../../../services/webhook-delivery';
import { validateTwilioWebhook } from '../../../middleware/webhookValidation';
import { liveCallRegistry } from '../../../services/live-call-registry';
import { getDomain } from '../../../utils/domain';
import { awsBedrockService } from '../../../services/aws-bedrock';
import { awsPollyService } from '../../../services/aws-polly';
import { POLLY_VOICES } from '../types';
import { conversationResumptionService } from '../../../services/conversation-resumption';
import { authenticateToken, AuthRequest } from '../../../middleware/auth';
import type { TwilioWebhookParams } from '../types';

const router = Router();

router.use('/voice', validateTwilioWebhook);

function normalizePhoneForLookup(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

function normalizePhoneForStorage(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

router.post('/voice/incoming', async (req: Request, res: Response) => {
  const params = req.body as TwilioWebhookParams;
  const { CallSid, From, To, Direction } = params;

  logger.info(`Incoming call: ${CallSid}`, undefined, 'BedrockPolly');
  logger.info(`From: ${From}, To: ${To}, Direction: ${Direction}`, undefined, 'BedrockPolly');

  let phoneRecordForWebhook: any = null;

  try {
    const normalizedTo = normalizePhoneForLookup(To);

    const [phoneRecord] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.phoneNumber, normalizedTo))
      .limit(1);

    phoneRecordForWebhook = phoneRecord;

    if (phoneRecord?.userId) {
      try {
        await webhookDeliveryService.triggerEvent(phoneRecord.userId, 'inbound_call.received', {
          callId: null,
          callSid: CallSid,
          direction: 'inbound',
          status: 'received',
          fromNumber: normalizePhoneForStorage(From),
          toNumber: normalizedTo,
          agentId: null,
          phoneNumberId: phoneRecord.id,
        });
      } catch (webhookError: any) {
        logger.error(`Failed to trigger inbound_call.received webhook: ${webhookError.message}`, undefined, 'BedrockPolly');
      }
    }

    if (!phoneRecord) {
      logger.info(`Phone number not found: ${normalizedTo}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured for AI calls.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    let ivrConfig = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.phoneNumberId, phoneRecord.id),
        eq(ivrConfigurations.isActive, true),
        eq(ivrConfigurations.engineType, 'bedrock-polly')
      ))
      .orderBy(desc(ivrConfigurations.updatedAt))
      .limit(1);

    if ((!ivrConfig || ivrConfig.length === 0) && phoneRecord.userId) {
      ivrConfig = await db
        .select()
        .from(ivrConfigurations)
        .where(and(
          eq(ivrConfigurations.userId, phoneRecord.userId),
          eq(ivrConfigurations.isActive, true),
          eq(ivrConfigurations.engineType, 'bedrock-polly')
        ))
        .orderBy(desc(ivrConfigurations.updatedAt))
        .limit(1);
      if (ivrConfig && ivrConfig.length > 0) {
        logger.info(`No IVR for phone ${normalizedTo} directly, using user-level Deprock IVR config: ${ivrConfig[0].name}`, undefined, 'BedrockPolly');
      }
    }

    if (ivrConfig && ivrConfig.length > 0) {
      logger.info(`Found Deprock IVR configuration for ${normalizedTo} - redirecting to IVR menu`, undefined, 'BedrockPolly');
      const baseUrl = getDomain();
      const redirectUrl = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrConfig[0].id)}&callSid=${encodeURIComponent(CallSid)}&caller=${encodeURIComponent(From)}&attempt=1`;
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${redirectUrl}</Redirect>
</Response>`);
      return;
    }

    const [connection] = await db
      .select()
      .from(incomingConnections)
      .where(eq(incomingConnections.phoneNumberId, phoneRecord.id))
      .limit(1);

    if (!connection) {
      logger.info(`No agent connection for: ${normalizedTo}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, no AI agent is available for this number.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, connection.agentId))
      .limit(1);

    if (!agent) {
      logger.info(`Agent not found: ${connection.agentId}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, the AI agent is not available.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, phoneRecord.userId || ''))
      .limit(1);

    if (!user || user.credits < 1) {
      logger.info(`Insufficient credits for user: ${phoneRecord.userId}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, there are no credits available for this call. Please top up your account.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    const callId = nanoid();

    let resumptionPrompt = '';
    let resumedFromCallId: string | null = null;
    try {
      const callerPhone = normalizePhoneForStorage(From);
      const previousCall = await conversationResumptionService.findResumableCall(callerPhone, agent.id);
      if (previousCall) {
        resumptionPrompt = conversationResumptionService.generateResumptionPrompt(previousCall);
        resumedFromCallId = previousCall.id;
        await db
          .update(calls)
          .set({ resumable: false })
          .where(eq(calls.id, previousCall.id))
          .catch(() => {});
        logger.info(`Found resumable call ${previousCall.id} for caller ${callerPhone}, marked as non-resumable`, undefined, 'BedrockPolly');
      }
    } catch (resumeErr: any) {
      logger.error(`Failed to check for resumable call: ${resumeErr.message}`, undefined, 'BedrockPolly');
    }

    const systemPromptWithResumption = resumptionPrompt
      ? `${resumptionPrompt}\n\n${agent.systemPrompt}`
      : agent.systemPrompt;

    const callMetadata: Record<string, unknown> = {
      incomingCall: true,
      agentId: agent.id,
      userId: phoneRecord.userId,
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      transferEnabled: agent.transferEnabled,
      transferPhoneNumber: agent.transferPhoneNumber,
      endConversationEnabled: agent.endConversationEnabled,
      detectLanguageEnabled: agent.detectLanguageEnabled,
      appointmentBookingEnabled: agent.appointmentBookingEnabled,
      systemPrompt: systemPromptWithResumption,
      firstMessage: agent.firstMessage,
      temperature: agent.temperature,
      language: agent.language || 'en',
      engine: 'bedrock-polly',
      behaviorConfig: agent.behaviorConfig || null,
      waitingMessages: agent.waitingMessages || null,
      dataSchema: agent.dataSchema || null,
      agentAssistConfig: (agent as any).agentAssistConfig || null,
      resumedFromCallId: resumedFromCallId,
    };

    const webhookLanguage = agent.language || 'en';
    const localizedWebhookFirst = await BedrockAgentFactory.localizeFirstMessage(
      agent.firstMessage,
      webhookLanguage
    );
    if (localizedWebhookFirst) {
      callMetadata.firstMessage = localizedWebhookFirst;
    }

    if (agent.type === 'flow' && agent.flowId) {
      logger.info(`Loading flow data for incoming call to flow agent ${agent.id}`, undefined, 'BedrockPolly');
      const [flow] = await db
        .select()
        .from(flows)
        .where(eq(flows.id, agent.flowId))
        .limit(1);

      if (flow && flow.compiledSystemPrompt && flow.compiledTools) {
        callMetadata.isFlowAgent = true;
        callMetadata.flowId = flow.id;
        callMetadata.systemPrompt = flow.compiledSystemPrompt;
        const localizedFlowFirst = await BedrockAgentFactory.localizeFirstMessage(
          flow.compiledFirstMessage || agent.firstMessage,
          webhookLanguage
        );
        callMetadata.firstMessage = localizedFlowFirst || flow.compiledFirstMessage || agent.firstMessage;
        callMetadata.compiledTools = flow.compiledTools;
        logger.info(`Stored ${(flow.compiledTools as any[]).length} compiled flow tools for incoming call`, undefined, 'BedrockPolly');
      }
    }

    await db.insert(twilioOpenaiCalls).values({
      id: callId,
      userId: phoneRecord.userId,
      agentId: agent.id,
      twilioPhoneNumberId: phoneRecord.id,
      openaiCredentialId: null,
      twilioCallSid: CallSid,
      fromNumber: normalizePhoneForStorage(From),
      toNumber: normalizedTo,
      openaiVoice: (agent.openaiVoice as any) || BEDROCK_POLLY_CONFIG.defaultVoice,
      openaiModel: BEDROCK_POLLY_CONFIG.defaultModel,
      status: 'in-progress',
      callDirection: 'inbound',
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: callMetadata,
    });

    // Start call recording (mandatory for all calls)
    try {
      const twilioClient = await getTwilioClient();
      const recordingCallback = getRecordingWebhookUrl();
      await twilioClient.calls(CallSid).recordings.create({
        recordingStatusCallback: recordingCallback,
        recordingStatusCallbackEvent: ['completed'],
        recordingChannels: 'dual',
      });
      logger.info(`Recording started for call ${callId}`, undefined, 'BedrockPolly');
    } catch (recordError: any) {
      logger.error('Failed to start recording', recordError, 'BedrockPolly');
    }

    logger.info(`Incoming call ${callId} prepared, session will be created when stream connects`, undefined, 'BedrockPolly');

    try {
      await webhookDeliveryService.triggerEvent(phoneRecord.userId!, 'call.started', {
        call: {
          id: callId,
          callSid: CallSid,
          direction: 'inbound',
          status: 'in-progress',
          startedAt: new Date().toISOString(),
          fromNumber: normalizePhoneForStorage(From),
          toNumber: normalizedTo,
        },
        agent: {
          id: agent.id,
          name: agent.name || null,
        },
        campaign: null,
      });
    } catch (webhookError: any) {
      logger.error(`Failed to trigger call.started webhook: ${webhookError.message}`, undefined, 'BedrockPolly');
    }

    try {
      await webhookDeliveryService.triggerEvent(phoneRecord.userId!, 'inbound_call.answered', {
        callId: callId,
        callSid: CallSid,
        direction: 'inbound',
        status: 'in-progress',
        fromNumber: normalizePhoneForStorage(From),
        toNumber: normalizedTo,
        agentId: agent.id,
        phoneNumberId: phoneRecord.id,
      });
    } catch (webhookError: any) {
      logger.error(`Failed to trigger inbound_call.answered webhook: ${webhookError.message}`, undefined, 'BedrockPolly');
    }

    liveCallRegistry.registerCall({
      callId,
      userId: phoneRecord.userId!,
      twilioCallSid: CallSid,
      direction: 'inbound',
      status: 'in-progress',
      fromNumber: normalizePhoneForStorage(From),
      toNumber: normalizedTo,
      agentId: agent.id,
      agentName: agent.name || undefined,
      engine: 'twilio-bedrock-polly',
      startedAt: new Date(),
      answeredAt: new Date(),
    });

    const streamUrl = getStreamWebhookUrl(CallSid);
    const twiml = generateTwiML({
      streamUrl,
      customParameters: {
        callId,
        agentId: agent.id,
      },
    });

    logger.info(`Call ${callId} connected to stream: ${streamUrl}`, undefined, 'BedrockPolly');

    res.type('text/xml');
    res.send(twiml);

  } catch (error: any) {
    logger.error('Error handling incoming call', error, 'BedrockPolly');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, an error occurred. Please try again.</Say>
  <Hangup/>
</Response>`);
  }
});

router.post('/voice/answer', async (req: Request, res: Response) => {
  const params = req.body as TwilioWebhookParams;
  const { CallSid } = params;

  logger.info(`Outbound call answered: ${CallSid}`, undefined, 'BedrockPolly');

  try {
    const [callRecord] = await db
      .select()
      .from(twilioOpenaiCalls)
      .where(eq(twilioOpenaiCalls.twilioCallSid, CallSid))
      .limit(1);

    if (!callRecord) {
      logger.info(`Call record not found for: ${CallSid}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call setup error. Goodbye.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    await db
      .update(twilioOpenaiCalls)
      .set({
        status: 'in-progress',
        answeredAt: new Date(),
      })
      .where(eq(twilioOpenaiCalls.id, callRecord.id));

    liveCallRegistry.registerCall({
      callId: callRecord.id,
      userId: callRecord.userId || '',
      twilioCallSid: CallSid,
      direction: 'outbound',
      status: 'in-progress',
      fromNumber: callRecord.fromNumber || undefined,
      toNumber: callRecord.toNumber || undefined,
      agentId: callRecord.agentId || undefined,
      campaignId: callRecord.campaignId || undefined,
      engine: 'twilio-bedrock-polly',
      startedAt: callRecord.startedAt || new Date(),
      answeredAt: new Date(),
    });

    const session = BedrockPollyAudioBridge.getSession(CallSid);
    if (!session) {
      logger.info(`No session found for: ${CallSid}`, undefined, 'BedrockPolly');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Session not found. Goodbye.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    // Start call recording for outbound calls (mandatory for all calls)
    try {
      const twilioClient = await getTwilioClient();
      const recordingCallback = getRecordingWebhookUrl();
      await twilioClient.calls(CallSid).recordings.create({
        recordingStatusCallback: recordingCallback,
        recordingStatusCallbackEvent: ['completed'],
        recordingChannels: 'dual',
      });
      logger.info(`Recording started for outbound call ${callRecord.id}`, undefined, 'BedrockPolly');
    } catch (recordError: any) {
      logger.error('Failed to start recording for outbound call', recordError, 'BedrockPolly');
    }

    const streamUrl = getStreamWebhookUrl(CallSid);
    const twiml = generateTwiML({
      streamUrl,
      customParameters: {
        callId: callRecord.id,
        agentId: callRecord.agentId || '',
      },
    });

    res.type('text/xml');
    res.send(twiml);

  } catch (error: any) {
    logger.error('Error handling answer', error, 'BedrockPolly');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred.</Say>
  <Hangup/>
</Response>`);
  }
});

router.post('/voice/status', async (req: Request, res: Response) => {
  const params = req.body as TwilioWebhookParams;
  const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingDuration } = params;

  logger.info(`Call status update: ${CallSid} -> ${CallStatus}`, undefined, 'BedrockPolly');

  try {
    const [callRecord] = await db
      .select()
      .from(twilioOpenaiCalls)
      .where(eq(twilioOpenaiCalls.twilioCallSid, CallSid))
      .limit(1);

    if (!callRecord) {
      logger.info(`Call record not found for status update: ${CallSid}`, undefined, 'BedrockPolly');
      res.sendStatus(200);
      return;
    }

    if (callRecord.userId) {
      try {
        const webhookPayload = {
          callId: callRecord.id,
          callSid: CallSid,
          direction: callRecord.callDirection || 'outbound',
          status: CallStatus,
          fromNumber: callRecord.fromNumber,
          toNumber: callRecord.toNumber,
          contactId: callRecord.contactId,
          campaignId: callRecord.campaignId,
        };

        if (CallStatus === 'ringing') {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.ringing', webhookPayload, callRecord.campaignId);
        } else if (CallStatus === 'in-progress') {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.answered', webhookPayload, callRecord.campaignId);
        } else if (CallStatus === 'no-answer') {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.no_answer', webhookPayload, callRecord.campaignId);
        } else if (CallStatus === 'busy') {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.busy', webhookPayload, callRecord.campaignId);
        }

        const AnsweredBy = (params as any).AnsweredBy;
        if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep' || AnsweredBy === 'machine_end_silence') {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.voicemail', webhookPayload, callRecord.campaignId);
        }
      } catch (webhookError: any) {
        logger.error(`Failed to trigger status webhook for call ${callRecord.id}: ${webhookError.message}`, webhookError, 'BedrockPolly');
      }
    }

    const updates: any = {
      status: CallStatus as any,
    };

    if (RecordingUrl) {
      updates.recordingUrl = RecordingUrl.endsWith('.mp3') ? RecordingUrl : `${RecordingUrl}.mp3`;
    }
    if (RecordingDuration) {
      updates.recordingDuration = parseInt(RecordingDuration, 10);
    }

    const SipResponseCode = (params as any).SipResponseCode;
    const AnsweredBy = (params as any).AnsweredBy;

    if (CallStatus === 'completed' || CallStatus === 'busy' ||
        CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
      updates.endedAt = new Date();

      let endReason = CallStatus;
      if (CallStatus === 'completed') {
        endReason = 'hangup';
      } else if (CallStatus === 'no-answer') {
        endReason = 'no-answer';
      } else if (CallStatus === 'busy') {
        endReason = 'busy';
      } else if (CallStatus === 'failed') {
        endReason = SipResponseCode ? `failed-sip-${SipResponseCode}` : 'failed';
      } else if (CallStatus === 'canceled') {
        endReason = 'canceled';
      }
      if (AnsweredBy && AnsweredBy.startsWith('machine')) {
        endReason = `voicemail-${AnsweredBy}`;
      }
      updates.metadata = sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ endReason })}::jsonb`;

      const duration = CallDuration ? parseInt(CallDuration, 10) : 0;
      if (duration > 0) {
        updates.duration = duration;
      }

      liveCallRegistry.updateCall(callRecord.id, { status: CallStatus as any });

      await BedrockPollyAudioBridge.endSession(CallSid);

      if (callRecord.userId && (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer')) {
        try {
          await webhookDeliveryService.triggerEvent(callRecord.userId, 'call.completed', {
            call: {
              id: callRecord.id,
              callSid: CallSid,
              direction: callRecord.callDirection || 'outbound',
              status: CallStatus,
              duration: duration,
              startedAt: callRecord.startedAt?.toISOString() || null,
              endedAt: new Date().toISOString(),
              fromNumber: callRecord.fromNumber || null,
              toNumber: callRecord.toNumber || null,
              transcript: updates.transcript || null,
              recordingUrl: updates.recordingUrl || callRecord.recordingUrl || null,
            },
            agent: callRecord.agentId ? { id: callRecord.agentId } : null,
            campaign: callRecord.campaignId ? { id: callRecord.campaignId } : null,
          });
        } catch (webhookError: any) {
          logger.error(`Failed to trigger call.completed webhook: ${webhookError.message}`, undefined, 'BedrockPolly');
        }
      }

      if (callRecord.userId && callRecord.callDirection === 'inbound') {
        try {
          const inboundPayload = {
            callId: callRecord.id,
            callSid: CallSid,
            direction: 'inbound',
            status: CallStatus,
            fromNumber: callRecord.fromNumber,
            toNumber: callRecord.toNumber,
            agentId: callRecord.agentId,
            phoneNumberId: callRecord.twilioPhoneNumberId,
            duration: duration,
          };

          if (CallStatus === 'completed') {
            await webhookDeliveryService.triggerEvent(callRecord.userId, 'inbound_call.completed', inboundPayload);
          } else if (CallStatus === 'no-answer' || CallStatus === 'canceled') {
            await webhookDeliveryService.triggerEvent(callRecord.userId, 'inbound_call.missed', inboundPayload);
          }
        } catch (webhookError: any) {
          logger.error(`Failed to trigger inbound call webhook: ${webhookError.message}`, undefined, 'BedrockPolly');
        }
      }

      if (callRecord.userId && callRecord.agentId) {
        try {
          const [agentRecord] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, callRecord.agentId))
            .limit(1);

          if (agentRecord && agentRecord.type === 'flow' && agentRecord.flowId) {
            const [flow] = await db
              .select()
              .from(flows)
              .where(eq(flows.id, agentRecord.flowId))
              .limit(1);

            const flowPayload = {
              flowId: agentRecord.flowId,
              flowName: flow?.name || 'Unknown Flow',
              callId: callRecord.id,
              callSid: CallSid,
              agentId: agentRecord.id,
              userId: callRecord.userId,
              duration: duration,
            };

            if (CallStatus === 'completed') {
              await webhookDeliveryService.triggerEvent(callRecord.userId, 'flow.completed', {
                ...flowPayload,
                nodesExecuted: flow?.nodes ? (flow.nodes as any[]).length : 0,
              });
            } else if (CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
              await webhookDeliveryService.triggerEvent(callRecord.userId, 'flow.failed', {
                ...flowPayload,
                error: {
                  code: 'CALL_ENDED',
                  message: `Call ended with status: ${CallStatus}`,
                },
              });
            }
          }
        } catch (flowWebhookError: any) {
          logger.error(`Failed to trigger flow webhook: ${flowWebhookError.message}`, undefined, 'BedrockPolly');
        }
      }

      if (callRecord.userId && CallStatus === 'completed' && callRecord.callDirection === 'outbound') {
        try {
          const { CRMLeadProcessor } = await import('../../crm/lead-processor.service');
          const result = await CRMLeadProcessor.processTwilioOpenAICall(callRecord.id);
          if (result?.leadId) {
            logger.info(`CRM lead created from outbound call: ${result.leadId}`, undefined, 'BedrockPolly');
          }
        } catch (crmError: any) {
          logger.error(`Failed to create CRM lead: ${crmError.message}`, crmError, 'BedrockPolly');
        }
      }
    }

    await db
      .update(twilioOpenaiCalls)
      .set(updates)
      .where(eq(twilioOpenaiCalls.id, callRecord.id));

    res.sendStatus(200);

  } catch (error: any) {
    logger.error('Error handling status', error, 'BedrockPolly');
    res.sendStatus(200);
  }
});

router.post('/voice/recording', async (req: Request, res: Response) => {
  const { CallSid, RecordingUrl, RecordingSid, RecordingDuration, RecordingStatus } = req.body;

  logger.info(`Recording status: ${RecordingSid} for call ${CallSid} -> ${RecordingStatus}`, undefined, 'BedrockPolly');

  try {
    if (RecordingStatus !== 'completed') {
      res.sendStatus(200);
      return;
    }

    const [callRecord] = await db
      .select()
      .from(twilioOpenaiCalls)
      .where(eq(twilioOpenaiCalls.twilioCallSid, CallSid))
      .limit(1);

    if (!callRecord) {
      logger.info(`Call record not found for recording: ${CallSid}`, undefined, 'BedrockPolly');
      res.sendStatus(200);
      return;
    }

    const recordingUrlWithFormat = RecordingUrl ? `${RecordingUrl}.mp3` : null;

    await db
      .update(twilioOpenaiCalls)
      .set({
        recordingUrl: recordingUrlWithFormat,
        recordingDuration: RecordingDuration ? parseInt(RecordingDuration, 10) : null,
      })
      .where(eq(twilioOpenaiCalls.id, callRecord.id));

    logger.info(`Recording saved for call ${callRecord.id}: ${recordingUrlWithFormat}`, undefined, 'BedrockPolly');

    res.sendStatus(200);

  } catch (error: any) {
    logger.error('Error handling recording status', error, 'BedrockPolly');
    res.sendStatus(200);
  }
});

router.post('/test-call', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const { agentId, toNumber, fromNumberId } = req.body;

    if (!agentId || !toNumber || !fromNumberId) {
      return res.status(400).json({ error: 'agentId, toNumber, and fromNumberId are required' });
    }

    const userId = (req as AuthRequest).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await BedrockPollyCallService.initiateCall({
      userId,
      agentId,
      toNumber,
      fromNumberId,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      callId: result.callId,
      twilioCallSid: result.twilioCallSid,
    });
  } catch (error: any) {
    logger.error('Error initiating test call', error, 'BedrockPolly');
    res.status(500).json({ error: error.message || 'Failed to initiate call' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    res.json({
      bedrockConfigured: awsBedrockService.isConfigured(),
      pollyConfigured: awsPollyService.isConfigured(),
      activeSessions: BedrockPollyAudioBridge.getActiveSessionCount(),
      availableModels: awsBedrockService.listModels(),
      availableVoices: POLLY_VOICES.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get status' });
  }
});

router.get('/voices', (_req: Request, res: Response) => {
  res.json(POLLY_VOICES);
});

router.get('/voice-preview/:voiceId', async (req: Request, res: Response) => {
  try {
    const { voiceId } = req.params;
    const voice = POLLY_VOICES.find(v => v.id === voiceId);
    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    const PREVIEW_TEXTS: Record<string, string> = {
      'en-US': "Hi there! I'm your AI assistant. How can I help you today?",
      'en-GB': "Hello! I'm your AI assistant. How may I help you today?",
      'en-AU': "G'day! I'm your AI assistant. How can I help you today?",
      'en-NZ': "Hello there! I'm your AI assistant. How can I help?",
      'en-IE': "Hello! I'm your AI assistant. How can I help you today?",
      'en-ZA': "Hello! I'm your AI assistant. How can I help you today?",
      'fr-FR': "Bonjour ! Je suis votre assistant. Comment puis-je vous aider ?",
      'fr-CA': "Bonjour ! Je suis votre assistant. Comment puis-je vous aider ?",
      'es-US': "¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?",
      'es-ES': "¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?",
      'es-MX': "¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?",
      'de-DE': "Hallo! Ich bin Ihr Assistent. Wie kann ich Ihnen helfen?",
      'de-AT': "Hallo! Ich bin Ihr Assistent. Wie kann ich Ihnen helfen?",
      'it-IT': "Ciao! Sono il tuo assistente. Come posso aiutarti oggi?",
      'hi-IN': "नमस्ते! मैं आपका सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",
      'cmn-CN': "你好！我是你的助手。今天我能帮你什么？",
      'yue-CN': "你好！我係你嘅助手。今日有咩可以幫到你？",
      'ar-AE': "مرحباً! أنا مساعدك. كيف يمكنني مساعدتك اليوم؟",
      'ja-JP': "こんにちは！AIアシスタントです。本日はどのようなご用件でしょうか？",
      'ko-KR': "안녕하세요! AI 어시스턴트입니다. 무엇을 도와드릴까요?",
      'pt-BR': "Olá! Sou seu assistente. Como posso ajudá-lo hoje?",
      'pt-PT': "Olá! Sou o seu assistente. Como posso ajudá-lo hoje?",
      'nl-NL': "Hallo! Ik ben uw assistent. Hoe kan ik u helpen?",
      'nl-BE': "Hallo! Ik ben uw assistent. Hoe kan ik u helpen?",
      'pl-PL': "Cześć! Jestem twoim asystentem. Jak mogę ci pomóc?",
      'fi-FI': "Hei! Olen avustajasi. Kuinka voin auttaa sinua tänään?",
      'nb-NO': "Hei! Jeg er din assistent. Hvordan kan jeg hjelpe deg?",
      'sv-SE': "Hej! Jag är din assistent. Hur kan jag hjälpa dig?",
      'da-DK': "Hej! Jeg er din assistent. Hvordan kan jeg hjælpe dig?",
      'tr-TR': "Merhaba! Ben sizin asistanınızım. Size nasıl yardımcı olabilirim?",
    };

    const previewText = PREVIEW_TEXTS[voice.language] || PREVIEW_TEXTS['en-US'];

    const result = await awsPollyService.synthesizeSpeech({
      text: previewText,
      voiceId: voice.id,
      engine: 'neural',
      outputFormat: 'mp3',
      sampleRate: '22050',
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': result.audioStream.length.toString(),
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(result.audioStream);
  } catch (error: any) {
    console.error(`[VoicePreview] Failed for ${req.params.voiceId}:`, error.message);
    try {
      const voice = POLLY_VOICES.find(v => v.id === req.params.voiceId);
      const result = await awsPollyService.synthesizeSpeech({
        text: "Hi there! I'm your AI assistant.",
        voiceId: req.params.voiceId,
        engine: 'standard',
        outputFormat: 'mp3',
        sampleRate: '22050',
      });
      res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': result.audioStream.length.toString() });
      res.send(result.audioStream);
    } catch (fallbackErr: any) {
      res.status(500).json({ error: 'Failed to generate voice preview' });
    }
  }
});

router.get('/models', (_req: Request, res: Response) => {
  res.json(awsBedrockService.listModels());
});

router.post('/ai-test-call', authenticateToken as any, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { agentId, turns = 10 } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  const maxTurns = Math.min(Math.max(turns, 3), 20);

  try {
    const [agent] = await db.execute(sql`SELECT id, name, language, system_prompt, first_message, knowledge_base_ids, knowledge_base_only, temperature FROM agents WHERE id = ${agentId} AND user_id = ${userId}`).then(r => r.rows as any[]);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const callId = nanoid(21);
    const callSid = `AITEST_${nanoid(12)}`;

    await db.insert(twilioOpenaiCalls).values({
      id: callId,
      userId,
      agentId,
      twilioCallSid: callSid,
      fromNumber: '+AI-TESTER',
      toNumber: '+AI-AGENT',
      openaiVoice: 'none',
      openaiModel: 'claude-sonnet-4-6',
      status: 'in-progress',
      callDirection: 'inbound',
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: { testCall: true, aiToAi: true, requestedTurns: maxTurns },
    });

    res.json({ success: true, callId, callSid, message: `AI test call started with ${maxTurns} turns` });

    const { runAiTestCall } = await import('../../../services/ai-test-call.service');
    runAiTestCall(callId, agent, maxTurns).catch(err => {
      console.error(`[AI Test Call] Background error: ${err.message}`);
    });

  } catch (error: any) {
    logger.error('Error starting AI test call', error, 'BedrockPolly');
    res.status(500).json({ error: error.message || 'Failed to start AI test call' });
  }
});

router.get('/ai-test-call/:callId', authenticateToken as any, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [call] = await db.execute(sql`SELECT id, status, duration, transcript, ai_summary, metadata FROM twilio_openai_calls WHERE id = ${req.params.callId} AND user_id = ${userId}`).then(r => r.rows as any[]);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    res.json(call);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-bedrock', async (_req: Request, res: Response) => {
  try {
    const result = await awsBedrockService.testCredentials();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to test Bedrock' });
  }
});

router.post('/test-polly', async (_req: Request, res: Response) => {
  try {
    const result = await awsPollyService.testCredentials();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to test Polly' });
  }
});

export default router;
