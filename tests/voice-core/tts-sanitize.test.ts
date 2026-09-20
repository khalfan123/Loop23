import { describe, it, expect } from 'vitest';
import { sanitizeForTTS, decideSpeakableTtsText } from '../../server/voice-core/text/tts-sanitize';

/** Mirrors the pre-fix bridge gate: trim then length < 3 (before/after sanitize). */
function legacyBridgeWouldSkipSynthesis(text: string): boolean {
  let trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return true;
  trimmed = sanitizeForTTS(trimmed);
  if (!trimmed || trimmed.length < 3) return true;
  return false;
}

describe('sanitizeForTTS', () => {
  it('strips TOOL_CALL blocks with JSON payloads', () => {
    expect(sanitizeForTTS('Sure. [TOOL_CALL] {"reason":"lookup"} One moment.')).toBe(
      'Sure. One moment.'
    );
  });

  it('leaves a stray brace on nested TOOL_CALL JSON (legacy non-greedy match, pinned)', () => {
    expect(sanitizeForTTS('Sure. [TOOL_CALL] {"name":"kb","params":{"q":"hours"}} One moment.')).toBe(
      'Sure. } One moment.'
    );
  });

  it('strips bare TOOL_CALL markers', () => {
    expect(sanitizeForTTS('Okay [TOOL_CALL] done')).toBe('Okay done');
  });

  it('strips tool result echoes', () => {
    expect(sanitizeForTTS('Tool "kb" returned: {"answer":"9am"} We open at 9.')).toBe('We open at 9.');
  });

  it('strips undefined tool echoes to end of text', () => {
    expect(sanitizeForTTS('Hold on. Tool "undefined" returned: garbage here')).toBe('Hold on.');
  });

  it('strips error JSON fragments', () => {
    expect(sanitizeForTTS('Sorry. {"error":"timeout"} Let me retry.')).toBe('Sorry. Let me retry.');
  });

  it('collapses repeated whitespace', () => {
    expect(sanitizeForTTS('Too   many    spaces')).toBe('Too many spaces');
  });

  it('passes clean text through unchanged', () => {
    expect(sanitizeForTTS('We open at nine in the morning.')).toBe('We open at nine in the morning.');
  });

  it('preserves short multilingual replies through sanitization', () => {
    expect(sanitizeForTTS('No')).toBe('No');
    expect(sanitizeForTTS('OK')).toBe('OK');
    expect(sanitizeForTTS('لا')).toBe('لا');
    expect(sanitizeForTTS('Да')).toBe('Да');
    expect(sanitizeForTTS('हाँ')).toBe('हाँ');
    expect(sanitizeForTTS('Ω')).toBe('Ω');
  });
});

describe('decideSpeakableTtsText — Unicode Letter/Number (any script)', () => {
  it('baseline length gate dropped No/OK/لا; current speaks them', () => {
    for (const text of ['No', 'OK', 'لا', 'Hi']) {
      expect(legacyBridgeWouldSkipSynthesis(text), `legacy skip ${text}`).toBe(true);
      const decision = decideSpeakableTtsText(text);
      expect(decision.shouldSpeak, text).toBe(true);
      expect(decision.reason, text).toBe('ok');
    }
  });

  it('speaks Cyrillic, Devanagari, and Greek letters', () => {
    for (const text of ['Да', 'हाँ', 'Ω', 'Ναι', 'नमस्ते']) {
      const decision = decideSpeakableTtsText(text);
      expect(decision.shouldSpeak, text).toBe(true);
      expect(decision.speakableText, text).toBe(text);
    }
  });

  it('rejects punctuation-only and combining-marks-only (including Arabic ؟)', () => {
    expect(decideSpeakableTtsText('')).toMatchObject({ shouldSpeak: false, reason: 'empty' });
    expect(decideSpeakableTtsText('...')).toMatchObject({
      shouldSpeak: false,
      reason: 'no_speakable_content',
    });
    expect(decideSpeakableTtsText('؟')).toMatchObject({
      shouldSpeak: false,
      reason: 'no_speakable_content',
    });
    expect(decideSpeakableTtsText('!!!')).toMatchObject({
      shouldSpeak: false,
      reason: 'no_speakable_content',
    });
    // Combining acute accents only — not Letter/Number.
    expect(decideSpeakableTtsText('\u0301\u0301')).toMatchObject({
      shouldSpeak: false,
      reason: 'no_speakable_content',
    });
  });

  it('keeps sanitization before speaking (tool artifacts stripped)', () => {
    const decision = decideSpeakableTtsText('OK [TOOL_CALL] {"x":1}');
    expect(decision.shouldSpeak).toBe(true);
    expect(decision.speakableText).toBe('OK');
  });
});
