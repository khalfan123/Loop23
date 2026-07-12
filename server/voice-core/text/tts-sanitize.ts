/**
 * ============================================================
 * TTS input sanitization
 * ============================================================
 */

/**
 * Strip tool-call artifacts and stray JSON fragments from LLM output
 * before it is sent to a TTS provider, collapsing extra whitespace.
 */
export function sanitizeForTTS(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(/\[TOOL_CALL\]\s*\{[\s\S]*?\}/g, '');
  sanitized = sanitized.replace(/\[TOOL_CALL\]/g, '');
  sanitized = sanitized.replace(/\{"name"\s*:\s*"[^"]*"\s*,\s*"params"\s*:\s*\{[\s\S]*?\}\s*\}/g, '');
  sanitized = sanitized.replace(/Tool\s+"[^"]*"\s+returned:\s*\{[\s\S]*?\}/g, '');
  sanitized = sanitized.replace(/Tool\s+"undefined"\s+returned:[\s\S]*/g, '');
  sanitized = sanitized.replace(/\{\s*"error"\s*:\s*"[^"]*"\s*\}/g, '');
  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  return sanitized.trim();
}
