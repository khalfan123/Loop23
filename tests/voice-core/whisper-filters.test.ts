import { describe, it, expect } from 'vitest';
import {
  isWhisperHallucination,
  isLikelyBackgroundSpeech,
  isLanguageMismatch,
} from '../../server/voice-core/stt/whisper-filters';

describe('isWhisperHallucination', () => {
  it('rejects very short transcripts', () => {
    expect(isWhisperHallucination('ab')).toBe(true);
    expect(isWhisperHallucination('  a ')).toBe(true);
  });

  it('rejects exact-list hallucinations (English and Arabic)', () => {
    expect(isWhisperHallucination('thank you for watching')).toBe(true);
    expect(isWhisperHallucination('Thanks')).toBe(true);
    expect(isWhisperHallucination('شكراً على المشاهدة')).toBe(true);
  });

  it('rejects contains-list hallucinations embedded in text', () => {
    expect(isWhisperHallucination('and remember to like and subscribe folks')).toBe(true);
    expect(isWhisperHallucination('subtitles by the community')).toBe(true);
  });

  it('rejects symbol-only and ellipsis-only output', () => {
    expect(isWhisperHallucination('♪♪ ..')).toBe(true);
    expect(isWhisperHallucination('.....')).toBe(true);
  });

  it('rejects exact phrase repetition', () => {
    expect(isWhisperHallucination('thank you thank you thank you thank you')).toBe(true);
    expect(isWhisperHallucination('okay sure okay sure okay sure okay sure')).toBe(true);
  });

  it('accepts valid short Arabic openers', () => {
    expect(isWhisperHallucination('ألو')).toBe(false);
    expect(isWhisperHallucination('مرحبا')).toBe(false);
  });

  it('rejects short religious-phrase noise on Arabic calls', () => {
    expect(isWhisperHallucination('سبحان الله وبحمده')).toBe(true);
  });

  it('accepts substantive Arabic requests', () => {
    expect(isWhisperHallucination('أريد مساعدة في حسابي من فضلك اليوم')).toBe(false);
  });

  it('accepts normal English utterances', () => {
    expect(isWhisperHallucination('I would like to check my order status please')).toBe(false);
    expect(isWhisperHallucination('Can you tell me your opening hours?')).toBe(false);
  });
});

describe('isLikelyBackgroundSpeech', () => {
  it('flags known household/TV phrases', () => {
    expect(isLikelyBackgroundSpeech('pass me the salt', [])).toBe(true);
    expect(isLikelyBackgroundSpeech('hey siri set a timer', [])).toBe(true);
    expect(isLikelyBackgroundSpeech('الأكل جاهز', [])).toBe(true);
  });

  it('flags off-topic pattern matches with no conversation overlap', () => {
    expect(isLikelyBackgroundSpeech('add two cups of flour to the oven dish', [
      { role: 'user', content: 'I need help with my invoice' },
    ])).toBe(true);
  });

  it('allows topic matches that overlap the conversation context', () => {
    const ctx = [
      { role: 'user', content: 'I want to order chicken recipe ingredient boxes' },
      { role: 'assistant', content: 'Sure, which recipe ingredient plan?' },
    ];
    expect(isLikelyBackgroundSpeech('the recipe ingredient plan please', ctx)).toBe(false);
  });

  it('passes normal on-topic speech', () => {
    expect(isLikelyBackgroundSpeech('I want to upgrade my subscription', [])).toBe(false);
  });
});

describe('isLanguageMismatch', () => {
  it('ignores very short transcripts', () => {
    expect(isLanguageMismatch('hi', 'ar')).toBe(false);
  });

  it('flags Latin-only text on an Arabic call', () => {
    expect(isLanguageMismatch('hello can you hear me', 'ar')).toBe(true);
  });

  it('accepts Arabic text on an Arabic call', () => {
    expect(isLanguageMismatch('أريد مساعدة في الفاتورة', 'ar')).toBe(false);
  });

  it('flags Arabic-dominant text on an English call', () => {
    expect(isLanguageMismatch('أريد مساعدة في الفاتورة من فضلك', 'en')).toBe(true);
  });

  it('flags CJK text on an English call', () => {
    expect(isLanguageMismatch('こんにちは元気ですかお元気で', 'en')).toBe(true);
  });

  it('flags French/Spanish patterns on an English call', () => {
    expect(isLanguageMismatch('je suis désolé mais nous ne pouvons pas', 'en')).toBe(true);
    expect(isLanguageMismatch('está usted seguro porque necesito ayuda', 'en')).toBe(true);
  });

  it('accepts English on an English call', () => {
    expect(isLanguageMismatch('I need help with my bill today', 'en')).toBe(false);
  });

  it('does not flag unrelated expected languages', () => {
    expect(isLanguageMismatch('hello can you hear me', 'es')).toBe(false);
  });
});
