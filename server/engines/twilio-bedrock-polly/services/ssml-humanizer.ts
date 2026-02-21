'use strict';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g);
  if (!raw) return [text];
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function isQuestion(sentence: string): boolean {
  return sentence.trim().endsWith('?');
}

function isExclamation(sentence: string): boolean {
  return sentence.trim().endsWith('!');
}

function isShortResponse(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/);
  return words.length <= 4;
}

function isGreeting(sentence: string): boolean {
  const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|welcome|thank you for calling|thanks for calling)/i;
  return greetingPatterns.test(sentence.trim());
}

function isEmpathetic(sentence: string): boolean {
  const empathyPatterns = /\b(understand|sorry|appreciate|concern|difficult|frustrating|worry|help you|here for you|absolutely|of course)\b/i;
  return empathyPatterns.test(sentence);
}

function isImportantInfo(sentence: string): boolean {
  const infoPatterns = /\b(important|please note|keep in mind|remember|make sure|don't forget|be aware|critical|essential)\b/i;
  return infoPatterns.test(sentence);
}

function getCommaBreak(): string {
  return '<break time="180ms"/>';
}

function getSentenceBreak(nextSentence?: string): string {
  if (!nextSentence) return '';
  if (isQuestion(nextSentence)) return '<break time="350ms"/>';
  return '<break time="280ms"/>';
}

function getEndBreathBreak(sentenceCount: number): string {
  if (sentenceCount > 2) return '<break time="200ms"/>';
  return '';
}

function processCommas(escapedText: string): string {
  return escapedText.replace(/,(\s)/g, `,${getCommaBreak()}$1`);
}

function processDashes(escapedText: string): string {
  return escapedText.replace(/ – | — | - /g, ` <break time="200ms"/> `);
}

function processEllipsis(escapedText: string): string {
  return escapedText.replace(/\.{3}/g, '<break time="400ms"/>');
}

function wrapSentence(escaped: string, original: string): string {
  if (isGreeting(original)) {
    return `<prosody rate="96%" pitch="+3%">${escaped}</prosody>`;
  }
  if (isQuestion(original)) {
    return `<prosody rate="94%" pitch="+2%">${escaped}</prosody>`;
  }
  if (isExclamation(original)) {
    return `<prosody rate="98%" pitch="+2%">${escaped}</prosody>`;
  }
  if (isEmpathetic(original)) {
    return `<prosody rate="92%" pitch="-1%">${escaped}</prosody>`;
  }
  if (isImportantInfo(original)) {
    return `<prosody rate="90%" pitch="+1%">${escaped}</prosody>`;
  }
  if (isShortResponse(original)) {
    return `<prosody rate="97%">${escaped}</prosody>`;
  }
  return `<prosody rate="95%">${escaped}</prosody>`;
}

export function humanizeToSSML(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '<speak></speak>';

  const sentences = splitIntoSentences(trimmed);

  if (sentences.length === 1) {
    let escaped = escapeXml(sentences[0]);
    escaped = processCommas(escaped);
    escaped = processDashes(escaped);
    escaped = processEllipsis(escaped);
    const wrapped = wrapSentence(escaped, sentences[0]);
    return `<speak>${wrapped}</speak>`;
  }

  const parts: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    let escaped = escapeXml(sentence);
    escaped = processCommas(escaped);
    escaped = processDashes(escaped);
    escaped = processEllipsis(escaped);
    const wrapped = wrapSentence(escaped, sentence);
    parts.push(wrapped);

    if (i < sentences.length - 1) {
      parts.push(getSentenceBreak(sentences[i + 1]));
    }
  }

  const breathBreak = getEndBreathBreak(sentences.length);

  return `<speak>${parts.join('')}${breathBreak}</speak>`;
}

export function humanizeToSSMLPlainFallback(text: string): string {
  return text.trim();
}
