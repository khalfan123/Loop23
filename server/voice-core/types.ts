/**
 * ============================================================
 * Voice Core — provider interfaces and shared types
 *
 * The orchestration seam for STT/LLM/TTS providers. Adapters
 * wrap existing vendor service code; the router selects among
 * them using health, latency, and language signals.
 * ============================================================
 */

export type TTSProviderId = 'aws_polly' | 'elevenlabs' | 'cartesia';

export interface TTSRequest {
  /** Caller has already sanitized and truncated the text. */
  text: string;
  /** Provider-native voice id. */
  voiceId: string;
  /** BCP-47-ish language hint, e.g. 'en', 'ar', 'es-MX'. */
  language?: string;
  /** v1: the engine consumes 8kHz PCM16LE mono. */
  sampleRateHz: 8000;
  /** Provider-specific escape hatches. */
  options?: {
    /** ElevenLabs per-agent API key. */
    apiKey?: string;
    /** Cartesia speech rate multiplier. */
    speed?: number;
  };
}

export interface TTSResult {
  /** 16-bit signed LE mono PCM at sampleRateHz. */
  pcm: Buffer;
  providerId: TTSProviderId;
  latencyMs: number;
  characters: number;
}

export interface TTSProvider {
  readonly id: TTSProviderId;
  /** Static credentials/config present for this process. */
  isConfigured(): boolean;
  supportsLanguage(language: string | undefined): boolean;
  /** Throws on failure — the router handles fallback. */
  synthesize(request: TTSRequest): Promise<TTSResult>;
}

/**
 * Streaming STT seam, reserved for the next increment
 * (Deepgram/AssemblyAI). Kept minimal so the batch-Whisper path can be
 * adapted first without committing to a streaming shape prematurely.
 */
export interface STTProvider {
  readonly id: string;
  transcribe(request: {
    audio: Buffer;
    format: 'mulaw8k_wav';
    language?: string;
    promptContext?: string[];
  }): Promise<{ text: string; confidence?: number; latencyMs: number }>;
}

export interface TTSAttempt {
  providerId: TTSProviderId;
  ok: boolean;
  latencyMs: number;
  error?: string;
  skipped?: 'breaker_open' | 'unusable';
}

export class TTSAllProvidersFailedError extends Error {
  constructor(public readonly attempts: TTSAttempt[]) {
    super(
      `All TTS providers failed: ` +
        attempts
          .map(a => `${a.providerId}=${a.skipped ?? a.error ?? 'failed'}`)
          .join(', ')
    );
    this.name = 'TTSAllProvidersFailedError';
  }
}
