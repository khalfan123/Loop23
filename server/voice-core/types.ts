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
  /** Telephony consumes 8kHz; the browser test-call path uses 22.05kHz mp3. */
  sampleRateHz: 8000 | 22050;
  /** Audio container: raw PCM16LE mono (default) or mp3. */
  format?: 'pcm' | 'mp3';
  /** Provider-specific escape hatches. */
  options?: {
    /** ElevenLabs per-agent API key. */
    apiKey?: string;
    /** ElevenLabs model id (e.g. eleven_flash_v2_5, eleven_multilingual_v2). */
    modelId?: string;
    /** ElevenLabs voice_settings.stability (0–1). */
    stability?: number;
    /** ElevenLabs voice_settings.similarity_boost (0–1). */
    similarityBoost?: number;
    /** ElevenLabs / Cartesia speech rate multiplier. */
    speed?: number;
    /** ElevenLabs voice_settings.style (0–1). */
    style?: number;
    /** ElevenLabs voice_settings.use_speaker_boost. */
    useSpeakerBoost?: boolean;
    /** ElevenLabs optimize_streaming_latency (0–4). Phone path uses 2. */
    optimizeStreamingLatency?: number;
    /** Polly: stop degradation after the neural tier (browser test calls). */
    pollyNeuralOnly?: boolean;
  };
}

export interface TTSResult {
  /** Audio payload in the requested format (PCM16LE mono, μ-law, or mp3). */
  audio: Buffer;
  providerId: TTSProviderId;
  latencyMs: number;
  characters: number;
  /** Encoding of `audio`. Defaults to pcm16le for telephony providers. */
  encoding?: 'pcm16le' | 'mulaw' | 'mp3';
}

export interface TTSProvider {
  readonly id: TTSProviderId;
  /** Static credentials/config present for this process. */
  isConfigured(): boolean;
  supportsLanguage(language: string | undefined): boolean;
  /** Throws on failure — the router handles fallback. */
  synthesize(request: TTSRequest): Promise<TTSResult>;
}

export interface STTRequest {
  /** Raw mulaw 8kHz audio; the provider handles container framing. */
  audio: Buffer;
  /** BCP-47-ish language hint, e.g. 'en', 'ar', 'es-MX'. */
  language?: string;
  /** Recent user utterances for vocabulary priming. */
  promptContext?: string[];
  /** Cancel an in-flight transcription (barge-in / new speech). */
  signal?: AbortSignal;
}

export interface STTResult {
  /**
   * The transcript. Empty on error/abort; on a confidence reject the raw
   * text is preserved for logging but MUST be discarded by the caller.
   */
  text: string;
  latencyMs: number;
  /** Why text is empty, when it is. */
  rejected?: 'confidence' | 'error' | 'aborted';
  /** Failure detail for the caller's logging; set when rejected === 'error'. */
  errorMessage?: string;
  /** HTTP status of a failed provider call, when applicable. */
  errorStatus?: number;
  /** Batch-Whisper quality metadata, when available. */
  noSpeechProb?: number;
  avgLogprob?: number;
  segmentCount?: number;
}

/**
 * STT seam. Batch Whisper implements it today; streaming providers
 * (Deepgram/AssemblyAI) slot in behind the same boundary next.
 */
export interface STTProvider {
  readonly id: string;
  isConfigured(): boolean | Promise<boolean>;
  transcribe(request: STTRequest): Promise<STTResult>;
}

export interface TTSAttempt {
  providerId: TTSProviderId;
  ok: boolean;
  latencyMs: number;
  error?: string;
  skipped?: 'breaker_open' | 'unusable';
  /** Characters synthesized on a successful attempt (for cost estimation). */
  characters?: number;
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
