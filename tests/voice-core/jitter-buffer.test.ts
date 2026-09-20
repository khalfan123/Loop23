import { describe, it, expect } from 'vitest';
import { JitterBuffer } from '../../server/voice-core/audio/jitter-buffer';

const frame = (n: number): Buffer => Buffer.from([n]);

describe('JitterBuffer', () => {
  it('prebuffers to the target depth before releasing anything', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 3, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.push({ seq: 1, payload: frame(1), arrivedAt: 20 });
    expect(jb.pop()).toBeNull(); // depth 2 < 3
    jb.push({ seq: 2, payload: frame(2), arrivedAt: 40 });
    expect(jb.pop()).toMatchObject({ lost: false, seq: 0 });
  });

  it('plays frames back in sequence order once started', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 1, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.push({ seq: 1, payload: frame(1), arrivedAt: 20 });
    jb.push({ seq: 2, payload: frame(2), arrivedAt: 40 });
    expect(jb.pop()).toMatchObject({ seq: 0 });
    expect(jb.pop()).toMatchObject({ seq: 1 });
    expect(jb.pop()).toMatchObject({ seq: 2 });
    expect(jb.pop()).toBeNull(); // drained
  });

  it('reorders out-of-order arrivals', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 2, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.push({ seq: 2, payload: frame(2), arrivedAt: 20 });
    expect(jb.pop()).toMatchObject({ seq: 0 });
    jb.push({ seq: 1, payload: frame(1), arrivedAt: 40 }); // arrives late but not yet played
    expect(jb.pop()).toMatchObject({ seq: 1 });
    expect(jb.pop()).toMatchObject({ seq: 2 });
    expect(jb.stats().reordered).toBe(1);
  });

  it('drops duplicate sequence numbers', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 2, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.push({ seq: 0, payload: frame(9), arrivedAt: 10 });
    expect(jb.stats().duplicates).toBe(1);
    expect(jb.depth).toBe(1);
  });

  it('drops frames that arrive after their playout slot (late)', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 1, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.pop(); // plays seq 0, nextSeq → 1
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 30 }); // too late
    expect(jb.stats().late).toBe(1);
    expect(jb.depth).toBe(0);
  });

  it('signals a loss on a gap when later frames are buffered, then continues', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 1, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    expect(jb.pop()).toMatchObject({ lost: false, seq: 0 });
    jb.push({ seq: 2, payload: frame(2), arrivedAt: 40 }); // seq 1 lost
    expect(jb.pop()).toEqual({ lost: true, seq: 1 });
    expect(jb.pop()).toMatchObject({ lost: false, seq: 2 });
    expect(jb.stats().lost).toBe(1);
  });

  it('returns null on underrun (empty buffer) rather than skipping ahead', () => {
    const jb = new JitterBuffer<Buffer>({ targetDepthFrames: 1, adaptive: false });
    jb.push({ seq: 0, payload: frame(0), arrivedAt: 0 });
    jb.pop();
    expect(jb.pop()).toBeNull(); // nothing buffered — wait, don't declare loss
    expect(jb.stats().lost).toBe(0);
  });

  it('adapts the target depth upward as jitter increases', () => {
    const jb = new JitterBuffer<Buffer>({ frameMs: 20, targetDepthFrames: 2, maxDepthFrames: 10, adaptive: true });
    // Inter-arrivals of ~80ms (deviation 60ms from the 20ms nominal) → the
    // buffer should grow its target depth beyond the initial 2.
    let t = 0;
    for (let seq = 0; seq < 60; seq++) {
      jb.push({ seq, payload: frame(seq & 0xff), arrivedAt: t });
      t += 80;
    }
    expect(jb.stats().targetDepthFrames).toBeGreaterThan(2);
  });
});
