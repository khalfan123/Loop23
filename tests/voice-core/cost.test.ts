import { describe, it, expect, afterEach } from 'vitest';
import {
  estimateTTSCostUsd,
  setTTSCostRates,
  TTS_COST_PER_1K_CHARS_USD,
} from '../../server/voice-core/cost';

afterEach(() => {
  // Restore defaults so cross-test state doesn't leak.
  setTTSCostRates(TTS_COST_PER_1K_CHARS_USD);
});

describe('estimateTTSCostUsd', () => {
  it('scales linearly with characters at the default rate', () => {
    expect(estimateTTSCostUsd('aws_polly', 1000)).toBeCloseTo(0.016);
    expect(estimateTTSCostUsd('aws_polly', 500)).toBeCloseTo(0.008);
    expect(estimateTTSCostUsd('elevenlabs', 2000)).toBeCloseTo(0.36);
  });

  it('returns 0 for zero/negative characters', () => {
    expect(estimateTTSCostUsd('cartesia', 0)).toBe(0);
    expect(estimateTTSCostUsd('cartesia', -50)).toBe(0);
  });

  it('honors overridden rates (e.g. an enterprise contract)', () => {
    setTTSCostRates({ elevenlabs: 0.05 });
    expect(estimateTTSCostUsd('elevenlabs', 1000)).toBeCloseTo(0.05);
    // Non-overridden providers keep their default rate
    expect(estimateTTSCostUsd('aws_polly', 1000)).toBeCloseTo(0.016);
  });
});
