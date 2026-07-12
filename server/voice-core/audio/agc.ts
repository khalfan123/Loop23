/**
 * ============================================================
 * Voice Core — Automatic Gain Control (AGC) / normalization
 *
 * Pure, dependency-free RMS-based gain normalization for PCM16
 * mono audio. Brings a caller's input level toward a target RMS
 * so downstream STT and energy-VAD behave consistently across
 * quiet and loud callers, without amplifying near-silence (which
 * would just boost background noise).
 * ============================================================
 */

export interface AgcOptions {
  /** Target RMS as a fraction of full scale (0..1). Default ~ -20 dBFS. */
  targetRms?: number;
  /** Never amplify beyond this factor (avoids blowing up noise). */
  maxGain?: number;
  /** Never attenuate below this factor. */
  minGain?: number;
  /**
   * Skip gain entirely when the frame RMS (fraction of full scale) is below
   * this floor — the frame is silence/noise, not speech worth normalizing.
   */
  silenceFloorRms?: number;
}

const FULL_SCALE = 32767;

const DEFAULTS: Required<AgcOptions> = {
  targetRms: 0.1,        // ≈ -20 dBFS
  maxGain: 8,
  minGain: 0.25,
  silenceFloorRms: 0.005,
};

/** RMS of a PCM16LE mono buffer as a fraction of full scale (0..1). */
export function rmsFraction(pcm16: Buffer): number {
  const samples = Math.floor(pcm16.length / 2);
  if (samples === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const s = pcm16.readInt16LE(i * 2) / FULL_SCALE;
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / samples);
}

/**
 * Return the gain factor AGC would apply to this buffer (1 = unchanged).
 * Exposed for observability/tests; applyAgc uses it internally.
 */
export function computeAgcGain(pcm16: Buffer, options: AgcOptions = {}): number {
  const opts = { ...DEFAULTS, ...options };
  const rms = rmsFraction(pcm16);
  if (rms < opts.silenceFloorRms) return 1;
  const gain = opts.targetRms / rms;
  return Math.min(opts.maxGain, Math.max(opts.minGain, gain));
}

/**
 * Apply RMS-based AGC to a PCM16LE mono buffer, returning a new buffer.
 * Samples are clamped to the int16 range to prevent clipping overflow.
 * A gain of 1 (silence, or already on target) returns a copy unchanged.
 */
export function applyAgc(pcm16: Buffer, options: AgcOptions = {}): Buffer {
  const gain = computeAgcGain(pcm16, options);
  const samples = Math.floor(pcm16.length / 2);
  const out = Buffer.alloc(samples * 2);
  if (gain === 1) {
    pcm16.copy(out, 0, 0, samples * 2);
    return out;
  }
  for (let i = 0; i < samples; i++) {
    let v = Math.round(pcm16.readInt16LE(i * 2) * gain);
    if (v > 32767) v = 32767;
    else if (v < -32768) v = -32768;
    out.writeInt16LE(v, i * 2);
  }
  return out;
}
