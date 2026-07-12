/**
 * ============================================================
 * TTS input sanitization
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
  // Keep Arabic/Latin text, numbers, whitespace, and common punctuation.
  sanitized = sanitized
    // Common emoji blocks + dingbats
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    // Variation selectors + emoji modifiers + ZWJ
    .replace(/[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}]/gu, '')
    // Other control/non-printing chars (keep newline/tab)
    .replace(/[^\P{Cc}\t\n\r]/gu, ' ');

  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  return sanitized.trim();
}
