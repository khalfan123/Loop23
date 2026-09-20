/**
 * ============================================================
 * Voice Core — acoustic echo cancellation (NLMS)
 *
 * A normalized least-mean-squares adaptive filter that removes the far-end
 * signal (what the agent just played) from the near-end mic signal, so the
 * agent doesn't transcribe its own TTS as caller speech — the foundation of
 * clean barge-in on speakerphone/hands-free calls.
 *
 * near[n] = local_speech[n] + echo(far)[n]; the filter learns the echo path
 * from `far` and subtracts its estimate, leaving the local speech as the
 * error signal it outputs. Dependency-free PCM16, deterministic — unit-tested
 * against synthetic echo paths.
 * ============================================================
 */

export interface EchoCancellerOptions {
  /** Adaptive filter length in taps (echo-path length). Default 128. */
  filterLength?: number;
  /** NLMS step size (0..2). Higher = faster adaptation, less stable. Default 0.3. */
  stepSize?: number;
  /** Regularization to avoid divide-by-zero on silent reference. Default 1e-3. */
  regularization?: number;
}

export class EchoCanceller {
  private weights: Float64Array;
  private farHistory: Float64Array; // circular-ish ring of recent far samples
  private mu: number;
  private reg: number;
  private len: number;

  constructor(opts: EchoCancellerOptions = {}) {
    this.len = Math.max(1, opts.filterLength ?? 128);
    this.mu = opts.stepSize ?? 0.3;
    this.reg = opts.regularization ?? 1e-3;
    this.weights = new Float64Array(this.len);
    this.farHistory = new Float64Array(this.len);
  }

  /**
   * Cancel echo of `far` (reference / played audio) from `near` (mic).
   * `near` and `far` must be the same length and time-aligned. Returns the
   * echo-cancelled near-end signal (PCM16).
   */
  process(near: Int16Array, far: Int16Array): Int16Array {
    const n = Math.min(near.length, far.length);
    const out = new Int16Array(near.length);
    for (let i = 0; i < n; i++) {
      // Shift the newest far sample into the history ring (index 0 = newest).
      for (let k = this.len - 1; k > 0; k--) this.farHistory[k] = this.farHistory[k - 1];
      this.farHistory[0] = far[i];

      // Estimated echo = w · farHistory.
      let yhat = 0;
      let energy = 0;
      for (let k = 0; k < this.len; k++) {
        yhat += this.weights[k] * this.farHistory[k];
        energy += this.farHistory[k] * this.farHistory[k];
      }

      const e = near[i] - yhat; // error = near minus estimated echo = local speech
      out[i] = clampInt16(e);

      // NLMS weight update.
      const norm = this.mu / (energy + this.reg);
      for (let k = 0; k < this.len; k++) {
        this.weights[k] += norm * e * this.farHistory[k];
      }
    }
    // Pass through any tail if near is longer than far.
    for (let i = n; i < near.length; i++) out[i] = near[i];
    return out;
  }

  /** Current adapted echo-path energy (‖w‖²) — a convergence indicator. */
  get filterEnergy(): number {
    let s = 0;
    for (let k = 0; k < this.len; k++) s += this.weights[k] * this.weights[k];
    return s;
  }

  reset(): void {
    this.weights.fill(0);
    this.farHistory.fill(0);
  }
}

function clampInt16(n: number): number {
  const r = Math.round(n);
  if (r > 32767) return 32767;
  if (r < -32768) return -32768;
  return r;
}
