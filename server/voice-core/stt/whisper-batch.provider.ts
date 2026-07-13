/**
 * ============================================================
 * Voice Core — batch Whisper STT provider
 *
 * Absorbs the Deprock engine's REST transcription path: wraps
 * mulaw 8kHz audio in a WAV container, POSTs to OpenAI Whisper
 * (verbose_json), applies the legacy confidence gates
 * (no_speech_prob > 0.6, avg_logprob < -1.0), and primes the
 * model with Arabic call vocabulary + recent conversation.
 *
 * API-key resolution and error reporting are injected so this
 * module stays free of db/service dependencies.
 * ============================================================
 */

import { createMulawWavHeader, createPcm16WavHeader } from '../audio/wav';
import { mulawToPcm16 } from '../audio/g711';
import { applyAgc } from '../audio/agc';
import type { STTProvider, STTRequest, STTResult } from '../types';

const ARABIC_CALL_VOCABULARY =
  'ألو، مرحبا، أهلا، أريد، ممكن، سؤال، مساعدة، حساب، فاتورة، رصيد، دفع، موعد، حجز، إلغاء، اشتراك، تجوال، خدمة، مشكلة، شكوى، استفسار';

export interface WhisperBatchOptions {
  /** Resolve the OpenAI API key (env/DB/pool — caller's concern). */
  resolveApiKey: () => Promise<string | null>;
  /**
   * Apply Automatic Gain Control to the mulaw input before transcription:
   * decode to PCM16, normalize the level, send as a PCM WAV. Off by default;
   * only affects transcription accuracy, never the audio the caller hears.
   */
  agc?: boolean;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export class WhisperBatchSTTProvider implements STTProvider {
  readonly id = 'whisper-batch';

  constructor(private options: WhisperBatchOptions) {}

  async isConfigured(): Promise<boolean> {
    return (await this.options.resolveApiKey()) !== null;
  }

  async transcribe(request: STTRequest): Promise<STTResult> {
    const startedAt = Date.now();
    const apiKey = await this.options.resolveApiKey();
    if (!apiKey) {
      return {
        text: '',
        latencyMs: Date.now() - startedAt,
        rejected: 'error',
        errorMessage: 'No OpenAI API key available for Whisper',
      };
    }

    try {
      let wavBuffer: Buffer;
      if (this.options.agc) {
        // Decode mulaw → PCM16, normalize the level, wrap as a PCM WAV.
        const normalized = applyAgc(mulawToPcm16(request.audio));
        wavBuffer = Buffer.concat([createPcm16WavHeader(normalized.length), normalized]);
      } else {
        // Native mulaw WAV — no transcoding.
        wavBuffer = Buffer.concat([createMulawWavHeader(request.audio.length), request.audio]);
      }

      const formData = new FormData();
      formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0');
      if (request.language) {
        formData.append('language', request.language.split('-')[0].toLowerCase());
      }

      let whisperPrompt = '';
      if (request.language?.split('-')[0].toLowerCase() === 'ar') {
        whisperPrompt = ARABIC_CALL_VOCABULARY;
      }
      if (request.promptContext && request.promptContext.length > 0) {
        const recentContext = request.promptContext.slice(-2).join(' ').substring(0, 200);
        whisperPrompt = whisperPrompt ? `${whisperPrompt}. ${recentContext}` : recentContext;
      }
      if (whisperPrompt) {
        formData.append('prompt', whisperPrompt);
      }

      const doFetch = this.options.fetchImpl ?? fetch;
      const response = await doFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: request.signal,
      });

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          text: '',
          latencyMs,
          rejected: 'error',
          errorStatus: response.status,
          errorMessage: `Whisper API error ${response.status}: ${errorText.substring(0, 200)}`,
        };
      }

      const rawBody = await response.text();

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

      const base = { latencyMs: Date.now() - startedAt, noSpeechProb, avgLogprob, segmentCount };

      // Confidence gates: keep the text in the result so callers can log it;
      // rejected === 'confidence' tells them to discard it.
      if (segmentCount > 0 && noSpeechProb > 0.6) {
        return { ...base, text, rejected: 'confidence' };
      }
      if (segmentCount > 0 && avgLogprob < -1.0) {
        return { ...base, text, rejected: 'confidence' };
      }

      return { ...base, text };
    } catch (error: any) {
      const latencyMs = Date.now() - startedAt;
      if (error.name === 'AbortError') {
        return { text: '', latencyMs, rejected: 'aborted' };
      }
      return {
        text: '',
        latencyMs,
        rejected: 'error',
        errorMessage: `Transcription error: ${error.message}`,
      };
    }
  }
}
