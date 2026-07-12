/**
 * ============================================================
 * Voice Core — provider cost estimation
 *
 * Character-based cost estimates for TTS providers, surfaced in
 * the ops metrics so operators can see spend per provider and,
 * later, feed cost into provider routing.
 *
 * These are DEFAULT public list rates (USD per 1,000 characters)
 * and are deliberately overridable — pricing changes and
 * enterprise contracts differ. Treat the output as an estimate.
 * ============================================================
 */

import type { TTSProviderId } from './types';

/** USD per 1,000 synthesized characters (public list-price ballparks). */
export const TTS_COST_PER_1K_CHARS_USD: Record<TTSProviderId, number> = {
  aws_polly: 0.016,   // Polly neural: $16 / 1M chars
  elevenlabs: 0.18,   // ElevenLabs mid-tier blended
  cartesia: 0.05,     // Cartesia Sonic blended
};

let rates: Record<TTSProviderId, number> = { ...TTS_COST_PER_1K_CHARS_USD };

/** Override the default rate table (e.g. from an enterprise contract). */
export function setTTSCostRates(overrides: Partial<Record<TTSProviderId, number>>): void {
  rates = { ...rates, ...overrides };
}

/** Estimated USD cost to synthesize `characters` on `providerId`. */
export function estimateTTSCostUsd(providerId: TTSProviderId, characters: number): number {
  const rate = rates[providerId] ?? 0;
  if (!characters || characters < 0) return 0;
  return (characters / 1000) * rate;
}
