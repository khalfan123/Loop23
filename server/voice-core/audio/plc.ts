/**
 * ============================================================
 * Voice Core — packet-loss concealment (PLC)
 *
 * When the jitter buffer ({@link ./jitter-buffer}) signals a lost frame,
 * PLC synthesizes a replacement from the last good PCM16 frame so the gap
 * doesn't become an audible click or silence. This is a lightweight,
 * dependency-free concealer (the family used by G.711 Appendix I): repeat
 * the last frame with a smooth attenuation, so a single lost frame is
 * inaudible and a burst of losses fades to silence instead of buzzing.
 *
 * PCM16LE mono. Concealment is stateful across consecutive losses via
 * {@link PlcState} so each successive concealed frame is quieter.
 * ============================================================
 */

export interface PlcState {
  /** The last successfully played PCM16 frame (the concealment template). */
  lastFrame: Int16Array | null;
  /** Number of consecutive frames concealed since the last good frame. */
  consecutiveLosses: number;
}

export interface PlcOptions {
  /** Per-consecutive-loss attenuation factor (0..1). Default 0.75. */
  attenuation?: number;
  /** After this many consecutive losses, emit silence. Default 5. */
  maxConcealedFrames?: number;
}

export function createPlcState(): PlcState {
  return { lastFrame: null, consecutiveLosses: 0 };
}

/** Record a good frame as the template for any subsequent concealment. */
export function recordGoodFrame(state: PlcState, frame: Int16Array): void {
  state.lastFrame = frame;
  state.consecutiveLosses = 0;
}

/**
 * Produce a concealment frame for one lost packet. Returns a frame of the
 * same length as the last good frame (or a silent frame of `fallbackLength`
 * when nothing has been played yet). Mutates `state`.
 */
export function concealFrame(
  state: PlcState,
  options: PlcOptions = {},
  fallbackLength = 160
): Int16Array {
  const attenuation = options.attenuation ?? 0.75;
  const maxConcealed = options.maxConcealedFrames ?? 5;

  if (!state.lastFrame || state.lastFrame.length === 0) {
    // Nothing to conceal from — emit silence.
    return new Int16Array(fallbackLength);
  }

  state.consecutiveLosses++;
  const out = new Int16Array(state.lastFrame.length);
  if (state.consecutiveLosses > maxConcealed) {
    return out; // faded fully to silence
  }

  // Repeat the last GOOD frame, attenuated geometrically by
  // attenuation^consecutiveLosses so a burst of losses decays smoothly to
  // silence. A short intra-frame ramp softens the frame boundary. The good
  // frame stays the template (we don't feed concealed audio back in, which
  // would over-attenuate).
  const gain = Math.pow(attenuation, state.consecutiveLosses);
  const rampSamples = Math.min(32, out.length);
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < rampSamples) g *= i / rampSamples; // ease in from the boundary
    out[i] = clampInt16(state.lastFrame[i] * g);
  }
  return out;
}

/** Convenience over Buffer (PCM16LE) for engine call sites. */
export function concealFrameBuffer(state: PlcState, options?: PlcOptions, fallbackLength = 160): Buffer {
  return int16ToBuffer(concealFrame(state, options, fallbackLength));
}

export function bufferToInt16(buf: Buffer): Int16Array {
  const out = new Int16Array(buf.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

export function int16ToBuffer(frame: Int16Array): Buffer {
  const buf = Buffer.allocUnsafe(frame.length * 2);
  for (let i = 0; i < frame.length; i++) buf.writeInt16LE(frame[i], i * 2);
  return buf;
}

function clampInt16(n: number): number {
  const r = Math.round(n);
  if (r > 32767) return 32767;
  if (r < -32768) return -32768;
  return r;
}
