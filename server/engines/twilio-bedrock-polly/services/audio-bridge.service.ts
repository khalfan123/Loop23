'use strict';
/**
 * ============================================================
 * Twilio-Bedrock-Polly Audio Bridge Service
 *
 * Bridges audio between Twilio Media Streams and AWS Bedrock + Polly.
 * Turn-based flow:
 * 1. Receive mulaw 8kHz audio from Twilio WebSocket
 * 2. Buffer audio and detect end of speech (silence detection)
 * 3. Transcribe using OpenAI Whisper API
 * 4. Send text to Bedrock Claude for AI response
 * 5. Process tool calls if any
 * 6. Convert response text to speech using AWS Polly
 * 7. Send Polly audio back to Twilio stream as mulaw chunks
 * ============================================================
 */

import WebSocket from 'ws';
import { awsBedrockService } from '../../../services/aws-bedrock';
import { awsPollyService } from '../../../services/aws-polly';
import { cartesiaTTSService } from '../../../services/cartesia-tts';
import { getTwilioClient } from '../../../services/twilio-connector';
import { generateTransferTwiML, generateHangupTwiML } from '../config/config';
import { db } from '../../../db';
import { agents, openaiCredentials } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { callErrorLogger } from '../../../services/call-error-logger';
import type {
  AgentConfig,
  BedrockPollyBridgeSession,
  CreateSessionParams,
  TwilioMediaStreamEvent,
  BedrockConversationMessage,
} from '../types';
import { isOpenAIModel } from '../types';
import { openaiInvokeStream, openaiInvoke, openaiInvokeStreamStructured } from './openai-llm.service';
import { ToolRegistry, toBedrockToolSpecs, agentToolToDefinition } from '../../../services/agent-orchestration/tool-registry';
import { converseStream, converseWithToolResults } from '../../../services/agent-orchestration/bedrock-converse';
import type { LLMStreamEvent, StructuredToolCall, StructuredToolResult, ToolDefinition } from '../../../services/agent-orchestration/tool-registry';
import { humanizeToSSML } from './ssml-humanizer';
import { conversationResumptionService } from '../../../services/conversation-resumption';
import { calls } from '@shared/schema';
import { RealtimeSentimentService } from '../../../services/realtime-sentiment.service';
import { liveCallRegistry } from '../../../services/live-call-registry';
import { NotificationService } from '../../../services/notification-service';
import { enrollSpeaker, matchesSpeaker, isEnrolled, clearSpeaker } from '../../../services/voice-fingerprint';
import {
  mulawEnergy,
  pcmToMulaw as corePcmToMulaw,
  downsamplePcm16By2,
} from '../../../voice-core/audio/g711';
import { createMulawWavHeader } from '../../../voice-core/audio/wav';
import { splitSentences as coreSplitSentences } from '../../../voice-core/text/sentence-split';
import { sanitizeForTTS as coreSanitizeForTTS } from '../../../voice-core/text/tts-sanitize';
import {
  isWhisperHallucination as coreIsWhisperHallucination,
  isLikelyBackgroundSpeech as coreIsLikelyBackgroundSpeech,
  isLanguageMismatch as coreIsLanguageMismatch,
} from '../../../voice-core/stt/whisper-filters';

/**
 * Silence detection timers keyed by callSid.
 * Stored outside the session to keep the session interface clean.
 */
const silenceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

/**
 * Audio buffers keyed by callSid.
 * Each entry accumulates raw mulaw chunks until silence is detected.
 */
const audioBuffers: Map<string, Buffer[]> = new Map();

/**
 * Tracks the timestamp of the first audio chunk in the current buffer,
 * used to enforce a maximum buffering duration.
 */
const bufferStartTimes: Map<string, number> = new Map();

/**
 * Flag used to signal barge-in so that ongoing synthesis stops sending chunks.
 */
const bargeInFlags: Map<string, boolean> = new Map();

const noResponseTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const callerHasSpoken: Map<string, boolean> = new Map();
const inboundHallucinationCount: Map<string, number> = new Map();
const inboundNoResponseTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

const bargeInAccum: Map<string, number> = new Map();

const playingGreeting: Map<string, boolean> = new Map();
const greetingMarkCallbacks: Map<string, () => void> = new Map();

const openingPhaseEnd: Map<string, number> = new Map();

const speechActive: Map<string, boolean> = new Map();

const pendingMarks: Map<string, Set<string>> = new Map();
let markCounter = 0;

const noiseFloorSamples: Map<string, number[]> = new Map();
const calibratedNoiseFloor: Map<string, number> = new Map();
const calibrationStartTime: Map<string, number> = new Map();

const peakEnergy: Map<string, number> = new Map();

const lastTtsEndTime: Map<string, number> = new Map();
const ECHO_COOLDOWN_MS = 600;

const whisperAbortControllers: Map<string, AbortController> = new Map();

/**
 * Twilio stream ready flags, tracked separately from session to avoid
 * race conditions during first-message sending.
 */
const twilioStreamReady: Map<string, boolean> = new Map();

export class BedrockPollyAudioBridge {
  private static activeSessions: Map<string, BedrockPollyBridgeSession> = new Map();

  private static readonly SILENCE_SHORT_MS = 250;
  private static readonly SILENCE_MEDIUM_MS = 200;
  private static readonly SILENCE_LONG_UTTERANCE_MS = 150;
  private static readonly LONG_UTTERANCE_BYTES = 16000;
  private static readonly SHORT_UTTERANCE_BYTES = 8000;
  private static readonly OPENING_SILENCE_THRESHOLD_MS = 600;
  private static readonly OPENING_PHASE_DURATION_MS = 8000;
  private static readonly MIN_AUDIO_LENGTH = 6400;
  private static readonly MAX_BUFFER_DURATION_MS = 15000;
  private static readonly AUDIO_CHUNK_SIZE = 640;
  private static readonly NO_RESPONSE_TIMEOUT_MS = 6000;
  private static readonly FOLLOW_UP_TIMEOUT_MS = 5000;
  private static readonly DEFAULT_SPEECH_ENERGY_THRESHOLD = 600;
  private static readonly DEFAULT_BARGE_IN_ENERGY_THRESHOLD = 800;
  private static readonly BARGE_IN_MIN_BYTES = 3200;
  private static readonly NOISE_CALIBRATION_DURATION_MS = 1500;
  private static readonly NOISE_FLOOR_SPEECH_MULTIPLIER = 4.0;
  private static readonly NOISE_FLOOR_BARGE_IN_MULTIPLIER = 3.5;
  private static readonly MIN_SPEECH_THRESHOLD = 500;
  private static readonly MIN_BARGE_IN_THRESHOLD = 600;
  private static readonly ENERGY_FALLOFF_RATIO = 0.3;
  private static readonly SUSTAINED_ENERGY_RATIO = 0.45;
  private static readonly ENERGY_VARIANCE_MAX_RATIO = 4.0;

  private static calculateMulawEnergy(chunk: Buffer): number {
    return mulawEnergy(chunk);
  }

  private static collectNoiseFloorSample(callSid: string, energy: number): void {
    if (calibratedNoiseFloor.has(callSid)) return;

    if (!calibrationStartTime.has(callSid)) {
      calibrationStartTime.set(callSid, Date.now());
      noiseFloorSamples.set(callSid, []);
    }

    const samples = noiseFloorSamples.get(callSid)!;
    samples.push(energy);

    const elapsed = Date.now() - calibrationStartTime.get(callSid)!;
    if (elapsed >= this.NOISE_CALIBRATION_DURATION_MS && samples.length >= 10) {
      const sorted = [...samples].sort((a, b) => a - b);
      const trimCount = Math.floor(sorted.length * 0.1);
      const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
      const avgNoise = trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;

      calibratedNoiseFloor.set(callSid, avgNoise);

      const speechThresh = this.getSpeechThreshold(callSid);
      const bargeInThresh = this.getBargeInThreshold(callSid);
      console.log(`[BedrockPolly Bridge] Noise floor calibrated for ${callSid}: floor=${Math.round(avgNoise)}, speechThreshold=${Math.round(speechThresh)}, bargeInThreshold=${Math.round(bargeInThresh)} (from ${samples.length} samples)`);
    }
  }

  private static getSpeechThreshold(callSid: string): number {
    const floor = calibratedNoiseFloor.get(callSid);
    if (floor === undefined) return this.DEFAULT_SPEECH_ENERGY_THRESHOLD;
    return Math.max(
      this.MIN_SPEECH_THRESHOLD,
      floor * this.NOISE_FLOOR_SPEECH_MULTIPLIER
    );
  }

  private static getBargeInThreshold(callSid: string): number {
    const floor = calibratedNoiseFloor.get(callSid);
    if (floor === undefined) return this.DEFAULT_BARGE_IN_ENERGY_THRESHOLD;
    return Math.max(
      this.MIN_BARGE_IN_THRESHOLD,
      floor * this.NOISE_FLOOR_BARGE_IN_MULTIPLIER
    );
  }

  private static readonly FINAL_HANGUP_TIMEOUT_MS = 8000;

  /**
   * Create a new Bedrock+Polly bridge session for a Twilio call.
   * Unlike the OpenAI bridge there is no external WebSocket to connect;
   * the session is immediately "connected" and ready to process audio.
   */
  static async createSession(params: CreateSessionParams): Promise<BedrockPollyBridgeSession> {
    const { callSid, agentConfig, twilioWs, streamSid, fromNumber, toNumber, callDirection } = params;

    const ttsLabel = agentConfig.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : agentConfig.ttsProvider === 'cartesia' ? 'Cartesia Sonic' : 'AWS Polly';
    const ttsVoiceId = agentConfig.ttsProvider === 'elevenlabs' ? agentConfig.elevenLabsVoiceId : agentConfig.ttsProvider === 'cartesia' ? agentConfig.cartesiaVoiceId : agentConfig.voice;
    console.log(`[BedrockPolly Bridge] Creating session for call ${callSid} (direction: ${callDirection || 'unknown'})`);
    console.log(`[BedrockPolly Bridge] TTS: ${ttsLabel}, Voice: ${ttsVoiceId}, Model: ${agentConfig.model}`);

    const session: BedrockPollyBridgeSession = {
      callSid,
      streamSid: streamSid || null,
      bedrockSessionId: `bedrock-${callSid}-${Date.now()}`,
      status: 'connected',
      startedAt: new Date(),
      endedAt: null,
      twilioWs: twilioWs || null,
      agentConfig,
      transcriptParts: [],
      toolHandlers: new Map(),
      processedToolCallIds: new Set(),
      onTranscriptCallback: null,
      onToolCallback: null,
      onAudioCallback: null,
      onEndCallback: null,
      messages: [],
      fromNumber,
      toNumber,
      callDirection,
      pendingAudioQueue: [],
      isProcessing: false,
      pollyEngine: 'neural',
      ttsProvider: agentConfig.ttsProvider || 'aws_polly',
      isOutbound: callDirection === 'outbound',
      explicitEndCall: false,
    };

    if (agentConfig.tools) {
      for (const tool of agentConfig.tools) {
        session.toolHandlers.set(tool.name, tool.handler);
      }
    }

    audioBuffers.set(callSid, []);
    bargeInFlags.set(callSid, false);
    twilioStreamReady.set(callSid, false);

    this.activeSessions.set(callSid, session);

    awsBedrockService.warmConnection().catch(() => {});


    console.log(`[BedrockPolly Bridge] Session created for ${callSid} — ready for Twilio stream`);
    return session;
  }

  /**
   * Retrieve an active session by its call SID.
   */
  static getSession(callSid: string): BedrockPollyBridgeSession | undefined {
    return this.activeSessions.get(callSid);
  }

  /**
   * Check whether a session exists for the given call SID.
   */
  static hasSession(callSid: string): boolean {
    return this.activeSessions.has(callSid);
  }

  /**
   * Re-key a session from one identifier to another.
   * Used for outbound calls where the internal call ID differs from the
   * Twilio CallSid assigned after the call connects.
   */
  static remapSession(oldKey: string, newKey: string): void {
    const session = this.activeSessions.get(oldKey);
    if (!session) return;

    session.callSid = newKey;
    this.activeSessions.delete(oldKey);
    this.activeSessions.set(newKey, session);

    const buf = audioBuffers.get(oldKey);
    if (buf) {
      audioBuffers.delete(oldKey);
      audioBuffers.set(newKey, buf);
    }

    const timer = silenceTimers.get(oldKey);
    if (timer) {
      silenceTimers.delete(oldKey);
      silenceTimers.set(newKey, timer);
    }

    const startTime = bufferStartTimes.get(oldKey);
    if (startTime !== undefined) {
      bufferStartTimes.delete(oldKey);
      bufferStartTimes.set(newKey, startTime);
    }

    const flag = bargeInFlags.get(oldKey);
    if (flag !== undefined) {
      bargeInFlags.delete(oldKey);
      bargeInFlags.set(newKey, flag);
    }

    const ready = twilioStreamReady.get(oldKey);
    if (ready !== undefined) {
      twilioStreamReady.delete(oldKey);
      twilioStreamReady.set(newKey, ready);
    }

    const nrTimer = noResponseTimers.get(oldKey);
    if (nrTimer) {
      noResponseTimers.delete(oldKey);
      noResponseTimers.set(newKey, nrTimer);
    }

    const spoken = callerHasSpoken.get(oldKey);
    if (spoken !== undefined) {
      callerHasSpoken.delete(oldKey);
      callerHasSpoken.set(newKey, spoken);
    }

    const accum = bargeInAccum.get(oldKey);
    if (accum !== undefined) {
      bargeInAccum.delete(oldKey);
      bargeInAccum.set(newKey, accum);
    }

    const greeting = playingGreeting.get(oldKey);
    if (greeting !== undefined) {
      playingGreeting.delete(oldKey);
      playingGreeting.set(newKey, greeting);
    }

    const greetCb = greetingMarkCallbacks.get(oldKey);
    if (greetCb) {
      greetingMarkCallbacks.delete(oldKey);
      greetingMarkCallbacks.set(newKey, greetCb);
    }

    const opEnd = openingPhaseEnd.get(oldKey);
    if (opEnd !== undefined) {
      openingPhaseEnd.delete(oldKey);
      openingPhaseEnd.set(newKey, opEnd);
    }

    const hallucCount = inboundHallucinationCount.get(oldKey);
    if (hallucCount !== undefined) {
      inboundHallucinationCount.delete(oldKey);
      inboundHallucinationCount.set(newKey, hallucCount);
    }

    const inbNrTimer = inboundNoResponseTimers.get(oldKey);
    if (inbNrTimer) {
      inboundNoResponseTimers.delete(oldKey);
      inboundNoResponseTimers.set(newKey, inbNrTimer);
    }

    const marks = pendingMarks.get(oldKey);
    if (marks) {
      pendingMarks.delete(oldKey);
      pendingMarks.set(newKey, marks);
    }

    const nfSamples = noiseFloorSamples.get(oldKey);
    if (nfSamples) {
      noiseFloorSamples.delete(oldKey);
      noiseFloorSamples.set(newKey, nfSamples);
    }

    const nfCalibrated = calibratedNoiseFloor.get(oldKey);
    if (nfCalibrated !== undefined) {
      calibratedNoiseFloor.delete(oldKey);
      calibratedNoiseFloor.set(newKey, nfCalibrated);
    }

    const calStart = calibrationStartTime.get(oldKey);
    if (calStart !== undefined) {
      calibrationStartTime.delete(oldKey);
      calibrationStartTime.set(newKey, calStart);
    }

    const pk = peakEnergy.get(oldKey);
    if (pk !== undefined) {
      peakEnergy.delete(oldKey);
      peakEnergy.set(newKey, pk);
    }

    const ttsEnd = lastTtsEndTime.get(oldKey);
    if (ttsEnd !== undefined) {
      lastTtsEndTime.delete(oldKey);
      lastTtsEndTime.set(newKey, ttsEnd);
    }

    console.log(`[BedrockPolly Bridge] Remapped session ${oldKey} → ${newKey}`);
  }

  /**
   * Handle an incoming Twilio Media Stream event for a given call.
   *
   * Event types handled:
   * - connected: connection established
   * - start: stream metadata received, triggers first message
   * - media: raw audio payload buffered for transcription
   * - stop: stream ended, triggers session cleanup
   * - mark: acknowledgement of a previously sent mark
   */
  static handleTwilioMedia(callSid: string, event: TwilioMediaStreamEvent): void {
    const session = this.activeSessions.get(callSid);
    if (!session) {
      return;
    }
    if (session.status === 'disconnected' && event.event === 'media') {
      return;
    }

    switch (event.event) {
      case 'connected':
        console.log(`[BedrockPolly Bridge] Twilio WebSocket connected for ${callSid}`);
        break;

      case 'start':
        session.streamSid = event.start?.streamSid || event.streamSid || null;
        twilioStreamReady.set(callSid, true);
        console.log(`[BedrockPolly Bridge] Twilio stream started for ${callSid}, streamSid=${session.streamSid}`);

        if (session.isOutbound && session.agentConfig.firstMessage) {
          this.sendFirstMessage(session).catch((err) => {
            console.error(`[BedrockPolly Bridge] Error sending first message:`, err);
          });
        } else if (!session.isOutbound && session.agentConfig.firstMessage) {
          this.sendInboundGreeting(session).catch((err) => {
            console.error(`[BedrockPolly Bridge] Error sending inbound greeting:`, err);
          });
        }
        break;

      case 'media':
        if (event.media?.payload) {
          const audioChunk = Buffer.from(event.media.payload, 'base64');

          if (!session._mediaLogThrottle) {
            session._mediaLogThrottle = 0;
          }
          session._mediaLogThrottle++;
          if (session._mediaLogThrottle === 1 || session._mediaLogThrottle % 500 === 0) {
            console.log(`[BedrockPolly Bridge] Media event #${session._mediaLogThrottle} for ${callSid}, chunk=${audioChunk.length}b, processing=${session.isProcessing}, status=${session.status}`);
          }

          if (playingGreeting.get(callSid)) {
            const greetingEnergy = this.calculateMulawEnergy(audioChunk);
            this.collectNoiseFloorSample(callSid, greetingEnergy);
            break;
          }

          if (session.isProcessing) {
            const energy = this.calculateMulawEnergy(audioChunk);
            if (energy > this.getBargeInThreshold(callSid)) {
              const accum = (bargeInAccum.get(callSid) || 0) + audioChunk.length;
              bargeInAccum.set(callSid, accum);
              if (accum >= this.BARGE_IN_MIN_BYTES && !bargeInFlags.get(callSid)) {
                bargeInFlags.set(callSid, true);
                console.log(`[BedrockPolly Bridge] Barge-in activated for ${callSid} (accum=${accum}b, energy=${Math.round(energy)})`);
                if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
                  session.twilioWs.send(JSON.stringify({
                    event: 'clear',
                    streamSid: session.streamSid,
                  }));
                }
              }
            }
            break;
          }

          {
            const ttsEnd = lastTtsEndTime.get(callSid);
            if (ttsEnd && (Date.now() - ttsEnd) < ECHO_COOLDOWN_MS) {
              this.collectNoiseFloorSample(callSid, this.calculateMulawEnergy(audioChunk));
              break;
            }
          }

          let buf = audioBuffers.get(callSid);
          if (!buf) {
            buf = [];
            audioBuffers.set(callSid, buf);
          }

          const energy = this.calculateMulawEnergy(audioChunk);
          this.collectNoiseFloorSample(callSid, energy);
          const isSpeech = energy > this.getSpeechThreshold(callSid);

          if (isSpeech) {
            buf.push(audioChunk);

            if (!bufferStartTimes.has(callSid)) {
              bufferStartTimes.set(callSid, Date.now());
            }

            if (!speechActive.get(callSid)) {
              speechActive.set(callSid, true);
              peakEnergy.set(callSid, energy);
              console.log(`[BedrockPolly Bridge] Speech detected for ${callSid} (energy=${Math.round(energy)})`);
            }

            const currentPeak = peakEnergy.get(callSid) || energy;
            if (energy > currentPeak) {
              peakEnergy.set(callSid, energy);
            }

            const existingTimer = silenceTimers.get(callSid);
            if (existingTimer) {
              clearTimeout(existingTimer);
              silenceTimers.delete(callSid);
            }
          } else if (speechActive.get(callSid)) {
            buf.push(audioChunk);

            if (!silenceTimers.has(callSid)) {
              const phaseEnd = session.isOutbound ? openingPhaseEnd.get(callSid) : undefined;
              const isOpeningPhase = session.isOutbound && phaseEnd && Date.now() < phaseEnd;

              const vadOverrideMs = session.agentConfig?.behaviorConfig?.vadSilenceTimeoutMs;
              let silenceMs: number;
              if (isOpeningPhase) {
                silenceMs = this.OPENING_SILENCE_THRESHOLD_MS;
              } else if (vadOverrideMs) {
                silenceMs = vadOverrideMs;
              } else {
                const totalLen = buf.reduce((s, b) => s + b.length, 0);
                const pk = peakEnergy.get(callSid) || 0;
                const energyDropped = pk > 0 && totalLen >= this.SHORT_UTTERANCE_BYTES && energy < pk * this.ENERGY_FALLOFF_RATIO;

                if (totalLen >= this.LONG_UTTERANCE_BYTES || energyDropped) {
                  silenceMs = this.SILENCE_LONG_UTTERANCE_MS;
                } else if (totalLen >= this.SHORT_UTTERANCE_BYTES) {
                  silenceMs = this.SILENCE_MEDIUM_MS;
                } else {
                  silenceMs = this.SILENCE_SHORT_MS;
                }
              }

              const timer = setTimeout(() => {
                speechActive.delete(callSid);
                peakEnergy.delete(callSid);
                this.onSilenceDetected(session);
              }, silenceMs);
              silenceTimers.set(callSid, timer);
            }
          }

          if (bufferStartTimes.has(callSid)) {
            const elapsed = Date.now() - (bufferStartTimes.get(callSid) || Date.now());
            if (elapsed >= this.MAX_BUFFER_DURATION_MS) {
              speechActive.delete(callSid);
              this.onSilenceDetected(session);
            }
          }
        }
        break;

      case 'stop':
        console.log(`[BedrockPolly Bridge] Twilio stream stopped for ${callSid}`);
        this.endSession(callSid).catch((err) => {
          console.error(`[BedrockPolly Bridge] Error ending session:`, err);
        });
        break;

      case 'mark':
        if (event.mark) {
          const marks = pendingMarks.get(callSid);
          if (marks) {
            marks.delete(event.mark.name);
          }
          console.log(`[BedrockPolly Bridge] Mark acknowledged: ${event.mark.name} for ${callSid}`);

          if (event.mark.name === 'greeting_playback_complete') {
            const cb = greetingMarkCallbacks.get(callSid);
            if (cb) {
              greetingMarkCallbacks.delete(callSid);
              console.log(`[BedrockPolly Bridge] Greeting playback confirmed by Twilio for ${callSid} — starting no-response timer`);
              cb();
            }
          }
        }
        break;

      default:
        console.log(`[BedrockPolly Bridge] Unknown event: ${(event as any).event}`);
    }
  }

  /**
   * Called when the silence timer fires, indicating the user has stopped
   * speaking. Kicks off the turn processing pipeline if audio was buffered.
   */
  private static onSilenceDetected(session: BedrockPollyBridgeSession): void {
    const { callSid } = session;

    silenceTimers.delete(callSid);
    bufferStartTimes.delete(callSid);

    if (session.status === 'disconnected') {
      return;
    }

    if (session.isProcessing) {
      console.log(`[BedrockPolly Bridge] onSilenceDetected skipped — isProcessing=true for ${callSid}`);
      return;
    }

    const buf = audioBuffers.get(callSid) || [];
    const totalLength = buf.reduce((sum, b) => sum + b.length, 0);

    const isOpeningPhase = session.isOutbound && !callerHasSpoken.get(callSid);
    const isEarlyConversation = session.isOutbound && session.messages.filter(m => m.role === 'user').length < 2;
    const isInboundEarlyConversation = !session.isOutbound && session.messages.filter(m => m.role === 'user').length < 2;
    const minRequired = isOpeningPhase ? Math.floor(this.MIN_AUDIO_LENGTH * 0.3) : ((isEarlyConversation || isInboundEarlyConversation) ? Math.floor(this.MIN_AUDIO_LENGTH * 0.5) : this.MIN_AUDIO_LENGTH);
    console.log(`[BedrockPolly Bridge] onSilenceDetected for ${callSid}: bufferSize=${totalLength}b, minRequired=${minRequired}b, callerHasSpoken=${callerHasSpoken.get(callSid)}${isOpeningPhase ? ' (opening phase - relaxed threshold)' : ''}`);

    if (totalLength < minRequired) {
      if (isOpeningPhase && totalLength > 0) {
        callerHasSpoken.set(callSid, true);
        greetingMarkCallbacks.delete(callSid);
        const nrTimer = noResponseTimers.get(callSid);
        if (nrTimer) {
          clearTimeout(nrTimer);
          noResponseTimers.delete(callSid);
          console.log(`[BedrockPolly Bridge] Short speech detected during opening — cancelled no-response timer for ${callSid}`);
        }
      }
      if (!session.isOutbound && totalLength > 0) {
        const inbNrTimer = inboundNoResponseTimers.get(callSid);
        if (inbNrTimer) {
          clearTimeout(inbNrTimer);
          inboundNoResponseTimers.delete(callSid);
          console.log(`[BedrockPolly Bridge] Short inbound speech detected — cancelled inbound no-response timer for ${callSid}`);
        }
      }
      audioBuffers.set(callSid, []);
      return;
    }

    if (session.isOutbound && !callerHasSpoken.get(callSid)) {
      callerHasSpoken.set(callSid, true);
      greetingMarkCallbacks.delete(callSid);
      const nrTimer = noResponseTimers.get(callSid);
      if (nrTimer) {
        clearTimeout(nrTimer);
        noResponseTimers.delete(callSid);
        console.log(`[BedrockPolly Bridge] Callee responded — cancelled no-response timer for ${callSid}`);
      }
    }

    session.isProcessing = true;
    bargeInFlags.set(callSid, false);
    bargeInAccum.set(callSid, 0);

    this.processUserTurn(session).catch((err) => {
      console.error(`[BedrockPolly Bridge] Error processing user turn for ${callSid}:`, err);
      session.isProcessing = false;
    });
  }

  private static readonly ACKNOWLEDGMENT_FILLERS: Record<string, string[]> = {
    en: ['Mm-hmm.', 'Right.', 'Yeah.', 'Okay.', 'Yep.', 'Uh-huh.'],
    ar: ['تمام.', 'أها.', 'ماشي.', 'أوكي.', 'اه.', 'صح.'],
    es: ['Ajá.', 'Sí.', 'Vale.', 'Okey.', 'Claro.', 'Mmm.'],
    fr: ['Ouais.', 'Oui.', 'Okay.', 'Hmm.', 'Mmm.', 'D\'accord.'],
    de: ['Ja.', 'Klar.', 'Okay.', 'Mmm.', 'Genau.', 'Jo.'],
    pt: ['Sim.', 'Tá.', 'Okay.', 'Aham.', 'Certo.', 'Mmm.'],
    hi: ['हाँ.', 'अच्छा.', 'हम्म.', 'जी.', 'ठीक.', 'ओके.'],
  };
  private static readonly THINKING_FILLERS: Record<string, string[]> = {
    en: ['Hmm,', 'So,', 'Well,', 'Okay so,', 'Right,', 'Let me see,'],
    ar: ['هم،', 'يعني،', 'طيب،', 'أوكي،', 'خلني أشوف،', 'حسناً،'],
    es: ['A ver,', 'Bueno,', 'Mmm,', 'Okay,', 'Entonces,', 'Mira,'],
    fr: ['Alors,', 'Bon,', 'Hmm,', 'Okay,', 'Voyons,', 'Donc,'],
    de: ['Also,', 'Hmm,', 'Okay,', 'Nun,', 'Mal sehen,', 'So,'],
    pt: ['Então,', 'Bom,', 'Hmm,', 'Okay,', 'Deixa eu ver,', 'Olha,'],
    hi: ['तो,', 'हम्म,', 'देखो,', 'अच्छा,', 'ओके,', 'एक सेकंड,'],
  };

  private static getPollyFallbackVoice(language?: string): string {
    const langVoiceMap: Record<string, string> = {
      ar: 'Hala',
      en: 'Joanna',
      es: 'Lupe',
      fr: 'Lea',
      de: 'Vicki',
      it: 'Bianca',
      pt: 'Camila',
      hi: 'Kajal',
      ja: 'Kazuha',
      ko: 'Seoyeon',
      zh: 'Zhiyu',
      tr: 'Burcu',
      nl: 'Laura',
      pl: 'Ola',
      sv: 'Elin',
      da: 'Sofie',
      nb: 'Ida',
      fi: 'Suvi',
    };
    if (!language) return 'Joanna';
    const langPrefix = language.split('-')[0].toLowerCase();
    return langVoiceMap[langPrefix] || 'Joanna';
  }

  private static getRandomFiller(fillers: string[]): string {
    return fillers[Math.floor(Math.random() * fillers.length)];
  }

  private static async playFillerAudio(session: BedrockPollyBridgeSession, filler: string): Promise<void> {
    try {
      const rawVoice = session.agentConfig.voice || 'Joanna';
      const voiceId = rawVoice.match(/^[0-9a-f-]{36}$/i) ? this.getPollyFallbackVoice(session.agentConfig.language) : rawVoice;
      const audioBuffer = await this.synthesizeWithPolly(filler, voiceId);
      const mulawAudio = this.pcmToMulaw(audioBuffer);
      const chunkSize = 640;
      for (let offset = 0; offset < mulawAudio.length; offset += chunkSize) {
        if (bargeInFlags.get(session.callSid)) break;
        const chunk = mulawAudio.subarray(offset, offset + chunkSize);
        if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
          session.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: session.streamSid,
            media: { payload: chunk.toString('base64') },
          }));
        }
      }
    } catch (e: any) {
      console.warn(`[BedrockPolly Bridge] Filler audio failed: ${e.message}`);
    }
  }

  /**
   * Process a complete user speech turn:
   * 1. Collect buffered audio
   * 2. Play instant acknowledgment filler (kills dead air)
   * 3. Transcribe via OpenAI Whisper
   * 4. Send to Bedrock for AI response
   * 5. Convert response to speech via Polly
   * 6. Stream audio back to Twilio
   */
  private static async processUserTurn(session: BedrockPollyBridgeSession): Promise<void> {
    const { callSid, agentConfig } = session;

    if (session.status === 'disconnected') {
      console.log(`[BedrockPolly Bridge] processUserTurn skipped — session disconnected for ${callSid}`);
      session.isProcessing = false;
      return;
    }

    try {
      const buf = audioBuffers.get(callSid) || [];
      audioBuffers.set(callSid, []);

      const audioBuffer = Buffer.concat(buf);
      const bufferEnergy = this.calculateMulawEnergy(audioBuffer);
      const speechThresh = this.getSpeechThreshold(callSid);
      console.log(`[BedrockPolly Bridge] processUserTurn START for ${callSid}: audioSize=${audioBuffer.length}b, avgEnergy=${Math.round(bufferEnergy)}, threshold=${Math.round(speechThresh)}`);

      const hasSpoken = callerHasSpoken.get(callSid);
      const energyMultiplier = (session.isOutbound && !hasSpoken) ? 0.2 : 0.4;
      if (bufferEnergy < speechThresh * energyMultiplier) {
        console.log(`[BedrockPolly Bridge] Buffer energy too low (${Math.round(bufferEnergy)} < ${Math.round(speechThresh * energyMultiplier)}), skipping Whisper for ${callSid} (multiplier=${energyMultiplier})`);
        session.isProcessing = false;
        return;
      }

      if (buf.length > 0) {
        const chunkEnergies = buf.map(chunk => this.calculateMulawEnergy(chunk));
        const chunksAboveThreshold = chunkEnergies.filter(e => e > speechThresh).length;
        const sustainedRatio = chunksAboveThreshold / chunkEnergies.length;

        if (sustainedRatio < this.SUSTAINED_ENERGY_RATIO) {
          console.log(`[BedrockPolly Bridge] Sustained energy check failed for ${callSid}: only ${Math.round(sustainedRatio * 100)}% of chunks above threshold (need ${Math.round(this.SUSTAINED_ENERGY_RATIO * 100)}%) — likely background burst`);
          session.isProcessing = false;
          return;
        }

        if (chunkEnergies.length >= 3) {
          const meanEnergy = chunkEnergies.reduce((s, e) => s + e, 0) / chunkEnergies.length;
          if (meanEnergy > 0) {
            const variance = chunkEnergies.reduce((s, e) => s + (e - meanEnergy) * (e - meanEnergy), 0) / chunkEnergies.length;
            const coeffOfVariation = Math.sqrt(variance) / meanEnergy;

            if (coeffOfVariation > this.ENERGY_VARIANCE_MAX_RATIO) {
              console.log(`[BedrockPolly Bridge] Energy consistency check failed for ${callSid}: coefficient of variation=${coeffOfVariation.toFixed(2)} (max=${this.ENERGY_VARIANCE_MAX_RATIO}) — likely noise burst, not steady speech`);
              session.isProcessing = false;
              return;
            }
          }
        }
      }

      const voiceIsolationEnabled = session.agentConfig?.behaviorConfig?.voiceIsolation !== false;
      if (voiceIsolationEnabled && isEnrolled(callSid)) {
        const speakerMatch = matchesSpeaker(callSid, audioBuffer);
        if (!speakerMatch && bufferEnergy < speechThresh * 3) {
          console.log(`[VAD] Rejected: different speaker detected for ${callSid} (energy=${Math.round(bufferEnergy)}, not loud enough to override)`);
          session.isProcessing = false;
          return;
        }
        if (!speakerMatch) {
          console.log(`[VAD] Speaker mismatch but high energy for ${callSid} — proceeding with transcription (possible caller tone change)`);
        }
      }

      const turnCount = session.messages.filter(m => m.role === 'user').length;
      const isLongUtterance = audioBuffer.length > 16000;

      const isStreamReady = session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid;
      if (turnCount >= 1 && isLongUtterance && isStreamReady && !playingGreeting.get(callSid) && !bargeInFlags.get(callSid)) {
        const lang = session.agentConfig.language || 'en';
        const ackFillers = this.ACKNOWLEDGMENT_FILLERS[lang] || this.ACKNOWLEDGMENT_FILLERS['en'];
        const filler = this.getRandomFiller(ackFillers);
        console.log(`[BedrockPolly Bridge] Playing acknowledgment filler for ${callSid}: "${filler}"`);
        await this.playFillerAudio(session, filler);
      }

      const turnStart = Date.now();
      const recentUserMessages = session.messages.filter(m => m.role === 'user').slice(-4).map(m => m.content).filter(Boolean);
      const sttStart = Date.now();
      const transcription = await this.transcribeAudio(audioBuffer, session.agentConfig.language, recentUserMessages, callSid);
      const sttMs = Date.now() - sttStart;

      if (!transcription || transcription.trim().length === 0) {
        console.log(`[BedrockPolly Bridge] Empty transcription, skipping turn for ${callSid}`);
        session.isProcessing = false;
        return;
      }

      if (this.isWhisperHallucination(transcription)) {
        console.log(`[BedrockPolly Bridge] Filtered Whisper hallucination for ${callSid}: "${transcription.substring(0, 100)}"`);
        session.isProcessing = false;

        if (!session.isOutbound) {
          const existingInbTimer = inboundNoResponseTimers.get(callSid);
          if (existingInbTimer) {
            clearTimeout(existingInbTimer);
            inboundNoResponseTimers.delete(callSid);
            console.log(`[BedrockPolly Bridge] Cleared inbound no-response timer on hallucination filter for ${callSid}`);
          }

          const count = (inboundHallucinationCount.get(callSid) || 0) + 1;
          inboundHallucinationCount.set(callSid, count);

          if (count <= 2) {
            const lang = session.agentConfig.language || 'en';
            const reprompts: Record<string, string> = {
              en: "I'm here. Please go ahead.",
              ar: "أنا هنا، تفضل.",
              es: "Estoy aquí. Adelante, por favor.",
              fr: "Je suis là. Allez-y, s'il vous plaît.",
              hi: "मैं यहाँ हूँ। कृपया बताइए।",
            };
            const reprompt = reprompts[lang] || reprompts['en'];
            console.log(`[BedrockPolly Bridge] Inbound hallucination re-prompt #${count} for ${callSid}: "${reprompt}"`);
            this.synthesizeAndSend(session, reprompt).then(() => {
              lastTtsEndTime.set(callSid, Date.now());
            }).catch(err => {
              console.error(`[BedrockPolly Bridge] Error sending hallucination re-prompt for ${callSid}:`, err);
            });
          }
        }

        return;
      }

      const expectedLang = session.agentConfig.language || 'en';
      if (this.isLanguageMismatch(transcription, expectedLang)) {
        console.log(`[BedrockPolly Bridge] Language mismatch filtered for ${callSid} (expected=${expectedLang}): "${transcription.substring(0, 100)}"`);
        session.isProcessing = false;
        return;
      }

      const backgroundNoiseRejection = session.agentConfig?.behaviorConfig?.backgroundNoiseRejection !== false;
      if (backgroundNoiseRejection && this.isLikelyBackgroundSpeech(transcription, session.messages)) {
        console.log(`[VAD] Skipped likely background speech for ${callSid}: "${transcription.substring(0, 100)}"`);
        session.isProcessing = false;
        return;
      }

      if (voiceIsolationEnabled && !isEnrolled(callSid)) {
        enrollSpeaker(callSid, audioBuffer);
      }

      console.log(`[BedrockPolly Bridge] User: "${transcription.substring(0, 200)}"`);

      const inboundNrTimer = inboundNoResponseTimers.get(callSid);
      if (inboundNrTimer) {
        clearTimeout(inboundNrTimer);
        inboundNoResponseTimers.delete(callSid);
        console.log(`[BedrockPolly Bridge] Cancelled inbound no-response timer for ${callSid} — user spoke`);
      }

      session.transcriptParts.push({
        role: 'user',
        text: transcription,
        timestamp: new Date(),
      });

      if (session.onTranscriptCallback) {
        session.onTranscriptCallback(transcription, true);
      }

      try {
        const sentimentResult = RealtimeSentimentService.analyzeSentiment(
          callSid,
          transcription,
          session.agentConfig.language || 'en'
        );
        liveCallRegistry.updateSentiment(callSid, sentimentResult.level, sentimentResult.score, sentimentResult.alert, sentimentResult.reason);
        if (sentimentResult.alert && session.userId) {
          NotificationService.create({
            userId: session.userId,
            type: 'sentiment_alert',
            title: 'Call Needs Attention',
            message: `Call with ${session.agentConfig.agentName || 'AI Agent'} flagged: ${sentimentResult.reason}. Sentiment: ${sentimentResult.level} (score: ${sentimentResult.score})`,
            link: '/app/live-monitoring',
            displayType: 'both',
            priority: 1,
          });
        }
      } catch (sentErr: any) {
        console.error(`[BedrockPolly Bridge] Sentiment analysis error for ${callSid}: ${sentErr.message}`);
      }

      session.messages.push({
        role: 'user',
        content: transcription,
        timestamp: new Date(),
      });

      if (session.status === 'disconnected') {
        console.log(`[BedrockPolly Bridge] Session disconnected before Bedrock call for ${callSid}`);
        return;
      }

      const words = transcription.trim().split(/\s+/);
      const hasQuestion = /\?|؟/.test(transcription);
      const hasKBTools = session.agentConfig.tools?.some(t => t.name === 'lookup_knowledge_base' || t.name === 'lookup_bedrock_knowledge_base');
      const isComplex = (hasQuestion && words.length > 8) || words.length > 15 || hasKBTools;

      let kbPreFetched = false;
      const KB_PREFETCH_TIMEOUT_MS = 5000;

      const kbTool = hasKBTools ? session.agentConfig.tools!.find(t => t.name === 'lookup_knowledge_base' || t.name === 'lookup_bedrock_knowledge_base') : null;

      const parallelTasks: Promise<any>[] = [];

      if (isComplex && !bargeInFlags.get(callSid)) {
        const lang = session.agentConfig.language || 'en';
        const thinkFillers = this.THINKING_FILLERS[lang] || this.THINKING_FILLERS['en'];
        const thinkFiller = this.getRandomFiller(thinkFillers);
        console.log(`[BedrockPolly Bridge] Playing thinking filler for ${callSid}: "${thinkFiller}"`);
        parallelTasks.push(this.playFillerAudio(session, thinkFiller));
      }

      let kbResultHolder: any = null;
      if (kbTool?.handler) {
        const kbStartMs = Date.now();
        const kbPromise = Promise.race([
          kbTool.handler({ query: transcription }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), KB_PREFETCH_TIMEOUT_MS)),
        ]).then((kbResult: any) => {
          const kbMs = Date.now() - kbStartMs;
          if (!kbResult) {
            console.warn(`[BedrockPolly Bridge] KB pre-fetch timed out for ${callSid} after ${kbMs}ms — falling back to tool call`);
          } else {
            kbResultHolder = kbResult;
            const kbResultStr = typeof kbResult === 'string' ? kbResult : JSON.stringify(kbResult);
            console.log(`[BedrockPolly Bridge] Pre-fetched KB for ${callSid} in ${kbMs}ms (${kbResultStr.length} chars, found=${kbResult.found})`);
          }
          return kbResult;
        }).catch((kbErr: any) => {
          console.warn(`[BedrockPolly Bridge] KB pre-fetch failed for ${callSid}: ${kbErr.message}`);
          return null;
        });
        parallelTasks.push(kbPromise);
      }

      if (parallelTasks.length > 0) {
        await Promise.all(parallelTasks);
      }

      if (kbResultHolder) {
        kbPreFetched = true;
        session._kbPreFetched = true;
        const kbResultStr = typeof kbResultHolder === 'string' ? kbResultHolder : JSON.stringify(kbResultHolder);

        if (kbResultHolder.found !== false) {
          const rawInfo = kbResultHolder.information || kbResultStr;
          const kbInfo = typeof rawInfo === 'string' ? rawInfo : JSON.stringify(rawInfo);
          session.messages.push({
            role: 'user',
            content: `[IMPORTANT — Reference data from your knowledge base for this question. Use this information to answer the caller's question directly and confidently. Do NOT say you need to look it up — you already have the answer below:]\n\n${kbInfo}`,
            timestamp: new Date(),
          });
          console.log(`[BedrockPolly Bridge] KB context injected for ${callSid}, skipping tool call round-trip`);
        } else {
          session.messages.push({
            role: 'user',
            content: `[No matching information found in your knowledge base for this query. Answer using your general knowledge and what you know from this conversation. Try to be helpful — suggest alternatives or offer to help with something else.]`,
            timestamp: new Date(),
          });
          console.log(`[BedrockPolly Bridge] KB returned no results for ${callSid}, injecting "answer from identity" directive`);
        }
      }

      const llmProvider = isOpenAIModel(agentConfig.model) ? 'OpenAI' : 'Bedrock';
      console.log(`[BedrockPolly Bridge] Calling ${llmProvider} for ${callSid} (messages=${session.messages.length}, bargeIn=${bargeInFlags.get(callSid)})`);

      const bedrockStart = Date.now();
      const responseText = await this.streamBedrockAndSpeak(session, sttMs);

      if (kbPreFetched) {
        session._kbPreFetched = false;
        const kbContextIdx = session.messages.findIndex(m =>
          m.role === 'user' && (m.content.startsWith('[IMPORTANT — Reference data') || m.content.startsWith('[No matching information found'))
        );
        if (kbContextIdx !== -1) {
          session.messages.splice(kbContextIdx, 1);
        }
      }

      if (!responseText || responseText.trim().length === 0) {
        console.log(`[BedrockPolly Bridge] Empty Bedrock response for ${callSid}`);
        session.isProcessing = false;
        return;
      }

      const totalMs = Date.now() - turnStart;
      console.log(`[BedrockPolly Bridge] Agent (full): "${responseText.substring(0, 200)}"`);
      console.log(`[LATENCY] call=${callSid} stt=${sttMs}ms total=${totalMs}ms`);

      session.transcriptParts.push({
        role: 'assistant',
        text: responseText,
        timestamp: new Date(),
      });

      session.messages.push({
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      });

      if (session.onTranscriptCallback) {
        session.onTranscriptCallback(responseText, true);
      }
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Turn processing error for ${callSid}:`, error.message);
    } finally {
      session.isProcessing = false;
      lastTtsEndTime.set(callSid, Date.now());
      bargeInAccum.set(callSid, 0);
    }
  }

  private static isWhisperHallucination(text: string): boolean {
    return coreIsWhisperHallucination(text);
  }

  private static isLikelyBackgroundSpeech(
    text: string,
    conversationMessages: { role: string; content: string }[]
  ): boolean {
    return coreIsLikelyBackgroundSpeech(text, conversationMessages);
  }

  private static isLanguageMismatch(text: string, expectedLang: string): boolean {
    return coreIsLanguageMismatch(text, expectedLang);
  }

  private static cachedOpenAIKey: string | null = null;
  private static cachedKeyTimestamp: number = 0;
  private static readonly KEY_CACHE_TTL_MS = 300_000;

  private static isValidApiKey(key: string | undefined): key is string {
    if (!key || key.trim().length === 0) return false;
    const dummyPatterns = ['_DUMMY_', 'YOUR_KEY', 'placeholder', 'xxx', 'REPLACE', 'changeme', 'test_key'];
    const upper = key.toUpperCase();
    return !dummyPatterns.some(p => upper.includes(p.toUpperCase()));
  }

  private static async resolveOpenAIKey(): Promise<string | null> {
    if (this.isValidApiKey(process.env.OPENAI_API_KEY)) {
      console.log('[BedrockPolly Bridge] Using OpenAI key from OPENAI_API_KEY env var');
      return process.env.OPENAI_API_KEY;
    }
    if (this.isValidApiKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY)) {
      console.log('[BedrockPolly Bridge] Using OpenAI key from AI_INTEGRATIONS env var');
      return process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    }

    const now = Date.now();
    if (this.cachedOpenAIKey && (now - this.cachedKeyTimestamp) < this.KEY_CACHE_TTL_MS) {
      return this.cachedOpenAIKey;
    }

    try {
      const [cred] = await db
        .select({ apiKey: openaiCredentials.apiKey })
        .from(openaiCredentials)
        .limit(1);
      if (cred?.apiKey && this.isValidApiKey(cred.apiKey)) {
        this.cachedOpenAIKey = cred.apiKey;
        this.cachedKeyTimestamp = now;
        console.log(`[BedrockPolly Bridge] Resolved OpenAI key from DB (${cred.apiKey.substring(0, 12)}...)`);
        return cred.apiKey;
      }
    } catch (err: any) {
      console.error('[BedrockPolly Bridge] Failed to resolve OpenAI key from DB:', err.message);
    }
    console.error('[BedrockPolly Bridge] No valid OpenAI key found in env vars or DB');
    return null;
  }

  private static async transcribeAudio(audioBuffer: Buffer, language?: string, conversationContext?: string[], callSid?: string): Promise<string> {
    const apiKey = await this.resolveOpenAIKey();
    if (!apiKey) {
      console.error('[BedrockPolly Bridge] No OpenAI API key available (env or DB) — cannot transcribe');
      return '';
    }

    if (callSid) {
      const existing = whisperAbortControllers.get(callSid);
      if (existing) {
        existing.abort();
        console.log(`[BedrockPolly Bridge] Cancelled previous Whisper request for ${callSid}`);
      }
    }

    const abortController = new AbortController();
    if (callSid) {
      whisperAbortControllers.set(callSid, abortController);
    }

    try {
      const wavHeader = createMulawWavHeader(audioBuffer.length);
      const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([wavBuffer], { type: 'audio/wav' }),
        'audio.wav'
      );
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0');
      if (language) {
        const whisperLang = language.split('-')[0].toLowerCase();
        formData.append('language', whisperLang);
      }

      let whisperPrompt = '';
      if (language === 'ar') {
        whisperPrompt = 'ألو، مرحبا، أهلا، أريد، ممكن، سؤال، مساعدة، حساب، فاتورة، رصيد، دفع، موعد، حجز، إلغاء، اشتراك، تجوال، خدمة، مشكلة، شكوى، استفسار';
      }
      if (conversationContext && conversationContext.length > 0) {
        const recentContext = conversationContext.slice(-2).join(' ').substring(0, 200);
        whisperPrompt = whisperPrompt ? `${whisperPrompt}. ${recentContext}` : recentContext;
      }
      if (whisperPrompt) {
        formData.append('prompt', whisperPrompt);
      }

      const sttStart = Date.now();
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BedrockPolly Bridge] Whisper API error ${response.status}: ${errorText}`);
        callErrorLogger.logCallError({
          engineType: 'bedrock-polly',
          errorCategory: 'stt_failure', severity: 'error',
          message: `Whisper API error ${response.status}: ${errorText.substring(0, 200)}`,
          latencyMs: Date.now() - sttStart, metadata: { callSid },
        });
        return '';
      }

      const rawBody = await response.text();
      const sttMs = Date.now() - sttStart;

      let text = '';
      let noSpeechProb = 0;
      let avgLogprob = 0;
      let segmentCount = 0;

      try {
        const jsonResult = JSON.parse(rawBody);
        text = (jsonResult.text || '').trim();

        if (jsonResult.segments && Array.isArray(jsonResult.segments) && jsonResult.segments.length > 0) {
          segmentCount = jsonResult.segments.length;
          let totalNoSpeech = 0;
          let totalLogprob = 0;
          for (const seg of jsonResult.segments) {
            totalNoSpeech += (seg.no_speech_prob || 0);
            totalLogprob += (seg.avg_logprob || 0);
          }
          noSpeechProb = totalNoSpeech / segmentCount;
          avgLogprob = totalLogprob / segmentCount;
        }
      } catch {
        text = rawBody.trim();
      }

      console.log(`[BedrockPolly Bridge] Whisper: ${sttMs}ms, "${text.substring(0, 200)}" (${text.length} chars, ${wavBuffer.length}b WAV, noSpeech=${noSpeechProb.toFixed(2)}, avgLogprob=${avgLogprob.toFixed(2)}, segs=${segmentCount})`);

      if (segmentCount > 0 && noSpeechProb > 0.6) {
        console.log(`[BedrockPolly Bridge] Whisper confidence reject: noSpeechProb=${noSpeechProb.toFixed(3)} > 0.6 for ${callSid}: "${text.substring(0, 100)}"`);
        return '';
      }

      if (segmentCount > 0 && avgLogprob < -1.0) {
        console.log(`[BedrockPolly Bridge] Whisper confidence reject: avgLogprob=${avgLogprob.toFixed(3)} < -1.0 for ${callSid}: "${text.substring(0, 100)}"`);
        return '';
      }

      return text;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[BedrockPolly Bridge] Whisper request aborted for ${callSid}`);
        return '';
      }
      console.error(`[BedrockPolly Bridge] Transcription error:`, error.message);
      return '';
    } finally {
      if (callSid) {
        whisperAbortControllers.delete(callSid);
      }
    }
  }

  private static splitSentences(text: string, eager: boolean = false): string[] {
    return coreSplitSentences(text, eager);
  }



  private static ensureUserFirst(msgs: Array<{role: string; content: string}>): Array<{role: string; content: string}> {
    if (msgs.length > 0 && msgs[0].role === 'assistant') {
      return [{ role: 'user', content: '[The person answered the phone]' }, ...msgs];
    }
    return msgs;
  }

  private static buildSystemPromptForStructured(session: BedrockPollyBridgeSession, includeToolInstructions: boolean): string {
    const { agentConfig } = session;
    const kbAlreadySearched = !!session._kbPreFetched;

    let kbOverride = '';
    if (kbAlreadySearched) {
      kbOverride = `\n\nKB already searched — results are in the conversation above. Do not call lookup_knowledge_base or lookup_bedrock_knowledge_base again.`;
    }

    const agentLang = agentConfig.language || 'en';
    const behaviorCfg = agentConfig.behaviorConfig || {};

    let behaviorPromptAdditions = '';
    if (behaviorCfg.maxQuestionsPerTurn) {
      behaviorPromptAdditions += `\n- Ask a MAXIMUM of ${behaviorCfg.maxQuestionsPerTurn} questions at a time. Never overwhelm the caller.`;
    }
    if (behaviorCfg.useDiscourseMarkers !== false) {
      behaviorPromptAdditions += `\n- Use casual discourse markers to sound natural (e.g., "So basically...", "Okay so here's the thing...", "Right, so...", "Yeah so...", "Alright...")`;
    }
    if (behaviorCfg.silenceTimeoutSec) {
      behaviorPromptAdditions += `\n- If the caller is silent for a while, gently prompt them: "Are you still there?" or "Take your time, I'm here when you're ready."`;
    }

    const conversationStyle = `

CONVERSATION STYLE:
- Give complete, thorough answers. Do not cut yourself short or ask "would you like to know more?" after every response. Provide ALL the relevant information the caller needs.
- If something is unclear, ask ONE specific clarifying question.
- Do NOT start every response with acknowledgments like "yes", "okay", "sure", "right" — just answer naturally.
- CRITICAL: After delivering your greeting, you MUST wait for the user to actually speak before responding. Do NOT assume the user has said something if you have not clearly heard their words. If there is silence or unclear noise, do NOT fabricate or guess what the user said — instead, wait patiently or say something brief like "Hello, are you there?" Do NOT respond as if the user said something negative (e.g., "I understand you don't have...") unless you clearly heard them say that.
- LANGUAGE CONSISTENCY: You MUST maintain the SAME language throughout the ENTIRE call — greeting, conversation, AND farewell/goodbye. ${agentLang !== 'en' ? `You are configured for ${agentLang} — every single word including your closing/goodbye message when ending the call MUST be in the same language. NEVER switch to English.` : ''}${behaviorPromptAdditions}`;

    const backgroundNoiseInstruction = `\n\nBACKGROUND NOISE HANDLING:\n- If you hear what seems like background conversation not directed at you, ignore it and wait for the caller to address you directly.\n- Do NOT respond to ambient noise, TV audio, or other people talking nearby.\n- Only respond when you are confident the caller is speaking directly to you.`;

    let toolBehaviorInstructions = '';
    if (includeToolInstructions) {
      toolBehaviorInstructions = `\n\nIMPORTANT FUNCTION CALLING REQUIREMENTS:
1. After collecting all form information from the user, you MUST call the submit_form function with the collected data. Do NOT just say "I have recorded your information" - you MUST actually call the submit_form function to save the data.
2. After completing the main task (like form submission), say a friendly closing message and ask if there's anything else. Wait for the user to respond.
3. Only call the end_call function AFTER the user confirms they are done or says goodbye. Do not hang up immediately after completing a task - give the user a chance to respond.
4. When the user says goodbye or confirms they are done, say a brief farewell in the SAME language you have been speaking, THEN call the end_call function to disconnect.
5. These function calls are MANDATORY. Data will NOT be saved unless you call the functions.`;
    }

    let languageReminder = '';
    if (agentLang !== 'en') {
      const langNames: Record<string, string> = { ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', hi: 'Hindi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', tr: 'Turkish', nl: 'Dutch' };
      const langName = langNames[agentLang.split('-')[0]] || agentLang;
      languageReminder = `\n\nREMINDER: Respond ONLY in fluent ${langName}. Do NOT use any English.`;
    }

    return agentConfig.systemPrompt + kbOverride + conversationStyle + backgroundNoiseInstruction + toolBehaviorInstructions + languageReminder;
  }

  private static getActiveToolsForSession(session: BedrockPollyBridgeSession): Array<{ name: string; description: string; parameters: Record<string, unknown>; handler?: (params: Record<string, unknown>) => Promise<unknown> }> {
    const { agentConfig } = session;
    const kbToolNames = new Set(['lookup_knowledge_base', 'lookup_bedrock_knowledge_base']);
    const kbAlreadySearched = !!session._kbPreFetched;
    return kbAlreadySearched
      ? (agentConfig.tools || []).filter(t => !kbToolNames.has(t.name))
      : (agentConfig.tools || []);
  }

  private static async streamBedrockAndSpeak(session: BedrockPollyBridgeSession, sttMs?: number): Promise<string> {
    const { callSid, agentConfig, messages } = session;

    const bedrockMessages = this.ensureUserFirst(messages.map((m) => ({
      role: m.role,
      content: m.content,
    })));

    const activeTools = this.getActiveToolsForSession(session);
    const hasTools = activeTools.length > 0;
    const useStructured = true;
    const isBedrock = !isOpenAIModel(agentConfig.model);

    const systemPrompt = this.buildSystemPromptForStructured(session, hasTools);

    if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
      session.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: session.streamSid,
      }));
    }

    const adaptiveTokens = this.estimateMaxTokens(bedrockMessages, systemPrompt);
    const provider = isBedrock ? 'Bedrock/Converse' : 'OpenAI';
    console.log(`[BedrockPolly Bridge] streamBedrockAndSpeak: ${provider} model=${agentConfig.model}, adaptive maxTokens=${adaptiveTokens}, messages=${bedrockMessages.length}, tools=${activeTools.length}, structured=${useStructured}`);

    try {
      let fullText = '';
      let sentenceBuffer = '';
      let sentencesSent = 0;
      let pendingSynthesis: Promise<void> | null = null;
      const startTime = Date.now();
      let firstTokenTime = 0;
      let firstTtsStartTime = 0;
      let firstTtsAudioTime = 0;
      const collectedToolCalls: StructuredToolCall[] = [];

      bargeInFlags.set(callSid, false);
      bargeInAccum.set(callSid, 0);

      let primaryModel = agentConfig.model;

      const synthesizeSentenceFragment = async (sentence: string) => {
        if (sentence.length < 3) return;
        if (pendingSynthesis) {
          await pendingSynthesis;
          pendingSynthesis = null;
        }
        sentencesSent++;
        if (sentencesSent === 1) {
          firstTtsStartTime = Date.now();
          const llmFirstMs = firstTokenTime ? firstTokenTime - startTime : 0;
          console.log(`[BedrockPolly Bridge] First fragment ready for ${callSid} (llm_first=${llmFirstMs}ms): "${sentence.substring(0, 80)}"`);
        }
        pendingSynthesis = this.synthesizeAndSend(session, sentence).then(() => {
          if (!firstTtsAudioTime) {
            firstTtsAudioTime = Date.now();
          }
        });
      };

      const consumeStructuredStream = async (eventStream: AsyncGenerator<LLMStreamEvent>) => {
        let lastStreamLog = 0;
        for await (const event of eventStream) {
          if (event.type === 'text') {
            if (!firstTokenTime) firstTokenTime = Date.now();
            fullText += event.text;
            sentenceBuffer += event.text;

            const now = Date.now();
            if (now - (lastStreamLog || startTime) >= 3000) {
              lastStreamLog = now;
              console.log(`[BedrockPolly Bridge] Stream progress for ${callSid}: ${now - startTime}ms, ${fullText.length} chars`);
            }

            if (bargeInFlags.get(callSid) && sentencesSent > 0) {
              console.log(`[BedrockPolly Bridge] Barge-in during streaming for ${callSid} (after ${sentencesSent} segments)`);
              break;
            }
            if (session.status === 'disconnected') break;

            const useEager = sentencesSent === 0;
            const shouldSynth = useEager
              ? (sentenceBuffer.length >= 12 && this.splitSentences(sentenceBuffer, true).length > 1)
              : this.splitSentences(sentenceBuffer, false).length > 1;

            if (shouldSynth) {
              const sentences = this.splitSentences(sentenceBuffer, useEager);
              for (let i = 0; i < sentences.length - 1; i++) {
                await synthesizeSentenceFragment(sentences[i]);
                if (i < sentences.length - 2 && pendingSynthesis) {
                  await pendingSynthesis;
                  pendingSynthesis = null;
                }
                if (bargeInFlags.get(callSid) || session.status === 'disconnected') break;
              }
              sentenceBuffer = sentences[sentences.length - 1];
            }
          } else if (event.type === 'tool_call') {
            console.log(`[BedrockPolly Bridge] Structured tool_call received: ${event.toolCall.name} for ${callSid}`);
            collectedToolCalls.push(event.toolCall);
          } else if (event.type === 'done') {
            console.log(`[BedrockPolly Bridge] Stream done: stopReason=${event.stopReason}, inputTokens=${event.inputTokens}, outputTokens=${event.outputTokens}`);
          }
        }
      };

      const consumeLegacyStream = async (stream: AsyncGenerator<string>) => {
        let lastStreamLog = 0;
        let toolCallDetected = false;
        for await (const token of stream) {
          if (!firstTokenTime) firstTokenTime = Date.now();
          fullText += token;

          const now = Date.now();
          if (now - (lastStreamLog || startTime) >= 3000) {
            lastStreamLog = now;
            console.log(`[BedrockPolly Bridge] Stream progress for ${callSid}: ${now - startTime}ms, ${fullText.length} chars`);
          }

          if (toolCallDetected) continue;
          sentenceBuffer += token;

          if (sentenceBuffer.includes('[TOOL_CALL]')) {
            toolCallDetected = true;
            continue;
          }

          if (bargeInFlags.get(callSid) && sentencesSent > 0) break;
          if (session.status === 'disconnected') break;

          const useEager = sentencesSent === 0;
          const shouldSynth = useEager
            ? (sentenceBuffer.length >= 12 && this.splitSentences(sentenceBuffer, true).length > 1)
            : this.splitSentences(sentenceBuffer, false).length > 1;

          if (shouldSynth) {
            const sentences = this.splitSentences(sentenceBuffer, useEager);
            for (let i = 0; i < sentences.length - 1; i++) {
              await synthesizeSentenceFragment(sentences[i]);
              if (i < sentences.length - 2 && pendingSynthesis) {
                await pendingSynthesis;
                pendingSynthesis = null;
              }
              if (bargeInFlags.get(callSid) || session.status === 'disconnected') break;
            }
            sentenceBuffer = sentences[sentences.length - 1];
          }
        }
        return toolCallDetected;
      };

      const createStructuredStream = (model: string): AsyncGenerator<LLMStreamEvent> | null => {
        if (isOpenAIModel(model) && hasTools) {
          const openaiToolDefs = activeTools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          }));
          return openaiInvokeStreamStructured({
            model,
            messages: bedrockMessages,
            systemPrompt,
            temperature: 0.3,
            maxTokens: adaptiveTokens,
            tools: openaiToolDefs,
          });
        }

        if (isBedrock) {
          const toolDefs: ToolDefinition[] = hasTools
            ? activeTools
                .map(t => agentToolToDefinition(t))
                .filter((d): d is ToolDefinition => d !== null)
            : [];
          const bedrockToolSpecs = toolDefs.length > 0 ? toBedrockToolSpecs(toolDefs) : undefined;

          return converseStream({
            model,
            messages: bedrockMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
            systemPrompt,
            temperature: 0.3,
            maxTokens: adaptiveTokens,
            tools: bedrockToolSpecs,
          });
        }

        return null;
      };

      const legacyToolCallMarkerClause = hasTools && !isOpenAIModel(primaryModel)
        ? `\n\nTOOL CALL FORMAT (LEGACY FALLBACK): When you need to call a tool, output [TOOL_CALL] followed by a JSON object with "name" and "params" keys. Example: [TOOL_CALL]{"name":"tool_name","params":{"key":"value"}}`
        : '';

      const createLegacyStream = (model: string): AsyncGenerator<string> => {
        const legacyPrompt = systemPrompt + legacyToolCallMarkerClause;
        if (isOpenAIModel(model)) {
          const openaiToolDefs = hasTools
            ? activeTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))
            : undefined;
          return openaiInvokeStream({
            model,
            messages: bedrockMessages,
            systemPrompt: legacyPrompt,
            temperature: 0.3,
            maxTokens: adaptiveTokens,
            tools: openaiToolDefs,
          });
        }
        return awsBedrockService.invokeStream({
          model,
          messages: bedrockMessages,
          systemPrompt: legacyPrompt,
          temperature: 0.3,
          maxTokens: adaptiveTokens,
        });
      };

      let usedLegacyToolCallDetection = false;

      try {
        const structuredStream = createStructuredStream(primaryModel);
        if (structuredStream) {
          await consumeStructuredStream(structuredStream);
        } else {
          const legacyStream = createLegacyStream(primaryModel);
          usedLegacyToolCallDetection = await consumeLegacyStream(legacyStream);
        }
      } catch (streamErr: any) {
        console.warn(`[BedrockPolly Bridge] Stream failed for ${callSid}: ${streamErr.message}. Retrying with legacy...`);
        fullText = '';
        sentenceBuffer = '';
        sentencesSent = 0;
        firstTokenTime = 0;
        collectedToolCalls.length = 0;
        const retryModel = isOpenAIModel(primaryModel) ? 'gpt-4o-mini' : 'claude-sonnet-4-6';
        try {
          const retryStream = createLegacyStream(retryModel);
          usedLegacyToolCallDetection = await consumeLegacyStream(retryStream);
        } catch (retryErr: any) {
          console.error(`[BedrockPolly Bridge] Retry also failed for ${callSid}: ${retryErr.message}`);
        }
      }

      if (pendingSynthesis) {
        await pendingSynthesis;
      }

      const hasStructuredToolCalls = collectedToolCalls.length > 0;

      if (sentencesSent === 0 && !hasStructuredToolCalls && !usedLegacyToolCallDetection && fullText.trim().length < 5) {
        console.warn(`[BedrockPolly Bridge] Model produced insufficient output for ${callSid}: "${fullText.trim().slice(0, 30)}". Retrying...`);
        fullText = '';
        sentenceBuffer = '';
        sentencesSent = 0;
        firstTokenTime = 0;
        collectedToolCalls.length = 0;
        const stallRetryModel = isOpenAIModel(primaryModel) ? 'gpt-4o-mini' : 'claude-sonnet-4-6';
        try {
          const retryStream = createLegacyStream(stallRetryModel);
          usedLegacyToolCallDetection = await consumeLegacyStream(retryStream);
          if (pendingSynthesis) {
            await pendingSynthesis;
          }
        } catch (retryErr: any) {
          console.error(`[BedrockPolly Bridge] Stall retry also failed for ${callSid}: ${retryErr.message}`);
        }

        if (sentencesSent === 0 && !usedLegacyToolCallDetection) {
          const apologyMsg = session.agentConfig?.language?.startsWith('ar') ? 'عذراً، لم أتمكن من فهم ذلك. هل يمكنك إعادة المحاولة؟' : 'I\'m sorry, I had trouble processing that. Could you repeat what you said?';
          await this.synthesizeAndSend(session, apologyMsg);
          session.messages.push({ role: 'assistant', content: apologyMsg });
          session.transcriptParts.push({ role: 'assistant', text: apologyMsg, timestamp: new Date() });
          return apologyMsg;
        }
      }

      if (hasStructuredToolCalls) {
        return this.handleStructuredToolCalls(session, fullText, collectedToolCalls, systemPrompt, sentencesSent > 0);
      }

      if (usedLegacyToolCallDetection) {
        return this.handleStreamToolCall(session, fullText, systemPrompt);
      }

      if (sentenceBuffer.trim().length > 0 && !bargeInFlags.get(callSid) && session.status !== 'disconnected') {
        sentencesSent++;
        if (sentencesSent === 1) {
          firstTtsStartTime = Date.now();
        }
        await this.synthesizeAndSend(session, sentenceBuffer.trim());
        if (!firstTtsAudioTime) firstTtsAudioTime = Date.now();
      }

      const elapsed = Date.now() - startTime;
      const llmFirstMs = firstTokenTime ? firstTokenTime - startTime : 0;
      const ttsFirstMs = firstTtsStartTime ? firstTtsStartTime - startTime : 0;
      const ttsAudioMs = firstTtsAudioTime ? firstTtsAudioTime - startTime : 0;
      console.log(`[BedrockPolly Bridge] Streaming complete for ${callSid}: ${fullText.length} chars, ${sentencesSent} segments, ${elapsed}ms`);
      console.log(`[LATENCY] call=${callSid} stt=${sttMs || 0}ms llm_first=${llmFirstMs}ms tts_start=${ttsFirstMs}ms tts_audio=${ttsAudioMs}ms stream_total=${elapsed}ms`);

      return fullText;
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Streaming Bedrock error for ${callSid}:`, error.message);
      callErrorLogger.logCallError({
        callId: (session.agentConfig as any).toolContext?.callId, userId: (session.agentConfig as any).toolContext?.userId, engineType: 'bedrock-polly',
        errorCategory: 'streaming', severity: 'error',
        message: `Streaming Bedrock error: ${error.message?.substring(0, 300)}`,
        metadata: { callSid, model: agentConfig.model },
      });
      const lang = agentConfig.language || 'en';
      const fallbacks: Record<string, string> = {
        ar: 'عذرًا، أواجه مشكلة تقنية حاليًا. هل يمكنك المحاولة مرة أخرى؟',
        es: 'Lo siento, estoy teniendo problemas técnicos. ¿Podría intentarlo de nuevo?',
        fr: 'Désolé, je rencontre un problème technique. Pourriez-vous réessayer ?',
        de: 'Entschuldigung, ich habe gerade technische Probleme. Könnten Sie es noch einmal versuchen?',
        zh: '抱歉，我目前遇到技术问题。您能再试一次吗？',
        ja: '申し訳ありませんが、技術的な問題が発生しています。もう一度お試しいただけますか？',
        ko: '죄송합니다. 기술적인 문제가 발생했습니다. 다시 시도해 주시겠어요?',
        pt: 'Desculpe, estou enfrentando um problema técnico. Poderia tentar novamente?',
        it: 'Mi scuso, sto riscontrando un problema tecnico. Potrebbe riprovare?',
        hi: 'क्षमा करें, मुझे एक तकनीकी समस्या आ रही है। क्या आप फिर से कोशिश कर सकते हैं?',
        tr: 'Özür dilerim, teknik bir sorun yaşıyorum. Tekrar deneyebilir misiniz?',
      };
      const fallback = fallbacks[lang] || 'I apologize, but I am having trouble processing your request right now. Could you please try again?';
      await this.synthesizeAndSend(session, fallback);
      return fallback;
    }
  }

  private static buildToolRegistry(session: BedrockPollyBridgeSession): ToolRegistry {
    const registry = new ToolRegistry();
    const activeTools = this.getActiveToolsForSession(session);
    for (const t of activeTools) {
      const def = agentToolToDefinition(t);
      if (def) registry.register(def);
    }
    return registry;
  }

  private static validateToolCallInput(
    registry: ToolRegistry,
    toolCall: StructuredToolCall
  ): { valid: boolean; error?: string } {
    return registry.validateInput(toolCall.name, toolCall.params);
  }

  private static async handleStructuredToolCalls(
    session: BedrockPollyBridgeSession,
    textBeforeTools: string,
    toolCalls: StructuredToolCall[],
    systemPrompt: string,
    textAlreadySpoken = false
  ): Promise<string> {
    const { callSid, agentConfig } = session;
    const isBedrock = !isOpenAIModel(agentConfig.model);

    if (!textAlreadySpoken && textBeforeTools.trim().length > 2) {
      await this.synthesizeAndSend(session, textBeforeTools.trim());
    }

    const registry = this.buildToolRegistry(session);
    const toolResults: StructuredToolResult[] = [];

    for (const tc of toolCalls) {
      console.log(`[BedrockPolly Bridge] Executing structured tool: ${tc.name} (id=${tc.id}) for ${callSid}`);

      const validation = this.validateToolCallInput(registry, tc);
      if (!validation.valid) {
        console.error(`[BedrockPolly Bridge] Zod validation failed for tool "${tc.name}": ${validation.error}`);
        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          result: { error: `Invalid parameters: ${validation.error}` },
          isError: true,
        });
        continue;
      }

      try {
        const toolResultStr = await this.handleToolCalls(session, [{ name: tc.name, params: tc.params }]);

        let resultObj: unknown;
        try {
          resultObj = JSON.parse(toolResultStr);
        } catch {
          resultObj = { result: toolResultStr };
        }

        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          result: resultObj,
        });
      } catch (execError: unknown) {
        const errorMsg = execError instanceof Error ? execError.message : 'Tool execution failed';
        console.error(`[BedrockPolly Bridge] Structured tool execution error for ${tc.name}:`, errorMsg);
        callErrorLogger.logCallError({
          engineType: 'bedrock-polly',
          errorCategory: 'tool_execution', severity: 'error',
          message: `Structured tool execution error: ${errorMsg.substring(0, 300)}`,
          metadata: { callSid, toolName: tc.name },
        });

        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          result: { error: errorMsg },
          isError: true,
        });
      }
    }

    if (isBedrock) {
      try {
        const bedrockMessages = this.ensureUserFirst(session.messages.map(m => ({
          role: m.role,
          content: m.content,
        })));

        const activeTools = this.getActiveToolsForSession(session);
        const toolDefs: ToolDefinition[] = activeTools
          .map(t => agentToolToDefinition(t))
          .filter((d): d is ToolDefinition => d !== null);
        const bedrockToolSpecs = toolDefs.length > 0 ? toBedrockToolSpecs(toolDefs) : undefined;

        const converseOptions = {
          model: agentConfig.model,
          messages: bedrockMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          systemPrompt,
          temperature: agentConfig.temperature ?? 0.7,
          maxTokens: this.estimateMaxTokens(bedrockMessages, systemPrompt),
          tools: bedrockToolSpecs,
        };

        const assistantContent: Array<{ text?: string; toolUse?: { toolUseId: string; name: string; input: unknown } }> = [];
        if (textBeforeTools) {
          assistantContent.push({ text: textBeforeTools });
        }
        for (const tc of toolCalls) {
          assistantContent.push({
            toolUse: {
              toolUseId: tc.id,
              name: tc.name,
              input: tc.params,
            },
          });
        }

        console.log(`[BedrockPolly Bridge] Using native Bedrock tool result continuation for ${callSid} (${toolResults.length} results)`);
        const continuationResult = await converseWithToolResults(converseOptions, assistantContent, toolResults);

        const toolSummary = toolResults.map(tr => {
          const resultStr = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result);
          return `Tool "${tr.name}" returned: ${resultStr}`;
        }).join('\n');
        session.messages.push({
          role: 'assistant',
          content: textBeforeTools || `[Called tools: ${toolCalls.map(tc => tc.name).join(', ')}]`,
          timestamp: new Date(),
        });
        session.messages.push({
          role: 'user',
          content: toolSummary,
          timestamp: new Date(),
        });

        if (continuationResult.toolCalls.length > 0) {
          session.messages.push({
            role: 'assistant',
            content: continuationResult.content || `[Called tools: ${continuationResult.toolCalls.map(tc => tc.name).join(', ')}]`,
            timestamp: new Date(),
          });
          return this.handleStructuredToolCalls(
            session,
            continuationResult.content,
            continuationResult.toolCalls,
            systemPrompt,
            false
          );
        }

        const responseText = continuationResult.content;
        if (responseText.trim().length > 0) {
          await this.synthesizeAndSend(session, responseText.trim());
        }
        session.messages.push({ role: 'assistant', content: responseText, timestamp: new Date() });
        session.transcriptParts.push({ role: 'assistant', text: responseText, timestamp: new Date() });
        return responseText;
      } catch (nativeErr: unknown) {
        const errMsg = nativeErr instanceof Error ? nativeErr.message : 'Unknown error';
        console.warn(`[BedrockPolly Bridge] Native tool continuation failed for ${callSid}: ${errMsg}. Falling back to text-based continuation.`);
      }
    }

    const toolSummary = toolResults.map(tr => {
      const resultStr = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result);
      return `Tool "${tr.name}" returned: ${resultStr}`;
    }).join('\n');

    session.messages.push({
      role: 'assistant',
      content: textBeforeTools || `[Called tools: ${toolCalls.map(tc => tc.name).join(', ')}]`,
      timestamp: new Date(),
    });
    session.messages.push({
      role: 'user',
      content: toolSummary,
      timestamp: new Date(),
    });

    return await this.streamBedrockAndSpeak(session);
  }

  private static estimateMaxTokens(messages: Array<{ role: string; content: string }>, systemPrompt?: string): number {
    const MIN_TOKENS = 512;
    const MAX_TOKENS = 2048;
    const DEFAULT_TOKENS = 1024;

    if (!messages || messages.length === 0) return DEFAULT_TOKENS;

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return DEFAULT_TOKENS;

    const userText = lastUserMsg.content.trim();
    const wordCount = userText.split(/\s+/).length;

    const shortPhrases = /^(مرحبا|هلا|أهلا|hi|hello|hey|ok|okay|نعم|لا|شكرا|bye|thanks|thank you|يعطيك العافية|تمام|ماشي|good|fine|great|الحمد لله|إن شاء الله|no|nope|yeah|yep|sure)$/i;
    if (shortPhrases.test(userText)) {
      return MIN_TOKENS;
    }

    const complexPatterns = /(explain|اشرح|compare|قارن|difference|الفرق|how does|كيف يعمل|tell me about|حدثني عن|what are all|ما هي كل|list|اذكر|describe|صف)/i;
    if (complexPatterns.test(userText) || wordCount > 15) {
      return MAX_TOKENS;
    }

    return DEFAULT_TOKENS;
  }

  private static extractToolCallJson(text: string): { jsonStr: string; textBefore: string } {
    const toolCallIdx = text.indexOf('[TOOL_CALL]');
    if (toolCallIdx === -1) return { jsonStr: '', textBefore: text.trim() };

    const afterTag = text.substring(toolCallIdx + '[TOOL_CALL]'.length).trim();
    const textBefore = text.substring(0, toolCallIdx).trim();
    const jsonStart = afterTag.indexOf('{');
    let jsonStr = '';
    if (jsonStart !== -1) {
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < afterTag.length; i++) {
        if (afterTag[i] === '{') depth++;
        else if (afterTag[i] === '}') {
          depth--;
          if (depth === 0) { jsonEnd = i; break; }
        }
      }
      if (jsonEnd !== -1) {
        jsonStr = afterTag.substring(jsonStart, jsonEnd + 1);
      }
    }
    return { jsonStr, textBefore };
  }

  private static parseToolCall(jsonStr: string): { name: string; params: Record<string, unknown> } | null {
    if (!jsonStr) return null;
    try {
      const parsed = JSON.parse(jsonStr) as { name?: string; params?: Record<string, unknown>; query?: string };
      if (!parsed.name || parsed.name === 'undefined' || typeof parsed.name !== 'string') {
        const nameMatch = jsonStr.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1] && nameMatch[1] !== 'undefined') {
          parsed.name = nameMatch[1];
        } else {
          console.error(`[BedrockPolly Bridge] Tool call has no valid name: ${jsonStr.substring(0, 200)}`);
          return null;
        }
      }
      return {
        name: parsed.name,
        params: parsed.params || (parsed.query ? { query: parsed.query } : {}),
      };
    } catch (e: any) {
      const nameMatch = jsonStr.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1] && nameMatch[1] !== 'undefined') {
        const paramsMatch = jsonStr.match(/"params"\s*:\s*(\{[^}]*\})/);
        let params: Record<string, unknown> = {};
        if (paramsMatch) {
          try { params = JSON.parse(paramsMatch[1]); } catch {}
        }
        return { name: nameMatch[1], params };
      }
      console.error(`[BedrockPolly Bridge] Failed to parse tool call JSON: ${e.message}, raw: ${jsonStr.substring(0, 200)}`);
      return null;
    }
  }

  private static getToolParseRecoveryPhrase(lang?: string): string {
    const phrases: Record<string, string> = {
      ar: 'عذرًا، واجهت مشكلة في معالجة طلبك. هل يمكنك تكرار ذلك؟',
      es: 'Lo siento, tuve un problema procesando eso. ¿Podría repetirlo?',
      fr: 'Désolé, j\'ai eu un problème en traitant cela. Pourriez-vous répéter ?',
      de: 'Entschuldigung, ich hatte ein Problem bei der Verarbeitung. Könnten Sie das wiederholen?',
      hi: 'क्षमा करें, मुझे उसे प्रोसेस करने में समस्या हुई। क्या आप दोहरा सकते हैं?',
    };
    return phrases[lang || ''] || 'I\'m sorry, I had trouble processing that request. Could you please repeat what you need?';
  }

  private static async handleStreamToolCall(
    session: BedrockPollyBridgeSession,
    fullText: string,
    systemPrompt: string
  ): Promise<string> {
    const { jsonStr, textBefore } = this.extractToolCallJson(fullText);

    if (textBefore.length > 2) {
      await this.synthesizeAndSend(session, textBefore);
    }

    const toolCall = this.parseToolCall(jsonStr);
    if (!toolCall) {
      console.error(`[BedrockPolly Bridge] Tool call parsing failed for ${session.callSid}, using recovery phrase`);
      callErrorLogger.logCallError({
        engineType: 'bedrock-polly',
        errorCategory: 'tool_call', severity: 'warning',
        message: `Tool call parsing failed`,
        metadata: { callSid: session.callSid },
      });
      const recovery = this.getToolParseRecoveryPhrase(session.agentConfig.language);
      await this.synthesizeAndSend(session, recovery);
      return textBefore || recovery;
    }

    try {
      const toolResult = await this.handleToolCalls(session, [toolCall]);

      session.messages.push({
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
      });

      session.messages.push({
        role: 'user',
        content: `Tool "${toolCall.name}" returned: ${toolResult}`,
        timestamp: new Date(),
      });

      return await this.streamBedrockAndSpeak(session);
    } catch (execError: any) {
      console.error(`[BedrockPolly Bridge] Tool execution error in stream for ${session.callSid}:`, execError.message);
      callErrorLogger.logCallError({
        engineType: 'bedrock-polly',
        errorCategory: 'tool_execution', severity: 'error',
        message: `Tool execution error: ${execError.message?.substring(0, 300)}`,
        metadata: { callSid: session.callSid, toolName: toolCall?.name },
      });
      const recovery = this.getToolParseRecoveryPhrase(session.agentConfig.language);
      await this.synthesizeAndSend(session, recovery);
      return textBefore || recovery;
    }
  }

  private static async getBedrockResponse(session: BedrockPollyBridgeSession): Promise<string> {
    const { agentConfig, messages } = session;

    const bedrockMessages = this.ensureUserFirst(messages.map((m) => ({
      role: m.role,
      content: m.content,
    })));

    const activeTools = this.getActiveToolsForSession(session);
    const hasTools = activeTools.length > 0;
    const isBedrock = !isOpenAIModel(agentConfig.model);

    const systemPrompt = this.buildSystemPromptForStructured(session, hasTools);

    const adaptiveTokens = this.estimateMaxTokens(bedrockMessages, systemPrompt);
    console.log(`[BedrockPolly Bridge] getBedrockResponse: systemPrompt=${systemPrompt.length} chars, messages=${bedrockMessages.length}, model=${agentConfig.model}, maxTokens=${adaptiveTokens}`);

    try {
      let content: string;
      let structuredToolCalls: StructuredToolCall[] = [];

      if (isOpenAIModel(agentConfig.model)) {
        const openaiTools = hasTools
          ? activeTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))
          : undefined;
        const response = await openaiInvoke({
          model: agentConfig.model,
          messages: bedrockMessages,
          systemPrompt,
          temperature: agentConfig.temperature ?? 0.7,
          maxTokens: adaptiveTokens,
          tools: openaiTools,
        });
        content = response.content || '';
        console.log(`[BedrockPolly Bridge] OpenAI response: ${content.length} chars, inputTokens=${response.inputTokens}, outputTokens=${response.outputTokens}, stopReason=${response.stopReason}`);
      } else {
        const { converseInvoke } = await import('../../../services/agent-orchestration/bedrock-converse');

        const toolDefs: ToolDefinition[] = hasTools
          ? activeTools
              .map(t => agentToolToDefinition(t))
              .filter((d): d is ToolDefinition => d !== null)
          : [];
        const bedrockToolSpecs = toolDefs.length > 0 ? toBedrockToolSpecs(toolDefs) : undefined;

        const response = await converseInvoke({
          model: agentConfig.model,
          messages: bedrockMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          systemPrompt,
          temperature: agentConfig.temperature ?? 0.7,
          maxTokens: adaptiveTokens,
          tools: bedrockToolSpecs,
        });
        content = response.content || '';
        structuredToolCalls = response.toolCalls || [];
        console.log(`[BedrockPolly Bridge] Bedrock Converse response: ${content.length} chars, toolCalls=${structuredToolCalls.length}, inputTokens=${response.inputTokens}, outputTokens=${response.outputTokens}, stopReason=${response.stopReason}`);
      }

      if (structuredToolCalls.length > 0) {
        const registry = this.buildToolRegistry(session);
        const toolResults: StructuredToolResult[] = [];
        for (const tc of structuredToolCalls) {
          const validation = registry.validateInput(tc.name, tc.params);
          if (!validation.valid) {
            console.error(`[BedrockPolly Bridge] Zod validation failed for tool "${tc.name}" in getBedrockResponse: ${validation.error}`);
            toolResults.push({ toolCallId: tc.id, name: tc.name, result: { error: `Invalid parameters: ${validation.error}` }, isError: true });
            continue;
          }

          try {
            const toolResultStr = await this.handleToolCalls(session, [{ name: tc.name, params: tc.params }]);
            let resultObj: unknown;
            try { resultObj = JSON.parse(toolResultStr); } catch { resultObj = { result: toolResultStr }; }
            toolResults.push({ toolCallId: tc.id, name: tc.name, result: resultObj });
          } catch (execError: unknown) {
            const errorMsg = execError instanceof Error ? execError.message : 'Tool execution failed';
            console.error(`[BedrockPolly Bridge] Tool execution error in getBedrockResponse:`, errorMsg);
            toolResults.push({ toolCallId: tc.id, name: tc.name, result: { error: errorMsg }, isError: true });
          }
        }

        if (isBedrock) {
          try {
            const assistantContent: Array<{ text?: string; toolUse?: { toolUseId: string; name: string; input: unknown } }> = [];
            if (content) assistantContent.push({ text: content });
            for (const tc of structuredToolCalls) {
              assistantContent.push({ toolUse: { toolUseId: tc.id, name: tc.name, input: tc.params } });
            }

            const continuationToolDefs: ToolDefinition[] = hasTools
              ? activeTools.map(t => agentToolToDefinition(t)).filter((d): d is ToolDefinition => d !== null)
              : [];
            const continuationToolSpecs = continuationToolDefs.length > 0 ? toBedrockToolSpecs(continuationToolDefs) : undefined;

            const converseOpts = {
              model: agentConfig.model,
              messages: bedrockMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
              systemPrompt,
              temperature: agentConfig.temperature ?? 0.7,
              maxTokens: adaptiveTokens,
              tools: continuationToolSpecs,
            };

            console.log(`[BedrockPolly Bridge] Using native Bedrock tool continuation in getBedrockResponse for ${session.callSid}`);
            const continuationResult = await converseWithToolResults(converseOpts, assistantContent, toolResults);

            const toolSummary = toolResults.map(tr => {
              const resultStr = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result);
              return `Tool "${tr.name}" returned: ${resultStr}`;
            }).join('\n');
            session.messages.push({ role: 'assistant', content: content || `[Called tools: ${structuredToolCalls.map(tc => tc.name).join(', ')}]`, timestamp: new Date() });
            session.messages.push({ role: 'user', content: toolSummary, timestamp: new Date() });

            if (continuationResult.toolCalls.length > 0) {
              session.messages.push({ role: 'assistant', content: continuationResult.content || `[Called tools: ${continuationResult.toolCalls.map(tc => tc.name).join(', ')}]`, timestamp: new Date() });
              return this.handleStructuredToolCalls(session, continuationResult.content, continuationResult.toolCalls, systemPrompt, false);
            }

            session.messages.push({ role: 'assistant', content: continuationResult.content, timestamp: new Date() });
            return continuationResult.content;
          } catch (nativeErr: unknown) {
            const errMsg = nativeErr instanceof Error ? nativeErr.message : 'Unknown error';
            console.warn(`[BedrockPolly Bridge] Native tool continuation failed in getBedrockResponse: ${errMsg}. Falling back to text recursion.`);
          }
        }

        const toolSummary = toolResults.map(tr => {
          const resultStr = typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result);
          return `Tool "${tr.name}" returned: ${resultStr}`;
        }).join('\n');
        session.messages.push({ role: 'assistant', content: content || `[Called tools: ${structuredToolCalls.map(tc => tc.name).join(', ')}]`, timestamp: new Date() });
        session.messages.push({ role: 'user', content: toolSummary, timestamp: new Date() });
        return await this.getBedrockResponse(session);
      }

      if (content.indexOf('[TOOL_CALL]') !== -1) {
        const { jsonStr, textBefore } = this.extractToolCallJson(content);
        const toolCall = this.parseToolCall(jsonStr);

        if (!toolCall) {
          console.error(`[BedrockPolly Bridge] Tool call parsing failed in getBedrockResponse for ${session.callSid}`);
          return textBefore || this.getToolParseRecoveryPhrase(agentConfig.language);
        }

        try {
          const toolResult = await this.handleToolCalls(session, [toolCall]);
          session.messages.push({ role: 'assistant', content: content, timestamp: new Date() });
          session.messages.push({ role: 'user', content: `Tool "${toolCall.name}" returned: ${toolResult}`, timestamp: new Date() });
          return await this.getBedrockResponse(session);
        } catch (execError: any) {
          console.error(`[BedrockPolly Bridge] Tool execution error in getBedrockResponse:`, execError.message);
          return textBefore || this.getToolParseRecoveryPhrase(agentConfig.language);
        }
      }

      return content;
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Bedrock invocation error for ${session.callSid}:`, error.message);
      const lang = agentConfig.language || 'en';
      const fallbacks: Record<string, string> = {
        ar: 'عذرًا، أواجه مشكلة تقنية حاليًا. هل يمكنك المحاولة مرة أخرى؟',
        es: 'Lo siento, estoy teniendo problemas técnicos. ¿Podría intentarlo de nuevo?',
        fr: 'Désolé, je rencontre un problème technique. Pourriez-vous réessayer ?',
        de: 'Entschuldigung, ich habe gerade technische Probleme. Könnten Sie es noch einmal versuchen?',
        zh: '抱歉，我目前遇到技术问题。您能再试一次吗？',
        ja: '申し訳ありませんが、技術的な問題が発生しています。もう一度お試しいただけますか？',
        ko: '죄송합니다. 기술적인 문제가 발생했습니다. 다시 시도해 주시겠어요?',
        pt: 'Desculpe, estou enfrentando um problema técnico. Poderia tentar novamente?',
        it: 'Mi scuso, sto riscontrando un problema tecnico. Potrebbe riprovare?',
        hi: 'क्षमा करें, मुझे एक तकनीकी समस्या आ रही है। क्या आप फिर से कोशिश कर सकते हैं?',
        tr: 'Özür dilerim, teknik bir sorun yaşıyorum. Tekrar deneyebilir misiniz?',
      };
      return fallbacks[lang] || 'I apologize, but I am having trouble processing your request right now. Could you please try again?';
    }
  }

  /**
   * Synthesize text to speech via ElevenLabs TTS API returning PCM audio buffer.
   * Uses the /v1/text-to-speech/{voice_id} endpoint with pcm_16000 output format,
   * then downsamples to 8kHz PCM for Twilio mulaw conversion.
   */
  private static async synthesizeWithElevenLabs(
    text: string,
    voiceId: string,
    apiKey: string
  ): Promise<Buffer> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.85,
          speed: 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS API error ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const pcm16k = Buffer.from(arrayBuffer);

    return downsamplePcm16By2(pcm16k);
  }

  /**
   * Synthesize the given text into speech and stream
   * the resulting audio back to the Twilio WebSocket as mulaw chunks.
   * Routes to ElevenLabs or AWS Polly based on session ttsProvider.
   */
  private static sendMulawToTwilio(
    session: BedrockPollyBridgeSession,
    mulawBuffer: Buffer
  ): void {
    const { callSid, twilioWs, streamSid } = session;
    if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN || !streamSid) return;

    let chunksSent = 0;
    for (let offset = 0; offset < mulawBuffer.length; offset += this.AUDIO_CHUNK_SIZE) {
      if (bargeInFlags.get(callSid) || session.status === 'disconnected') break;

      const chunk = mulawBuffer.slice(
        offset,
        Math.min(offset + this.AUDIO_CHUNK_SIZE, mulawBuffer.length)
      );

      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: chunk.toString('base64'),
        },
      }));

      chunksSent++;
    }
  }

  private static async synthesizeAndSend(
    session: BedrockPollyBridgeSession,
    text: string
  ): Promise<void> {
    const { callSid, agentConfig, twilioWs, streamSid, ttsProvider } = session;

    if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN || !streamSid) {
      console.warn(`[BedrockPolly Bridge] Cannot send audio — stream not ready for ${callSid}`);
      return;
    }

    try {
      let trimmedText = text.trim();
      if (!trimmedText || trimmedText.length < 3) {
        console.log(`[BedrockPolly Bridge] Text too short (${trimmedText.length} chars), skipping synthesis for ${callSid}: "${trimmedText}"`);
        return;
      }

      trimmedText = this.sanitizeForTTS(trimmedText);
      if (!trimmedText || trimmedText.length < 3) {
        console.log(`[BedrockPolly Bridge] Text too short after TTS sanitization, skipping for ${callSid}`);
        return;
      }

      const MAX_CHARS = 3000;
      const synthesisText = trimmedText.length > MAX_CHARS 
        ? trimmedText.substring(0, MAX_CHARS) 
        : trimmedText;

      let pcmBuffer: Buffer;

      if (ttsProvider === 'cartesia' && agentConfig.cartesiaVoiceId) {
        try {
          pcmBuffer = await this.synthesizeWithCartesia(synthesisText, agentConfig.cartesiaVoiceId, agentConfig.language);
        } catch (cartesiaError: any) {
          console.warn(`[BedrockPolly Bridge] Cartesia TTS failed for ${callSid}, falling back to Polly: ${cartesiaError.message}`);
          const pollyFallbackVoice = (agentConfig.voice && !agentConfig.voice.match(/^[0-9a-f-]{36}$/i)) ? agentConfig.voice : this.getPollyFallbackVoice(agentConfig.language);
          pcmBuffer = await this.synthesizeWithPolly(synthesisText, pollyFallbackVoice);
        }
      } else if (ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId) {
        const apiKey = agentConfig.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          console.warn(`[BedrockPolly Bridge] No ElevenLabs API key for ${callSid}, falling back to Polly`);
          pcmBuffer = await this.synthesizeWithPolly(synthesisText, agentConfig.voice);
        } else {
          try {
            pcmBuffer = await this.synthesizeWithElevenLabs(synthesisText, agentConfig.elevenLabsVoiceId, apiKey);
          } catch (elError: any) {
            console.warn(`[BedrockPolly Bridge] ElevenLabs TTS failed for ${callSid}, falling back to Polly: ${elError.message}`);
            pcmBuffer = await this.synthesizeWithPolly(synthesisText, agentConfig.voice);
          }
        }
      } else {
        pcmBuffer = await this.synthesizeWithPolly(synthesisText, agentConfig.voice);
      }

      const mulawBuffer = this.pcmToMulaw(pcmBuffer);
      this.sendMulawToTwilio(session, mulawBuffer);

      const markName = `tts_segment_${++markCounter}_${Date.now()}`;
      let marks = pendingMarks.get(callSid);
      if (!marks) {
        marks = new Set();
        pendingMarks.set(callSid, marks);
      }
      marks.add(markName);

      twilioWs.send(JSON.stringify({
        event: 'mark',
        streamSid,
        mark: {
          name: markName,
        },
      }));

      if (session.onAudioCallback) {
        session.onAudioCallback(mulawBuffer.toString('base64'));
      }
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] TTS synthesis error for ${callSid}:`, error.message);
      callErrorLogger.logCallError({
        engineType: 'bedrock-polly',
        errorCategory: 'tts_failure', severity: 'error',
        message: `TTS synthesis error: ${error.message?.substring(0, 300)}`,
        metadata: { callSid },
      });
    }
  }

  private static sanitizeForTTS(text: string): string {
    return coreSanitizeForTTS(text);
  }

  private static ssmlBlockedVoices: Set<string> = new Set();
  private static neuralBlockedVoices: Set<string> = new Set();

  /**
   * Synthesize text using AWS Polly returning 8kHz PCM buffer.
   */
  private static async synthesizeWithCartesia(text: string, voiceId: string, language?: string): Promise<Buffer> {
    const result = await cartesiaTTSService.synthesizeSpeech({
      text,
      voiceId,
      language: language || 'en',
      sampleRate: 8000,
      speed: 1.25,
    });
    return result.audioStream;
  }

  private static async synthesizeWithPolly(text: string, voiceId: string): Promise<Buffer> {
    const useSSML = !this.ssmlBlockedVoices.has(voiceId);
    const useNeural = !this.neuralBlockedVoices.has(voiceId);

    let result;

    if (useSSML && useNeural) {
      try {
        const ssmlText = humanizeToSSML(text);
        result = await awsPollyService.synthesizeSpeech({
          text: ssmlText,
          voiceId,
          engine: 'neural',
          outputFormat: 'pcm',
          sampleRate: '8000',
          textType: 'ssml',
        });
        return result.audioStream;
      } catch (e: any) {
        console.warn(`[BedrockPolly Bridge] SSML+Neural failed for ${voiceId}, caching: ${e.message}`);
        this.ssmlBlockedVoices.add(voiceId);
      }
    }

    if (useNeural) {
      try {
        result = await awsPollyService.synthesizeSpeech({
          text,
          voiceId,
          engine: 'neural',
          outputFormat: 'pcm',
          sampleRate: '8000',
        });
        return result.audioStream;
      } catch (e: any) {
        console.warn(`[BedrockPolly Bridge] Neural failed for ${voiceId}, caching: ${e.message}`);
        this.neuralBlockedVoices.add(voiceId);
      }
    }

    result = await awsPollyService.synthesizeSpeech({
      text,
      voiceId,
      engine: 'standard',
      outputFormat: 'pcm',
      sampleRate: '8000',
    });
    return result.audioStream;
  }

  /**
   * Convert a PCM 16-bit signed LE buffer to mu-law encoded bytes.
   * Each 16-bit PCM sample becomes one 8-bit mu-law byte, halving the
   * buffer length.
   */
  private static pcmToMulaw(pcmBuffer: Buffer): Buffer {
    return corePcmToMulaw(pcmBuffer);
  }

  /**
   * Execute tool calls extracted from a Bedrock response.
   * Handles built-in tools (end_call, transfer_call, transfer_to_agent)
   * as well as user-defined tools registered via agentConfig.tools.
   *
   * @returns A string describing the tool results for context injection.
   */
  private static async handleToolCalls(
    session: BedrockPollyBridgeSession,
    toolCalls: Array<{ name: string; params: Record<string, unknown> }>
  ): Promise<string> {
    const { callSid } = session;
    const results: string[] = [];

    for (const toolCall of toolCalls) {
      const { name, params } = toolCall;

      if (!name || name === 'undefined' || typeof name !== 'string') {
        console.error(`[BedrockPolly Bridge] Skipping tool call with invalid name: "${name}" for ${callSid}`);
        results.push('Tool call skipped — invalid tool name');
        continue;
      }

      console.log(`[BedrockPolly Bridge] Tool call: ${name} for ${callSid}`);

      const toolId = `${name}-${Date.now()}`;
      if (session.processedToolCallIds.has(toolId)) {
        console.log(`[BedrockPolly Bridge] Skipping duplicate tool call: ${name}`);
        continue;
      }
      session.processedToolCallIds.add(toolId);

      try {
        if (name === 'end_call') {
          console.log(`[BedrockPolly Bridge] end_call invoked for ${callSid}`);
          session.explicitEndCall = true;
          const reason = (params.reason as string) || 'Call ended by agent';
          results.push(`Call ending: ${reason}`);

          this.executeEndCall(session, reason).catch((err) => {
            console.error(`[BedrockPolly Bridge] Error executing end_call:`, err);
          });
          continue;
        }

        if (name === 'transfer_call' || name.startsWith('transfer_')) {
          let targetNumber = (params.destination as string) || (params.phoneNumber as string) || '';

          if (!targetNumber && session.agentConfig.tools) {
            for (const tool of session.agentConfig.tools) {
              const toolAny = tool as unknown as Record<string, unknown>;
              if (tool.name === name) {
                if (toolAny._transferNumber) {
                  targetNumber = toolAny._transferNumber as string;
                } else if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).phoneNumber) {
                  targetNumber = (toolAny._metadata as Record<string, unknown>).phoneNumber as string;
                }
                break;
              }
            }
          }

          if (targetNumber) {
            console.log(`[BedrockPolly Bridge] Transferring call ${callSid} to ${targetNumber}`);
            results.push(`Transferring call to ${targetNumber}`);
            this.executeTransfer(session, targetNumber).catch((err) => {
              console.error(`[BedrockPolly Bridge] Error executing transfer:`, err);
            });
          } else {
            results.push('Transfer failed — no destination number specified');
          }
          continue;
        }

        if (name === 'transfer_to_agent' || name.startsWith('transfer_agent_')) {
          let targetAgentId = '';
          if (session.agentConfig.tools) {
            for (const tool of session.agentConfig.tools) {
              const toolAny = tool as unknown as Record<string, unknown>;
              if (tool.name === name) {
                if (toolAny._transferAgentId) {
                  targetAgentId = toolAny._transferAgentId as string;
                } else if (toolAny._metadata && (toolAny._metadata as Record<string, unknown>).agentId) {
                  targetAgentId = (toolAny._metadata as Record<string, unknown>).agentId as string;
                }
                break;
              }
            }
          }

          if (targetAgentId) {
            console.log(`[BedrockPolly Bridge] Agent transfer to ${targetAgentId} for ${callSid}`);
            results.push(`Transferring to agent ${targetAgentId}`);
          } else {
            results.push('Agent transfer failed — no target agent specified');
          }
          continue;
        }

        const handler = session.toolHandlers.get(name);
        if (handler) {
          const toolResult = await handler(params);
          const resultStr = typeof toolResult === 'string'
            ? toolResult
            : JSON.stringify(toolResult);
          results.push(`${name}: ${resultStr}`);
          console.log(`[BedrockPolly Bridge] Tool ${name} result: ${resultStr.substring(0, 200)}`);
        } else {
          console.warn(`[BedrockPolly Bridge] No handler for tool: ${name}`);
          results.push(`${name}: Tool not found`);
        }
      } catch (error: any) {
        console.error(`[BedrockPolly Bridge] Tool ${name} error:`, error.message);
        results.push(`${name}: Error — ${error.message}`);
      }
    }

    return results.join('\n');
  }

  /**
   * Execute a Twilio call hangup via the REST API.
   */
  private static async executeEndCall(
    session: BedrockPollyBridgeSession,
    reason: string
  ): Promise<void> {
    try {
      const client = await getTwilioClient();
      const twiml = generateHangupTwiML(undefined, session.agentConfig.voice);

      await client.calls(session.callSid).update({
        twiml,
      });

      console.log(`[BedrockPolly Bridge] Call ${session.callSid} ended: ${reason}`);
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Failed to end call ${session.callSid}:`, error.message);
    }
  }

  /**
   * Execute a Twilio call transfer via the REST API.
   */
  private static async executeTransfer(
    session: BedrockPollyBridgeSession,
    targetNumber: string
  ): Promise<void> {
    try {
      const client = await getTwilioClient();
      const callerId = session.fromNumber || '';
      const twiml = generateTransferTwiML(targetNumber, callerId);

      await client.calls(session.callSid).update({
        twiml,
      });

      console.log(`[BedrockPolly Bridge] Call ${session.callSid} transferred to ${targetNumber}`);
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Failed to transfer call ${session.callSid}:`, error.message);
    }
  }

  /**
   * Send the configured first message as synthesized speech.
   * Converts the greeting text to audio via Polly and streams it to
   * the Twilio WebSocket. Also records it in the conversation history.
   */
  private static async sendFirstMessage(session: BedrockPollyBridgeSession): Promise<void> {
    const { callSid, agentConfig } = session;

    if (!agentConfig.firstMessage) return;

    console.log(`[BedrockPolly Bridge] Sending first message for ${callSid}: "${agentConfig.firstMessage.substring(0, 80)}..."`);

    callerHasSpoken.set(callSid, false);
    playingGreeting.set(callSid, true);

    audioBuffers.set(callSid, []);
    bufferStartTimes.delete(callSid);
    const existingSilenceTimer = silenceTimers.get(callSid);
    if (existingSilenceTimer) {
      clearTimeout(existingSilenceTimer);
      silenceTimers.delete(callSid);
    }

    session.transcriptParts.push({
      role: 'assistant',
      text: agentConfig.firstMessage,
      timestamp: new Date(),
    });

    session.messages.push({
      role: 'assistant',
      content: agentConfig.firstMessage,
      timestamp: new Date(),
    });

    if (session.onTranscriptCallback) {
      session.onTranscriptCallback(agentConfig.firstMessage, true);
    }

    await this.synthesizeAndSend(session, agentConfig.firstMessage);

    if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
      session.twilioWs.send(JSON.stringify({
        event: 'mark',
        streamSid: session.streamSid,
        mark: { name: 'greeting_playback_complete' },
      }));
    }

    playingGreeting.set(callSid, false);
    audioBuffers.set(callSid, []);
    bufferStartTimes.delete(callSid);

    openingPhaseEnd.set(callSid, Date.now() + this.OPENING_PHASE_DURATION_MS);

    console.log(`[BedrockPolly Bridge] Greeting sent for ${callSid} — waiting for Twilio playback confirmation before starting no-response timer`);

    const startNoResponseTimer = () => {
      console.log(`[BedrockPolly Bridge] Greeting playback done for ${callSid} — opening phase active, now listening`);
      const followUpTimer = setTimeout(async () => {
      noResponseTimers.delete(callSid);
      if (callerHasSpoken.get(callSid)) return;

      const currentSession = this.activeSessions.get(callSid);
      if (!currentSession || currentSession.status === 'disconnected') return;

      console.log(`[BedrockPolly Bridge] No response after greeting for ${callSid} — sending confident follow-up`);

      audioBuffers.set(callSid, []);
      bufferStartTimes.delete(callSid);

      const agentName = agentConfig.agentName;
      const lang = agentConfig.language || 'en';
      let followUp: string;
      if (lang === 'ar') {
        followUp = agentName
          ? `مرحبا، أنا ${agentName} — هل تسمعني؟`
          : `مرحبا، هل تسمعني؟`;
      } else if (lang === 'es') {
        followUp = agentName
          ? `Hola, soy ${agentName} — ¿me escuchas bien?`
          : `Hola, ¿me escuchas bien?`;
      } else if (lang === 'fr') {
        followUp = agentName
          ? `Bonjour, c'est ${agentName} — vous m'entendez bien ?`
          : `Bonjour, vous m'entendez bien ?`;
      } else if (lang === 'hi') {
        followUp = agentName
          ? `नमस्ते, मैं ${agentName} हूँ — क्या आप मुझे सुन सकते हैं?`
          : `नमस्ते, क्या आप मुझे सुन सकते हैं?`;
      } else {
        followUp = agentName
          ? `Hey, it's ${agentName} — can you hear me okay?`
          : `Hey, can you hear me okay?`;
      }

      currentSession.transcriptParts.push({
        role: 'assistant',
        text: followUp,
        timestamp: new Date(),
      });

      const lastMsg = currentSession.messages[currentSession.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content += ` ... ${followUp}`;
      } else {
        currentSession.messages.push({
          role: 'assistant',
          content: followUp,
          timestamp: new Date(),
        });
      }

      if (currentSession.onTranscriptCallback) {
        currentSession.onTranscriptCallback(followUp, true);
      }

      await this.synthesizeAndSend(currentSession, followUp);

      console.log(`[BedrockPolly Bridge] Follow-up finished for ${callSid} — now listening for response (preserving buffered audio)`);

      const finalCheckTimer = setTimeout(async () => {
        noResponseTimers.delete(callSid);
        if (callerHasSpoken.get(callSid)) return;

        const sess = this.activeSessions.get(callSid);
        if (!sess || sess.status === 'disconnected') return;

        console.log(`[BedrockPolly Bridge] Still no response for ${callSid} — sending final check`);

        const finalLang = agentConfig.language || 'en';
        let finalMsg: string;
        if (finalLang === 'ar') {
          finalMsg = `يبدو أن هناك مشكلة في الاتصال. سأحاول معك في وقت آخر!`;
        } else if (finalLang === 'es') {
          finalMsg = `Parece que tenemos una mala conexión. ¡Te intentaré llamar en otro momento!`;
        } else if (finalLang === 'fr') {
          finalMsg = `On dirait que la connexion est mauvaise. Je vous rappellerai plus tard !`;
        } else if (finalLang === 'hi') {
          finalMsg = `लगता है कनेक्शन में समस्या है। मैं आपको बाद में कॉल करूँगा!`;
        } else {
          finalMsg = `I think we might have a bad connection. I'll try you another time!`;
        }

        sess.transcriptParts.push({
          role: 'assistant',
          text: finalMsg,
          timestamp: new Date(),
        });

        if (sess.onTranscriptCallback) {
          sess.onTranscriptCallback(finalMsg, true);
        }

        await this.synthesizeAndSend(sess, finalMsg);

        console.log(`[BedrockPolly Bridge] Final check delivered for ${callSid} — scheduling graceful hangup`);

        const hangupTimer = setTimeout(async () => {
          if (callerHasSpoken.get(callSid)) return;

          const hangupSess = this.activeSessions.get(callSid);
          if (!hangupSess || hangupSess.status === 'disconnected') return;

          console.log(`[BedrockPolly Bridge] No response after final check — hanging up ${callSid}`);

          try {
            const twilioClient = await getTwilioClient();
            await twilioClient.calls(callSid).update({ status: 'completed' });
            console.log(`[BedrockPolly Bridge] Graceful hangup completed for ${callSid}`);
          } catch (hangupErr: any) {
            console.error(`[BedrockPolly Bridge] Error during graceful hangup for ${callSid}: ${hangupErr.message}`);
          }
        }, this.FINAL_HANGUP_TIMEOUT_MS);
        noResponseTimers.set(callSid, hangupTimer);
      }, this.FOLLOW_UP_TIMEOUT_MS);
      noResponseTimers.set(callSid, finalCheckTimer);
      }, this.NO_RESPONSE_TIMEOUT_MS);
      noResponseTimers.set(callSid, followUpTimer);
    };

    greetingMarkCallbacks.set(callSid, startNoResponseTimer);

    setTimeout(() => {
      const cb = greetingMarkCallbacks.get(callSid);
      if (cb) {
        greetingMarkCallbacks.delete(callSid);
        console.log(`[BedrockPolly Bridge] Greeting mark timeout for ${callSid} — starting no-response timer (fallback)`);
        cb();
      }
    }, 15000);
  }

  private static async sendInboundGreeting(session: BedrockPollyBridgeSession): Promise<void> {
    const { callSid, agentConfig } = session;
    if (!agentConfig.firstMessage) return;

    console.log(`[BedrockPolly Bridge] Sending inbound greeting for ${callSid}: "${agentConfig.firstMessage.substring(0, 80)}..."`);

    playingGreeting.set(callSid, true);
    audioBuffers.set(callSid, []);
    bufferStartTimes.delete(callSid);
    speechActive.delete(callSid);

    session.transcriptParts.push({
      role: 'assistant',
      text: agentConfig.firstMessage,
      timestamp: new Date(),
    });

    session.messages.push({
      role: 'assistant',
      content: agentConfig.firstMessage,
      timestamp: new Date(),
    });

    if (session.onTranscriptCallback) {
      session.onTranscriptCallback(agentConfig.firstMessage, true);
    }

    await this.synthesizeAndSend(session, agentConfig.firstMessage);

    await new Promise(resolve => setTimeout(resolve, 400));

    playingGreeting.set(callSid, false);
    audioBuffers.set(callSid, []);
    bufferStartTimes.delete(callSid);
    speechActive.delete(callSid);
    bargeInAccum.set(callSid, 0);
    bargeInFlags.set(callSid, false);

    console.log(`[BedrockPolly Bridge] Inbound greeting finished for ${callSid} — now listening`);
    lastTtsEndTime.set(callSid, Date.now());

    const INBOUND_NO_RESPONSE_MS = 15000;
    const INBOUND_FINAL_TIMEOUT_MS = 12000;

    const inboundFollowUpTimer = setTimeout(async () => {
      inboundNoResponseTimers.delete(callSid);

      const currentSession = this.activeSessions.get(callSid);
      if (!currentSession || currentSession.status === 'disconnected') return;

      const hasUserTurn = currentSession.messages.some(m => m.role === 'user');
      if (hasUserTurn) return;

      console.log(`[BedrockPolly Bridge] Inbound no response after greeting for ${callSid} — sending follow-up`);

      const lang = agentConfig.language || 'en';
      const followUps: Record<string, string> = {
        en: "I'm still here. How can I help you?",
        ar: "أنا لا زلت هنا، كيف يمكنني مساعدتك؟",
        es: "Sigo aquí. ¿En qué puedo ayudarle?",
        fr: "Je suis toujours là. Comment puis-je vous aider ?",
        hi: "मैं अभी भी यहाँ हूँ। मैं आपकी कैसे मदद कर सकता हूँ?",
      };
      const followUp = followUps[lang] || followUps['en'];

      currentSession.transcriptParts.push({
        role: 'assistant',
        text: followUp,
        timestamp: new Date(),
      });

      currentSession.messages.push({
        role: 'assistant',
        content: followUp,
        timestamp: new Date(),
      });

      if (currentSession.onTranscriptCallback) {
        currentSession.onTranscriptCallback(followUp, true);
      }

      await this.synthesizeAndSend(currentSession, followUp);

      console.log(`[BedrockPolly Bridge] Inbound follow-up sent for ${callSid} — waiting for response`);

      const inboundFinalTimer = setTimeout(async () => {
        inboundNoResponseTimers.delete(callSid);

        const sess = this.activeSessions.get(callSid);
        if (!sess || sess.status === 'disconnected') return;

        const hasUserResponse = sess.messages.some(m => m.role === 'user');
        if (hasUserResponse) return;

        console.log(`[BedrockPolly Bridge] Inbound still no response for ${callSid} — saying goodbye`);

        const goodbyes: Record<string, string> = {
          en: "It seems like you're not available right now. Feel free to call back anytime. Goodbye!",
          ar: "يبدو أنك غير متاح حالياً. لا تتردد في الاتصال بنا مرة أخرى. مع السلامة!",
          es: "Parece que no está disponible en este momento. No dude en llamar de nuevo. ¡Adiós!",
          fr: "Il semble que vous ne soyez pas disponible pour le moment. N'hésitez pas à rappeler. Au revoir !",
          hi: "लगता है आप अभी उपलब्ध नहीं हैं। कभी भी वापस कॉल करें। अलविदा!",
        };
        const goodbye = goodbyes[lang] || goodbyes['en'];

        sess.transcriptParts.push({
          role: 'assistant',
          text: goodbye,
          timestamp: new Date(),
        });

        if (sess.onTranscriptCallback) {
          sess.onTranscriptCallback(goodbye, true);
        }

        await this.synthesizeAndSend(sess, goodbye);

        setTimeout(async () => {
          const hangupSess = this.activeSessions.get(callSid);
          if (!hangupSess || hangupSess.status === 'disconnected') return;

          const hasResponse = hangupSess.messages.some(m => m.role === 'user');
          if (hasResponse) return;

          console.log(`[BedrockPolly Bridge] Inbound graceful hangup for ${callSid}`);
          try {
            const twilioClient = await getTwilioClient();
            await twilioClient.calls(callSid).update({ status: 'completed' });
          } catch (hangupErr: any) {
            console.error(`[BedrockPolly Bridge] Error during inbound hangup for ${callSid}: ${hangupErr.message}`);
          }
        }, 3000);
      }, INBOUND_FINAL_TIMEOUT_MS);
      inboundNoResponseTimers.set(callSid, inboundFinalTimer);
    }, INBOUND_NO_RESPONSE_MS);
    inboundNoResponseTimers.set(callSid, inboundFollowUpTimer);
  }

  /**
   * End and clean up a session, firing the end callback with transcript
   * and duration information.
   */
  static async endSession(callSid: string): Promise<{ duration: number; transcript: string }> {
    const session = this.activeSessions.get(callSid);
    if (!session) return { duration: 0, transcript: '' };

    if (session.status === 'disconnected') {
      const durationMs = (session.endedAt || new Date()).getTime() - session.startedAt.getTime();
      const duration = Math.max(0, Math.floor(durationMs / 1000));
      const transcript = session.transcriptParts
        .map((p) => `${p.role}: ${p.text}`)
        .join('\n');
      return { duration, transcript };
    }

    console.log(`[BedrockPolly Bridge] Ending session for ${callSid}`);

    session.status = 'disconnected';
    session.endedAt = new Date();

    const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
    const duration = Math.max(0, Math.floor(durationMs / 1000));
    const transcript = session.transcriptParts
      .map((p) => `${p.role}: ${p.text}`)
      .join('\n');

    try {
      const timer = silenceTimers.get(callSid);
      if (timer) {
        clearTimeout(timer);
        silenceTimers.delete(callSid);
      }

      audioBuffers.delete(callSid);
      bufferStartTimes.delete(callSid);
      bargeInFlags.delete(callSid);
      bargeInAccum.delete(callSid);
      playingGreeting.delete(callSid);
      greetingMarkCallbacks.delete(callSid);
      openingPhaseEnd.delete(callSid);
      twilioStreamReady.delete(callSid);
      speechActive.delete(callSid);
      noiseFloorSamples.delete(callSid);
      calibratedNoiseFloor.delete(callSid);
      calibrationStartTime.delete(callSid);
      pendingMarks.delete(callSid);
      peakEnergy.delete(callSid);
      whisperAbortControllers.get(callSid)?.abort();
      whisperAbortControllers.delete(callSid);

      const nrTimer = noResponseTimers.get(callSid);
      if (nrTimer) {
        clearTimeout(nrTimer);
        noResponseTimers.delete(callSid);
      }
      callerHasSpoken.delete(callSid);
      lastTtsEndTime.delete(callSid);
      inboundHallucinationCount.delete(callSid);
      const inboundNrTimer = inboundNoResponseTimers.get(callSid);
      if (inboundNrTimer) {
        clearTimeout(inboundNrTimer);
        inboundNoResponseTimers.delete(callSid);
      }
      RealtimeSentimentService.resetCall(callSid);
      clearSpeaker(callSid);
    } catch (cleanupErr: any) {
      console.error(`[BedrockPolly Bridge] Timer/buffer cleanup error for ${callSid}: ${cleanupErr.message}`);
    }

    try {
      if (!session.explicitEndCall && session.transcriptParts.length > 0) {
        const [callRecord] = await db
          .select({ id: calls.id })
          .from(calls)
          .where(eq(calls.twilioSid, callSid))
          .limit(1);

        if (callRecord) {
          const transcriptText = session.transcriptParts
            .map(p => `${p.role === 'user' ? 'User' : 'Agent'}: ${p.text}`)
            .join('\n');

          const context = {
            collectedData: {} as Record<string, string | null>,
            summaryOfDiscussion: transcriptText.substring(0, 500),
            lastTopic: session.transcriptParts.length > 0
              ? session.transcriptParts[session.transcriptParts.length - 1].text.substring(0, 200)
              : '',
            pendingQuestions: [] as string[],
          };

          await conversationResumptionService.markCallResumable(callRecord.id, context);
          console.log(`[BedrockPolly Bridge] Marked call ${callRecord.id} as resumable (no explicit end_call)`);
        }
      }
    } catch (err: any) {
      console.log(`[BedrockPolly Bridge] Could not mark call as resumable: ${err.message}`);
    }

    try {
      await this.fireEndCallback(session);
    } catch (cbErr: any) {
      console.error(`[BedrockPolly Bridge] End callback error for ${callSid}: ${cbErr.message}`);
    }

    this.activeSessions.delete(callSid);

    console.log(`[BedrockPolly Bridge] Session ended for ${callSid}: duration=${duration}s, transcript=${transcript.length} chars`);
    return { duration, transcript };
  }

  /**
   * Fire the session-end callback with transcript and duration data.
   */
  private static async fireEndCallback(session: BedrockPollyBridgeSession): Promise<void> {
    if (!session.onEndCallback) return;

    const durationMs = session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : Date.now() - session.startedAt.getTime();

    const transcript = session.transcriptParts
      .map((p) => `${p.role}: ${p.text}`)
      .join('\n');

    const duration = Math.max(0, Math.floor(durationMs / 1000));

    try {
      await Promise.resolve(session.onEndCallback({
        transcript,
        duration,
        bedrockSessionId: session.bedrockSessionId,
      }));
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] End callback error for ${session.callSid}:`, error.message);
    }
  }

  /**
   * Register a callback that fires when the session ends.
   */
  static onSessionEnd(
    callSid: string,
    callback: (data: { transcript: string; duration: number; bedrockSessionId: string }) => void
  ): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onEndCallback = callback;
    }
  }

  /**
   * Register a callback that fires when a transcript segment is available.
   */
  static onTranscript(
    callSid: string,
    callback: (text: string, isFinal: boolean) => void
  ): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.onTranscriptCallback = callback;
    }
  }

  /**
   * Retrieve the full conversation transcript for a session.
   */
  static getTranscript(callSid: string): string {
    const session = this.activeSessions.get(callSid);
    if (!session) return '';

    return session.transcriptParts
      .map((p) => `${p.role}: ${p.text}`)
      .join('\n');
  }

  /**
   * Return the number of currently active bridge sessions.
   */
  static getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}
