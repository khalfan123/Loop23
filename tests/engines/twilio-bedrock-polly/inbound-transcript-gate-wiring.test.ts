import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { decideInboundTranscriptGate } from '../../../server/voice-core/stt/whisper-filters';
import { decideSpeakableTtsText } from '../../../server/voice-core/text/tts-sanitize';

const BRIDGE_PATH = resolve(
  __dirname,
  '../../../server/engines/twilio-bedrock-polly/services/audio-bridge.service.ts'
);

describe('BedrockPolly bridge transcript gate wiring', () => {
  const source = readFileSync(BRIDGE_PATH, 'utf8');

  it('processUserTurn consumes decideInboundTranscriptGate (not parallel private filters)', () => {
    expect(source).toContain('decideInboundTranscriptGate(transcription');
    expect(source).not.toContain('this.isWhisperHallucination(transcription)');
    expect(source).not.toContain('this.isLanguageMismatch(transcription');
    expect(source).not.toContain('this.isLikelyBackgroundSpeech(transcription');
  });

  it('skipped TTS logs reason only — no raw text payload', () => {
    expect(source).toContain('Skipping synthesis for ${callSid} (reason=${speakable.reason})');
    expect(source).not.toMatch(/Skipping synthesis for \$\{callSid\}.*String\(text\)/);
    expect(source).not.toMatch(/Skipping synthesis for \$\{callSid\}.*substring/);
  });

  it('runtime gate accepts subscription/TV/school requests the bridge will see post-STT', () => {
    // Same helper import path the bridge uses after transcription returns.
    for (const text of [
      'I want to cancel my subscription please',
      'can you help me change the channel on my TV package',
      'I need help with school homework portal login',
      'thank you for watching — actually I meant thank you for your help',
    ]) {
      const gate = decideInboundTranscriptGate(text, {
        expectedLang: 'en',
        isOutbound: false,
        inboundHallucinationCount: 0,
        backgroundNoiseRejection: true,
        validatedBackgroundAcousticEvidence: false,
      });
      expect(gate.action, text).toBe('accept');
    }
  });

  it('runtime gate re-prompt path for nonspeech matches bridge policy inputs', () => {
    const gate = decideInboundTranscriptGate('...', {
      expectedLang: 'en',
      isOutbound: false,
      inboundHallucinationCount: 0,
    });
    expect(gate.action).toBe('reject_nonspeech');
    if (gate.action === 'reject_nonspeech') {
      expect(gate.shouldReprompt).toBe(true);
    }
  });

  it('bridge TTS speakable helper allows short multilingual replies', () => {
    for (const text of ['No', 'OK', 'لا', 'Да', 'हाँ', 'Ω']) {
      expect(decideSpeakableTtsText(text).shouldSpeak, text).toBe(true);
    }
    expect(decideSpeakableTtsText('؟').shouldSpeak).toBe(false);
    expect(decideSpeakableTtsText('́́').shouldSpeak).toBe(false);
  });
});
