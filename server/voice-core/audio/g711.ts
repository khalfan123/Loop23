/**
 * ============================================================
 * G.711 mu-law audio primitives
 *
 * Pure, dependency-free helpers for the 8kHz mulaw telephony
 * path: decode-table energy measurement, ITU-T G.711 mu-law
 * encoding, and PCM16 downsampling.
 * ============================================================
 */

export const MULAW_DECODE_TABLE: Int16Array = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    let val = ~i;
    const sign = val & 0x80;
    const exponent = (val >> 4) & 0x07;
    const mantissa = val & 0x0F;
    let magnitude = ((mantissa << 1) | 0x21) << (exponent + 2);
    magnitude -= 0x21 << 2;
    table[i] = sign ? -magnitude : magnitude;
  }
  return table;
})();

/**
 * Decode a raw mu-law buffer into PCM16LE mono (one 8-bit byte → one
 * 16-bit sample). Uses the same decode table as the energy calculation.
 */
export function mulawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) {
    out.writeInt16LE(MULAW_DECODE_TABLE[mulaw[i]], i * 2);
  }
  return out;
}

/**
 * RMS energy of a raw mulaw buffer, computed over the decoded
 * linear samples. Returns 0 for an empty buffer.
 */
export function mulawEnergy(chunk: Buffer): number {
  if (chunk.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < chunk.length; i++) {
    const linear = MULAW_DECODE_TABLE[chunk[i]];
    sumSquares += linear * linear;
  }
  return Math.sqrt(sumSquares / chunk.length);
}

/**
 * Encode a single signed 16-bit PCM sample into an 8-bit mu-law byte.
 * Uses the standard ITU-T G.711 mu-law compression algorithm with a
 * lookup table for the exponent.
 */
export function linearToMulaw(pcmVal: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  const expLut = [
    0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
    4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  ];

  let sign = (pcmVal >> 8) & 0x80;
  if (sign !== 0) pcmVal = -pcmVal;
  if (pcmVal > CLIP) pcmVal = CLIP;
  pcmVal = pcmVal + BIAS;
  const exponent = expLut[(pcmVal >> 7) & 0xFF];
  const mantissa = (pcmVal >> (exponent + 3)) & 0x0F;
  let mulawByte = ~(sign | (exponent << 4) | mantissa);
  mulawByte &= 0xFF;
  return mulawByte;
}

/**
 * Convert a PCM 16-bit signed LE buffer to mu-law encoded bytes.
 * Each 16-bit PCM sample becomes one 8-bit mu-law byte, halving the
 * buffer length.
 */
export function pcmToMulaw(pcmBuffer: Buffer): Buffer {
  // Floor odd-length inputs (e.g. a truncated final chunk from a streaming
  // provider) instead of reading past the end of the buffer.
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const mulawBuffer = Buffer.alloc(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = linearToMulaw(sample);
  }
  return mulawBuffer;
}

/**
 * Naive N:1 decimation of a PCM16LE mono buffer (e.g. 16kHz -> 8kHz with
 * factor 2, or 24kHz -> 8kHz with factor 3), keeping every Nth sample.
 * No anti-alias filtering — matches the legacy bridge downsample style.
 */
export function downsamplePcm16ByFactor(pcmIn: Buffer, factor: number): Buffer {
  const step = Math.floor(factor);
  if (!Number.isFinite(step) || step < 2) {
    throw new Error(`downsamplePcm16ByFactor expects factor >= 2, got ${factor}`);
  }
  const sampleCount = Math.floor(pcmIn.length / 2);
  const outputCount = Math.floor(sampleCount / step);
  const pcmOut = Buffer.alloc(outputCount * 2);
  for (let i = 0; i < outputCount; i++) {
    pcmOut.writeInt16LE(pcmIn.readInt16LE(i * step * 2), i * 2);
  }
  return pcmOut;
}

/**
 * Naive 2:1 decimation of a PCM16LE mono buffer (e.g. 16kHz -> 8kHz),
 * keeping every other sample. No anti-alias filtering — matches the
 * legacy bridge behavior exactly.
 */
export function downsamplePcm16By2(pcmIn: Buffer): Buffer {
  return downsamplePcm16ByFactor(pcmIn, 2);
}
