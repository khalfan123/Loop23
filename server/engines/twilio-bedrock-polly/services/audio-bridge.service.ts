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
import { getTwilioClient } from '../../../services/twilio-connector';
import { generateTransferTwiML, generateHangupTwiML } from '../config/config';
import { db } from '../../../db';
import { agents, openaiCredentials } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  AgentConfig,
  BedrockPollyBridgeSession,
  CreateSessionParams,
  TwilioMediaStreamEvent,
  BedrockConversationMessage,
} from '../types';
import { humanizeToSSML } from './ssml-humanizer';

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

const bargeInAccum: Map<string, number> = new Map();

const playingGreeting: Map<string, boolean> = new Map();

const openingPhaseEnd: Map<string, number> = new Map();

const speechActive: Map<string, boolean> = new Map();

const pendingMarks: Map<string, Set<string>> = new Map();
let markCounter = 0;

const noiseFloorSamples: Map<string, number[]> = new Map();
const calibratedNoiseFloor: Map<string, number> = new Map();
const calibrationStartTime: Map<string, number> = new Map();

const peakEnergy: Map<string, number> = new Map();

const cachedFillerAudio: Map<string, Buffer> = new Map();

const whisperAbortControllers: Map<string, AbortController> = new Map();

const MULAW_DECODE_TABLE: Int16Array = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    let val = ~i;
    const sign = val & 0x80;
    const exponent = (val >> 4) & 0x07;
    const mantissa = val & 0x0F;
    let magnitude = ((mantissa << 1) | 0x21) << (exponent + 2);
    magnitude -= 0x21 << 2;
    table[i] = sign ? -magnitude : magnitude;
  }
  return table;
})();

/**
 * Twilio stream ready flags, tracked separately from session to avoid
 * race conditions during first-message sending.
 */
const twilioStreamReady: Map<string, boolean> = new Map();

/**
 * Creates a proper WAV header for mulaw-encoded audio data.
 * Format code 7 = mu-law compression, 8-bit samples, mono, 8 kHz.
 *
 * @param dataLength - Length of the raw mulaw audio data in bytes
 * @param sampleRate - Sample rate (default 8000)
 * @param channels   - Number of audio channels (default 1)
 * @returns Buffer containing a 46-byte WAV header
 */
function createMulawWavHeader(
  dataLength: number,
  sampleRate: number = 8000,
  channels: number = 1
): Buffer {
  const fmtChunkSize = 18;
  const headerSize = 12 + 8 + fmtChunkSize + 8;
  const header = Buffer.alloc(headerSize);

  header.write('RIFF', 0);
  header.writeUInt32LE(dataLength + headerSize - 8, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(fmtChunkSize, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels, 28);
  header.writeUInt16LE(channels, 32);
  header.writeUInt16LE(8, 34);
  header.writeUInt16LE(0, 36);

  header.write('data', 38);
  header.writeUInt32LE(dataLength, 42);

  return header;
}

export class BedrockPollyAudioBridge {
  private static activeSessions: Map<string, BedrockPollyBridgeSession> = new Map();

  private static readonly SILENCE_SHORT_MS = 600;
  private static readonly SILENCE_MEDIUM_MS = 500;
  private static readonly SILENCE_LONG_UTTERANCE_MS = 400;
  private static readonly LONG_UTTERANCE_BYTES = 16000;
  private static readonly SHORT_UTTERANCE_BYTES = 8000;
  private static readonly OPENING_SILENCE_THRESHOLD_MS = 1800;
  private static readonly OPENING_PHASE_DURATION_MS = 8000;
  private static readonly MIN_AUDIO_LENGTH = 4800;
  private static readonly MAX_BUFFER_DURATION_MS = 30000;
  private static readonly AUDIO_CHUNK_SIZE = 640;
  private static readonly NO_RESPONSE_TIMEOUT_MS = 6000;
  private static readonly FOLLOW_UP_TIMEOUT_MS = 5000;
  private static readonly DEFAULT_SPEECH_ENERGY_THRESHOLD = 500;
  private static readonly DEFAULT_BARGE_IN_ENERGY_THRESHOLD = 600;
  private static readonly BARGE_IN_MIN_BYTES = 3200;
  private static readonly NOISE_CALIBRATION_DURATION_MS = 1500;
  private static readonly NOISE_FLOOR_SPEECH_MULTIPLIER = 4.0;
  private static readonly NOISE_FLOOR_BARGE_IN_MULTIPLIER = 5.0;
  private static readonly MIN_SPEECH_THRESHOLD = 500;
  private static readonly MIN_BARGE_IN_THRESHOLD = 600;
  private static readonly ENERGY_FALLOFF_RATIO = 0.3;

  private static calculateMulawEnergy(chunk: Buffer): number {
    if (chunk.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < chunk.length; i++) {
      const linear = MULAW_DECODE_TABLE[chunk[i]];
      sumSquares += linear * linear;
    }
    return Math.sqrt(sumSquares / chunk.length);
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

    const ttsLabel = agentConfig.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'AWS Polly';
    console.log(`[BedrockPolly Bridge] Creating session for call ${callSid} (direction: ${callDirection || 'unknown'})`);
    console.log(`[BedrockPolly Bridge] TTS: ${ttsLabel}, Voice: ${agentConfig.ttsProvider === 'elevenlabs' ? agentConfig.elevenLabsVoiceId : agentConfig.voice}, Model: ${agentConfig.model}`);

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

    this.preWarmFillerAudio(agentConfig.voice || 'Joanna', agentConfig.language || 'en').catch(() => {});

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

    const opEnd = openingPhaseEnd.get(oldKey);
    if (opEnd !== undefined) {
      openingPhaseEnd.delete(oldKey);
      openingPhaseEnd.set(newKey, opEnd);
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

              let silenceMs: number;
              if (isOpeningPhase) {
                silenceMs = this.OPENING_SILENCE_THRESHOLD_MS;
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
    console.log(`[BedrockPolly Bridge] onSilenceDetected for ${callSid}: bufferSize=${totalLength}b, minRequired=${this.MIN_AUDIO_LENGTH}b, callerHasSpoken=${callerHasSpoken.get(callSid)}`);

    if (totalLength < this.MIN_AUDIO_LENGTH) {
      audioBuffers.set(callSid, []);
      return;
    }

    if (session.isOutbound && !callerHasSpoken.get(callSid)) {
      callerHasSpoken.set(callSid, true);
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

  /**
   * Process a complete user speech turn:
   * 1. Collect buffered audio
   * 2. Transcribe via OpenAI Whisper
   * 3. Send to Bedrock for AI response
   * 4. Convert response to speech via Polly
   * 5. Stream audio back to Twilio
   */
  private static async processUserTurn(session: BedrockPollyBridgeSession): Promise<void> {
    const { callSid } = session;

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

      if (bufferEnergy < speechThresh * 0.8) {
        console.log(`[BedrockPolly Bridge] Buffer energy too low (${Math.round(bufferEnergy)} < ${Math.round(speechThresh * 0.8)}), skipping Whisper for ${callSid}`);
        session.isProcessing = false;
        return;
      }

      const turnStart = Date.now();
      const recentUserMessages = session.messages.filter(m => m.role === 'user').slice(-2).map(m => m.content).filter(Boolean);
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
        return;
      }

      console.log(`[BedrockPolly Bridge] User: "${transcription.substring(0, 200)}"`);

      session.transcriptParts.push({
        role: 'user',
        text: transcription,
        timestamp: new Date(),
      });

      if (session.onTranscriptCallback) {
        session.onTranscriptCallback(transcription, true);
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

      console.log(`[BedrockPolly Bridge] Calling Bedrock for ${callSid} (messages=${session.messages.length}, bargeIn=${bargeInFlags.get(callSid)})`);

      const bedrockStart = Date.now();
      const responseText = await this.streamBedrockAndSpeak(session, sttMs);

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
      bargeInAccum.set(callSid, 0);
    }
  }

  private static isWhisperHallucination(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;

    const hallucinations = [
      'اشتركوا في القناة',
      'شكراً على المشاهدة',
      'وشكراً على المشاهدة',
      'لا تنسوا الاشتراك',
      'شكرا للمشاهدة',
      'اشترك في القناة',
      'ترجمة',
      'subscribe',
      'thank you for watching',
      'thanks for watching',
      'like and subscribe',
      'please subscribe',
      'Shabbat shalom',
      'subtitles by',
      'amara.org',
      'www.mooji.org',
      '♪',
      '...',
      'أعوذ بالله من الشيطان الرجيم',
      'بسم الله الرحمن الرحيم',
    ];
    const lower = trimmed.toLowerCase();
    for (const h of hallucinations) {
      if (lower === h.toLowerCase()) return true;
    }

    const repeatedPattern = /^(.{2,15})\1{2,}$/;
    if (repeatedPattern.test(trimmed)) return true;

    return false;
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
      formData.append('response_format', 'text');
      formData.append('temperature', '0');
      if (language && language !== 'en') {
        formData.append('language', language);
      }

      let whisperPrompt = '';
      if (language === 'ar') {
        whisperPrompt = 'تجوال، eSIM، موعد، حجز، إلغاء، تغيير، حساب، اشتراك، فاتورة، رصيد، دفع';
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
        return '';
      }

      const text = (await response.text()).trim();
      const sttMs = Date.now() - sttStart;
      console.log(`[BedrockPolly Bridge] Whisper: ${sttMs}ms, "${text.substring(0, 200)}" (${text.length} chars, ${wavBuffer.length}b WAV)`);
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
    const sentences: string[] = [];
    const pattern = eager
      ? /[.!?؟]\s|[.!?؟]$|[,،:؛]\s/gm
      : /[.!?؟]\s|[.!?؟]$/gm;
    const minLen = eager ? 3 : 8;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const end = match.index + match[0].length;
      const sentence = text.substring(lastIndex, end).trim();
      if (sentence.length >= minLen) {
        sentences.push(sentence);
        lastIndex = end;
      }
    }
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) sentences.push(remaining);
    return sentences;
  }

  private static getFillerPhrase(language: string): string {
    const fillers: Record<string, string[]> = {
      ar: ['حسناً', 'نعم', 'تمام'],
      en: ['Mm-hmm', 'Sure', 'Right'],
      es: ['Sí', 'Claro', 'Bien'],
      fr: ['Oui', 'Bien sûr', 'D\'accord'],
      de: ['Ja', 'Natürlich', 'Gut'],
      zh: ['好的', '嗯'],
      ja: ['はい', 'ええ'],
      ko: ['네', '알겠습니다'],
      pt: ['Sim', 'Certo'],
      it: ['Sì', 'Certo'],
      hi: ['हाँ', 'जी'],
      tr: ['Evet', 'Tamam'],
    };
    const options = fillers[language] || fillers['en'];
    return options[Math.floor(Math.random() * options.length)];
  }

  private static async preWarmFillerAudio(voiceId: string, language: string): Promise<void> {
    const fillers: Record<string, string[]> = {
      ar: ['حسناً', 'نعم', 'تمام'],
      en: ['Mm-hmm', 'Sure', 'Right'],
    };
    const phrases = fillers[language] || fillers['en'];
    for (const phrase of phrases) {
      const cacheKey = `${voiceId}_${phrase}`;
      if (cachedFillerAudio.has(cacheKey)) continue;
      try {
        const pcm = await this.synthesizeWithPolly(phrase, voiceId);
        const mulaw = this.pcmToMulaw(pcm);
        cachedFillerAudio.set(cacheKey, mulaw);
      } catch (_) {
      }
    }
    console.log(`[BedrockPolly Bridge] Pre-cached ${phrases.length} filler audio buffers for voice=${voiceId}`);
  }

  private static async streamBedrockAndSpeak(session: BedrockPollyBridgeSession, sttMs?: number): Promise<string> {
    const { callSid, agentConfig, messages } = session;

    const bedrockMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let toolCallInstructions = '';
    if (agentConfig.tools && agentConfig.tools.length > 0) {
      const toolDescriptions = agentConfig.tools.map((t) => {
        const paramsDesc = JSON.stringify(t.parameters || {});
        return `- ${t.name}: ${t.description}. Parameters: ${paramsDesc}`;
      }).join('\n');

      toolCallInstructions = `\n\nTools (respond with [TOOL_CALL] {"name":"<name>","params":{...}}):\n${toolDescriptions}\nCall tools after collecting info. Say closing message after task. Only end_call when user confirms done.`;
    }

    const voiceInstructions = `\n\nVOICE CALL RULES: Live phone call. Never say you can't understand. Infer intent, ask ONE clarifying question if needed. 1-2 sentences max. Don't repeat questions. Be natural.`;

    const systemPrompt = agentConfig.systemPrompt + toolCallInstructions + voiceInstructions;

    if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
      session.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: session.streamSid,
      }));
    }

    try {
      let fullText = '';
      let sentenceBuffer = '';
      let sentencesSent = 0;
      let toolCallDetected = false;
      let fillerSent = false;
      let fillerInProgress = false;
      let pendingSynthesis: Promise<void> | null = null;
      const startTime = Date.now();
      let firstTokenTime = 0;
      let firstTtsStartTime = 0;
      let firstTtsAudioTime = 0;

      const fillerTimer = setTimeout(async () => {
        if (sentencesSent === 0 && !fillerSent && !fillerInProgress && session.status !== 'disconnected' && !bargeInFlags.get(callSid)) {
          fillerInProgress = true;
          fillerSent = true;
          const lang = agentConfig.language || 'en';
          const fillerText = this.getFillerPhrase(lang);
          const cacheKey = `${agentConfig.voice || 'default'}_${fillerText}`;
          const cachedBuf = cachedFillerAudio.get(cacheKey);
          if (cachedBuf) {
            console.log(`[BedrockPolly Bridge] Playing cached filler for ${callSid}: "${fillerText}"`);
            this.sendMulawToTwilio(session, cachedBuf);
          } else {
            console.log(`[BedrockPolly Bridge] Sending filler for ${callSid}: "${fillerText}"`);
            await this.synthesizeAndSend(session, fillerText);
          }
          fillerInProgress = false;
        }
      }, 400);

      const stream = awsBedrockService.invokeStream({
        model: agentConfig.model,
        messages: bedrockMessages,
        systemPrompt,
        temperature: agentConfig.temperature ?? 0.3,
        maxTokens: 300,
      });

      for await (const token of stream) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }
        fullText += token;

        if (toolCallDetected) {
          continue;
        }

        sentenceBuffer += token;

        if (sentenceBuffer.includes('[TOOL_CALL]')) {
          toolCallDetected = true;
          clearTimeout(fillerTimer);
          continue;
        }

        if (bargeInFlags.get(callSid)) {
          console.log(`[BedrockPolly Bridge] Barge-in during streaming for ${callSid}`);
          break;
        }

        if (session.status === 'disconnected') break;

        const useEager = sentencesSent === 0;
        const shouldSynth = useEager
          ? (sentenceBuffer.length >= 20 && this.splitSentences(sentenceBuffer, true).length > 1)
          : this.splitSentences(sentenceBuffer, false).length > 1;

        if (shouldSynth) {
          const sentences = this.splitSentences(sentenceBuffer, useEager);
          for (let i = 0; i < sentences.length - 1; i++) {
            const sentence = sentences[i];
            if (sentence.length < 2) continue;

            while (fillerInProgress) {
              await new Promise(r => setTimeout(r, 50));
            }

            if (pendingSynthesis) {
              await pendingSynthesis;
              pendingSynthesis = null;
            }

            sentencesSent++;
            if (sentencesSent === 1) {
              clearTimeout(fillerTimer);
              firstTtsStartTime = Date.now();
              const llmFirstMs = firstTokenTime ? firstTokenTime - startTime : 0;
              console.log(`[BedrockPolly Bridge] First fragment ready for ${callSid} (llm_first=${llmFirstMs}ms): "${sentence.substring(0, 80)}"`);
            }

            pendingSynthesis = this.synthesizeAndSend(session, sentence).then(() => {
              if (!firstTtsAudioTime) {
                firstTtsAudioTime = Date.now();
              }
            });

            if (i < sentences.length - 2) {
              await pendingSynthesis;
              pendingSynthesis = null;
            }

            if (bargeInFlags.get(callSid) || session.status === 'disconnected') break;
          }
          sentenceBuffer = sentences[sentences.length - 1];
        }
      }

      clearTimeout(fillerTimer);

      if (pendingSynthesis) {
        await pendingSynthesis;
      }

      if (toolCallDetected) {
        return this.handleStreamToolCall(session, fullText, systemPrompt);
      }

      if (sentenceBuffer.trim().length > 0 && !bargeInFlags.get(callSid) && session.status !== 'disconnected') {
        while (fillerInProgress) {
          await new Promise(r => setTimeout(r, 50));
        }
        sentencesSent++;
        if (sentencesSent === 1) {
          clearTimeout(fillerTimer);
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

  private static async handleStreamToolCall(
    session: BedrockPollyBridgeSession,
    fullText: string,
    systemPrompt: string
  ): Promise<string> {
    const toolCallIdx = fullText.indexOf('[TOOL_CALL]');
    const afterTag = fullText.substring(toolCallIdx + '[TOOL_CALL]'.length).trim();
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

    const textBeforeToolCall = fullText.substring(0, toolCallIdx).trim();
    if (textBeforeToolCall.length > 2) {
      await this.synthesizeAndSend(session, textBeforeToolCall);
    }

    try {
      const toolCall = JSON.parse(jsonStr) as {
        name: string;
        params: Record<string, unknown>;
      };

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
    } catch (parseError: any) {
      console.error(`[BedrockPolly Bridge] Failed to parse tool call in stream:`, parseError.message);
      return textBeforeToolCall || fullText;
    }
  }

  /**
   * Send the conversation history to AWS Bedrock and return the
   * text response. Handles tool-use blocks by executing registered
   * tool handlers and recursing until a final text answer is produced.
   * NOTE: This is the non-streaming fallback. The streaming version
   * (streamBedrockAndSpeak) is used for real-time conversation.
   */
  private static async getBedrockResponse(session: BedrockPollyBridgeSession): Promise<string> {
    const { agentConfig, messages } = session;

    const bedrockMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let toolCallInstructions = '';
    if (agentConfig.tools && agentConfig.tools.length > 0) {
      const toolDescriptions = agentConfig.tools.map((t) => {
        const paramsDesc = JSON.stringify(t.parameters || {});
        return `- ${t.name}: ${t.description}. Parameters: ${paramsDesc}`;
      }).join('\n');

      toolCallInstructions = `\n\nYou have access to the following tools. To call a tool, respond with a JSON block in this exact format on its own line:
[TOOL_CALL] {"name": "<tool_name>", "params": {<parameters>}}

Available tools:
${toolDescriptions}

IMPORTANT: After collecting all required information, you MUST call the relevant tool. Do NOT just describe what you would do — actually call the tool. After completing the main task, say a friendly closing message and ask if there's anything else. Only call end_call after the user confirms they are done.`;
    }

    const systemPrompt = agentConfig.systemPrompt + toolCallInstructions;
    console.log(`[BedrockPolly Bridge] getBedrockResponse: systemPrompt=${systemPrompt.length} chars, messages=${bedrockMessages.length}, model=${agentConfig.model}`);

    try {
      const response = await awsBedrockService.invoke({
        model: agentConfig.model,
        messages: bedrockMessages,
        systemPrompt,
        temperature: agentConfig.temperature ?? 0.7,
        maxTokens: 1024,
      });

      const content = response.content || '';
      console.log(`[BedrockPolly Bridge] Bedrock response: ${content.length} chars, inputTokens=${response.inputTokens}, outputTokens=${response.outputTokens}, stopReason=${response.stopReason}`);

      const toolCallIdx = content.indexOf('[TOOL_CALL]');
      if (toolCallIdx !== -1) {
        const afterTag = content.substring(toolCallIdx + '[TOOL_CALL]'.length).trim();
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

        const remainingText = jsonStr
          ? afterTag.substring(afterTag.indexOf(jsonStr) + jsonStr.length).trim()
          : afterTag;
        const textBeforeToolCall = content.substring(0, toolCallIdx).trim();

        try {
          const toolCall = JSON.parse(jsonStr) as {
            name: string;
            params: Record<string, unknown>;
          };

          const toolResult = await this.handleToolCalls(session, [toolCall]);

          session.messages.push({
            role: 'assistant',
            content: content,
            timestamp: new Date(),
          });

          session.messages.push({
            role: 'user',
            content: `Tool "${toolCall.name}" returned: ${toolResult}`,
            timestamp: new Date(),
          });

          const followUp = await this.getBedrockResponse(session);
          return followUp;
        } catch (parseError: any) {
          console.error(`[BedrockPolly Bridge] Failed to parse tool call:`, parseError.message);
          const cleanText = (textBeforeToolCall + ' ' + remainingText).trim();
          return cleanText || content;
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

    const sampleCount = pcm16k.length / 2;
    const outputCount = Math.floor(sampleCount / 2);
    const pcm8k = Buffer.alloc(outputCount * 2);
    for (let i = 0; i < outputCount; i++) {
      pcm8k.writeInt16LE(pcm16k.readInt16LE(i * 4), i * 2);
    }

    return pcm8k;
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
      if (chunksSent % 100 === 0 && typeof setImmediate !== 'undefined') {
        setImmediate(() => {});
      }
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
      const trimmedText = text.trim();
      if (!trimmedText) {
        console.log(`[BedrockPolly Bridge] Empty text, skipping synthesis for ${callSid}`);
        return;
      }

      const MAX_CHARS = 3000;
      const synthesisText = trimmedText.length > MAX_CHARS 
        ? trimmedText.substring(0, MAX_CHARS) 
        : trimmedText;

      let pcmBuffer: Buffer;

      if (ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId) {
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
    }
  }

  private static ssmlBlockedVoices: Set<string> = new Set();
  private static neuralBlockedVoices: Set<string> = new Set();

  /**
   * Synthesize text using AWS Polly returning 8kHz PCM buffer.
   */
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
    const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);
    for (let i = 0; i < pcmBuffer.length; i += 2) {
      const sample = pcmBuffer.readInt16LE(i);
      mulawBuffer[i / 2] = this.linearToMulaw(sample);
    }
    return mulawBuffer;
  }

  /**
   * Encode a single signed 16-bit PCM sample into an 8-bit mu-law byte.
   * Uses the standard ITU-T G.711 mu-law compression algorithm with a
   * lookup table for the exponent.
   */
  private static linearToMulaw(pcmVal: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;
    const expLut = [
      0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
      4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
      5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
      5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
      6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
      6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
      6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
      6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
      7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    ];

    let sign = (pcmVal >> 8) & 0x80;
    if (sign !== 0) pcmVal = -pcmVal;
    if (pcmVal > CLIP) pcmVal = CLIP;
    pcmVal = pcmVal + BIAS;
    const exponent = expLut[(pcmVal >> 7) & 0xFF];
    const mantissa = (pcmVal >> (exponent + 3)) & 0x0F;
    let mulawByte = ~(sign | (exponent << 4) | mantissa);
    mulawByte &= 0xFF;
    return mulawByte;
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

    playingGreeting.set(callSid, false);
    audioBuffers.set(callSid, []);
    bufferStartTimes.delete(callSid);

    openingPhaseEnd.set(callSid, Date.now() + this.OPENING_PHASE_DURATION_MS);

    console.log(`[BedrockPolly Bridge] Greeting finished for ${callSid} — opening phase active (${this.OPENING_PHASE_DURATION_MS}ms), now listening`);

    const followUpTimer = setTimeout(async () => {
      noResponseTimers.delete(callSid);
      if (callerHasSpoken.get(callSid)) return;

      const currentSession = this.activeSessions.get(callSid);
      if (!currentSession || currentSession.status === 'disconnected') return;

      console.log(`[BedrockPolly Bridge] No response after greeting for ${callSid} — sending confident follow-up`);

      audioBuffers.set(callSid, []);
      bufferStartTimes.delete(callSid);

      const agentName = agentConfig.agentName;
      const followUp = agentName
        ? `Hey, it's ${agentName} — can you hear me okay?`
        : `Hey, can you hear me okay?`;

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

        const finalMsg = `I think we might have a bad connection. I'll try you another time!`;

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
  }

  /**
   * End and clean up a session, firing the end callback with transcript
   * and duration information.
   */
  static async endSession(callSid: string): Promise<{ duration: number; transcript: string }> {
    const session = this.activeSessions.get(callSid);
    if (!session) return { duration: 0, transcript: '' };

    console.log(`[BedrockPolly Bridge] Ending session for ${callSid}`);

    session.status = 'disconnected';
    session.endedAt = new Date();

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

    const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
    const duration = Math.floor(durationMs / 1000);
    const transcript = session.transcriptParts
      .map((p) => `${p.role}: ${p.text}`)
      .join('\n');

    this.fireEndCallback(session);
    this.activeSessions.delete(callSid);

    return { duration, transcript };
  }

  /**
   * Fire the session-end callback with transcript and duration data.
   */
  private static fireEndCallback(session: BedrockPollyBridgeSession): void {
    if (!session.onEndCallback) return;

    const durationMs = session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : Date.now() - session.startedAt.getTime();

    const transcript = session.transcriptParts
      .map((p) => `${p.role}: ${p.text}`)
      .join('\n');

    try {
      session.onEndCallback({
        transcript,
        duration: Math.floor(durationMs / 1000),
        bedrockSessionId: session.bedrockSessionId,
      });
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] End callback error:`, error.message);
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
