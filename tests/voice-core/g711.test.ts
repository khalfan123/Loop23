import { describe, it, expect } from 'vitest';
import {
  MULAW_DECODE_TABLE,
  mulawEnergy,
  linearToMulaw,
  pcmToMulaw,
  downsamplePcm16By2,
} from '../../server/voice-core/audio/g711';

function pcmBufferFrom(samples: number[]): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
  return buf;
}

describe('linearToMulaw', () => {
  it('encodes silence to 0xFF', () => {
    expect(linearToMulaw(0)).toBe(0xff);
  });

  it('clips at +/-32635', () => {
    expect(linearToMulaw(32767)).toBe(linearToMulaw(32635));
    expect(linearToMulaw(-32768)).toBe(linearToMulaw(-32635));
  });

  it('round-trips through the decode table within G.711 quantization error', () => {
    for (let s = -32635; s <= 32635; s += 97) {
      const mu = linearToMulaw(s);
      const decoded = MULAW_DECODE_TABLE[mu];
      // mu-law quantization step grows with magnitude; max step is 1024 at the top segment
      const tolerance = Math.max(64, Math.abs(s) / 16);
      expect(Math.abs(decoded - s)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('always returns a byte', () => {
    for (let s = -32768; s <= 32767; s += 251) {
      const mu = linearToMulaw(s);
      expect(mu).toBeGreaterThanOrEqual(0);
      expect(mu).toBeLessThanOrEqual(255);
    }
  });
});

describe('pcmToMulaw', () => {
  it('halves the buffer length', () => {
    const pcm = pcmBufferFrom([0, 1000, -1000, 32000]);
    expect(pcmToMulaw(pcm).length).toBe(4);
  });

  it('encodes each sample independently', () => {
    const pcm = pcmBufferFrom([0, 12345]);
    const mu = pcmToMulaw(pcm);
    expect(mu[0]).toBe(linearToMulaw(0));
    expect(mu[1]).toBe(linearToMulaw(12345));
  });
});

describe('mulawEnergy', () => {
  it('returns 0 for an empty buffer', () => {
    expect(mulawEnergy(Buffer.alloc(0))).toBe(0);
  });

  it('is near zero for mulaw silence and large for a full-scale square wave', () => {
    const silence = Buffer.alloc(160, linearToMulaw(0));
    const loud = Buffer.alloc(160);
    for (let i = 0; i < loud.length; i++) {
      loud[i] = linearToMulaw(i % 2 === 0 ? 32000 : -32000);
    }
    expect(mulawEnergy(silence)).toBeLessThan(10);
    expect(mulawEnergy(loud)).toBeGreaterThan(20000);
  });
});

describe('downsamplePcm16By2', () => {
  it('keeps every other sample', () => {
    const pcm = pcmBufferFrom([10, 20, 30, 40, 50, 60]);
    const out = downsamplePcm16By2(pcm);
    expect(out.length).toBe(6);
    expect(out.readInt16LE(0)).toBe(10);
    expect(out.readInt16LE(2)).toBe(30);
    expect(out.readInt16LE(4)).toBe(50);
  });

  it('floors odd sample counts', () => {
    const pcm = pcmBufferFrom([1, 2, 3]);
    const out = downsamplePcm16By2(pcm);
    expect(out.length).toBe(2);
    expect(out.readInt16LE(0)).toBe(1);
  });
});
