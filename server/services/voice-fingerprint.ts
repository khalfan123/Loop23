'use strict';

interface VoiceProfile {
  zeroCrossingRate: number;
  energyMean: number;
  energyVariance: number;
  spectralCentroid: number;
  speakingRate: number;
}

const speakerProfiles: Map<string, VoiceProfile> = new Map();

const MULAW_DECODE_TABLE: Int16Array = (() => {
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

const SIMILARITY_THRESHOLD = 0.5;

function decodeMulaw(buffer: Buffer): Int16Array {
  const samples = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    samples[i] = MULAW_DECODE_TABLE[buffer[i]];
  }
  return samples;
}

function extractFeatures(audioBuffer: Buffer): VoiceProfile {
  const samples = decodeMulaw(audioBuffer);
  const len = samples.length;

  let zeroCrossings = 0;
  for (let i = 1; i < len; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = zeroCrossings / len;

  let sumEnergy = 0;
  const chunkSize = 160;
  const chunkCount = Math.floor(len / chunkSize);
  const chunkEnergies: number[] = [];
  for (let c = 0; c < chunkCount; c++) {
    let chunkSum = 0;
    const offset = c * chunkSize;
    for (let i = 0; i < chunkSize; i++) {
      const s = samples[offset + i];
      chunkSum += s * s;
    }
    const chunkEnergy = Math.sqrt(chunkSum / chunkSize);
    chunkEnergies.push(chunkEnergy);
    sumEnergy += chunkEnergy;
  }
  const energyMean = chunkCount > 0 ? sumEnergy / chunkCount : 0;

  let varianceSum = 0;
  for (const ce of chunkEnergies) {
    const diff = ce - energyMean;
    varianceSum += diff * diff;
  }
  const energyVariance = chunkCount > 0 ? varianceSum / chunkCount : 0;

  let weightedFreqSum = 0;
  let magnitudeSum = 0;
  const frameSize = 256;
  const frameCount = Math.floor(len / frameSize);
  for (let f = 0; f < frameCount; f++) {
    const offset = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const mag = Math.abs(samples[offset + i]);
      const freq = i / frameSize;
      weightedFreqSum += freq * mag;
      magnitudeSum += mag;
    }
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedFreqSum / magnitudeSum : 0;

  let peakCount = 0;
  const peakThreshold = energyMean * 0.8;
  let wasBelowThreshold = true;
  for (const ce of chunkEnergies) {
    if (ce > peakThreshold && wasBelowThreshold) {
      peakCount++;
      wasBelowThreshold = false;
    } else if (ce <= peakThreshold) {
      wasBelowThreshold = true;
    }
  }
  const durationSec = len / 8000;
  const speakingRate = durationSec > 0 ? peakCount / durationSec : 0;

  return {
    zeroCrossingRate,
    energyMean,
    energyVariance,
    spectralCentroid,
    speakingRate,
  };
}

function calculateSimilarity(a: VoiceProfile, b: VoiceProfile): number {
  const features: (keyof VoiceProfile)[] = [
    'zeroCrossingRate',
    'energyMean',
    'energyVariance',
    'spectralCentroid',
    'speakingRate',
  ];

  const weights = [0.3, 0.2, 0.15, 0.25, 0.1];

  let totalScore = 0;

  for (let i = 0; i < features.length; i++) {
    const valA = a[features[i]];
    const valB = b[features[i]];
    const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 1e-6);
    const diff = Math.abs(valA - valB) / maxVal;
    const featureScore = Math.max(0, 1 - diff);
    totalScore += featureScore * weights[i];
  }

  return totalScore;
}

export function enrollSpeaker(callSid: string, audioBuffer: Buffer): void {
  const profile = extractFeatures(audioBuffer);
  speakerProfiles.set(callSid, profile);
  console.log(
    `[VoiceFingerprint] Enrolled speaker for ${callSid}: ` +
    `zcr=${profile.zeroCrossingRate.toFixed(4)}, ` +
    `energyMean=${Math.round(profile.energyMean)}, ` +
    `energyVar=${Math.round(profile.energyVariance)}, ` +
    `spectral=${profile.spectralCentroid.toFixed(4)}, ` +
    `rate=${profile.speakingRate.toFixed(2)}`
  );
}

export function matchesSpeaker(callSid: string, audioBuffer: Buffer, threshold?: number): boolean {
  const enrolledProfile = speakerProfiles.get(callSid);
  if (!enrolledProfile) {
    return true;
  }

  const currentProfile = extractFeatures(audioBuffer);
  const similarity = calculateSimilarity(enrolledProfile, currentProfile);
  const effectiveThreshold = threshold ?? SIMILARITY_THRESHOLD;
  const matches = similarity >= effectiveThreshold;

  if (!matches) {
    console.log(
      `[VoiceFingerprint] Speaker mismatch for ${callSid}: ` +
      `similarity=${similarity.toFixed(3)} < threshold=${effectiveThreshold}`
    );
  }

  return matches;
}

export function isEnrolled(callSid: string): boolean {
  return speakerProfiles.has(callSid);
}

export function clearSpeaker(callSid: string): void {
  if (speakerProfiles.delete(callSid)) {
    console.log(`[VoiceFingerprint] Cleared speaker profile for ${callSid}`);
  }
}
