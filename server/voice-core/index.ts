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
export type { TTSRouteContext, TTSRouteResult, ProviderHealthSnapshot, SelectionWeights } from './router';
export { MetricsRecorder, voiceMetrics } from './metrics';
export type { TurnLatencyMetric, VoiceMetricsSummary } from './metrics';
export { estimateTTSCostUsd, setTTSCostRates, ttsCostPer1kChars, TTS_COST_PER_1K_CHARS_USD } from './cost';

export { mulawEnergy, pcmToMulaw, linearToMulaw, downsamplePcm16By2, mulawToPcm16, MULAW_DECODE_TABLE } from './audio/g711';
export { createMulawWavHeader, createPcm16WavHeader } from './audio/wav';
export { applyAgc, computeAgcGain, rmsFraction } from './audio/agc';
export { VoiceActivityDetector } from './audio/vad';
export type { VadOptions, VadFrameResult } from './audio/vad';
export { JitterBuffer } from './audio/jitter-buffer';
export type { JitterPacket, JitterBufferOptions, JitterStats, JitterPop } from './audio/jitter-buffer';
export {
  createPlcState,
  recordGoodFrame,
  concealFrame,
  concealFrameBuffer,
  bufferToInt16,
  int16ToBuffer,
} from './audio/plc';
export type { PlcState, PlcOptions } from './audio/plc';
export { splitSentences } from './text/sentence-split';
export { sanitizeForTTS } from './text/tts-sanitize';
export {
  isWhisperHallucination,
  isLikelyBackgroundSpeech,
  isLanguageMismatch,
} from './stt/whisper-filters';
