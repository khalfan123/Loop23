import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isWhisperHallucination,
  isLikelyBackgroundSpeech,
  isLanguageMismatch,
  normalizeCallerUtterance,
  isDigitOnlyUtterance,
  evaluateInboundTranscriptFilters,
  decideInboundTranscriptGate,
  collectLexicalSuspectSignals,
} from '../../server/voice-core/stt/whisper-filters';
import {
  baselineIsWhisperHallucination,
  baselineIsLanguageMismatch,
  baselineIsLikelyBackgroundSpeech,
} from './fixtures/whisper-filters-baseline';

const PRESERVE_VS_BASELINE_HALLUCINATION = [
  'no',
  'No',
  'لا',
  'لَا',
  'ok',
  'hi',
  'you',
  'AB',
  'Thanks',
  'thank you',
  'bye',
  '1',
  '١٢٣٤',
  '是',
  'إن شاء الله',
  'بسم الله الرحمن الرحيم',
  'خالد',
  'subscribe',
  'the end',
  'thank you for watching my channel help',
] as const;

const BUSINESS_REQUESTS_ONCE_DROPPED_AS_BACKGROUND = [
  'please turn the volume up on the hold music',
  'can you help me change the channel on my TV package',
  'I need help with my child homework school portal login',
  'schedule a test appointment for the driving exam',
] as const;

describe('normalizeCallerUtterance / digits', () => {
  it('strips case, punctuation, and Arabic diacritics', () => {
    expect(normalizeCallerUtterance('  No! ')).toBe('no');
    expect(normalizeCallerUtterance('لَا.')).toBe('لا');
  });

  it('recognizes Western and Arabic-Indic digits', () => {
    expect(isDigitOnlyUtterance('42')).toBe(true);
    expect(isDigitOnlyUtterance('١٢٣٤')).toBe(true);
  });
});

describe('baseline vs current — prior hard rejects must accept', () => {
  for (const text of PRESERVE_VS_BASELINE_HALLUCINATION) {
    it(`baseline rejected ${JSON.stringify(text)}; current preserves`, () => {
      expect(baselineIsWhisperHallucination(text)).toBe(true);
      expect(isWhisperHallucination(text)).toBe(false);
    });
  }
});

describe('isWhisperHallucination — empty / non-speech only', () => {
  it('rejects empty and punctuation/music-only', () => {
    expect(isWhisperHallucination('')).toBe(true);
    expect(isWhisperHallucination('   ')).toBe(true);
    expect(isWhisperHallucination('♪♪')).toBe(true);
    expect(isWhisperHallucination('...')).toBe(true);
    expect(isWhisperHallucination('؟؟')).toBe(true);
    expect(isWhisperHallucination('!!!')).toBe(true);
  });

  it('does not drop watermark-like or subscription speech on text alone', () => {
    expect(isWhisperHallucination('subscribe')).toBe(false);
    expect(isWhisperHallucination('the end')).toBe(false);
    expect(isWhisperHallucination('thank you for watching')).toBe(false);
    expect(isWhisperHallucination('I need to manage my subscription billing')).toBe(false);
  });
});

describe('background / language — no text-only drops', () => {
  for (const text of BUSINESS_REQUESTS_ONCE_DROPPED_AS_BACKGROUND) {
    it(`does not drop business request ${JSON.stringify(text)}`, () => {
      expect(baselineIsLikelyBackgroundSpeech(text, [])).toBe(true);
      expect(isLikelyBackgroundSpeech(text, [])).toBe(false);
    });
  }

  it('only drops background when validated acoustic evidence is supplied', () => {
    expect(isLikelyBackgroundSpeech('volume up', [], false)).toBe(false);
    expect(isLikelyBackgroundSpeech('volume up', [], true)).toBe(true);
  });

  it('never hard-rejects French/Spanish phrases by text alone', () => {
    const fr = 'je suis désolé mais nous ne pouvons pas vous aider aujourd\'hui';
    const es = 'está usted seguro porque necesito ayuda con mi cuenta bancaria';
    expect(baselineIsLanguageMismatch(fr, 'en')).toBe(true);
    expect(baselineIsLanguageMismatch(es, 'en')).toBe(true);
    expect(isLanguageMismatch(fr, 'en')).toBe(false);
    expect(isLanguageMismatch(es, 'en')).toBe(false);
  });

  it('emits non-dropping lexical signals for suspects', () => {
    const signals = collectLexicalSuspectSignals('please turn the volume up');
    expect(signals.some((s) => s.kind === 'background_phrase_suspect')).toBe(true);
    expect(isLikelyBackgroundSpeech('please turn the volume up', [])).toBe(false);
  });
});

describe('decideInboundTranscriptGate — bridge decision helper', () => {
  const baseOpts = {
    expectedLang: 'ar' as const,
    conversationMessages: [] as { role: string; content: string }[],
    isOutbound: false,
    inboundHallucinationCount: 0,
  };

  it('accepts subscription / TV / school business requests with optional signals', () => {
    for (const text of [
      'I want to cancel my subscription please',
      'help me change the channel on my TV package',
      'I need school homework portal support',
      ...BUSINESS_REQUESTS_ONCE_DROPPED_AS_BACKGROUND,
    ]) {
      const gate = decideInboundTranscriptGate(text, baseOpts);
      expect(gate.action, text).toBe('accept');
    }
  });

  it('rejects nonspeech and offers inbound re-prompt policy', () => {
    const gate = decideInboundTranscriptGate('♪♪', baseOpts);
    expect(gate.action).toBe('reject_nonspeech');
    if (gate.action === 'reject_nonspeech') {
      expect(gate.shouldReprompt).toBe(true);
      expect(gate.nextHallucinationCount).toBe(1);
    }
  });

  it('does not re-prompt outbound nonspeech', () => {
    const gate = decideInboundTranscriptGate('...', {
      ...baseOpts,
      isOutbound: true,
    });
    expect(gate.action).toBe('reject_nonspeech');
    if (gate.action === 'reject_nonspeech') {
      expect(gate.shouldReprompt).toBe(false);
    }
  });

  it('evaluateInboundTranscriptFilters stages stay ordered', () => {
    const result = evaluateInboundTranscriptFilters('hello', { expectedLang: 'en' });
    expect(result.accept).toBe(true);
    expect(result.stages.map((s) => s.stage)).toEqual([
      'nonspeech',
      'language_mismatch',
      'background_speech',
    ]);
  });
});
