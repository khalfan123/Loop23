'use strict';
/**
 * ============================================================
 * Twilio-OpenAI Audio Bridge Service
 * 
 * Bridges audio between Twilio Media Streams and OpenAI Realtime API.
 * - Receives mulaw 8kHz audio from Twilio WebSocket
 * - Sends directly to OpenAI (supports g711_ulaw format)
 * - Sends OpenAI audio response back to Twilio
 * - Handles tool calls, transcripts, and interruptions
 * - Executes actual Twilio transfers and hangups via REST API
 * ============================================================
 */

import WebSocket from 'ws';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { 
  AgentConfig, 
  AgentTool, 
  AudioBridgeSession, 
  CreateSessionParams,
  TwilioMediaStreamEvent
} from '../types';
import { getTwilioClient } from '../../../services/twilio-connector';
import { generateTransferTwiML, generateHangupTwiML } from '../config/twilio-openai-config';
import { resolveHumanAgentBridgeCallerId } from '../../../utils/phone-e164';
import { openaiPoolManager } from '../../../infrastructure';
import { db } from '../../../db';
import { twilioOpenaiCalls, agents, calls, incomingConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { OpenAIAgentFactory } from './openai-agent-factory';
import { OpenAIPoolService } from '../../../services/openai-pool.service';
import { conversationResumptionService } from '../../../services/conversation-resumption';
import { RealtimeSentimentService } from '../../../services/realtime-sentiment.service';
import { liveCallRegistry } from '../../../services/live-call-registry';
import { NotificationService } from '../../../services/notification-service';
import { ConversationMemoryService } from '../../../services/conversation-memory';
import { callErrorLogger } from '../../../services/call-error-logger';

const execAsync = promisify(exec);
const fsWriteFile = promisify(fs.writeFile);
const fsUnlink = promisify(fs.unlink);
const fsReadFile = promisify(fs.readFile);

const SPEECH_GUARDRAIL_PATTERNS = [
  /\baccording to (our|the) (knowledge base|records|policy|policies)\b/i,
  /\bas per (our|the) (policy|policies|knowledge base)\b/i,
  /\bhere are the (steps|bullet points|points|items)\b/i,
  /\bfirst[,:\s].*second[,:\s].*third[,:\s]/i,
  /\bhttps?:\/\//i,
  /\bwww\./i,
  /[`*_#>-]/,
];

const KB_LOW_CONFIDENCE_ESCALATION_HINT =
  'Runtime policy: The latest knowledge lookup confidence is low. Do not provide a definitive policy/factual answer in this turn. Ask one concise clarifying question or offer transfer/escalation.';

const UNRESOLVED_LOOP_ESCALATION_HINT =
  'Runtime policy: We have had repeated unresolved turns. Prioritize resolution now: offer transfer to a specialist or present one concrete escalation next step in <=2 short sentences.';
const UNRESOLVED_LOOP_ESCALATION_THRESHOLD = 3;

// Observability helpers (callSid-scoped; avoids FK dependencies).
const firstAudioAtByResponse: Map<string, Map<string, number>> = new Map(); // callSid -> (responseId -> epoch ms)

const EXPLICIT_HUMAN_REQUEST_PATTERNS: RegExp[] = [
  // English
  /\b(human|real person|someone real|representative|agent|operator)\b/i,
  /\b(talk|speak) to (a )?(human|person|agent|representative)\b/i,
  /\btransfer me\b/i,
  // Arabic (broad)
  /موظف/i,
  /بشر/i,
  /ممثل/i,
  /خدمة العملاء/i,
  /حوّلني/i,
  /حولني/i,
];

function callerExplicitlyRequestedHuman(session: AudioBridgeSession): boolean {
  const lastUser = [...session.transcriptParts].reverse().find((p) => p.role === 'user')?.text || '';
  if (!lastUser) return false;
  return EXPLICIT_HUMAN_REQUEST_PATTERNS.some((re) => re.test(lastUser));
}

function clamp16(x: number): number {
  return Math.max(-32768, Math.min(32767, x | 0));
}

// µ-law encoding for 16-bit PCM -> 8-bit G.711 μ-law.
function linear16ToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let s = clamp16(sample);
  const sign = (s < 0) ? 0x80 : 0x00;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s = s + BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (s & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    // loop
  }
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function buildRingbackMulawFrame(frameIndex: number): Buffer {
  // 20ms @ 8kHz = 160 samples.
  const sampleRate = 8000;
  const samples = 160;
  const t0 = (frameIndex * samples) / sampleRate;

  // Ringback: 2s on / 2s off, dual-tone (440Hz + 480Hz).
  const cadenceSec = 4;
  const onSec = 2;
  const phaseInCadence = t0 % cadenceSec;
  const isOn = phaseInCadence < onSec;

  const out = Buffer.allocUnsafe(samples);
  if (!isOn) {
    out.fill(0xff); // μ-law silence
    return out;
  }

  const f1 = 440;
  const f2 = 480;
  const amp = 7000; // conservative amplitude
  for (let i = 0; i < samples; i++) {
    const t = t0 + (i / sampleRate);
    const v = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.5;
    out[i] = linear16ToMulaw(v * amp);
  }
  return out;
}

export class TwilioOpenAIAudioBridge {
  private static activeSessions: Map<string, AudioBridgeSession> = new Map();
  private static readonly OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
  private static credentialByCallSid: Map<string, string> = new Map();
  private static readonly BARGE_IN_CANCEL_COOLDOWN_MS = 350;
  private static readonly ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
  private static readonly CJK_CHAR_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

  static async createSession(params: CreateSessionParams): Promise<AudioBridgeSession> {
    const { callSid, openaiApiKey, agentConfig, twilioWs, streamSid, fromNumber, toNumber, callDirection, humanWizardCli } = params;
    
    console.log(`[TwilioOpenAI Bridge] Creating session for call ${callSid} (direction: ${callDirection || 'unknown'})`);
    console.log(`[TwilioOpenAI Bridge] Voice: ${agentConfig.voice}, Model: ${agentConfig.model}`);

    const session: AudioBridgeSession = {
      callSid,
      streamSid: streamSid || null,
      openaiSessionId: '',
      status: 'connecting',
      startedAt: new Date(),
      endedAt: null,
      openaiWs: null,
      twilioWs: twilioWs || null,
      agentConfig,
      transcriptParts: [],
      toolHandlers: new Map(),
      processedToolCallIds: new Set(),
      onTranscriptCallback: null,
      onToolCallback: null,
      onAudioCallback: null,
      onEndCallback: null,
      endCallbackFired: false,
      firstMessageSent: false,
      twilioStreamReady: false,
      lastUserSpeechTime: Date.now(),
      isResponseActive: false,
      fromNumber,
      toNumber,
      callDirection,
      humanWizardCli,
      pendingAudioQueue: [],
      softTimeoutId: null,
      hardTimeoutId: null,
      behaviorConfig: null,
      waitingMessages: null,
      explicitEndCall: false,
      pendingClearTimerId: null,
      sentimentMode: 'neutral',
      lastBargeInCancelAt: 0,
      activeResponseId: null,
      suppressResponseOutputUntilDone: false,
      suppressedResponseId: null,
      runtimeInstructionBase: '',
      lastSyncedSentimentMode: null,
      speechGuardrailStrikes: 0,
      kbLowConfidenceGateActive: false,
      unresolvedIntentStreak: 0,
      escalationCheckpointArmed: false,
      ivrRouted: false,
      ringbackIntervalId: null,
      ringbackStartedAtMs: null,
      ringbackFrameIndex: 0,
    };

    try {
      const [agentRecord] = await db
        .select({
          behaviorConfig: agents.behaviorConfig,
          waitingMessages: agents.waitingMessages,
          userId: twilioOpenaiCalls.userId,
          metadata: twilioOpenaiCalls.metadata,
        })
        .from(twilioOpenaiCalls)
        .innerJoin(agents, eq(agents.id, twilioOpenaiCalls.agentId))
        .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
        .limit(1);

      if (agentRecord) {
        session.behaviorConfig = agentRecord.behaviorConfig as any || null;
        session.waitingMessages = agentRecord.waitingMessages || null;
        session.userId = agentRecord.userId || undefined;
        const meta = (agentRecord.metadata as Record<string, unknown> | null) || null;
        session.ivrRouted = meta?.ivrRouted === true;
        console.log(`[TwilioOpenAI Bridge] Loaded behavior config for ${callSid}: softTimeout=${session.behaviorConfig?.softTimeoutSec ?? 4}s, hardTimeout=${session.behaviorConfig?.hardTimeoutSec ?? 15}s`);
      }
    } catch (err: any) {
      console.log(`[TwilioOpenAI Bridge] Could not load behavior config for ${callSid}: ${err.message}`);
    }

    if (callDirection === 'inbound' && fromNumber) {
      try {
        const [callRecord] = await db
          .select({ agentId: twilioOpenaiCalls.agentId, userId: twilioOpenaiCalls.userId })
          .from(twilioOpenaiCalls)
          .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
          .limit(1);

        if (callRecord?.agentId) {
          session.userId = session.userId || callRecord.userId || undefined;
          const previousCall = await conversationResumptionService.findResumableCall(fromNumber, callRecord.agentId);
          if (previousCall) {
            const resumptionPrompt = conversationResumptionService.generateResumptionPrompt(previousCall);
            if (resumptionPrompt) {
              agentConfig.systemPrompt = resumptionPrompt + '\n\n' + agentConfig.systemPrompt;
              console.log(`[TwilioOpenAI Bridge] Prepended resumption context from call ${previousCall.id} for ${callSid}`);

              const [currentCallRecord] = await db
                .select({ id: calls.id })
                .from(calls)
                .where(eq(calls.twilioSid, callSid))
                .limit(1);

              if (currentCallRecord) {
                await conversationResumptionService.markCallResumed(currentCallRecord.id, previousCall.id);
              }
            }
          }
        }
      } catch (err: any) {
        console.log(`[TwilioOpenAI Bridge] Could not check for resumable calls: ${err.message}`);
      }
    }

    try {
      const callerPhoneNumber = callDirection === 'outbound' ? toNumber : fromNumber;
      if (session.userId && callerPhoneNumber) {
        const withMemory = await OpenAIAgentFactory.injectCallerMemoryContext(agentConfig as any, {
          userId: session.userId,
          callerPhoneNumber,
        });
        session.agentConfig = withMemory;
        agentConfig.systemPrompt = withMemory.systemPrompt;
      }
    } catch (memoryErr: any) {
      console.log(`[TwilioOpenAI Bridge] Caller memory injection skipped for ${callSid}: ${memoryErr.message}`);
    }

    if (agentConfig.tools) {
      for (const tool of agentConfig.tools) {
        session.toolHandlers.set(tool.name, tool.handler);
      }
    }

    this.activeSessions.set(callSid, session);

    // Ensure pool manager settings are loaded
    if (!openaiPoolManager.isSettingsLoaded()) {
      await openaiPoolManager.loadSettings();
    }

    // Check if we can reserve a slot in the OpenAI pool
    const credentialId = params.credentialId || 'twilio-openai-default';
    if (!openaiPoolManager.canReserveSlot(credentialId)) {
      console.log(`[TwilioOpenAI Bridge] OpenAI pool limit reached for credential ${credentialId}`);
      throw new Error('OpenAI connection limit reached. Please try again later.');
    }
    this.credentialByCallSid.set(callSid, credentialId);

    try {
      await this.connectToOpenAI(session, openaiApiKey);
      return session;
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Failed to create session:`, error.message);
      session.status = 'error';
      this.credentialByCallSid.delete(callSid);
      throw error;
    }
  }

  private static async connectToOpenAI(session: AudioBridgeSession, apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { agentConfig, callSid } = session;
      
      const wsUrl = `${this.OPENAI_REALTIME_URL}?model=${agentConfig.model}`;
      
      console.log(`[TwilioOpenAI Bridge] Connecting to OpenAI: ${agentConfig.model}`);
      
      // GA Realtime API (beta header retired 2026-05-12; sending it closes with beta_api_shape_disabled)
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      session.openaiWs = ws;

      const connectionTimeoutId = setTimeout(() => {
        if (session.status === 'connecting') {
          this.activeSessions.delete(callSid);
          reject(new Error('OpenAI connection timeout'));
        }
      }, 15000);

      ws.on('open', () => {
        clearTimeout(connectionTimeoutId);
        console.log(`[TwilioOpenAI Bridge] OpenAI connected for ${callSid}`);
        session.status = 'connected';
        const credentialId = this.credentialByCallSid.get(callSid) || 'twilio-openai-default';
        
        // Register connection with the pool manager
        openaiPoolManager.addConnection(
          session.callSid,
          ws,
          '',  // sessionId will be updated later
          credentialId
        );
        
        this.configureSession(session);
        resolve();
      });

      ws.on('message', (data) => {
        this.handleOpenAIMessage(session, data.toString());
        openaiPoolManager.updateActivity(session.callSid);
      });

      ws.on('error', (error) => {
        clearTimeout(connectionTimeoutId);
        console.error(`[TwilioOpenAI Bridge] OpenAI error for ${callSid}:`, error);
        session.status = 'error';
        openaiPoolManager.removeConnection(session.callSid);
        this.credentialByCallSid.delete(callSid);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`[TwilioOpenAI Bridge] OpenAI closed for ${callSid}: ${code} ${reason}`);
        session.status = 'disconnected';
        openaiPoolManager.removeConnection(session.callSid);
        this.credentialByCallSid.delete(callSid);
        this.fireEndCallback(session);
      });
    });
  }

  private static configureSession(session: AudioBridgeSession): void {
    const { agentConfig, openaiWs } = session;
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;

    const tools: any[] = [];
    if (agentConfig.tools) {
      for (const tool of agentConfig.tools) {
        tools.push({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }

    // VAD configuration with semantic VAD support
    // Improved defaults for better call quality - less aggressive interruption
    // Apply behaviorConfig overrides from agent settings (Microsoft Call Center AI-inspired)
    const behaviorCfg = session.behaviorConfig || {};
    const vadSettings = agentConfig.vadSettings || {};
    const vadType = vadSettings.type ?? 'semantic_vad';
    const vadThreshold = behaviorCfg.vadThreshold ?? vadSettings.threshold ?? 0.8;
    const vadPrefixPaddingMs = vadSettings.prefixPaddingMs ?? 500;
    const vadSilenceDurationMs = behaviorCfg.vadSilenceTimeoutMs ?? vadSettings.silenceDurationMs ?? 1000;
    const vadEagerness = vadSettings.eagerness ?? 'low';

    console.log(`[TwilioOpenAI Bridge] VAD settings: type=${vadType}, threshold=${vadThreshold}, prefix=${vadPrefixPaddingMs}ms, silence=${vadSilenceDurationMs}ms`);

    const turnDetection = vadType === 'semantic_vad'
      ? {
          type: 'semantic_vad',
          eagerness: vadEagerness,
          create_response: true,
          interrupt_response: true,
        }
      : {
          type: 'server_vad',
          threshold: vadThreshold,
          prefix_padding_ms: vadPrefixPaddingMs,
          silence_duration_ms: vadSilenceDurationMs,
        };

    // Apply behavior config rules to system prompt (Microsoft Call Center AI-inspired)
    let behaviorPromptAdditions = '';
    if (behaviorCfg.maxQuestionsPerTurn) {
      behaviorPromptAdditions += `\n- Ask a MAXIMUM of ${behaviorCfg.maxQuestionsPerTurn} questions at a time. Never overwhelm the caller.`;
    }
    if (behaviorCfg.useDiscourseMarkers !== false) {
      behaviorPromptAdditions += `\n- Use natural discourse markers and fillers to sound human-like (e.g., "I see...", "Well, let me think...", "So, what I can do for you is...", "That makes sense...", "Right, let me help you with that...")`;
    }
    if (behaviorCfg.silenceTimeoutSec) {
      behaviorPromptAdditions += `\n- If the caller is silent for a while, gently prompt them: "Are you still there?" or "Take your time, I'm here when you're ready."`;
    }

    const hasSubmitForm = tools.some((t) => t.name === 'submit_form' || t.name.startsWith('submit_form'));
    const hasSubmitDynamicForm = tools.some((t) => t.name === 'submit_dynamic_form');

    const formSubmissionToolInstruction = hasSubmitForm
      ? 'After collecting all form information from the user, you MUST call the submit_form function with the collected data.'
      : hasSubmitDynamicForm
        ? 'After collecting all form information from the user, you MUST call the submit_dynamic_form function with the collected data (use formId when available; otherwise omit it to create an ad-hoc form).'
        : 'If you need to save structured information, first check which tools are available. If no form submission tool is available, do not claim you saved anything — instead ask for a callback/transfer to a specialist.';

    // Append mandatory function calling requirements to system prompt
    const functionCallingRequirements = `

CONVERSATION STYLE:
- Keep responses phone-friendly and concise: 1-3 sentences by default.
- If the caller requests more detail, provide it in small chunks instead of long monologues.
- If something is unclear, ask ONE specific clarifying question.
- Do NOT start every response with acknowledgments like "yes", "okay", "sure", "right" — just answer naturally.
- Never read URLs, markdown, or bullet lists aloud. Rephrase into natural spoken language.
- If information is uncertain or missing, clearly say you cannot confirm and offer escalation.
- CRITICAL: After delivering your greeting, you MUST wait for the user to actually speak before responding. Do NOT assume the user has said something if you have not clearly heard their words. If there is silence or unclear noise, do NOT fabricate or guess what the user said — instead, wait patiently or say something brief like "Hello, are you there?" Do NOT respond as if the user said something negative (e.g., "I understand you don't have...") unless you clearly heard them say that.

IMPORTANT FUNCTION CALLING REQUIREMENTS:
1. ${formSubmissionToolInstruction} Do NOT just say "I have recorded your information" — you MUST actually call the correct function to save the data.
2. After completing the main task (like form submission), say a friendly closing message and ask if there's anything else. Wait for the user to respond.
3. Only call the end_call function AFTER the user confirms they are done or says goodbye. Do not hang up immediately after completing a task - give the user a chance to respond.
4. When the user says goodbye or confirms they are done, THEN call the end_call function to disconnect.
5. These function calls are MANDATORY. Data will NOT be saved unless you call the functions.`;

    const backgroundNoiseInstruction = `\n\nBACKGROUND NOISE HANDLING:\n- If you hear what seems like background conversation not directed at you, ignore it and wait for the caller to address you directly.\n- Do NOT respond to ambient noise, TV audio, or other people talking nearby.\n- Only respond when you are confident the caller is speaking directly to you.\n- If a voice fingerprint rejection is noted in the conversation, it means background speech from a different speaker was detected and filtered — do not address it.`;

    session.runtimeInstructionBase = agentConfig.systemPrompt + behaviorPromptAdditions + backgroundNoiseInstruction + functionCallingRequirements;

    const enhancedInstructions = this.buildEmotionAdaptiveInstruction(
      session,
      session.runtimeInstructionBase
    );

    const sessionConfig = {
      type: 'session.update',
      session: this.buildGaRealtimeSession({
        instructions: enhancedInstructions,
        voice: agentConfig.voice,
        language: agentConfig.language,
        turnDetection,
        tools,
      }),
    };

    console.log(`[TwilioOpenAI Bridge] Configuring session with ${tools.length} tools (GA Realtime)`);
    if (tools.length > 0) {
      console.log(`[TwilioOpenAI Bridge] Tools configured:`, tools.map(t => t.name).join(', '));
    }
    openaiWs.send(JSON.stringify(sessionConfig));

    // First message is now sent when Twilio stream starts (see handleTwilioMedia 'start' event)
    // This ensures the audio is not lost before the stream is ready
    if (agentConfig.firstMessage) {
      console.log(`[TwilioOpenAI Bridge] First message configured, will send when Twilio stream starts for ${session.callSid}`);
    }
  }

  private static trySendFirstMessage(session: AudioBridgeSession): void {
    if (session.firstMessageSent) return;
    if (!session.twilioStreamReady) return;
    if (session.status !== 'connected') return;
    if (!session.agentConfig.firstMessage) return;

    session.firstMessageSent = true;
    console.log(`[TwilioOpenAI Bridge] Twilio stream ready, sending first message for ${session.callSid}`);
    this.sendAgentMessage(session, session.agentConfig.firstMessage);
  }

  private static updateSentimentMode(session: AudioBridgeSession): void {
    const current = RealtimeSentimentService.getCurrentLevel(session.callSid);
    if (current === 'critical' || current === 'negative') {
      session.sentimentMode = 'deescalate';
      return;
    }
    if (current === 'cautious') {
      session.sentimentMode = 'cautious';
      return;
    }
    session.sentimentMode = 'neutral';
  }

  private static async refreshSentimentModeAndSync(session: AudioBridgeSession): Promise<void> {
    const previous = session.sentimentMode;
    this.updateSentimentMode(session);
    if (previous !== session.sentimentMode) {
      await this.syncRealtimeSentimentInstructions(session);
    }
  }

  private static async syncRealtimeSentimentInstructions(session: AudioBridgeSession): Promise<void> {
    if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) return;

    const tone = session.sentimentMode;

    const agentConfig = session.agentConfig;
    const behaviorCfg = session.behaviorConfig || {};
    const vadSettings = agentConfig.vadSettings || {};
    const vadType = vadSettings.type ?? 'semantic_vad';
    const vadThreshold = behaviorCfg.vadThreshold ?? vadSettings.threshold ?? 0.8;
    const vadPrefixPaddingMs = vadSettings.prefixPaddingMs ?? 500;
    const vadSilenceDurationMs = behaviorCfg.vadSilenceTimeoutMs ?? vadSettings.silenceDurationMs ?? 1000;
    const vadEagerness = vadSettings.eagerness ?? 'low';

    const turnDetection = vadType === 'semantic_vad'
      ? {
          type: 'semantic_vad',
          eagerness: vadEagerness,
          create_response: true,
          interrupt_response: true,
        }
      : {
          type: 'server_vad',
          threshold: vadThreshold,
          prefix_padding_ms: vadPrefixPaddingMs,
          silence_duration_ms: vadSilenceDurationMs,
        };

    const tools: any[] = [];
    if (agentConfig.tools) {
      for (const tool of agentConfig.tools) {
        tools.push({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }

    const instructions = this.buildEmotionAdaptiveInstruction(session, session.runtimeInstructionBase || agentConfig.systemPrompt);
    session.openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: this.buildGaRealtimeSession({
        instructions,
        voice: agentConfig.voice,
        language: agentConfig.language,
        turnDetection,
        tools,
      }),
    }));
    session.lastSyncedSentimentMode = tone;
  }

  /**
   * Build GA Realtime session.update payload (beta flat shape retired 2026-05-12).
   * Twilio Media Streams use G.711 µ-law (audio/pcmu).
   */
  private static buildGaRealtimeSession(opts: {
    instructions: string;
    voice: string;
    language?: string;
    turnDetection: Record<string, unknown>;
    tools: unknown[];
  }): Record<string, unknown> {
    const lang = opts.language ? String(opts.language).slice(0, 2).toLowerCase() : undefined;
    return {
      type: 'realtime',
      instructions: opts.instructions,
      output_modalities: ['audio'],
      tools: opts.tools,
      tool_choice: opts.tools.length > 0 ? 'auto' : 'none',
      audio: {
        input: {
          format: { type: 'audio/pcmu' },
          turn_detection: opts.turnDetection,
          transcription: {
            model: 'whisper-1',
            ...(lang ? { language: lang } : {}),
          },
        },
        output: {
          format: { type: 'audio/pcmu' },
          voice: opts.voice,
        },
      },
    };
  }

  private static shouldThrottleBargeInCancel(session: AudioBridgeSession): boolean {
    const now = Date.now();
    const last = session.lastBargeInCancelAt || 0;
    if (now - last < this.BARGE_IN_CANCEL_COOLDOWN_MS) {
      return true;
    }
    session.lastBargeInCancelAt = now;
    return false;
  }

  private static buildEmotionAdaptiveInstruction(session: AudioBridgeSession, base: string): string {
    let instruction = base;

    if (session.sentimentMode === 'deescalate') {
      instruction = `${instruction}\n\nTone mode: caller may be upset. Lead with a brief empathy line, keep sentences short, avoid promotional language, and move directly to resolution options.`;
    }
    if (session.sentimentMode === 'cautious') {
      instruction = `${instruction}\n\nTone mode: caller may be uncertain. Use a calm, reassuring tone and confirm one concrete next step.`;
    }

    if (session.speechGuardrailStrikes > 0) {
      const strictness = session.speechGuardrailStrikes >= 2 ? 'strict' : 'normal';
      instruction = `${instruction}\n\nPhone speech guardrails (${strictness}):
- Use spoken conversational phrasing only.
- Do NOT say "according to policy/records/knowledge base" and do NOT read URLs or markdown.
- Keep answers to 1-3 short sentences unless explicitly asked for detail.
- If confidence is low, say you cannot confirm and offer a safe next step or escalation.`;
    }
    if (session.kbLowConfidenceGateActive) {
      instruction = `${instruction}\n\n${KB_LOW_CONFIDENCE_ESCALATION_HINT}`;
    }
    if (session.escalationCheckpointArmed) {
      const transferHint = this.hasEscalationTool(session)
        ? 'If caller agrees, use the appropriate transfer tool immediately.'
        : 'Provide one explicit escalation next step and confirm caller preference.';
      instruction = `${instruction}\n\n${UNRESOLVED_LOOP_ESCALATION_HINT} ${transferHint}`;
    }

    return instruction;
  }

  private static hasEscalationTool(session: AudioBridgeSession): boolean {
    return (session.agentConfig.tools || []).some((tool) =>
      tool.name === 'transfer_call'
      || tool.name === 'transfer_to_agent'
      || tool.name.startsWith('transfer_')
      || tool.name.startsWith('transfer_agent_')
    );
  }

  private static markResolvedCheckpoint(session: AudioBridgeSession): void {
    session.unresolvedIntentStreak = 0;
    session.escalationCheckpointArmed = false;
    session.kbLowConfidenceGateActive = false;
  }

  private static async markUnresolvedTurn(session: AudioBridgeSession): Promise<void> {
    const previousArmed = session.escalationCheckpointArmed;
    session.unresolvedIntentStreak = Math.min(session.unresolvedIntentStreak + 1, 8);
    session.escalationCheckpointArmed =
      session.unresolvedIntentStreak >= UNRESOLVED_LOOP_ESCALATION_THRESHOLD;
    if (!previousArmed && session.escalationCheckpointArmed) {
      await this.syncRealtimeSentimentInstructions(session);
      console.warn(
        `[TwilioOpenAI Bridge] Escalation checkpoint armed for ${session.callSid} (streak=${session.unresolvedIntentStreak})`
      );
    }
  }

  private static async evaluateRuntimeQualityGuards(
    session: AudioBridgeSession,
    toolName: string,
    result: unknown
  ): Promise<void> {
    this.applyRuntimePoliciesFromToolResult(session, toolName, result);

    if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
      return;
    }

    if (session.kbLowConfidenceGateActive || session.escalationCheckpointArmed) {
      await this.syncRealtimeSentimentInstructions(session);
    }
  }

  private static applyRuntimePoliciesFromToolResult(
    session: AudioBridgeSession,
    toolName: string,
    result: unknown
  ): void {
    const payload = (typeof result === 'object' && result !== null)
      ? (result as Record<string, unknown>)
      : null;

    if (toolName === 'lookup_knowledge_base' && payload) {
      const confidenceLevelRaw = payload.confidenceLevel;
      const confidenceLevel = typeof confidenceLevelRaw === 'string'
        ? confidenceLevelRaw.toLowerCase()
        : '';
      const confidence = Number(payload.confidence);
      const lowConfidence =
        confidenceLevel === 'low'
        || (Number.isFinite(confidence) && confidence >= 0 && confidence < 0.52);

      session.kbLowConfidenceGateActive = lowConfidence;
      if (lowConfidence) {
        session.unresolvedIntentStreak = Math.min(session.unresolvedIntentStreak + 1, 8);
        session.escalationCheckpointArmed =
          session.unresolvedIntentStreak >= UNRESOLVED_LOOP_ESCALATION_THRESHOLD;
      } else if (confidenceLevel === 'high') {
        session.kbLowConfidenceGateActive = false;
        session.unresolvedIntentStreak = Math.max(0, session.unresolvedIntentStreak - 1);
      }

      console.log(
        `[TwilioOpenAI Bridge] KB guardrail state for ${session.callSid}: lowConfidence=${session.kbLowConfidenceGateActive}, streak=${session.unresolvedIntentStreak}`
      );
      return;
    }

    if (!payload) {
      return;
    }

    const isResolvedAction =
      (toolName === 'book_appointment' && payload.success === true)
      || (toolName === 'submit_form' && payload.success === true)
      || (payload.transferSuccess === true)
      || (payload.hangupSuccess === true)
      || (payload.action === 'end_call' && payload.hangupSuccess === true);

    if (isResolvedAction) {
      this.markResolvedCheckpoint(session);
    }
  }

  private static violatesSpeechGuardrails(text: string): boolean {
    if (!text) return false;
    if (SPEECH_GUARDRAIL_PATTERNS.some((pattern) => pattern.test(text))) {
      return true;
    }
    const sentenceCount = text
      .split(/[.!?؟]+/)
      .map((s) => s.trim())
      .filter(Boolean).length;
    return sentenceCount > 5;
  }

  private static scheduleTwilioClear(session: AudioBridgeSession): void {
    if (session.pendingClearTimerId) {
      clearTimeout(session.pendingClearTimerId);
      session.pendingClearTimerId = null;
    }
    if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN || !session.streamSid) {
      return;
    }

    // Coalesce bursty clear requests to avoid clear/media races under rapid barge-in.
    session.pendingClearTimerId = setTimeout(() => {
      session.pendingClearTimerId = null;
      if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN || !session.streamSid) {
        return;
      }
      session.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: session.streamSid,
      }));
    }, 45);
  }

  /**
   * Process pending audio queue after stream becomes ready
   * Plays all queued audio files in order
   */
  private static async processPendingAudioQueue(session: AudioBridgeSession): Promise<void> {
    const { callSid, pendingAudioQueue } = session;
    
    if (pendingAudioQueue.length === 0) return;
    
    console.log(`[TwilioOpenAI Bridge] Processing ${pendingAudioQueue.length} pending audio requests for ${callSid}`);
    
    // Process all queued audio requests
    while (pendingAudioQueue.length > 0) {
      const request = pendingAudioQueue.shift();
      if (!request) break;
      
      console.log(`[TwilioOpenAI Bridge] Playing queued audio: ${request.audioUrl}`);
      
      try {
        const result = await this.executePlayAudio(session, request.audioUrl);
        if (result.success) {
          console.log(`[TwilioOpenAI Bridge] Queued audio played successfully`);
        } else {
          console.error(`[TwilioOpenAI Bridge] Queued audio playback failed: ${result.error}`);
        }
        
        // Small delay between queued audio files
        if (pendingAudioQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`[TwilioOpenAI Bridge] Error playing queued audio: ${error.message}`);
      }
    }
    
    console.log(`[TwilioOpenAI Bridge] Finished processing pending audio queue for ${callSid}`);
  }

  /**
   * Send a text message for the agent to speak
   * Uses response.create with instructions to speak the exact greeting text
   * per official OpenAI Realtime API documentation
   */
  private static sendAgentMessage(session: AudioBridgeSession, text: string): void {
    const { openaiWs, callSid } = session;
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;

    console.log(`[TwilioOpenAI Bridge] Sending first message for ${callSid}: "${text.substring(0, 50)}..."`);

    // Use response.create with instructions to speak the exact greeting
    // This is the official way to have the agent say a specific first message
    // After speaking this greeting, the agent MUST wait for user input before responding again
    openaiWs.send(JSON.stringify({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: `IMPORTANT: Say ONLY the following greeting message word-for-word, then STOP and WAIT for the user to respond. Do NOT add any follow-up questions or additional content. Do NOT assume the user has said anything until you actually hear them speak. Just say this exact message and wait: "${text}"`,
      },
    }));
  }

  private static async handleOpenAIMessage(session: AudioBridgeSession, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      const { callSid } = session;

      switch (message.type) {
        case 'session.created':
          session.openaiSessionId = message.session?.id || `session-${Date.now()}`;
          console.log(`[TwilioOpenAI Bridge] Session created: ${session.openaiSessionId}`);
          break;

        case 'session.updated':
          console.log(`[TwilioOpenAI Bridge] Session updated for ${callSid}`);
          break;

        case 'response.output_audio.delta':
        case 'response.audio.delta':
          // Stop ringback as soon as the agent starts speaking.
          this.stopRingback(session);
          this.clearLLMTimeouts(session);
          {
            const deltaResponseId = message.response_id || message.response?.id || null;
            if (session.suppressResponseOutputUntilDone) {
              if (
                session.suppressedResponseId
                && deltaResponseId
                && deltaResponseId !== session.suppressedResponseId
              ) {
                session.suppressResponseOutputUntilDone = false;
                session.suppressedResponseId = null;
              } else {
                break;
              }
            }

            // Ignore stale/out-of-order audio chunks from non-active responses.
            if (
              session.activeResponseId
              && deltaResponseId
              && session.activeResponseId !== deltaResponseId
            ) {
              break;
            }
          }
          if (message.delta) {
            const deltaResponseId = message.response_id || message.response?.id || null;
            // Time-to-first-audio (TTFA): first audio chunk after user speech stopped.
            if (deltaResponseId) {
              let byResp = firstAudioAtByResponse.get(callSid);
              if (!byResp) {
                byResp = new Map();
                firstAudioAtByResponse.set(callSid, byResp);
              }
              if (!byResp.has(deltaResponseId)) {
                const now = Date.now();
                byResp.set(deltaResponseId, now);
                const ttfaMs = Math.max(0, now - (session.lastUserSpeechTime || now));
                callErrorLogger.logCallError({
                  engineType: 'twilio-openai',
                  errorCategory: 'latency',
                  severity: ttfaMs > 1000 ? 'warning' : 'info',
                  message: `ttfa_ms=${ttfaMs}`,
                  metadata: { callSid, responseId: deltaResponseId, ttfaMs, model: session.agentConfig.model },
                }).catch(() => undefined);
              }
            }
            if (
              session.pendingClearTimerId
              && (!session.activeResponseId || !deltaResponseId || session.activeResponseId === deltaResponseId)
            ) {
              clearTimeout(session.pendingClearTimerId);
              session.pendingClearTimerId = null;
            }
            if (session.onAudioCallback) {
              session.onAudioCallback(message.delta);
            }
            
            if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
              session.twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: session.streamSid,
                media: {
                  payload: message.delta,
                },
              }));
            }
          }
          break;

        case 'response.output_audio.done':
        case 'response.audio.done':
          console.log(`[TwilioOpenAI Bridge] Audio response complete for ${callSid}`);
          if (session.suppressResponseOutputUntilDone) {
            const doneResponseId = message.response_id || message.response?.id || null;
            if (!session.suppressedResponseId || !doneResponseId || session.suppressedResponseId === doneResponseId) {
              session.suppressResponseOutputUntilDone = false;
              session.suppressedResponseId = null;
            }
          }
          const audioDoneResponseId = message.response_id || message.response?.id || null;
          if (
            !session.activeResponseId
            || !audioDoneResponseId
            || session.activeResponseId === audioDoneResponseId
          ) {
            session.isResponseActive = false;
            session.activeResponseId = null;
          }
          break;

        case 'response.output_text.delta':
        case 'response.text.delta':
          this.clearLLMTimeouts(session);
          break;

        case 'response.output_audio_transcript.delta':
        case 'response.audio_transcript.delta':
          this.clearLLMTimeouts(session);
          if (message.delta && session.onTranscriptCallback) {
            session.onTranscriptCallback(message.delta, false);
          }
          break;

        case 'response.output_audio_transcript.done':
        case 'response.audio_transcript.done':
          if (message.transcript) {
            const assistantText = message.transcript as string;
            session.transcriptParts.push({
              role: 'assistant',
              text: assistantText,
              timestamp: new Date(),
            });
            if (session.onTranscriptCallback) {
              session.onTranscriptCallback(assistantText, true);
            }
            if (this.violatesSpeechGuardrails(assistantText)) {
              session.speechGuardrailStrikes = Math.min(session.speechGuardrailStrikes + 1, 3);
              await this.syncRealtimeSentimentInstructions(session);
              console.warn(
                `[TwilioOpenAI Bridge] Speech guardrail triggered for ${callSid} (strikes=${session.speechGuardrailStrikes})`
              );
            } else if (session.speechGuardrailStrikes > 0) {
              session.speechGuardrailStrikes -= 1;
              await this.syncRealtimeSentimentInstructions(session);
            }
            console.log(`[TwilioOpenAI Bridge] Agent: "${assistantText.substring(0, 100)}..."`);
          }
          if (session.kbLowConfidenceGateActive) {
            // Low-confidence gate is turn-scoped; clear after assistant turn completes.
            session.kbLowConfidenceGateActive = false;
          }
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            session.transcriptParts.push({
              role: 'user',
              text: message.transcript,
              timestamp: new Date(),
            });
            console.log(`[TwilioOpenAI Bridge] User: "${message.transcript.substring(0, 100)}..."`);
            await this.markUnresolvedTurn(session);

            try {
              const sentimentResult = RealtimeSentimentService.analyzeSentiment(
                session.callSid,
                message.transcript,
                session.agentConfig.language || 'en'
              );
              await this.refreshSentimentModeAndSync(session);
              liveCallRegistry.updateSentiment(session.callSid, sentimentResult.level, sentimentResult.score, sentimentResult.alert, sentimentResult.reason);
              if (sentimentResult.alert && session.userId) {
                NotificationService.create({
                  userId: session.userId,
                  type: 'sentiment_alert',
                  title: 'Call Needs Attention',
                  message: `Call with ${session.agentConfig?.agentName || 'AI Agent'} flagged: ${sentimentResult.reason}. Sentiment: ${sentimentResult.level} (score: ${sentimentResult.score})`,
                  link: '/app/live-monitoring',
                  displayType: 'both',
                  priority: 1,
                });
              }
            } catch (sentErr: any) {
              console.error(`[TwilioOpenAI Bridge] Sentiment analysis error for ${session.callSid}: ${sentErr.message}`);
            }
          }
          break;

        case 'input_audio_buffer.speech_started':
          session.lastUserSpeechTime = Date.now();
          console.log(`[TwilioOpenAI Bridge] User started speaking (barge-in detected)`);
          this.stopRingback(session);
          if (session.isResponseActive) {
            this.handleBargeIn(session);
          } else {
            this.scheduleTwilioClear(session);
          }
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log(`[TwilioOpenAI Bridge] User stopped speaking`);
          this.startLLMTimeouts(session);
          break;

        case 'response.created':
          {
            const responseId = message.response?.id || null;
            if (session.suppressResponseOutputUntilDone) {
              // A new response id indicates we can safely stop suppressing stale output.
              if (!session.suppressedResponseId || !responseId || responseId !== session.suppressedResponseId) {
                session.suppressResponseOutputUntilDone = false;
                session.suppressedResponseId = null;
              }
            }
            session.isResponseActive = true;
            session.activeResponseId = responseId;
          }
          console.log(`[TwilioOpenAI Bridge] Event: response.created`);
          break;

        case 'response.function_call_arguments.done':
          await this.handleToolCall(session, message);
          break;

        case 'response.done':
          {
            const doneResponseId = message.response?.id || null;
            const isSuppressedResponse = session.suppressResponseOutputUntilDone
              && (!session.suppressedResponseId || !doneResponseId || session.suppressedResponseId === doneResponseId);

            if (isSuppressedResponse) {
              session.suppressResponseOutputUntilDone = false;
              session.suppressedResponseId = null;
            }

            if (
              !session.activeResponseId
              || !doneResponseId
              || session.activeResponseId === doneResponseId
            ) {
              session.isResponseActive = false;
              session.activeResponseId = null;
            }

            if (isSuppressedResponse) {
              break;
            }
          }
          if (message.response?.output) {
            for (const item of message.response.output) {
              if (item.type === 'function_call') {
                await this.handleToolCall(session, {
                  name: item.name,
                  call_id: item.call_id,
                  arguments: item.arguments,
                });
              }
            }
          }
          break;

        case 'error':
          if (message.error?.code === 'response_cancel_not_active') {
            break;
          }
          console.error(`[TwilioOpenAI Bridge] OpenAI error for ${callSid}:`, message.error);
          break;

        default:
          if (message.type && !message.type.includes('delta')) {
            console.log(`[TwilioOpenAI Bridge] Event: ${message.type}`);
          }
      }
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Error handling message:`, error.message);
    }
  }

  private static async handleToolCall(
    session: AudioBridgeSession, 
    message: { name?: string; call_id?: string; arguments?: string }
  ): Promise<void> {
    const { callSid } = session;
    const toolName = message.name;
    const callId = message.call_id;
    
    if (!toolName || !callId) {
      console.warn(`[TwilioOpenAI Bridge] Invalid tool call for ${callSid}`);
      return;
    }

    // Deduplicate: skip if we've already processed this tool call
    if (session.processedToolCallIds.has(callId)) {
      console.log(`[TwilioOpenAI Bridge] Skipping duplicate tool call: ${toolName} (${callId})`);
      return;
    }
    session.processedToolCallIds.add(callId);

    console.log(`[TwilioOpenAI Bridge] Tool call: ${toolName} for ${callSid}`);
    const toolStart = Date.now();

    try {
      let params: Record<string, unknown> = {};
      if (message.arguments) {
        try {
          params = JSON.parse(message.arguments);
        } catch (e) {
          console.warn(`[TwilioOpenAI Bridge] Failed to parse tool arguments`);
        }
      }

      let result: unknown;
      
      // Handle end_call as a special built-in tool
      if (toolName === 'end_call') {
        console.log(`[TwilioOpenAI Bridge] Built-in end_call tool invoked for ${callSid}`);
        session.explicitEndCall = true;
        result = { 
          action: 'end_call', 
          reason: (params.reason as string) || 'Call ended by agent',
          ...params 
        };
      } 
      // Handle transfer_to_agent and transfer_agent_* for agent swap (not phone transfer)
      else if (toolName === 'transfer_to_agent' || toolName.startsWith('transfer_agent_')) {
        console.log(`[TwilioOpenAI Bridge] Agent transfer tool invoked: ${toolName} for ${callSid}`);
        
        let targetAgentId = '';
        
        if (session.agentConfig.tools) {
          for (const tool of session.agentConfig.tools) {
            const toolAny = tool as unknown as Record<string, unknown>;
            if (tool.name === toolName) {
              if (toolAny._transferAgentId) {
                targetAgentId = toolAny._transferAgentId as string;
              } else if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).agentId) {
                targetAgentId = (toolAny._metadata as Record<string, unknown>).agentId as string;
              }
              break;
            }
          }
        }
        
        if (!targetAgentId) {
          console.warn(`[TwilioOpenAI Bridge] No target agent ID found for ${toolName}`);
          result = { 
            error: 'No target agent specified',
            message: 'Cannot transfer - no agent specified.'
          };
        } else {
          result = { 
            action: 'transfer_to_agent',
            targetAgentId: targetAgentId,
            reason: (params.reason as string) || (params.context as string) || 'Agent transfer requested',
          };
        }
      }
      // Handle transfer_call and transfer_* as built-in tools for flow agents
      else if (toolName === 'transfer_call' || toolName.startsWith('transfer_')) {
        console.log(`[TwilioOpenAI Bridge] Built-in transfer tool invoked: ${toolName} for ${callSid}`);

        // Safety gate: only allow transfer when caller explicitly asked for a human.
        if (!callerExplicitlyRequestedHuman(session)) {
          console.warn(`[TwilioOpenAI Bridge] Transfer blocked (no explicit human request) for ${callSid}`);
          callErrorLogger.logCallError({
            engineType: 'twilio-openai',
            errorCategory: 'tool_call_delay',
            severity: 'warning',
            message: 'transfer_blocked_no_explicit_human_request',
            metadata: { callSid, toolName },
          }).catch(() => undefined);
          result = {
            error: 'Transfer not allowed',
            message: 'Transfer is only allowed when the caller explicitly asks for a human representative. Continue assisting as the customer support agent.',
            transferBlocked: true,
          };
        } else {
        
        // Get target number from params or tool metadata
        let targetNumber = (params.destination as string) || (params.phoneNumber as string) || '';
        
        // If no destination in params, look for it in the tools array (flow agents store it as _transferNumber)
        // First try to match by the exact tool name, then fall back to any transfer tool
        if (!targetNumber && session.agentConfig.tools) {
          // First pass: look for exact tool name match
          for (const tool of session.agentConfig.tools) {
            const toolAny = tool as unknown as Record<string, unknown>;
            if (tool.name === toolName) {
              if (toolAny._transferNumber) {
                targetNumber = toolAny._transferNumber as string;
                console.log(`[TwilioOpenAI Bridge] Found transfer number from matching tool ${toolName}: ${targetNumber}`);
                break;
              } else if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).phoneNumber) {
                targetNumber = (toolAny._metadata as Record<string, unknown>).phoneNumber as string;
                console.log(`[TwilioOpenAI Bridge] Found transfer number from matching tool ${toolName} metadata: ${targetNumber}`);
                break;
              }
            }
          }
          
          // Second pass: if no match found, look for any transfer tool with a phone number
          if (!targetNumber) {
            for (const tool of session.agentConfig.tools) {
              const toolAny = tool as unknown as Record<string, unknown>;
              if (tool.name === 'transfer_call' || tool.name.startsWith('transfer_')) {
                if (toolAny._transferNumber) {
                  targetNumber = toolAny._transferNumber as string;
                  console.log(`[TwilioOpenAI Bridge] Found transfer number from tool ${tool.name} _transferNumber: ${targetNumber}`);
                  break;
                } else if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).phoneNumber) {
                  targetNumber = (toolAny._metadata as Record<string, unknown>).phoneNumber as string;
                  console.log(`[TwilioOpenAI Bridge] Found transfer number from tool ${tool.name} _metadata: ${targetNumber}`);
                  break;
                }
              }
            }
          }
        }
        
        if (!targetNumber) {
          console.warn(`[TwilioOpenAI Bridge] No transfer destination found for ${toolName}`);
          result = { 
            error: 'No transfer destination specified',
            message: 'Cannot transfer - no phone number provided.'
          };
        } else {
          result = { 
            action: 'transfer', 
            phoneNumber: targetNumber,
            reason: (params.reason as string) || (params.context as string) || 'Transfer requested',
          };
        }
        }
      }
      // Handle play_audio tool
      else if (toolName === 'play_audio' || toolName.startsWith('play_audio_')) {
        // First check params (direct call), then look up from tool _metadata (flow compiled tools)
        let audioUrl = params.audioUrl as string || params.audio_url as string || '';
        
        // If no audioUrl in params, look it up from the tool's _metadata
        if (!audioUrl && session.agentConfig.tools) {
          for (const tool of session.agentConfig.tools) {
            const toolAny = tool as unknown as Record<string, unknown>;
            if (tool.name === toolName) {
              if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).audioUrl) {
                audioUrl = (toolAny._metadata as Record<string, unknown>).audioUrl as string;
                console.log(`[TwilioOpenAI Bridge] Found audioUrl from tool ${toolName} _metadata: ${audioUrl}`);
                break;
              }
            }
          }
        }
        
        console.log(`[TwilioOpenAI Bridge] Play audio tool invoked for ${callSid}: ${audioUrl}`);
        
        if (audioUrl) {
          // Check if stream is ready, if not queue the request
          if (!session.twilioStreamReady || !session.streamSid) {
            console.log(`[TwilioOpenAI Bridge] Stream not ready, queueing audio playback for ${callSid}`);
            session.pendingAudioQueue.push({
              audioUrl,
              callId,
              timestamp: new Date(),
            });
            result = {
              action: 'play_audio',
              audioUrl,
              success: true,
              queued: true,
              message: 'Audio playback queued - will play when stream is ready.'
            };
          } else {
            // Execute Twilio audio playback via WebSocket streaming
            const playResult = await this.executePlayAudio(session, audioUrl);
            result = {
              action: 'play_audio',
              audioUrl,
              success: playResult.success,
              message: playResult.success 
                ? 'Audio is now playing on the call.'
                : `Audio playback failed: ${playResult.error}`
            };
          }
        } else {
          result = {
            action: 'play_audio',
            audioUrl: '',
            success: false,
            message: 'No audio URL found for playback.'
          };
        }
      } else {
        const handler = session.toolHandlers.get(toolName);
        
        if (handler) {
          result = await handler(params);
        } else if (session.onToolCallback) {
          result = await session.onToolCallback(toolName, params);
        } else {
          // Unknown tool call from the model (usually prompt/tooling mismatch).
          // Log it explicitly so it shows up in /app/analytics troubleshooting.
          const availableTools = Array.from(session.toolHandlers.keys());
          callErrorLogger.logCallError({
            engineType: 'twilio-openai',
            errorCategory: 'tooling',
            severity: 'warning',
            message: `unknown_tool=${toolName}`,
            metadata: {
              callSid,
              toolName,
              availableTools,
              paramsPreview: typeof params === 'object' ? JSON.stringify(params).slice(0, 500) : String(params).slice(0, 500),
            },
          }).catch(() => undefined);
          result = { error: `Unknown tool: ${toolName}` };
        }
      }

      const toolMs = Date.now() - toolStart;
      callErrorLogger.logCallError({
        engineType: 'twilio-openai',
        errorCategory: toolMs > 1500 ? 'tool_call_delay' : 'latency',
        severity: toolMs > 1500 ? 'warning' : 'info',
        message: `tool_ms=${toolMs} tool=${toolName}`,
        metadata: { callSid, toolName, toolMs },
      }).catch(() => undefined);

      if (toolName === 'transfer_call' || toolName.startsWith('transfer_')) {
        callErrorLogger.logCallError({
          engineType: 'twilio-openai',
          errorCategory: 'latency',
          severity: (typeof result === 'object' && result !== null && (result as any).transferBlocked)
            ? 'warning'
            : 'info',
          message: 'transfer_tool_result',
          metadata: {
            callSid,
            toolName,
            transferBlocked: Boolean((result as any)?.transferBlocked),
            action: (result as any)?.action,
          },
        }).catch(() => undefined);
      }

      await this.evaluateRuntimeQualityGuards(session, toolName, result);

      console.log(`[TwilioOpenAI Bridge] Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200));

      // Update call metadata for successful tool executions (for CRM Lead Processor)
      if (typeof result === 'object' && result !== null) {
        const toolResult = result as Record<string, unknown>;
        
        // Track successful appointment bookings
        if (toolName === 'book_appointment' && toolResult.success === true) {
          await this.updateCallMetadata(callSid, {
            appointmentBooked: true,
            hasAppointment: true,
            appointmentData: {
              appointmentId: toolResult.appointmentId,
              message: toolResult.message,
              bookedAt: new Date().toISOString(),
            },
            aiInsights: {
              primaryOutcome: 'appointment_booked',
              appointmentBooked: true,
            },
          });
        }
        
        // Track successful form submissions
        if (toolName === 'submit_form' && toolResult.success === true) {
          await this.updateCallMetadata(callSid, {
            formSubmitted: true,
            hasFormSubmission: true,
            formData: {
              submissionId: toolResult.submissionId,
              message: toolResult.message,
              submittedAt: new Date().toISOString(),
            },
            aiInsights: {
              primaryOutcome: 'form_submitted',
              formSubmitted: true,
            },
          });
        }
      }

      if (typeof result === 'object' && result !== null) {
        const actionResult = result as Record<string, unknown>;
        
        // Handle agent swap transfers (swap OpenAI session, keep Twilio call)
        if (actionResult.action === 'transfer_to_agent') {
          const targetAgentId = actionResult.targetAgentId as string;
          console.log(`[TwilioOpenAI Bridge] Executing agent transfer to ${targetAgentId}`);
          
          const swapResult = await this.executeAgentSwap(session, targetAgentId);
          if (!swapResult.success) {
            result = { 
              ...actionResult, 
              transferError: swapResult.error,
              message: 'Agent transfer failed, please try again.'
            };
          } else {
            result = { 
              ...actionResult, 
              transferSuccess: true,
              message: 'Agent transfer completed successfully. You are now connected to a new agent.'
            };
            
            await this.updateCallMetadata(callSid, {
              wasTransferred: true,
              hasTransfer: true,
              transferredToAgent: targetAgentId,
              transferredAt: new Date().toISOString(),
              aiInsights: {
                primaryOutcome: 'agent_transfer',
                wasTransferred: true,
                transferTargetAgent: targetAgentId,
              },
            });
            this.markResolvedCheckpoint(session);
            
            return;
          }
        }
        
        // Track successful transfers
        if (actionResult.action === 'transfer') {
          const targetNumber = actionResult.phoneNumber as string;
          console.log(`[TwilioOpenAI Bridge] Executing transfer to ${targetNumber}`);
          
          const transferResult = await this.executeTransfer(session, targetNumber);
          if (!transferResult.success) {
            result = { 
              ...actionResult, 
              transferError: transferResult.error,
              message: 'Transfer failed, please try again or inform the caller.'
            };
          } else {
            result = { 
              ...actionResult, 
              transferSuccess: true,
              message: 'Transfer initiated successfully.'
            };
            
            // Update metadata for successful transfer
            await this.updateCallMetadata(callSid, {
              wasTransferred: true,
              hasTransfer: true,
              transferredTo: targetNumber,
              transferredAt: new Date().toISOString(),
              aiInsights: {
                primaryOutcome: 'call_transfer',
                wasTransferred: true,
                transferTarget: targetNumber,
              },
            });
            this.markResolvedCheckpoint(session);
          }
        }
        
        if (actionResult.action === 'end_call') {
          // Don't hang up if transfer is in progress (session already marked as disconnected)
          if (session.status === 'disconnected') {
            console.log(`[TwilioOpenAI Bridge] Ignoring end_call - session already disconnecting/transferring`);
            result = { ignored: true, reason: 'Session already disconnecting or transfer in progress' };
          } else {
            console.log(`[TwilioOpenAI Bridge] Executing end call: ${actionResult.reason}`);
            const hangupResult = await this.executeHangup(session);
            if (!hangupResult.success) {
              result = {
                ...actionResult,
                hangupError: hangupResult.error,
                message: 'Failed to end call, please try again.'
              };
            } else {
              result = {
                ...actionResult,
                hangupSuccess: true,
                message: 'Call ended successfully.'
              };
              this.markResolvedCheckpoint(session);
            }
          }
        }
      }

      this.applyRuntimePoliciesFromToolResult(session, toolName, result);

      this.sendToolResult(session, callId, result);

    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Tool ${toolName} error:`, error.message);
      this.sendToolResult(session, callId, { error: error.message });
    }
  }

  private static sendToolResult(session: AudioBridgeSession, callId: string, result: unknown): void {
    const { openaiWs } = session;
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;

    openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    }));

    openaiWs.send(JSON.stringify({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: this.buildEmotionAdaptiveInstruction(
          session,
          'Continue naturally. Keep it conversational and phone-friendly in 1-3 short sentences.'
        ),
      },
    }));
  }

  /**
   * Update call metadata in database after successful tool executions
   * This is critical for CRM Lead Processor to detect appointments, forms, and transfers
   * Uses deep merge for nested objects (aiInsights, appointmentData, formData) to preserve existing values
   */
  private static async updateCallMetadata(
    callSid: string, 
    metadataUpdates: Record<string, unknown>
  ): Promise<void> {
    try {
      // Find the call record by callSid (stored in twilioCallSid column)
      const [existingCall] = await db
        .select()
        .from(twilioOpenaiCalls)
        .where(eq(twilioOpenaiCalls.twilioCallSid, callSid))
        .limit(1);

      if (!existingCall) {
        console.warn(`[TwilioOpenAI Bridge] Cannot update metadata - call not found: ${callSid}`);
        return;
      }

      // Deep merge existing metadata with new updates
      // This preserves existing nested values while adding new ones
      const existingMetadata = (existingCall.metadata as Record<string, unknown>) || {};
      const updatedMetadata = this.deepMergeMetadata(existingMetadata, metadataUpdates);

      await db
        .update(twilioOpenaiCalls)
        .set({ metadata: updatedMetadata })
        .where(eq(twilioOpenaiCalls.id, existingCall.id));

      console.log(`[TwilioOpenAI Bridge] Updated call metadata for ${callSid}:`, Object.keys(metadataUpdates));
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Failed to update call metadata:`, error.message);
    }
  }

  /**
   * Deep merge metadata objects, preserving existing nested values
   * Specifically handles aiInsights, appointmentData, formData to avoid overwriting
   */
  private static deepMergeMetadata(
    existing: Record<string, unknown>, 
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...existing };
    
    for (const key of Object.keys(updates)) {
      const existingValue = result[key];
      const newValue = updates[key];
      
      // Deep merge for known nested objects
      if (
        key === 'aiInsights' || 
        key === 'appointmentData' || 
        key === 'formData'
      ) {
        if (
          typeof existingValue === 'object' && 
          existingValue !== null && 
          !Array.isArray(existingValue) &&
          typeof newValue === 'object' && 
          newValue !== null && 
          !Array.isArray(newValue)
        ) {
          result[key] = { 
            ...(existingValue as Record<string, unknown>), 
            ...(newValue as Record<string, unknown>) 
          };
        } else {
          result[key] = newValue;
        }
      } else {
        // Shallow merge for other keys
        result[key] = newValue;
      }
    }
    
    return result;
  }

  static handleTwilioMedia(callSid: string, event: TwilioMediaStreamEvent): void {
    const session = this.activeSessions.get(callSid);
    if (!session) {
      return;
    }

    switch (event.event) {
      case 'connected':
        console.log(`[TwilioOpenAI Bridge] Twilio stream connected for ${callSid}`);
        break;

      case 'start':
        if (event.start) {
          session.streamSid = event.start.streamSid;
          session.twilioStreamReady = true;
          console.log(`[TwilioOpenAI Bridge] Stream started: ${event.start.streamSid}, callSid: ${event.start.callSid}`);
          this.startRingbackIfNeeded(session);
          this.trySendFirstMessage(session);
          
          // Process any pending audio requests that were queued before stream was ready
          if (session.pendingAudioQueue.length > 0) {
            console.log(`[TwilioOpenAI Bridge] Processing ${session.pendingAudioQueue.length} queued audio requests`);
            this.processPendingAudioQueue(session);
          }
        }
        break;

      case 'media':
        if (event.media?.payload && session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
          session.openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: event.media.payload,
          }));
        }
        break;

      case 'stop':
        console.log(`[TwilioOpenAI Bridge] Stream stopped for ${callSid}`);
        this.stopRingback(session);
        break;

      case 'mark':
        if (event.mark) {
          console.log(`[TwilioOpenAI Bridge] Mark received: ${event.mark.name}`);
        }
        break;
    }
  }

  static setTwilioWebSocket(callSid: string, twilioWs: WebSocket, streamSid: string): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.twilioWs = twilioWs;
      session.streamSid = streamSid;
      console.log(`[TwilioOpenAI Bridge] Twilio WebSocket set for ${callSid}, streamSid: ${streamSid}`);
    }
  }

  static onAudioOutput(callSid: string, callback: (audioBase64: string) => void): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onAudioCallback = callback;
    }
  }

  static onTranscriptUpdate(callSid: string, callback: (text: string, isFinal: boolean) => void): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onTranscriptCallback = callback;
    }
  }

  static onToolCall(callSid: string, callback: (toolName: string, params: Record<string, unknown>) => Promise<unknown>): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onToolCallback = callback;
    }
  }

  static onSessionEnd(callSid: string, callback: (sessionData: { transcript: string; duration: number; openaiSessionId: string }) => void): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onEndCallback = callback;
    }
  }

  static async sendMessage(callSid: string, message: string): Promise<void> {
    const session = this.activeSessions.get(callSid);
    if (!session || !session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
      console.warn(`[TwilioOpenAI Bridge] Cannot send message - no active session for ${callSid}`);
      return;
    }

    console.log(`[TwilioOpenAI Bridge] Injecting message: "${message.substring(0, 50)}..."`);

    session.openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }],
      },
    }));

    session.openaiWs.send(JSON.stringify({
      type: 'response.create',
    }));
  }

  static interrupt(callSid: string): void {
    const session = this.activeSessions.get(callSid);
    if (!session || !session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
      return;
    }

    console.log(`[TwilioOpenAI Bridge] Interrupting response for ${callSid}`);
    
    session.openaiWs.send(JSON.stringify({
      type: 'response.cancel',
    }));

    if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
      session.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: session.streamSid,
      }));
    }
  }

  /**
   * Handle user barge-in (interruption)
   * Called when OpenAI detects user speech starting while agent is speaking
   * This is critical to prevent the "rushing through" behavior
   */
  private static handleBargeIn(session: AudioBridgeSession): void {
    const { callSid, openaiWs, twilioWs, streamSid } = session;
    
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.shouldThrottleBargeInCancel(session)) {
      this.scheduleTwilioClear(session);
      return;
    }

    console.log(`[TwilioOpenAI Bridge] Handling barge-in for ${callSid}`);

    // Suppress stale output from the response being cancelled until we observe its done boundary.
    session.suppressResponseOutputUntilDone = true;
    session.suppressedResponseId = session.activeResponseId;
    
    // 1. Cancel the current response from OpenAI
    // This tells OpenAI to stop generating more audio/text
    openaiWs.send(JSON.stringify({
      type: 'response.cancel',
    }));
    
    // 2. Clear any queued audio that hasn't been sent yet
    // This prevents "rushing through" already-generated audio
    this.scheduleTwilioClear(session);
    if (twilioWs && twilioWs.readyState === WebSocket.OPEN && streamSid) {
      console.log(`[TwilioOpenAI Bridge] Scheduled Twilio audio clear for ${callSid}`);
    }
    
    // 3. Optionally clear OpenAI's input audio buffer to start fresh
    // (commented out as it may discard user's speech - let VAD handle this)
    // openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
  }

  private static getDefaultWaitingMessages(): string[] {
    return [
      "Let me look into that for you...",
      "One moment please, I'm checking on that...",
      "I'm working on that, just a moment...",
      "Bear with me while I look that up...",
    ];
  }

  private static buildWaitingInstruction(session: AudioBridgeSession, preferredLang: string, message: string): string {
    const lang = (preferredLang || 'en').toLowerCase();
    const langNote = lang.startsWith('en')
      ? 'English'
      : lang.startsWith('ar')
        ? 'Arabic'
        : `the caller's language ("${preferredLang}")`;

    // Avoid stiff "say exactly" phrasing (sounds robotic). We still keep the content constrained
    // to one short waiting line to prevent the model from switching topics mid-processing.
    return this.buildEmotionAdaptiveInstruction(
      session,
      [
        `Language guard: Respond ONLY in ${langNote}. Do not switch languages.`,
        'Say ONE short, natural, human-sounding waiting line and then stop.',
        `Use this line (or a very close paraphrase that keeps the same meaning): "${message}"`,
      ].join(' ')
    );
  }

  private static inferPreferredLanguageFromContext(session: AudioBridgeSession): string {
    // Explicit agent/IVR language always wins (including English). Do not override
    // "en" just because the system prompt still contains Arabic policy examples.
    const configured = String(session.agentConfig.language || '').toLowerCase().split(/[-_]/)[0];
    if (configured) {
      return configured;
    }

    // Heuristic: if we've observed Arabic in the recent transcript, stick to Arabic for
    // waiting/timeout messages to avoid jarring mid-call language flips.
    const recent = session.transcriptParts.slice(-8);
    for (const part of recent) {
      if (part?.text && this.ARABIC_CHAR_RE.test(part.text)) {
        return 'ar';
      }
    }

    // Also check prompts that may be Arabic even before transcript exists.
    const seedText = `${session.agentConfig.firstMessage || ''}\n${session.agentConfig.systemPrompt || ''}`;
    if (seedText && this.ARABIC_CHAR_RE.test(seedText)) {
      return 'ar';
    }
    if (seedText && this.CJK_CHAR_RE.test(seedText)) {
      // Covers Chinese/Japanese/Korean scripts; exact locale can be refined later.
      return 'zh';
    }

    return 'en';
  }

  private static getDefaultWaitingMessagesForLanguage(lang?: string | null): string[] {
    const code = (lang || 'en').toLowerCase();
    if (code.startsWith('ar')) {
      return [
        'دقيقة بس، خلّني أتأكد لك.',
        'لحظة عن إذنك… قاعد أشيّك لك.',
        'تمام… ثواني وبردّ عليك.',
        'حاضر… بس أتأكد لك من المعلومة.',
      ];
    }
    if (code.startsWith('es')) {
      return [
        'Dame un momento, lo reviso ahora.',
        'Un segundo, ya lo estoy comprobando.',
        'Ahora mismo lo miro, un momentito.',
        'Déjame confirmarlo y te digo.',
      ];
    }
    if (code.startsWith('fr')) {
      return [
        'Un instant, je vérifie ça.',
        'Deux secondes, je regarde.',
        'Je m’en occupe, un petit moment.',
        'Je confirme l’info et je reviens vers vous.',
      ];
    }
    if (code.startsWith('de')) {
      return [
        'Einen Moment bitte, ich prüfe das kurz.',
        'Sekunde, ich schaue eben nach.',
        'Ich kümmere mich darum, einen kleinen Moment.',
        'Ich kläre das kurz ab und sage Ihnen Bescheid.',
      ];
    }
    if (code.startsWith('it')) {
      return [
        'Un attimo, controllo subito.',
        'Solo un secondo, verifico.',
        'Ci sto lavorando, un momento.',
        'Fammi controllare e ti dico.',
      ];
    }
    if (code.startsWith('pt')) {
      return [
        'Só um momento, vou verificar.',
        'Um instante, já estou conferindo.',
        'Estou vendo isso agora, só um minutinho.',
        'Deixa eu confirmar e já te digo.',
      ];
    }
    if (code.startsWith('tr')) {
      return [
        'Bir saniye, hemen kontrol ediyorum.',
        'Kısa bir bekletiyorum, bakıyorum.',
        'Hemen bakıp size söyleyeceğim.',
        'Bir dakika, netleştirip döneyim.',
      ];
    }
    if (code.startsWith('ru')) {
      return [
        'Секундочку, сейчас уточню.',
        'Одну минуту, проверяю.',
        'Сейчас посмотрю, подождите чуть-чуть.',
        'Дайте секунду, я сверюсь и скажу.',
      ];
    }
    if (code.startsWith('hi')) {
      return [
        'एक मिनट, मैं अभी देख रहा/रही हूँ।',
        'थोड़ी देर रुको, मैं चेक करता/करती हूँ।',
        'बस एक पल, मैं पुष्टि कर लेता/लेती हूँ।',
        'अभी देख कर बताता/बताती हूँ।',
      ];
    }
    if (code.startsWith('ur')) {
      return [
        'ایک منٹ، میں ابھی چیک کر لیتا/لیتی ہوں۔',
        'ذرا سا وقت دیں، میں دیکھتا/دیکھتی ہوں۔',
        'بس تھوڑی دیر، میں تصدیق کر کے بتاتا/بتاتی ہوں۔',
        'ایک لمحہ، میں ابھی معلوم کرتا/کرتی ہوں۔',
      ];
    }
    if (code.startsWith('fa')) {
      return [
        'یک لحظه، الان بررسی می‌کنم.',
        'چند ثانیه صبر کنید، دارم چک می‌کنم.',
        'الان نگاه می‌کنم، یک لحظه.',
        'اجازه بدید تأیید کنم و بهتون می‌گم.',
      ];
    }
    if (code.startsWith('zh')) {
      return [
        '稍等一下，我马上帮你确认。',
        '我这边看一下，等我一下。',
        '我正在查，稍等片刻。',
        '我确认一下信息，马上回来。',
      ];
    }
    if (code.startsWith('ja')) {
      return [
        '少々お待ちください、確認します。',
        'すぐ確認しますので、少しだけお待ちください。',
        'ただいま調べています、少々お待ちください。',
        '確認して戻ります、少々お待ちください。',
      ];
    }
    if (code.startsWith('ko')) {
      return [
        '잠시만요, 바로 확인해볼게요.',
        '조금만 기다려 주세요, 확인 중이에요.',
        '지금 확인하고 있어요, 잠시만요.',
        '확인하고 바로 안내드릴게요.',
      ];
    }
    return this.getDefaultWaitingMessages();
  }

  private static startLLMTimeouts(session: AudioBridgeSession): void {
    this.clearLLMTimeouts(session);

    const softTimeoutSec = session.behaviorConfig?.softTimeoutSec ?? 4;
    const hardTimeoutSec = session.behaviorConfig?.hardTimeoutSec ?? 15;

    session.softTimeoutId = setTimeout(() => {
      session.softTimeoutId = null;
      if (session.status !== 'connected') return;
      if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) return;

      const preferredLang = this.inferPreferredLanguageFromContext(session);
      const messages = (session.waitingMessages && session.waitingMessages.length > 0)
        ? session.waitingMessages
        : this.getDefaultWaitingMessagesForLanguage(preferredLang);
      const waitingMessage = messages[Math.floor(Math.random() * messages.length)];

      console.log(`[TwilioOpenAI Bridge] Soft timeout (${softTimeoutSec}s) reached for ${session.callSid}, sending waiting message: "${waitingMessage}"`);

      session.openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
          output_modalities: ['audio'],
          instructions: this.buildWaitingInstruction(session, preferredLang, waitingMessage),
        },
      }));
    }, softTimeoutSec * 1000);

    session.hardTimeoutId = setTimeout(() => {
      session.hardTimeoutId = null;
      if (session.status !== 'connected') return;

      const preferredLang = this.inferPreferredLanguageFromContext(session);
      const errorMessage =
        preferredLang.toLowerCase().startsWith('ar')
          ? 'سمح لي… صار عندي تأخير بسيط. ممكن تعيد سؤالك مرة ثانية؟'
          : "I apologize — I'm having trouble processing that. Could you please repeat your question?";
      console.error(`[TwilioOpenAI Bridge] Hard timeout (${hardTimeoutSec}s) reached for ${session.callSid} — cancelling response`);

      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.send(JSON.stringify({ type: 'response.cancel' }));

        session.openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            output_modalities: ['audio'],
            instructions: `Say exactly this to the caller: "${errorMessage}"`,
          },
        }));
      }

      this.scheduleTwilioClear(session);
    }, hardTimeoutSec * 1000);
  }

  private static clearLLMTimeouts(session: AudioBridgeSession): void {
    if (session.softTimeoutId) {
      clearTimeout(session.softTimeoutId);
      session.softTimeoutId = null;
    }
    if (session.hardTimeoutId) {
      clearTimeout(session.hardTimeoutId);
      session.hardTimeoutId = null;
    }
    if (session.pendingClearTimerId) {
      clearTimeout(session.pendingClearTimerId);
      session.pendingClearTimerId = null;
    }
  }

  private static startRingbackIfNeeded(session: AudioBridgeSession): void {
    if (!session.ivrRouted) return;
    if (session.ringbackIntervalId) return;
    if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN || !session.streamSid) return;

    session.ringbackStartedAtMs = Date.now();
    session.ringbackFrameIndex = 0;
    console.log(`[TwilioOpenAI Bridge] Starting ringback for ${session.callSid}`);

    session.ringbackIntervalId = setInterval(() => {
      try {
        if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN || !session.streamSid) {
          this.stopRingback(session);
          return;
        }
        // Stop as soon as the AI is actively responding.
        if (session.isResponseActive) {
          this.stopRingback(session);
          return;
        }

        const frame = buildRingbackMulawFrame(session.ringbackFrameIndex || 0);
        session.ringbackFrameIndex = (session.ringbackFrameIndex || 0) + 1;

        session.twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid: session.streamSid,
          media: { payload: frame.toString('base64') },
        }));
      } catch {
        this.stopRingback(session);
      }
    }, 20);
  }

  private static stopRingback(session: AudioBridgeSession): void {
    if (!session.ringbackIntervalId) return;
    clearInterval(session.ringbackIntervalId);
    session.ringbackIntervalId = null;
    session.ringbackFrameIndex = 0;
    const startedAt = session.ringbackStartedAtMs;
    session.ringbackStartedAtMs = null;
    const durMs = startedAt ? (Date.now() - startedAt) : 0;
    console.log(`[TwilioOpenAI Bridge] Stopped ringback for ${session.callSid} after ${durMs}ms`);
  }

  static async endSession(callSid: string): Promise<{
    duration: number;
    transcript: string;
    transcriptParts: { role: 'user' | 'assistant'; text: string; timestamp: Date }[];
  }> {
    const session = this.activeSessions.get(callSid);
    if (!session) {
      return { duration: 0, transcript: '', transcriptParts: [] };
    }

    console.log(`[TwilioOpenAI Bridge] Ending session for ${callSid}`);
    
    this.clearLLMTimeouts(session);
    
    // Remove connection from the pool manager
    openaiPoolManager.removeConnection(callSid);
    this.credentialByCallSid.delete(callSid);

    session.status = 'disconnected';
    session.endedAt = new Date();

    if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
      session.openaiWs.close();
    }

    if (!session.explicitEndCall && session.transcriptParts.length > 0) {
      try {
        const [callRecord] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.twilioSid, callSid))
          .limit(1);

        if (callRecord) {
          const transcript = session.transcriptParts
            .map(p => `${p.role === 'user' ? 'User' : 'Agent'}: ${p.text}`)
            .join('\n');

          const context = {
            collectedData: {} as Record<string, string | null>,
            summaryOfDiscussion: transcript.substring(0, 500),
            lastTopic: session.transcriptParts.length > 0
              ? session.transcriptParts[session.transcriptParts.length - 1].text.substring(0, 200)
              : '',
            pendingQuestions: [] as string[],
          };

          await conversationResumptionService.markCallResumable(callRecord.id, context);
          console.log(`[TwilioOpenAI Bridge] Marked call ${callRecord.id} as resumable (no explicit end_call)`);
        }
      } catch (err: any) {
        console.log(`[TwilioOpenAI Bridge] Could not mark call as resumable: ${err.message}`);
      }
    }

    const duration = session.endedAt
      ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    const transcript = session.transcriptParts
      .map(p => `${p.role === 'user' ? 'User' : 'Agent'}: ${p.text}`)
      .join('\n');
    const callerNumberForMemory = session.callDirection === 'inbound'
      ? session.fromNumber
      : session.toNumber;

    try {
      if (session.userId && callerNumberForMemory && transcript.length > 80) {
        const [callRecord] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.twilioSid, callSid))
          .limit(1);
        const callIdForMemory = callRecord?.id || callSid;
        const facts = await ConversationMemoryService.processCallTranscript(
          session.userId,
          callIdForMemory,
          callerNumberForMemory,
          transcript
        );
        if (facts > 0) {
          console.log(`[TwilioOpenAI Bridge] Stored ${facts} caller-memory facts for ${callSid}`);
        }
      }
    } catch (memoryErr: any) {
      console.error(`[TwilioOpenAI Bridge] Caller-memory persistence failed for ${callSid}: ${memoryErr.message}`);
    }

    this.activeSessions.delete(callSid);
    RealtimeSentimentService.resetCall(callSid);

    return {
      duration,
      transcript,
      transcriptParts: session.transcriptParts,
    };
  }

  static getSession(callSid: string): AudioBridgeSession | undefined {
    return this.activeSessions.get(callSid);
  }

  static remapSession(oldCallSid: string, newCallSid: string): boolean {
    const session = this.activeSessions.get(oldCallSid);
    if (!session) {
      console.warn(`[TwilioOpenAI Bridge] Cannot remap session - not found: ${oldCallSid}`);
      return false;
    }
    session.callSid = newCallSid;
    this.activeSessions.delete(oldCallSid);
    this.activeSessions.set(newCallSid, session);
    const credentialId = this.credentialByCallSid.get(oldCallSid);
    if (credentialId) {
      this.credentialByCallSid.delete(oldCallSid);
      this.credentialByCallSid.set(newCallSid, credentialId);
    }
    console.log(`[TwilioOpenAI Bridge] Remapped session from ${oldCallSid} to ${newCallSid}`);
    return true;
  }

  static getActiveSessions(): Map<string, AudioBridgeSession> {
    return this.activeSessions;
  }

  /**
   * Execute agent swap: close old OpenAI WebSocket, build new agent config, reconnect
   * The Twilio WebSocket stays connected (same phone call), only the OpenAI session changes
   */
  private static async executeAgentSwap(session: AudioBridgeSession, targetAgentId: string): Promise<{ success: boolean; error?: string }> {
    const { callSid } = session;
    
    try {
      console.log(`[TwilioOpenAI Bridge] Starting agent swap for ${callSid} to agent ${targetAgentId}`);
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const [targetAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, targetAgentId))
        .limit(1);
      
      if (!targetAgent) {
        throw new Error(`Target agent ${targetAgentId} not found`);
      }
      
      console.log(`[TwilioOpenAI Bridge] Found target agent: ${targetAgent.name} (${targetAgent.id})`);
      
      const newAgentConfig = await OpenAIAgentFactory.createFromAgentRecord({
        id: targetAgent.id,
        userId: targetAgent.userId,
        type: targetAgent.type,
        systemPrompt: targetAgent.systemPrompt || '',
        firstMessage: targetAgent.firstMessage || null,
        openaiVoice: targetAgent.openaiVoice || null,
        openaiModel: null,
        temperature: targetAgent.temperature as number | null,
        knowledgeBaseIds: targetAgent.knowledgeBaseIds as string[] | null,
        knowledgeBaseOnly: targetAgent.knowledgeBaseOnly as boolean | null,
        transferEnabled: targetAgent.transferEnabled as boolean | null,
        transferPhoneNumber: targetAgent.transferPhoneNumber || null,
        transferMessage: null,
        transferAgentId: targetAgent.transferAgentId || null,
        endConversationEnabled: targetAgent.endConversationEnabled as boolean | null,
        detectLanguageEnabled: targetAgent.detectLanguageEnabled as boolean | null,
        flowId: targetAgent.flowId || null,
        language: targetAgent.language || null,
      }, 'pro');
      
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        console.log(`[TwilioOpenAI Bridge] Closing old OpenAI WebSocket for agent swap`);
        session.openaiWs.close(1000, 'Agent swap');
      }
      
      session.toolHandlers.clear();
      session.processedToolCallIds.clear();
      
      session.agentConfig = newAgentConfig;
      session.firstMessageSent = false;
      this.markResolvedCheckpoint(session);
      
      if (newAgentConfig.tools) {
        for (const tool of newAgentConfig.tools) {
          session.toolHandlers.set(tool.name, tool.handler);
        }
      }
      
      const apiKey = await this.getOpenAIApiKey(session);
      
      await this.connectToOpenAI(session, apiKey);
      
      this.configureSession(session);
      
      console.log(`[TwilioOpenAI Bridge] Agent swap completed for ${callSid}. Now using agent: ${targetAgent.name}`);
      
      if (newAgentConfig.firstMessage) {
        this.sendInitialGreeting(session);
      }
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Agent swap failed for ${callSid}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get OpenAI API key for the session from the call record's credential or environment
   */
  private static async getOpenAIApiKey(session: AudioBridgeSession): Promise<string> {
    try {
      const [callRecord] = await db
        .select({ openaiCredentialId: twilioOpenaiCalls.openaiCredentialId })
        .from(twilioOpenaiCalls)
        .where(eq(twilioOpenaiCalls.twilioCallSid, session.callSid))
        .limit(1);
      
      if (callRecord?.openaiCredentialId) {
        const credential = await OpenAIPoolService.getCredentialById(callRecord.openaiCredentialId);
        if (credential?.apiKey) {
          return credential.apiKey;
        }
      }
    } catch (e) {
      // Fall through to env var
    }
    
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) return envKey;
    
    throw new Error('No OpenAI API key available for agent swap');
  }

  /**
   * Send initial greeting from a new agent after agent swap
   */
  private static sendInitialGreeting(session: AudioBridgeSession): void {
    if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) return;
    
    const greetingText = session.agentConfig.firstMessage || 'Greet the caller and let them know you are here to help.';
    session.openaiWs.send(JSON.stringify({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: `IMPORTANT: Say ONLY the following greeting message word-for-word, then STOP and WAIT for the user to respond. Do NOT add any follow-up questions or additional content. Do NOT assume the user has said anything until you actually hear them speak. Just say this exact message and wait: "${greetingText}"`,
      },
    }));
  }

  /**
   * Execute actual call transfer via Twilio REST API
   * Updates the live call with TwiML to dial the transfer number
   * Uses the Twilio phone number (fromNumber) as the callerId since Twilio requires verified/owned caller IDs
   */
  private static async executeTransfer(session: AudioBridgeSession, targetNumber: string): Promise<{ success: boolean; error?: string }> {
    const { callSid, fromNumber, toNumber, callDirection, humanWizardCli } = session;

    try {
      // Wait for AI to finish speaking the transfer announcement
      // This prevents the call from being transferred mid-sentence
      console.log(`[TwilioOpenAI Bridge] Waiting 2.5s for AI to complete transfer announcement...`);
      await new Promise(resolve => setTimeout(resolve, 2500));

      const client = await getTwilioClient();

      // Call direction is REQUIRED to determine the Twilio-owned inbound DID
      // (UAE→UAE PSTN bridges must NOT present the inbound UAE number as caller ID).
      if (!callDirection) {
        console.error(`[TwilioOpenAI Bridge] Transfer failed - callDirection is missing for ${callSid}. fromNumber: ${fromNumber}, toNumber: ${toNumber}`);
        throw new Error('Cannot transfer call - callDirection is missing. This indicates a session setup issue.');
      }

      // Twilio-owned inbound DID:
      // - Inbound: toNumber (what customer dialed TO).
      // - Outbound: fromNumber (what we dialed FROM).
      const inboundDid = callDirection === 'inbound' ? toNumber : fromNumber;

      // Resolve <Dial callerId>: wizard non-UAE pick → TWILIO_TRANSFER_CALLER_ID env →
      // inbound DID (omitted when UAE toll-free or otherwise UAE-only).
      const callerId = resolveHumanAgentBridgeCallerId({
        wizardOutboundPhoneE164: humanWizardCli,
        inboundDid,
      });

      let source: 'wizard' | 'env' | 'inbound' | 'omitted';
      if (callerId && humanWizardCli && callerId === humanWizardCli) source = 'wizard';
      else if (callerId && callerId === process.env.TWILIO_TRANSFER_CALLER_ID?.trim().replace(/[\s\-().]/g, '')) source = 'env';
      else if (callerId) source = 'inbound';
      else source = 'omitted';

      console.log(
        `[Transfer] engine=twilio-openai callSid=${callSid} target=${targetNumber} callerId=${callerId ?? '(omitted)'} source=${source} direction=${callDirection} inboundDid=${inboundDid ?? '(none)'}`
      );

      // Persist the resolved CLI + source so Call Detail can show
      // "Transfer CLI: +44… (env)" / "(omitted — UAE-only DID)".
      try {
        await db
          .update(twilioOpenaiCalls)
          .set({
            wasTransferred: true,
            transferredTo: targetNumber,
            transferredAt: new Date(),
            transferCallerId: callerId ?? null,
            transferCallerIdSource: source,
          })
          .where(eq(twilioOpenaiCalls.twilioCallSid, callSid));
      } catch (persistErr: any) {
        console.error(`[TwilioOpenAI Bridge] Failed to persist transfer audit for ${callSid}:`, persistErr.message);
      }

      // Surface on Live Monitoring before we tear down the OpenAI WS.
      liveCallRegistry.updateCallByTwilioSid(callSid, {
        wasTransferred: true,
        transferredTo: targetNumber,
        transferCallerId: callerId ?? null,
        transferCallerIdSource: source,
      });

      const twiml = generateTransferTwiML(targetNumber, callerId);
      
      await client.calls(callSid).update({
        twiml: twiml,
      });
      
      console.log(`[TwilioOpenAI Bridge] Transfer initiated successfully for ${callSid}`);
      
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.close(1000, 'Call transferred');
      }
      
      session.status = 'disconnected';
      session.endedAt = new Date();
      
      this.fireEndCallback(session);
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Transfer failed for ${callSid}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute actual call hangup via Twilio REST API
   * Updates the live call with TwiML to end the call gracefully
   */
  private static async executeHangup(session: AudioBridgeSession): Promise<{ success: boolean; error?: string }> {
    const { callSid } = session;
    
    try {
      const client = await getTwilioClient();
      
      const twiml = generateHangupTwiML('Thank you for calling. Goodbye!');
      
      console.log(`[TwilioOpenAI Bridge] Hanging up call ${callSid}`);
      
      await client.calls(callSid).update({
        twiml: twiml,
      });
      
      console.log(`[TwilioOpenAI Bridge] Hangup successful for ${callSid}`);
      
      session.status = 'disconnected';
      session.endedAt = new Date();
      
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.close(1000, 'Call ended');
      }
      
      this.fireEndCallback(session);
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] Hangup failed for ${callSid}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute audio playback by streaming audio through the Twilio Media Stream WebSocket
   * 
   * For Twilio Media Streams (bidirectional), we send audio as 'media' events
   * The audio must be in mulaw 8kHz format, base64 encoded
   */
  private static async executePlayAudio(session: AudioBridgeSession, audioUrl: string): Promise<{ success: boolean; error?: string }> {
    const { callSid, twilioWs, streamSid, twilioStreamReady } = session;
    
    console.log(`[TwilioOpenAI Bridge] ===== INITIATING AUDIO PLAYBACK =====`);
    console.log(`[TwilioOpenAI Bridge] Call SID: ${callSid}`);
    console.log(`[TwilioOpenAI Bridge] Audio URL: ${audioUrl}`);
    console.log(`[TwilioOpenAI Bridge] Stream ready: ${twilioStreamReady}, streamSid: ${streamSid}`);
    
    // Verify stream is ready before attempting playback
    if (!twilioStreamReady) {
      console.error(`[TwilioOpenAI Bridge] Twilio stream not ready for audio playback`);
      return { success: false, error: 'Twilio stream not ready - please wait for call to connect' };
    }
    
    if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) {
      console.error(`[TwilioOpenAI Bridge] Twilio WebSocket not available for audio playback`);
      return { success: false, error: 'Twilio WebSocket not available' };
    }
    
    if (!streamSid) {
      console.error(`[TwilioOpenAI Bridge] Stream SID not available for audio playback`);
      return { success: false, error: 'Stream SID not available' };
    }
    
    try {
      // Construct full audio URL if it's a relative path
      let fullAudioUrl = audioUrl;
      if (audioUrl.startsWith('/')) {
        // Priority: APP_DOMAIN > REPLIT_DOMAINS (prod) > DEV_DOMAIN/REPLIT_DEV_DOMAIN (dev only) > localhost
        const isProduction = process.env.NODE_ENV === 'production';
        let baseUrl: string;
        if (process.env.APP_DOMAIN) {
          baseUrl = `https://${process.env.APP_DOMAIN.replace(/^https?:\/\//, '')}`;
        } else if (isProduction && process.env.REPLIT_DOMAINS) {
          baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}`;
        } else if (!isProduction && process.env.DEV_DOMAIN) {
          baseUrl = `https://${process.env.DEV_DOMAIN}`;
        } else if (!isProduction && process.env.REPLIT_DEV_DOMAIN) {
          baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
        } else if (process.env.REPLIT_DOMAINS) {
          baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}`;
        } else {
          baseUrl = process.env.BASE_URL || process.env.APP_URL || 'http://localhost:5000';
        }
        fullAudioUrl = `${baseUrl}${audioUrl}`;
        console.log(`[TwilioOpenAI Bridge] Converted relative URL to: ${fullAudioUrl}`);
      }
      
      // Fetch the audio file
      console.log(`[TwilioOpenAI Bridge] Fetching audio file...`);
      const response = await axios.get(fullAudioUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      
      const audioBuffer = Buffer.from(response.data);
      console.log(`[TwilioOpenAI Bridge] Audio file fetched, size: ${audioBuffer.length} bytes`);
      
      // For Twilio Media Streams, audio must be mulaw 8kHz
      // If the file is a WAV with mulaw encoding, extract the audio data
      // If it's raw mulaw, use it directly
      // If it's MP3 or other format, we need to convert it (complex - skip for now)
      
      let mulawData: Buffer;
      const contentType = response.headers['content-type'] || '';
      
      if (contentType.includes('audio/wav') || contentType.includes('audio/x-wav') || 
          audioUrl.endsWith('.wav') || audioUrl.includes('.wav')) {
        // WAV file - try to extract raw audio data (skip header)
        // Standard WAV header is 44 bytes, but can vary
        // Look for 'data' chunk
        const dataIndex = audioBuffer.indexOf(Buffer.from('data'));
        if (dataIndex > 0 && dataIndex + 8 < audioBuffer.length) {
          // Skip 'data' + 4 bytes of chunk size
          mulawData = audioBuffer.slice(dataIndex + 8);
          console.log(`[TwilioOpenAI Bridge] Extracted audio data from WAV, size: ${mulawData.length} bytes`);
        } else {
          // Fallback: skip first 44 bytes (standard header)
          mulawData = audioBuffer.slice(44);
          console.log(`[TwilioOpenAI Bridge] Using fallback WAV extraction, size: ${mulawData.length} bytes`);
        }
      } else if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3') ||
                 audioUrl.endsWith('.mp3') || audioUrl.includes('.mp3')) {
        // MP3 file - convert to mulaw 8kHz WAV using ffmpeg
        console.log(`[TwilioOpenAI Bridge] MP3 format detected - converting to mulaw 8kHz...`);
        
        const convertedData = await this.convertAudioToMulaw(audioBuffer, 'mp3');
        if (!convertedData) {
          return { 
            success: false, 
            error: 'Failed to convert MP3 audio to mulaw format.' 
          };
        }
        mulawData = convertedData;
        console.log(`[TwilioOpenAI Bridge] Converted MP3 to mulaw, size: ${mulawData.length} bytes`);
      } else {
        // Assume it's already raw mulaw data
        mulawData = audioBuffer;
        console.log(`[TwilioOpenAI Bridge] Using audio data directly, size: ${mulawData.length} bytes`);
      }
      
      // Stream audio in chunks (160 bytes = 20ms of 8kHz mulaw audio)
      const chunkSize = 160;
      const totalChunks = Math.ceil(mulawData.length / chunkSize);
      console.log(`[TwilioOpenAI Bridge] Streaming ${totalChunks} audio chunks...`);
      
      let chunksSent = 0;
      for (let offset = 0; offset < mulawData.length; offset += chunkSize) {
        const chunk = mulawData.slice(offset, offset + chunkSize);
        const payload = chunk.toString('base64');
        
        if (twilioWs.readyState !== WebSocket.OPEN) {
          console.warn(`[TwilioOpenAI Bridge] WebSocket closed during playback at chunk ${chunksSent}`);
          break;
        }
        
        twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: payload,
          },
        }));
        
        chunksSent++;
        
        // Add small delay every 50 chunks to prevent flooding
        if (chunksSent % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Send a mark event to track when playback completes
      const markName = `audio_playback_${Date.now()}`;
      twilioWs.send(JSON.stringify({
        event: 'mark',
        streamSid: streamSid,
        mark: {
          name: markName,
        },
      }));
      
      // Calculate playback duration and wait for audio to finish
      // Mulaw 8kHz = 8000 samples/second, 1 byte per sample
      const audioDurationMs = Math.ceil((mulawData.length / 8000) * 1000);
      console.log(`[TwilioOpenAI Bridge] Audio duration: ${audioDurationMs}ms, waiting for playback...`);
      
      // Wait for estimated playback duration plus buffer
      await new Promise(resolve => setTimeout(resolve, audioDurationMs + 500));
      
      console.log(`[TwilioOpenAI Bridge] ===== SUCCESS - Audio playback complete =====`);
      console.log(`[TwilioOpenAI Bridge] Sent ${chunksSent} chunks, mark: ${markName}`);
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] ===== ERROR =====`);
      console.error(`[TwilioOpenAI Bridge] Error message: ${error.message}`);
      if (error.response) {
        console.error(`[TwilioOpenAI Bridge] Response status: ${error.response.status}`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper to fire end callback only once with session data
   */
  private static fireEndCallback(session: AudioBridgeSession): void {
    if (session.endCallbackFired || !session.onEndCallback) {
      return;
    }

    this.stopRingback(session);
    
    session.endCallbackFired = true;
    session.endedAt = session.endedAt || new Date();
    
    const duration = session.endedAt
      ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : 0;
      
    const transcript = session.transcriptParts
      .map(p => `${p.role === 'user' ? 'User' : 'Agent'}: ${p.text}`)
      .join('\n');
    
    session.onEndCallback({ 
      transcript, 
      duration, 
      openaiSessionId: session.openaiSessionId || '' 
    });
  }

  /**
   * Convert audio to mulaw 8kHz format using ffmpeg
   * Supports MP3, WAV, and other common audio formats
   */
  private static async convertAudioToMulaw(audioBuffer: Buffer, inputFormat: string): Promise<Buffer | null> {
    const tempId = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${tempId}.${inputFormat}`);
    const outputPath = path.join(tempDir, `${tempId}_mulaw.raw`);
    
    try {
      // Write input file
      await fsWriteFile(inputPath, audioBuffer);
      console.log(`[TwilioOpenAI Bridge] Wrote temp audio file: ${inputPath} (${audioBuffer.length} bytes)`);
      
      // Convert using ffmpeg to raw mulaw 8kHz mono
      // -f mulaw outputs raw mulaw without WAV header
      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ar 8000 -ac 1 -f mulaw "${outputPath}"`;
      console.log(`[TwilioOpenAI Bridge] Running ffmpeg conversion...`);
      
      await execAsync(ffmpegCmd);
      
      // Read converted output
      const mulawData = await fsReadFile(outputPath);
      console.log(`[TwilioOpenAI Bridge] Conversion complete: ${mulawData.length} bytes of mulaw audio`);
      
      // Clean up temp files
      await fsUnlink(inputPath).catch(() => {});
      await fsUnlink(outputPath).catch(() => {});
      
      return mulawData;
      
    } catch (error: any) {
      console.error(`[TwilioOpenAI Bridge] FFmpeg conversion failed: ${error.message}`);
      
      // Clean up temp files on error
      await fsUnlink(inputPath).catch(() => {});
      await fsUnlink(outputPath).catch(() => {});
      
      return null;
    }
  }
}
