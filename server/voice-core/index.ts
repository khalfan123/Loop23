/**
 * ============================================================
 * Voice Core — public exports
 * ============================================================
 */

export type {
  TTSProviderId,
  TTSRequest,
  TTSResult,
  TTSProvider,
  STTProvider,
  STTRequest,
  STTResult,
  TTSAttempt,
} from './types';
export { TTSAllProvidersFailedError } from './types';
export { WhisperBatchSTTProvider } from './stt/whisper-batch.provider';

export { ProviderRegistry } from './registry';
export { CircuitBreaker } from './circuit-breaker';
export type { BreakerState, CircuitBreakerOptions } from './circuit-breaker';
export { ProviderStats } from './health-stats';
export type { ProviderStatsSnapshot } from './health-stats';
export { ProviderRouter } from './router';
export type { TTSRouteContext, TTSRouteResult, ProviderHealthSnapshot } from './router';
export { MetricsRecorder, voiceMetrics } from './metrics';
export type { TurnLatencyMetric, VoiceMetricsSummary } from './metrics';

export { mulawEnergy, pcmToMulaw, linearToMulaw, downsamplePcm16By2, MULAW_DECODE_TABLE } from './audio/g711';
export { createMulawWavHeader } from './audio/wav';
export { splitSentences } from './text/sentence-split';
export { sanitizeForTTS } from './text/tts-sanitize';
export {
  isWhisperHallucination,
  isLikelyBackgroundSpeech,
  isLanguageMismatch,
} from './stt/whisper-filters';
