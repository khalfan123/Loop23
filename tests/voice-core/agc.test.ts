import { describe, it, expect } from 'vitest';
import { applyAgc, computeAgcGain, rmsFraction } from '../../server/voice-core/audio/agc';

function tone(amplitude: number, samples = 400): Buffer {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    // Alternating +/- amplitude = full-amplitude square wave (RMS = amplitude)
    buf.writeInt16LE(i % 2 === 0 ? amplitude : -amplitude, i * 2);
  }
  return buf;
}

describe('rmsFraction', () => {
  it('is 0 for an empty buffer', () => {
    expect(rmsFraction(Buffer.alloc(0))).toBe(0);
  });

  it('reflects amplitude as a fraction of full scale', () => {
    expect(rmsFraction(tone(3277))).toBeCloseTo(0.1, 2); // ~10% of 32767
    expect(rmsFraction(tone(16384))).toBeCloseTo(0.5, 2);
  });
});

describe('computeAgcGain', () => {
  it('amplifies a quiet frame toward the target RMS', () => {
    const quiet = tone(1638); // ~0.05 fraction
    const gain = computeAgcGain(quiet, { targetRms: 0.1 });
    expect(gain).toBeCloseTo(2, 1); // 0.1 / 0.05
  });

  it('attenuates a loud frame toward the target', () => {
    const loud = tone(13107); // ~0.4 fraction
    const gain = computeAgcGain(loud, { targetRms: 0.1 });
    expect(gain).toBeCloseTo(0.25, 1);
  });

  it('clamps to maxGain and minGain', () => {
    expect(computeAgcGain(tone(328), { targetRms: 0.1, maxGain: 4 })).toBe(4);
    expect(computeAgcGain(tone(30000), { targetRms: 0.1, minGain: 0.5 })).toBe(0.5);
  });

  it('does not amplify near-silence (returns gain 1 below the floor)', () => {
    expect(computeAgcGain(tone(50), { silenceFloorRms: 0.01 })).toBe(1);
    expect(computeAgcGain(Buffer.alloc(0))).toBe(1);
  });
});

describe('applyAgc', () => {
  it('raises the RMS of a quiet frame toward the target', () => {
    const quiet = tone(1638);
    const out = applyAgc(quiet, { targetRms: 0.1 });
    expect(rmsFraction(out)).toBeGreaterThan(rmsFraction(quiet));
    expect(rmsFraction(out)).toBeCloseTo(0.1, 1);
  });

  it('clamps samples to the int16 range (no overflow) when amplifying loud audio', () => {
    const loud = tone(20000);
    const out = applyAgc(loud, { targetRms: 0.9, maxGain: 8, minGain: 0.25 });
    for (let i = 0; i < out.length; i += 2) {
      const v = out.readInt16LE(i);
      expect(v).toBeGreaterThanOrEqual(-32768);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });

  it('returns an unchanged copy for near-silence', () => {
    const silence = tone(20);
    const out = applyAgc(silence, { silenceFloorRms: 0.01 });
    expect(out.equals(silence)).toBe(true);
    expect(out).not.toBe(silence); // new buffer
  });
});
