/**
 * ============================================================
 * WAV container helpers for mulaw audio
 * ============================================================
 */

/**
 * Creates a proper WAV header for mulaw-encoded audio data.
 * Format code 7 = mu-law compression, 8-bit samples, mono, 8 kHz.
 *
 * @param dataLength - Length of the raw mulaw audio data in bytes
 * @param sampleRate - Sample rate (default 8000)
 * @param channels   - Number of audio channels (default 1)
 * @returns Buffer containing a 46-byte WAV header
 */
export function createMulawWavHeader(
  dataLength: number,
  sampleRate: number = 8000,
  channels: number = 1
): Buffer {
  const fmtChunkSize = 18;
  const headerSize = 12 + 8 + fmtChunkSize + 8;
  const header = Buffer.alloc(headerSize);

  header.write('RIFF', 0);
  header.writeUInt32LE(dataLength + headerSize - 8, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(fmtChunkSize, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels, 28);
  header.writeUInt16LE(channels, 32);
  header.writeUInt16LE(8, 34);
  header.writeUInt16LE(0, 36);

  header.write('data', 38);
  header.writeUInt32LE(dataLength, 42);

  return header;
}
