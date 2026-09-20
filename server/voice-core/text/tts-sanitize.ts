/**
 * ============================================================
 * TTS input sanitization + speakable-text gate
 *
 * sanitizeForTTS preserves speakable text while stripping tool/JSON
 * artifacts and non-speakable controls. The synthesis gate must not
 * drop legitimate short replies (No / OK / لا / Да / हाँ) by length
 * or by a narrow script allowlist.
 * ============================================================
 */

/**
 * Strip tool-call artifacts, stray JSON fragments, and non-speakable
 * characters from LLM output before it is sent to a TTS provider,
 * collapsing extra whitespace.
 */
export function sanitizeForTTS(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(/\[TOOL_CALL\]\s*\{[\s\S]*?\}/g, '');
  sanitized = sanitized.replace(/\[TOOL_CALL\]/g, '');
  sanitized = sanitized.replace(/\{"name"\s*:\s*"[^"]*"\s*,\s*"params"\s*:\s*\{[\s\S]*?\}\s*\}/g, '');
  sanitized = sanitized.replace(/Tool\s+"[^"]*"\s+returned:\s*\{[\s\S]*?\}/g, '');
  sanitized = sanitized.replace(/Tool\s+"undefined"\s+returned:[\s\S]*/g, '');
  sanitized = sanitized.replace(/\{\s*"error"\s*:\s*"[^"]*"\s*\}/g, '');

  // Strip emojis / pictographs / variation selectors that can break Polly SSML/TTS.
  // Keep letters/numbers from any script; punctuation may remain until speakable check.
  // RegExp ctor avoids low-target unicode-flag diagnostics on some tsc configs.
  const emojiBlock = new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]', 'gu');
  const emojiMods = new RegExp('[\\u{FE00}-\\u{FE0F}\\u{1F3FB}-\\u{1F3FF}\\u{200D}]', 'gu');
  const controls = new RegExp('[^\\P{Cc}\\t\\n\\r]', 'gu');
  sanitized = sanitized.replace(emojiBlock, '').replace(emojiMods, '').replace(controls, ' ');

  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  return sanitized.trim();
}

export type TtsSpeakableDecision = {
  shouldSpeak: boolean;
  /** Sanitized text to send to TTS when shouldSpeak is true; otherwise ''. */
  speakableText: string;
  reason: 'ok' | 'empty' | 'no_speakable_content';
};

/** Unicode Letter or Number — constructed at runtime for Node; avoids literal /u TS1501. */
const UNICODE_LETTER_OR_NUMBER = new RegExp('[\\p{L}\\p{N}]', 'u');

/**
 * Decide whether assistant text should be synthesized after sanitization.
 * Requires at least one Unicode Letter or Number (any script). Punctuation
 * and combining marks alone are not speakable content.
 */
export function decideSpeakableTtsText(text: string): TtsSpeakableDecision {
  const sanitized = sanitizeForTTS(text ?? '');
  if (!sanitized) {
    return { shouldSpeak: false, speakableText: '', reason: 'empty' };
  }
  if (!UNICODE_LETTER_OR_NUMBER.test(sanitized)) {
    return { shouldSpeak: false, speakableText: '', reason: 'no_speakable_content' };
  }
  return { shouldSpeak: true, speakableText: sanitized, reason: 'ok' };
}
