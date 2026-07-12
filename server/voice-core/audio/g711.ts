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
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    mulawBuffer[i / 2] = linearToMulaw(sample);
  }
  return mulawBuffer;
}

/**
 * Naive 2:1 decimation of a PCM16LE mono buffer (e.g. 16kHz -> 8kHz),
 * keeping every other sample. No anti-alias filtering — matches the
 * legacy bridge behavior exactly.
 */
export function downsamplePcm16By2(pcmIn: Buffer): Buffer {
  const sampleCount = pcmIn.length / 2;
  const outputCount = Math.floor(sampleCount / 2);
  const pcmOut = Buffer.alloc(outputCount * 2);
  for (let i = 0; i < outputCount; i++) {
    pcmOut.writeInt16LE(pcmIn.readInt16LE(i * 4), i * 2);
  }
  return pcmOut;
}
