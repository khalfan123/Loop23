import { describe, it, expect } from 'vitest';
import { EchoCanceller } from '../../server/voice-core/audio/aec';

const energy = (f: Int16Array): number => f.reduce((s, v) => s + v * v, 0);

function tone(len: number, amp: number, period: number, phase = 0): Int16Array {
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.round(Math.sin((2 * Math.PI * (i + phase)) / period) * amp);
  return out;
}

/** Build a near signal = local + a delayed, attenuated echo of far. */
function withEcho(local: Int16Array, far: Int16Array, delay: number, gain: number): Int16Array {
  const out = new Int16Array(local.length);
  for (let i = 0; i < local.length; i++) {
    const echo = i - delay >= 0 ? far[i - delay] * gain : 0;
    out[i] = Math.round(local[i] + echo);
  }
  return out;
}

describe('EchoCanceller (NLMS)', () => {
  it('cancels a pure echo (no local speech) toward silence as it converges', () => {
    const aec = new EchoCanceller({ filterLength: 64, stepSize: 0.5 });
    const far = tone(4000, 6000, 23);
    const near = withEcho(new Int16Array(4000), far, 3, 0.6); // pure echo
    const out = aec.process(near, far);
    // Residual over the converged second half is far below the input echo.
    const firstHalf = out.slice(0, 2000);
    const secondHalf = out.slice(2000);
    expect(energy(secondHalf)).toBeLessThan(energy(firstHalf) * 0.5);
    expect(energy(secondHalf)).toBeLessThan(energy(near.slice(2000)) * 0.2);
  });

  it('recovers local speech from near = speech + echo', () => {
    const aec = new EchoCanceller({ filterLength: 64, stepSize: 0.5 });
    const far = tone(6000, 6000, 23);
    const local = tone(6000, 4000, 7); // different frequency = the caller
    const near = withEcho(local, far, 2, 0.5);
    const out = aec.process(near, far);
    // On the converged tail the output should track local far better than near does.
    const tailLocal = local.slice(4000);
    const errAec = diffEnergy(out.slice(4000), tailLocal);
    const errNear = diffEnergy(near.slice(4000), tailLocal);
    expect(errAec).toBeLessThan(errNear);
  });

  it('grows filter energy as it learns the echo path, and reset clears it', () => {
    const aec = new EchoCanceller({ filterLength: 32, stepSize: 0.4 });
    const far = tone(2000, 6000, 19);
    aec.process(withEcho(new Int16Array(2000), far, 1, 0.5), far);
    expect(aec.filterEnergy).toBeGreaterThan(0);
    aec.reset();
    expect(aec.filterEnergy).toBe(0);
  });

  it('is a near no-op when there is no reference signal', () => {
    const aec = new EchoCanceller({ filterLength: 16 });
    const near = tone(1000, 4000, 11);
    const out = aec.process(near, new Int16Array(1000)); // silent far
    // With zero reference the filter cannot adapt; output ≈ near.
    expect(diffEnergy(out, near)).toBeLessThan(energy(near) * 0.01);
  });

  it('never produces out-of-range PCM16 samples', () => {
    const aec = new EchoCanceller();
    const far = tone(500, 30000, 13);
    const near = withEcho(tone(500, 20000, 5), far, 2, 0.9);
    const out = aec.process(near, far);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(-32768);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });
});

function diffEnergy(a: Int16Array, b: Int16Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}
