/**
 * ============================================================
 * Voice Core — noise suppression
 *
 * A dependency-free, streaming spectral-gate noise suppressor for PCM16LE:
 * it tracks the ambient noise floor with a minimum-statistics estimator
 * (falls fast to new minima, rises slowly) and applies a smoothed per-frame
 * gain that attenuates low-SNR frames toward a floor while passing speech at
 * unity. This removes steady environmental noise (fans, traffic, hiss)
 * before STT without the pumping a hard gate produces.
 *
 * This is the classical DSP tier; a neural suppressor (RNNoise/DeepFilterNet
 * via WASM) is a drop-in upgrade behind the same `process()` seam — it needs
 * a model artifact this build doesn't ship. Clock-free and deterministic, so
 * it is unit-tested directly.
 * ============================================================
 */

export interface NoiseSuppressorOptions {
  /** Samples per analysis frame (default 160 = 20ms @ 8kHz). */
  frameSize?: number;
  /** Minimum gain applied to pure-noise frames (0..1, default 0.12). */
  floorGain?: number;
  /** SNR (dB) at/above which a frame passes at unity gain (default 9). */
  snrThresholdDb?: number;
  /** Noise-floor rise rate when energy exceeds the floor (slow, default 0.02). */
  noiseAdaptUp?: number;
  /** Noise-floor fall rate toward new minima (fast, default 0.5). */
  noiseAdaptDown?: number;
  /** Per-frame gain EWMA to avoid pumping (0..1, default 0.3). */
  gainSmoothing?: number;
}

const EPS = 1e-6;

export class NoiseSuppressor {
  private frameSize: number;
  private floorGain: number;
  private snrThresholdDb: number;
  private noiseAdaptUp: number;
  private noiseAdaptDown: number;
  private gainSmoothing: number;

  private noiseRms: number | null = null;
  private smoothedGain = 1;

  constructor(opts: NoiseSuppressorOptions = {}) {
    this.frameSize = Math.max(1, opts.frameSize ?? 160);
    this.floorGain = clamp01(opts.floorGain ?? 0.12);
    this.snrThresholdDb = opts.snrThresholdDb ?? 9;
    this.noiseAdaptUp = clamp01(opts.noiseAdaptUp ?? 0.02);
    this.noiseAdaptDown = clamp01(opts.noiseAdaptDown ?? 0.5);
    this.gainSmoothing = clamp01(opts.gainSmoothing ?? 0.3);
  }

  /** Suppress noise in a PCM16 signal, returning a new frame-gated signal. */
  process(pcm: Int16Array): Int16Array {
    const out = new Int16Array(pcm.length);
    for (let start = 0; start < pcm.length; start += this.frameSize) {
      const end = Math.min(start + this.frameSize, pcm.length);
      const rms = frameRms(pcm, start, end);
      if (this.noiseRms === null) this.noiseRms = rms;

      const snrDb = 20 * Math.log10((rms + EPS) / (this.noiseRms + EPS));
      const targetGain = this.gainForSnr(snrDb);
      this.smoothedGain = this.gainSmoothing * targetGain + (1 - this.gainSmoothing) * this.smoothedGain;

      for (let i = start; i < end; i++) {
        out[i] = clampInt16(pcm[i] * this.smoothedGain);
      }

      // Minimum-statistics noise tracking: only frames that look like noise
      // (below the pass threshold) update the floor — fast down, slow up — so
      // speech barely raises it.
      if (targetGain < 1) {
        const rate = rms < this.noiseRms ? this.noiseAdaptDown : this.noiseAdaptUp;
        this.noiseRms = this.noiseRms + rate * (rms - this.noiseRms);
      }
    }
    return out;
  }

  processBuffer(buf: Buffer): Buffer {
    const pcm = new Int16Array(buf.length >> 1);
    for (let i = 0; i < pcm.length; i++) pcm[i] = buf.readInt16LE(i * 2);
    const out = this.process(pcm);
    const outBuf = Buffer.allocUnsafe(out.length * 2);
    for (let i = 0; i < out.length; i++) outBuf.writeInt16LE(out[i], i * 2);
    return outBuf;
  }

  /** Current ambient-noise RMS estimate (null until the first frame). */
  get noiseFloor(): number | null {
    return this.noiseRms;
  }

  private gainForSnr(snrDb: number): number {
    if (snrDb >= this.snrThresholdDb) return 1;
    if (snrDb <= 0) return this.floorGain;
    // Linear ramp from floorGain at 0dB to 1 at the threshold.
    return this.floorGain + (1 - this.floorGain) * (snrDb / this.snrThresholdDb);
  }
}

function frameRms(pcm: Int16Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += pcm[i] * pcm[i];
  const n = end - start;
  return n > 0 ? Math.sqrt(sum / n) : 0;
}

function clampInt16(n: number): number {
  const r = Math.round(n);
  if (r > 32767) return 32767;
  if (r < -32768) return -32768;
  return r;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
