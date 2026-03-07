'use strict';

const ARABIC_PRONUNCIATION_MAP: Array<[RegExp, string]> = [
  [/تجوال/g, 'تقوال'],
  [/تِجوال/g, 'تِقوال'],
  [/Tejwal/gi, 'Tegwal'],
];

export function applyArabicPronunciationFixes(text: string): string {
  let result = text;
  for (const [pattern, replacement] of ARABIC_PRONUNCIATION_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?؟]+[.!?؟]+[\s]?|[^.!?؟]+$/g);
  if (!raw) return [text];
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function isQuestion(sentence: string): boolean {
  const trimmed = sentence.trim();
  return trimmed.endsWith('?') || trimmed.endsWith('؟');
}

function isExclamation(sentence: string): boolean {
  return sentence.trim().endsWith('!');
}

function isShortResponse(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/);
  return words.length <= 4;
}

function isGreeting(sentence: string): boolean {
  const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|welcome|thank you for calling|thanks for calling|مرحبا|أهلا|السلام عليكم|مساء الخير|صباح الخير|أهلاً وسهلاً|شكراً لاتصالك)/i;
  return greetingPatterns.test(sentence.trim());
}

function isEmpathetic(sentence: string): boolean {
  const empathyPatterns = /\b(understand|sorry|appreciate|concern|difficult|frustrating|worry|help you|here for you|absolutely|of course)\b|أفهم|أقدر|آسف|لا تقلق|بكل سرور|طبعاً|بالتأكيد|أساعدك/i;
  return empathyPatterns.test(sentence);
}

function isImportantInfo(sentence: string): boolean {
  const infoPatterns = /\b(important|please note|keep in mind|remember|make sure|don't forget|be aware|critical|essential)\b|مهم|يرجى ملاحظة|تذكر|تأكد|لا تنسَ|ضروري/i;
  return infoPatterns.test(sentence);
}

function randomVariation(baseMs: number, variancePct: number = 30): number {
  const variance = baseMs * (variancePct / 100);
  return Math.round(baseMs + (Math.random() * 2 - 1) * variance);
}

function getCommaBreak(): string {
  return `<break time="${randomVariation(250)}ms"/>`;
}

function getSentenceBreak(nextSentence?: string): string {
  if (!nextSentence) return '';
  if (isQuestion(nextSentence)) return `<break time="${randomVariation(450)}ms"/>`;
  return `<break time="${randomVariation(380)}ms"/>`;
}

function getEndBreathBreak(sentenceCount: number): string {
  if (sentenceCount > 2) return `<break time="${randomVariation(300)}ms"/>`;
  return '';
}

function processCommas(escapedText: string): string {
  return escapedText
    .replace(/,(\s)/g, `,${getCommaBreak()}$1`)
    .replace(/،(\s)/g, `،${getCommaBreak()}$1`);
}

function processDashes(escapedText: string): string {
  return escapedText.replace(/ – | — | - /g, ` <break time="200ms"/> `);
}

function processEllipsis(escapedText: string): string {
  return escapedText.replace(/\.{3}/g, '<break time="400ms"/>');
}

function randomProsodyShift(baseRate: number, basePitch: number): { rate: string; pitch: string } {
  const rateShift = (Math.random() * 4 - 2);
  const pitchShift = (Math.random() * 2 - 1);
  return {
    rate: `${Math.round(baseRate + rateShift)}%`,
    pitch: `${basePitch + pitchShift >= 0 ? '+' : ''}${(basePitch + pitchShift).toFixed(0)}%`,
  };
}

function wrapSentence(escaped: string, original: string): string {
  if (isGreeting(original)) {
    const { rate, pitch } = randomProsodyShift(92, 3);
    return `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>`;
  }
  if (isQuestion(original)) {
    const { rate, pitch } = randomProsodyShift(90, 2);
    return `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>`;
  }
  if (isExclamation(original)) {
    const { rate, pitch } = randomProsodyShift(94, 2);
    return `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>`;
  }
  if (isEmpathetic(original)) {
    const { rate, pitch } = randomProsodyShift(88, -1);
    return `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>`;
  }
  if (isImportantInfo(original)) {
    const { rate, pitch } = randomProsodyShift(86, 1);
    return `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>`;
  }
  if (isShortResponse(original)) {
    const { rate } = randomProsodyShift(93, 0);
    return `<prosody rate="${rate}">${escaped}</prosody>`;
  }
  const { rate } = randomProsodyShift(90, 0);
  return `<prosody rate="${rate}">${escaped}</prosody>`;
}

export function humanizeToSSML(text: string): string {
  const trimmed = applyArabicPronunciationFixes(text.trim());
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
  return applyArabicPronunciationFixes(text.trim());
}
