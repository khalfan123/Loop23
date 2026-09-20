/**
 * ============================================================
 * Voice Core — Voice Activity Detection (adaptive energy VAD)
 *
 * A dependency-free, stateful VAD for 8kHz mulaw telephony frames.
 * It tracks the ambient noise floor (EMA over non-speech frames),
 * derives a speech threshold as a multiple of that floor, and
 * applies hysteresis (consecutive-frame confirmation to enter
 * speech + a hangover tail to exit) so brief dips inside an
 * utterance don't chop it and single noise spikes don't trigger.
 *
 * This is the seam for a neural VAD (e.g. Silero): swap the
 * per-frame decision while keeping the same interface. Pure and
 * deterministic — unit-testable on synthetic frames.
 * ============================================================
 */

import { mulawEnergy } from './g711';

export interface VadOptions {
  /** Speech threshold = max(noiseFloor * multiplier, minSpeechEnergy). */
  speechMultiplier?: number;
  /** Absolute floor so a silent line can't set an implausibly low threshold. */
  minSpeechEnergy?: number;
  /** EMA weight for the noise floor (higher = adapts faster). */
  noiseFloorAlpha?: number;
  /** Consecutive speech frames required to enter the speaking state. */
  attackFrames?: number;
  /** Non-speech frames tolerated before leaving the speaking state (hangover). */
  hangoverFrames?: number;
}

export interface VadFrameResult {
  /** Whether the caller is currently considered to be speaking. */
  speech: boolean;
  /** True only on the frame speech starts (rising edge). */
  speechStart: boolean;
  /** True only on the frame speech ends (falling edge). */
  speechEnd: boolean;
  energy: number;
  noiseFloor: number;
  threshold: number;
}

const DEFAULTS: Required<VadOptions> = {
  speechMultiplier: 3.5,
  minSpeechEnergy: 500,
  noiseFloorAlpha: 0.05,
  attackFrames: 2,
  hangoverFrames: 8,
};

export class VoiceActivityDetector {
  private opts: Required<VadOptions>;
  private noiseFloor: number | null = null;
  private speaking = false;
  private consecutiveSpeech = 0;
  private silenceRun = 0;

  constructor(options: VadOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Feed one mulaw frame; returns the current speech decision + edges. */
  process(frame: Buffer): VadFrameResult {
    const energy = mulawEnergy(frame);

    if (this.noiseFloor === null) {
      this.noiseFloor = energy;
    }

    const threshold = Math.max(this.noiseFloor * this.opts.speechMultiplier, this.opts.minSpeechEnergy);
    const isLoud = energy >= threshold;

    // Adapt the noise floor only on genuine silence (below threshold, not
    // speaking) — a loud onset must not raise the floor before speech latches,
    // and a sustained utterance must not drag it up and clip itself.
    if (!this.speaking && !isLoud) {
      const a = this.opts.noiseFloorAlpha;
      this.noiseFloor = a * energy + (1 - a) * this.noiseFloor;
    }

    let speechStart = false;
    let speechEnd = false;

    if (!this.speaking) {
      this.consecutiveSpeech = isLoud ? this.consecutiveSpeech + 1 : 0;
      if (this.consecutiveSpeech >= this.opts.attackFrames) {
        this.speaking = true;
        this.silenceRun = 0;
        speechStart = true;
      }
    } else {
      if (isLoud) {
        this.silenceRun = 0;
      } else {
        this.silenceRun++;
        if (this.silenceRun > this.opts.hangoverFrames) {
          this.speaking = false;
          this.consecutiveSpeech = 0;
          speechEnd = true;
        }
      }
    }

    return {
      speech: this.speaking,
      speechStart,
      speechEnd,
      energy,
      noiseFloor: this.noiseFloor,
      threshold,
    };
  }

  /** Whether the detector currently considers the line to be in speech. */
  isSpeaking(): boolean {
    return this.speaking;
  }

  /** Reset all adaptive state (e.g. on a new call). */
  reset(): void {
    this.noiseFloor = null;
    this.speaking = false;
    this.consecutiveSpeech = 0;
    this.silenceRun = 0;
  }
}
