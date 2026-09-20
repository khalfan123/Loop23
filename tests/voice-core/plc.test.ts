import { describe, it, expect } from 'vitest';
import {
  createPlcState,
  recordGoodFrame,
  concealFrame,
  concealFrameBuffer,
  bufferToInt16,
  int16ToBuffer,
} from '../../server/voice-core/audio/plc';

const energy = (f: Int16Array): number => f.reduce((s, v) => s + v * v, 0);
const constFrame = (len: number, amp: number): Int16Array => Int16Array.from({ length: len }, () => amp);

describe('PLC', () => {
  it('emits a silent frame of the fallback length when nothing has been played yet', () => {
    const state = createPlcState();
    const out = concealFrame(state, {}, 160);
    expect(out).toHaveLength(160);
    expect(energy(out)).toBe(0);
  });

  it('conceals from the last good frame, attenuated and same length', () => {
    const state = createPlcState();
    const good = constFrame(160, 1000);
    recordGoodFrame(state, good);
    const out = concealFrame(state);
    expect(out).toHaveLength(160);
    expect(energy(out)).toBeGreaterThan(0);
    expect(energy(out)).toBeLessThan(energy(good)); // attenuated
    expect(state.consecutiveLosses).toBe(1);
  });

  it('decays a burst of consecutive losses monotonically to silence', () => {
    const state = createPlcState();
    recordGoodFrame(state, constFrame(160, 1000));
    const energies: number[] = [];
    for (let i = 0; i < 7; i++) energies.push(energy(concealFrame(state, { maxConcealedFrames: 5 })));
    // Strictly decreasing while concealing…
    for (let i = 1; i < 5; i++) expect(energies[i]).toBeLessThan(energies[i - 1]);
    // …and fully silent past the cap.
    expect(energies[5]).toBe(0);
    expect(energies[6]).toBe(0);
  });

  it('resets the loss counter after a good frame recovers', () => {
    const state = createPlcState();
    recordGoodFrame(state, constFrame(160, 1000));
    concealFrame(state);
    concealFrame(state);
    expect(state.consecutiveLosses).toBe(2);
    recordGoodFrame(state, constFrame(160, 800));
    expect(state.consecutiveLosses).toBe(0);
    const out = concealFrame(state);
    expect(state.consecutiveLosses).toBe(1); // decay restarts from the fresh frame
    expect(energy(out)).toBeGreaterThan(0);
  });

  it('round-trips PCM16 buffers losslessly', () => {
    const buf = Buffer.alloc(8);
    buf.writeInt16LE(-32768, 0);
    buf.writeInt16LE(32767, 2);
    buf.writeInt16LE(0, 4);
    buf.writeInt16LE(1234, 6);
    const back = int16ToBuffer(bufferToInt16(buf));
    expect(back.equals(buf)).toBe(true);
  });

  it('concealFrameBuffer returns a PCM16 buffer of the right byte length', () => {
    const state = createPlcState();
    recordGoodFrame(state, constFrame(160, 500));
    const buf = concealFrameBuffer(state);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(320); // 160 samples * 2 bytes
  });

  it('never produces out-of-range PCM16 samples', () => {
    const state = createPlcState();
    recordGoodFrame(state, constFrame(160, 32760)); // near max
    const out = concealFrame(state, { attenuation: 0.99 });
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(-32768);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });
});
