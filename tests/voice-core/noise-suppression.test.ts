import { describe, it, expect } from 'vitest';
import { NoiseSuppressor } from '../../server/voice-core/audio/noise-suppression';

const energy = (f: Int16Array): number => f.reduce((s, v) => s + v * v, 0);

/** Deterministic pseudo-random noise in [-amp, amp]. */
function noise(len: number, amp: number, seed = 1): Int16Array {
  const out = new Int16Array(len);
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = Math.round(((s / 0x7fffffff) * 2 - 1) * amp);
  }
  return out;
}

/** A loud sine "speech" tone. */
function tone(len: number, amp: number, period = 20): Int16Array {
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.round(Math.sin((2 * Math.PI * i) / period) * amp);
  return out;
}

describe('NoiseSuppressor', () => {
  it('attenuates steady low-level noise after adapting to the floor', () => {
    const ns = new NoiseSuppressor({ frameSize: 160 });
    const input = noise(160 * 40, 400); // ~40 frames of quiet hiss
    const out = ns.process(input);
    // After adaptation the noise should be substantially attenuated.
    expect(energy(out)).toBeLessThan(energy(input) * 0.5);
    expect(ns.noiseFloor).not.toBeNull();
  });

  it('passes loud speech through at near-unity gain once the floor is low', () => {
    const ns = new NoiseSuppressor({ frameSize: 160 });
    ns.process(noise(160 * 20, 300)); // establish a low noise floor first
    const speech = tone(160 * 10, 9000);
    const out = ns.process(speech);
    // Speech energy is largely preserved (gain near 1).
    expect(energy(out)).toBeGreaterThan(energy(speech) * 0.6);
  });

  it('preserves speech far better than noise once the floor is learned', () => {
    // A noise gate must observe the ambient floor first (as in a real call,
    // where a moment of room noise precedes speech). Warm both, then compare
    // retention of the follow-on segment.
    const nsNoise = new NoiseSuppressor({ frameSize: 160 });
    const nsSpeech = new NoiseSuppressor({ frameSize: 160 });
    const warm = noise(160 * 20, 400);
    nsNoise.process(warm);
    nsSpeech.process(warm);
    const moreNoise = noise(160 * 20, 400, 7);
    const speech = tone(160 * 20, 9000);
    const noiseRetention = energy(nsNoise.process(moreNoise)) / energy(moreNoise);
    const speechRetention = energy(nsSpeech.process(speech)) / energy(speech);
    expect(speechRetention).toBeGreaterThan(noiseRetention * 3); // clearly better
  });

  it('keeps silence silent', () => {
    const ns = new NoiseSuppressor();
    const out = ns.process(new Int16Array(1600));
    expect(energy(out)).toBe(0);
  });

  it('round-trips through a PCM16 buffer', () => {
    const ns = new NoiseSuppressor();
    const buf = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) buf.writeInt16LE(1000, i * 2);
    const out = ns.processBuffer(buf);
    expect(out).toBeInstanceOf(Buffer);
    expect(out.length).toBe(320);
  });

  it('never produces out-of-range PCM16 samples', () => {
    const ns = new NoiseSuppressor();
    const out = ns.process(tone(320, 32760));
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(-32768);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });
});
