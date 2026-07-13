import { describe, it, expect } from 'vitest';
import { VoiceActivityDetector } from '../../server/voice-core/audio/vad';
import { pcmToMulaw } from '../../server/voice-core/audio/g711';

/** A mulaw frame whose decoded RMS is roughly `amplitude`. */
function frame(amplitude: number, samples = 160): Buffer {
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    pcm.writeInt16LE(i % 2 === 0 ? amplitude : -amplitude, i * 2);
  }
  return pcmToMulaw(pcm);
}

const quiet = () => frame(60);   // near-silence background
const loud = () => frame(12000); // clear speech

describe('VoiceActivityDetector', () => {
  it('stays silent on ambient noise and calibrates a noise floor', () => {
    const vad = new VoiceActivityDetector();
    let r;
    for (let i = 0; i < 10; i++) r = vad.process(quiet());
    expect(r!.speech).toBe(false);
    expect(vad.isSpeaking()).toBe(false);
    expect(r!.threshold).toBeGreaterThanOrEqual(500); // minSpeechEnergy floor
  });

  it('requires attackFrames of loud audio before entering speech (no single-spike trigger)', () => {
    const vad = new VoiceActivityDetector({ attackFrames: 2 });
    vad.process(quiet());
    const first = vad.process(loud());
    expect(first.speech).toBe(false); // one loud frame is not enough
    const second = vad.process(loud());
    expect(second.speech).toBe(true);
    expect(second.speechStart).toBe(true);
  });

  it('holds through a brief dip via hangover, then ends after sustained silence', () => {
    const vad = new VoiceActivityDetector({ attackFrames: 1, hangoverFrames: 3 });
    vad.process(quiet());
    expect(vad.process(loud()).speechStart).toBe(true);
    // brief dips within hangover stay in speech
    expect(vad.process(quiet()).speech).toBe(true);
    expect(vad.process(loud()).speech).toBe(true);
    // now sustained silence beyond hangover
    vad.process(quiet());
    vad.process(quiet());
    vad.process(quiet());
    const end = vad.process(quiet());
    expect(end.speech).toBe(false);
    expect(end.speechEnd).toBe(true);
  });

  it('emits exactly one rising and one falling edge per utterance', () => {
    const vad = new VoiceActivityDetector({ attackFrames: 1, hangoverFrames: 2 });
    const seq = [quiet(), loud(), loud(), loud(), quiet(), quiet(), quiet(), quiet()];
    let starts = 0, ends = 0;
    for (const f of seq) {
      const r = vad.process(f);
      if (r.speechStart) starts++;
      if (r.speechEnd) ends++;
    }
    expect(starts).toBe(1);
    expect(ends).toBe(1);
  });

  it('does not let a long utterance drag the noise floor up and clip itself', () => {
    const vad = new VoiceActivityDetector({ attackFrames: 1, hangoverFrames: 4, noiseFloorAlpha: 0.5 });
    vad.process(quiet());
    vad.process(loud());
    const floorAtStart = vad.process(loud()).noiseFloor;
    for (let i = 0; i < 20; i++) vad.process(loud());
    // floor is frozen while speaking → stays put, so speech is never clipped
    expect(vad.process(loud()).noiseFloor).toBeCloseTo(floorAtStart, 5);
    expect(vad.isSpeaking()).toBe(true);
  });

  it('reset() clears all adaptive state', () => {
    const vad = new VoiceActivityDetector({ attackFrames: 1 });
    vad.process(quiet());
    vad.process(loud());
    expect(vad.isSpeaking()).toBe(true);
    vad.reset();
    expect(vad.isSpeaking()).toBe(false);
    // after reset the floor re-seeds from the next frame
    expect(vad.process(quiet()).speech).toBe(false);
  });
});
