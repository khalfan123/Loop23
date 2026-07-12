/**
 * ============================================================
 * Sentence splitting for streaming LLM -> TTS chunking
 * ============================================================
 */

/**
 * Split accumulated LLM text into speakable fragments.
 *
 * In eager mode (used for the first fragment of a turn) the split also
 * fires on commas/colons (Latin and Arabic) with a lower minimum length,
 * minimizing time-to-first-audio. Normal mode splits only on sentence
 * terminators. Any trailing remainder is returned as a final fragment.
 */
export function splitSentences(text: string, eager: boolean = false): string[] {
  const sentences: string[] = [];
  const pattern = eager
    ? /[.!?؟]\s|[.!?؟]$|[,،:؛]\s/gm
    : /[.!?؟]\s|[.!?؟]$/gm;
  const minLen = eager ? 3 : 8;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const sentence = text.substring(lastIndex, end).trim();
    if (sentence.length >= minLen) {
      sentences.push(sentence);
      lastIndex = end;
    }
  }
  const remaining = text.substring(lastIndex).trim();
  if (remaining.length > 0) sentences.push(remaining);
  return sentences;
}
