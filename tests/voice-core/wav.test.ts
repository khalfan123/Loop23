import { describe, it, expect } from 'vitest';
import { createMulawWavHeader } from '../../server/voice-core/audio/wav';

describe('createMulawWavHeader', () => {
  it('produces a 46-byte header', () => {
    expect(createMulawWavHeader(1000).length).toBe(46);
  });

  it('writes RIFF/WAVE/fmt/data markers and sizes', () => {
    const dataLength = 1600;
    const h = createMulawWavHeader(dataLength);
    expect(h.toString('ascii', 0, 4)).toBe('RIFF');
    expect(h.readUInt32LE(4)).toBe(dataLength + 46 - 8);
    expect(h.toString('ascii', 8, 12)).toBe('WAVE');
    expect(h.toString('ascii', 12, 16)).toBe('fmt ');
    expect(h.readUInt32LE(16)).toBe(18);
    expect(h.toString('ascii', 38, 42)).toBe('data');
    expect(h.readUInt32LE(42)).toBe(dataLength);
  });

  it('uses format code 7 (mu-law), mono, 8kHz, 8-bit by default', () => {
    const h = createMulawWavHeader(100);
    expect(h.readUInt16LE(20)).toBe(7);
    expect(h.readUInt16LE(22)).toBe(1);
    expect(h.readUInt32LE(24)).toBe(8000);
    expect(h.readUInt32LE(28)).toBe(8000);
    expect(h.readUInt16LE(34)).toBe(8);
  });

  it('honors custom sample rate and channels', () => {
    const h = createMulawWavHeader(100, 16000, 2);
    expect(h.readUInt16LE(22)).toBe(2);
    expect(h.readUInt32LE(24)).toBe(16000);
    expect(h.readUInt32LE(28)).toBe(32000);
  });
});
