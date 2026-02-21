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
import { agents } from '@shared/schema';
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

  private static readonly SILENCE_THRESHOLD_MS = 1500;
  private static readonly MIN_AUDIO_LENGTH = 1600;
  private static readonly MAX_BUFFER_DURATION_MS = 30000;
  private static readonly AUDIO_CHUNK_SIZE = 320;

  /**
   * Create a new Bedrock+Polly bridge session for a Twilio call.
   * Unlike the OpenAI bridge there is no external WebSocket to connect;
   * the session is immediately "connected" and ready to process audio.
   */
  static async createSession(params: CreateSessionParams): Promise<BedrockPollyBridgeSession> {
    const { callSid, agentConfig, twilioWs, streamSid, fromNumber, toNumber, callDirection } = params;

    console.log(`[BedrockPolly Bridge] Creating session for call ${callSid} (direction: ${callDirection || 'unknown'})`);
    console.log(`[BedrockPolly Bridge] Voice: ${agentConfig.voice}, Model: ${agentConfig.model}`);

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
      console.warn(`[BedrockPolly Bridge] No session for ${callSid}`);
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

        if (session.agentConfig.firstMessage) {
          this.sendFirstMessage(session).catch((err) => {
            console.error(`[BedrockPolly Bridge] Error sending first message:`, err);
          });
        }
        break;

      case 'media':
        if (event.media?.payload) {
          const audioChunk = Buffer.from(event.media.payload, 'base64');

          if (session.isProcessing) {
            bargeInFlags.set(callSid, true);
            if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
              session.twilioWs.send(JSON.stringify({
                event: 'clear',
                streamSid: session.streamSid,
              }));
            }
          }

          let buf = audioBuffers.get(callSid);
          if (!buf) {
            buf = [];
            audioBuffers.set(callSid, buf);
          }
          buf.push(audioChunk);

          if (!bufferStartTimes.has(callSid)) {
            bufferStartTimes.set(callSid, Date.now());
          }

          const existingTimer = silenceTimers.get(callSid);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const elapsed = Date.now() - (bufferStartTimes.get(callSid) || Date.now());
          if (elapsed >= this.MAX_BUFFER_DURATION_MS) {
            this.onSilenceDetected(session);
          } else {
            const timer = setTimeout(() => {
              this.onSilenceDetected(session);
            }, this.SILENCE_THRESHOLD_MS);
            silenceTimers.set(callSid, timer);
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

    if (session.isProcessing) return;

    const buf = audioBuffers.get(callSid) || [];
    const totalLength = buf.reduce((sum, b) => sum + b.length, 0);
    if (totalLength < this.MIN_AUDIO_LENGTH) {
      audioBuffers.set(callSid, []);
      return;
    }

    session.isProcessing = true;
    bargeInFlags.set(callSid, false);

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

    try {
      const buf = audioBuffers.get(callSid) || [];
      audioBuffers.set(callSid, []);

      const audioBuffer = Buffer.concat(buf);
      console.log(`[BedrockPolly Bridge] Processing ${audioBuffer.length} bytes of audio for ${callSid}`);

      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || transcription.trim().length === 0) {
        console.log(`[BedrockPolly Bridge] Empty transcription, skipping turn for ${callSid}`);
        session.isProcessing = false;
        return;
      }

      console.log(`[BedrockPolly Bridge] User: "${transcription.substring(0, 100)}"`);

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

      if (bargeInFlags.get(callSid)) {
        console.log(`[BedrockPolly Bridge] Barge-in detected during transcription, skipping response`);
        session.isProcessing = false;
        return;
      }

      const responseText = await this.getBedrockResponse(session);

      if (!responseText || responseText.trim().length === 0) {
        console.log(`[BedrockPolly Bridge] Empty Bedrock response for ${callSid}`);
        session.isProcessing = false;
        return;
      }

      console.log(`[BedrockPolly Bridge] Agent: "${responseText.substring(0, 100)}"`);

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

      if (bargeInFlags.get(callSid)) {
        console.log(`[BedrockPolly Bridge] Barge-in detected before synthesis, skipping`);
        session.isProcessing = false;
        return;
      }

      await this.synthesizeAndSend(session, responseText);
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Turn processing error for ${callSid}:`, error.message);
    } finally {
      session.isProcessing = false;
    }
  }

  /**
   * Transcribe a mulaw 8 kHz audio buffer using the OpenAI Whisper API.
   * Wraps the raw mulaw data in a WAV container (format code 7) before
   * uploading to the /v1/audio/transcriptions endpoint.
   */
  private static async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[BedrockPolly Bridge] OPENAI_API_KEY not set — cannot transcribe');
      return '';
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

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BedrockPolly Bridge] Whisper API error ${response.status}: ${errorText}`);
        return '';
      }

      const result = (await response.json()) as { text?: string };
      return result.text || '';
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Transcription error:`, error.message);
      return '';
    }
  }

  /**
   * Send the conversation history to AWS Bedrock and return the
   * text response. Handles tool-use blocks by executing registered
   * tool handlers and recursing until a final text answer is produced.
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

    try {
      const response = await awsBedrockService.invoke({
        model: agentConfig.model,
        messages: bedrockMessages,
        systemPrompt,
        temperature: agentConfig.temperature ?? 0.7,
        maxTokens: 1024,
      });

      const content = response.content || '';

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
      console.error(`[BedrockPolly Bridge] Bedrock invocation error:`, error.message);
      return 'I apologize, but I am having trouble processing your request right now. Could you please try again?';
    }
  }

  /**
   * Synthesize the given text into speech via AWS Polly and stream
   * the resulting audio back to the Twilio WebSocket as mulaw chunks.
   */
  private static async synthesizeAndSend(
    session: BedrockPollyBridgeSession,
    text: string
  ): Promise<void> {
    const { callSid, agentConfig, twilioWs, streamSid } = session;

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

      const MAX_POLLY_CHARS = 3000;
      const synthesisText = trimmedText.length > MAX_POLLY_CHARS 
        ? trimmedText.substring(0, MAX_POLLY_CHARS) 
        : trimmedText;

      const ssmlText = humanizeToSSML(synthesisText);

      let result;
      try {
        result = await awsPollyService.synthesizeSpeech({
          text: ssmlText,
          voiceId: agentConfig.voice,
          engine: 'neural',
          outputFormat: 'pcm',
          sampleRate: '8000',
          textType: 'ssml',
        });
      } catch (neuralError: any) {
        console.warn(`[BedrockPolly Bridge] Neural SSML failed for voice ${agentConfig.voice}, trying plain text: ${neuralError.message}`);
        result = await awsPollyService.synthesizeSpeech({
          text: synthesisText,
          voiceId: agentConfig.voice,
          engine: 'neural',
          outputFormat: 'pcm',
          sampleRate: '8000',
        });
      }

      const pcmBuffer = result.audioStream;
      const mulawBuffer = this.pcmToMulaw(pcmBuffer);

      for (let offset = 0; offset < mulawBuffer.length; offset += this.AUDIO_CHUNK_SIZE) {
        if (bargeInFlags.get(callSid)) {
          console.log(`[BedrockPolly Bridge] Barge-in during synthesis, stopping playback for ${callSid}`);
          break;
        }

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
      }

      if (session.onAudioCallback) {
        session.onAudioCallback(mulawBuffer.toString('base64'));
      }
    } catch (error: any) {
      console.error(`[BedrockPolly Bridge] Polly synthesis error for ${callSid}:`, error.message);
    }
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

    console.log(`[BedrockPolly Bridge] Sending first message for ${callSid}: "${agentConfig.firstMessage.substring(0, 50)}..."`);

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
    twilioStreamReady.delete(callSid);

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
