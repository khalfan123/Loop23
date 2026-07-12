import { describe, it, expect } from 'vitest';
import { splitSentences } from '../../server/voice-core/text/sentence-split';

describe('splitSentences', () => {
  it('splits on sentence terminators in normal mode', () => {
    expect(splitSentences('Hello there. How are you today? I am fine!')).toEqual([
      'Hello there.',
      'How are you today?',
      'I am fine!',
    ]);
  });

  it('does not split on commas in normal mode', () => {
    expect(splitSentences('Hmm, let me check that for you.')).toEqual([
      'Hmm, let me check that for you.',
    ]);
  });

  it('splits eagerly on commas for time-to-first-audio', () => {
    expect(splitSentences('Hmm, let me check that for you.', true)).toEqual([
      'Hmm,',
      'let me check that for you.',
    ]);
  });

  it('enforces the minimum fragment length (8 normal, 3 eager)', () => {
    // "a." is only 2 chars — folded into the remainder in normal mode
    expect(splitSentences('a. bcdefgh.')).toEqual(['a. bcdefgh.']);
    expect(splitSentences('ab, cd', true)).toEqual(['ab,', 'cd']);
  });

  it('handles Arabic terminators and separators', () => {
    expect(splitSentences('مرحبا، كيف حالك؟ أنا بخير.', true)).toEqual([
      'مرحبا،',
      'كيف حالك؟',
      'أنا بخير.',
    ]);
  });

  it('returns the trailing remainder without a terminator', () => {
    expect(splitSentences('No terminator at all just words')).toEqual([
      'No terminator at all just words',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
  });
});
