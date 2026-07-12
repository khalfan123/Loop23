import { describe, it, expect } from 'vitest';
import { sanitizeForTTS } from '../../server/voice-core/text/tts-sanitize';

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
});
