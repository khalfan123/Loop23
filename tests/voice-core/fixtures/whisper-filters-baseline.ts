/**
 * Frozen snapshot of server/voice-core/stt/whisper-filters.ts at
 * mainsite HEAD 00ffa317 (pre voice-hardening). Used only by regression
 * tests to prove prior behavior rejected legitimate GCC utterances.
 *
 * DO NOT import from production code paths.
 */
export {
  isWhisperHallucination as baselineIsWhisperHallucination,
  isLikelyBackgroundSpeech as baselineIsLikelyBackgroundSpeech,
  isLanguageMismatch as baselineIsLanguageMismatch,
} from './whisper-filters-mainsite-baseline';
