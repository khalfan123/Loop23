/**
 * ============================================================
 * Inbound transcript gates + lexical *signals* (not drop rules)
 *
 * Drop only defensible empty / non-speech transcripts. Text alone
 * cannot prove YouTube watermarks, TV/background origin, homework
 * chatter, or wrong-language speech — those become non-dropping
 * signals for observability. Prefer validated Whisper confidence
 * (no_speech_prob / avg_logprob) and acoustic checks upstream; do
 * not invent acoustic evidence here.
 *
 * Bridge consumes decideInboundTranscriptGate() for the runtime path.
 * ============================================================
 */

/** Arabic combining marks commonly present in vocalized transcripts. */
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/** Western + Arabic-Indic + Eastern Arabic-Indic digits. */
const DIGIT_CHARS = /[0-9\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * Normalize a caller transcript for signal matching:
 * trim, lowercase, strip Arabic diacritics, strip surrounding punctuation.
 */
export function normalizeCallerUtterance(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/^[¿?؟!.,،؛:!"'“”‘’\-—–…\s]+/, '')
    .replace(/[¿?؟!.,،؛:!"'“”‘’\-—–…\s]+$/, '')
    .trim();
}

/** True when the string is only digits (any common Arabic digit shapes). */
export function isDigitOnlyUtterance(text: string): boolean {
  const normalized = normalizeCallerUtterance(text);
  if (!normalized) return false;
  const digits = normalized.match(DIGIT_CHARS);
  if (!digits || digits.length === 0) return false;
  return digits.join('') === normalized.replace(/\s+/g, '') && digits.length <= 16;
}

/**
 * Lexical watermark *suspects* — logged as signals only.
 * Never used to drop a turn: callers request subscriptions, endings, etc.
 */
export const LEXICAL_WATERMARK_SUSPECT_PHRASES: string[] = [
  'شكراً على المشاهدة',
  'وشكراً على المشاهدة',
  'شكرا على المشاهدة',
  'شكرا للمشاهدة',
  'اشتركوا في القناة',
  'اشترك في القناة',
  'لا تنسوا الاشتراك',
  'subscribe',
  'thank you for watching',
  'thanks for watching',
  'like and subscribe',
  'please subscribe',
  "don't forget to subscribe",
  'hit the bell',
  'subtitles by',
  'amara.org',
  'www.mooji.org',
  'the end',
  'مشاهدة ممتعة',
  'تابعونا على',
  'قناتنا على',
  'ترجمة الأخ',
  'ترجمة فريق',
  'لا تنسى الإعجاب',
  'اضغط لايك',
  'فعل الجرس',
  'رابط القناة',
];

/**
 * Household/TV *suspect* phrases — signals only.
 * Callers legitimately ask for volume, channel, homework/school help.
 */
export const LEXICAL_BACKGROUND_SUSPECT_PHRASES: string[] = [
  'pass me the salt',
  'pass the salt',
  'what do you want to eat',
  'what should we eat',
  "what's for dinner",
  "what's for lunch",
  "let's order food",
  'change the channel',
  "what's on tv",
  'volume up',
  'volume down',
  'stay tuned',
  'breaking news',
  'back after the break',
  'brought to you by',
  'sponsored by',
  'and now a word from',
  'tonight on',
  'next on',
  'previously on',
  'the following program',
  'viewer discretion',
  'brush your teeth',
  'do your homework',
  'clean your room',
  'dinner is ready',
  'food is ready',
  'lunch is ready',
  'time for bed',
  'bad dog',
  'here kitty',
  'who scored',
  "what's the score",
  'touchdown',
  'home run',
  'what a play',
  'pass the remote',
  "where's the remote",
  "someone's at the door",
  'answer the door',
  'hey google',
  'ok google',
  'hey siri',
  'alexa',
  'ناولني الملح',
  'وش نأكل',
  'شو بدك تاكل',
  'غير القناة',
  'ارفع الصوت',
  'وطي الصوت',
  'اسكت',
  'روح نام',
  'الأكل جاهز',
  'العشاء جاهز',
  'الغداء جاهز',
  'مين سجل',
  'كم النتيجة',
  'مين على الباب',
];

export const LEXICAL_TOPIC_SUSPECT_PATTERNS: RegExp[] = [
  /\b(?:recipe|ingredient|tablespoon|teaspoon|cups? of|oven|stir|chop|dice|bake|fry|boil)\b/i,
  /\b(?:episode|season \d|series|movie|film|actor|actress|character|plot|scene)\b/i,
  /\b(?:homework|math|science|teacher|school|class|exam|test|grade)\b/i,
  /\b(?:walk the dog|feed the cat|pet food|veterinar|litter box)\b/i,
  /\b(?:laundry|dishes|vacuum|mop|sweep|trash|garbage|recycl)\b/i,
  /\b(?:weather forecast|traffic update|sports update|headline)\b/i,
  /\b(?:commercial|advertisement|promo|trailer)\b/i,
];

/** @deprecated Keep export name for older imports; lists are signal-only now. */
export const WHISPER_HALLUCINATION_EXACT = LEXICAL_WATERMARK_SUSPECT_PHRASES;
/** @deprecated Signal-only; do not use to drop turns. */
export const WHISPER_HALLUCINATION_CONTAINS = LEXICAL_WATERMARK_SUSPECT_PHRASES;
/** @deprecated Signal-only. */
export const BACKGROUND_NOISE_PHRASES = LEXICAL_BACKGROUND_SUSPECT_PHRASES;
/** @deprecated Signal-only. */
export const BACKGROUND_TOPIC_PATTERNS = LEXICAL_TOPIC_SUSPECT_PATTERNS;

export type LexicalSuspectKind =
  | 'watermark_suspect'
  | 'background_phrase_suspect'
  | 'topic_pattern_suspect';

export interface LexicalSuspectSignal {
  kind: LexicalSuspectKind;
  /** Stable phrase/pattern id — never the full caller transcript. */
  matchedId: string;
}

/**
 * Collect non-dropping lexical suspects for observability.
 * Does not assert TV/background/watermark origin.
 */
export function collectLexicalSuspectSignals(text: string): LexicalSuspectSignal[] {
  const normalized = normalizeCallerUtterance(text);
  if (!normalized) return [];

  const signals: LexicalSuspectSignal[] = [];
  const lower = text.trim().toLowerCase();

  for (const phrase of LEXICAL_WATERMARK_SUSPECT_PHRASES) {
    const needle = normalizeCallerUtterance(phrase);
    if (!needle) continue;
    if (normalized === needle || normalized.includes(needle)) {
      signals.push({ kind: 'watermark_suspect', matchedId: needle.slice(0, 48) });
    }
  }

  for (const phrase of LEXICAL_BACKGROUND_SUSPECT_PHRASES) {
    const p = phrase.toLowerCase();
    if (lower === p || lower.includes(p)) {
      signals.push({ kind: 'background_phrase_suspect', matchedId: p.slice(0, 48) });
    }
  }

  for (const pattern of LEXICAL_TOPIC_SUSPECT_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ kind: 'topic_pattern_suspect', matchedId: pattern.source.slice(0, 48) });
    }
  }

  return signals;
}

/**
 * True only for empty / non-speech transcripts (music marks, ellipsis,
 * punctuation-only). Never rejects lexical watermark suspects or speech.
 */
export function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Non-speech: music/emoji/punctuation-only or ellipsis-only.
  if (/^[♪♫🎵🎶\s.,!?…¿?؟،؛:!"'“”‘’\-—–]+$/.test(trimmed)) return true;
  if (/^\.{2,}$/.test(trimmed)) return true;

  const normalized = normalizeCallerUtterance(trimmed);
  // Combining marks / punctuation only after normalization — still non-speech.
  if (!normalized) return true;

  return false;
}

/**
 * Background drop gate — disabled for text-only heuristics.
 * Lexical suspects are signals via collectLexicalSuspectSignals.
 * Returns true only when validatedAcousticEvidence is explicitly true
 * (callers must supply real acoustic/provider evidence; never invent it).
 */
export function isLikelyBackgroundSpeech(
  _text: string,
  _conversationMessages: { role: string; content: string }[],
  validatedAcousticEvidence?: boolean
): boolean {
  return validatedAcousticEvidence === true;
}

/**
 * Language-mismatch drop gate — disabled for phrase/script heuristics.
 * Gulf Arabic↔English code-switch and other scripts must not be dropped
 * on text alone. Always returns false.
 */
export function isLanguageMismatch(_text: string, _expectedLang: string): boolean {
  return false;
}

export type InboundTranscriptFilterStage =
  | 'nonspeech'
  | 'language_mismatch'
  | 'background_speech';

export interface InboundTranscriptFilterResult {
  accept: boolean;
  rejectedBy: InboundTranscriptFilterStage | null;
  stages: Array<{ stage: InboundTranscriptFilterStage; rejected: boolean }>;
  signals: LexicalSuspectSignal[];
}

/**
 * Sequential gate used by BedrockPollyAudioBridge.processUserTurn.
 * Order: nonspeech → language → background. Only nonspeech may drop
 * without validated acoustic evidence.
 */
export function evaluateInboundTranscriptFilters(
  text: string,
  options: {
    expectedLang: string;
    conversationMessages?: { role: string; content: string }[];
    backgroundNoiseRejection?: boolean;
    /** Must be real acoustic/provider evidence — never invent. */
    validatedBackgroundAcousticEvidence?: boolean;
  }
): InboundTranscriptFilterResult {
  const conversationMessages = options.conversationMessages ?? [];
  const backgroundNoiseRejection = options.backgroundNoiseRejection !== false;
  const signals = collectLexicalSuspectSignals(text);
  const stages: InboundTranscriptFilterResult['stages'] = [];

  const nonspeech = isWhisperHallucination(text);
  stages.push({ stage: 'nonspeech', rejected: nonspeech });
  if (nonspeech) {
    return { accept: false, rejectedBy: 'nonspeech', stages, signals };
  }

  const lang = isLanguageMismatch(text, options.expectedLang);
  stages.push({ stage: 'language_mismatch', rejected: lang });
  if (lang) {
    return { accept: false, rejectedBy: 'language_mismatch', stages, signals };
  }

  const background =
    backgroundNoiseRejection &&
    isLikelyBackgroundSpeech(
      text,
      conversationMessages,
      options.validatedBackgroundAcousticEvidence
    );
  stages.push({ stage: 'background_speech', rejected: background });
  if (background) {
    return { accept: false, rejectedBy: 'background_speech', stages, signals };
  }

  return { accept: true, rejectedBy: null, stages, signals };
}

export type InboundTranscriptGateDecision =
  | {
      action: 'accept';
      signals: LexicalSuspectSignal[];
      stages: InboundTranscriptFilterResult['stages'];
    }
  | {
      action: 'reject_nonspeech';
      signals: LexicalSuspectSignal[];
      stages: InboundTranscriptFilterResult['stages'];
      /** Inbound-only: re-prompt when count stays within limit. */
      shouldReprompt: boolean;
      nextHallucinationCount: number;
    }
  | {
      action: 'reject_silent';
      rejectedBy: Exclude<InboundTranscriptFilterStage, 'nonspeech'>;
      signals: LexicalSuspectSignal[];
      stages: InboundTranscriptFilterResult['stages'];
    };

/**
 * Bridge-facing decision helper: filter stages + inbound re-prompt policy.
 * This is the function BedrockPollyAudioBridge must call (not a parallel copy).
 */
export function decideInboundTranscriptGate(
  text: string,
  options: {
    expectedLang: string;
    conversationMessages?: { role: string; content: string }[];
    backgroundNoiseRejection?: boolean;
    validatedBackgroundAcousticEvidence?: boolean;
    isOutbound: boolean;
    inboundHallucinationCount: number;
    maxInboundReprompts?: number;
  }
): InboundTranscriptGateDecision {
  const maxReprompts = options.maxInboundReprompts ?? 2;
  const result = evaluateInboundTranscriptFilters(text, options);

  if (result.accept) {
    return { action: 'accept', signals: result.signals, stages: result.stages };
  }

  if (result.rejectedBy === 'nonspeech') {
    const nextHallucinationCount = options.inboundHallucinationCount + 1;
    const shouldReprompt =
      !options.isOutbound && nextHallucinationCount <= maxReprompts;
    return {
      action: 'reject_nonspeech',
      signals: result.signals,
      stages: result.stages,
      shouldReprompt,
      nextHallucinationCount,
    };
  }

  return {
    action: 'reject_silent',
    rejectedBy: result.rejectedBy!,
    signals: result.signals,
    stages: result.stages,
  };
}
