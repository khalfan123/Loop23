/**
 * ============================================================
 * Whisper transcript quality filters
 *
 * Pure heuristics used to reject hallucinated, background, or
 * wrong-language transcripts returned by batch Whisper STT on
 * noisy 8kHz telephony audio.
 * ============================================================
 */

export const WHISPER_HALLUCINATION_EXACT: string[] = [
  'شكراً على المشاهدة',
  'وشكراً على المشاهدة',
  'شكرا على المشاهدة',
  'شكرا للمشاهدة',
  'اشتركوا في القناة',
  'اشترك في القناة',
  'لا تنسوا الاشتراك',
  'ترجمة',
  'أعوذ بالله من الشيطان الرجيم',
  'بسم الله الرحمن الرحيم',
  'السلام عليكم ورحمة الله وبركاته',
  'صلى الله عليه وسلم',
  'سبحان الله وبحمده',
  'الحمد لله رب العالمين',
  'والسلام عليكم ورحمة الله',
  'إن شاء الله',
  'ما شاء الله',
  'لا حول ولا قوة إلا بالله',
  'سبحان الله',
  'الله أكبر',
  'لا إله إلا الله',
  'استغفر الله',
  'أشهد أن لا إله إلا الله',
  'رضي الله عنه',
  'جزاكم الله خيرا',
  'بارك الله فيكم',
  'حسبي الله ونعم الوكيل',
  'إنا لله وإنا إليه راجعون',
  'تحياتي',
  'مع السلامة',
  'الى اللقاء',
  'subscribe',
  'thank you for watching',
  'thanks for watching',
  'like and subscribe',
  'please subscribe',
  'don\'t forget to subscribe',
  'hit the bell',
  'Shabbat shalom',
  'subtitles by',
  'amara.org',
  'www.mooji.org',
  '♪',
  '...',
  'you',
  'bye',
  'the end',
  'thank you',
  'thanks',
  'MBC',
  'SBS',
  'TV',
  'FM',
];

export const WHISPER_HALLUCINATION_CONTAINS: string[] = [
  'شكرا على المشاهدة',
  'شكراً على المشاهدة',
  'اشتركوا في القناة',
  'لا تنسوا الاشتراك',
  'thank you for watching',
  'thanks for watching',
  'like and subscribe',
  'please subscribe',
  'subtitles by',
  'amara.org',
  'www.mooji.org',
  'مشاهدة ممتعة',
  'تابعونا على',
  'قناتنا على',
  'ترجمة الأخ',
  'ترجمة فريق',
  'أخرجها',
  'إخراج',
  'مونتاج',
  'تصوير',
  'إعداد وتقديم',
  'حلقة جديدة',
  'الحلقة القادمة',
  'في الحلقة',
  'نراكم في',
  'كونوا معنا',
  'لا تنسى الإعجاب',
  'اضغط لايك',
  'فعل الجرس',
  'رابط القناة',
];

/**
 * True when a Whisper transcript looks like a known hallucination:
 * YouTube-style outros, religious filler on noise, symbol-only output,
 * exact/near phrase repetition, or implausible short Arabic fragments.
 */
export function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;

  const lower = trimmed.toLowerCase();

  for (const h of WHISPER_HALLUCINATION_EXACT) {
    if (lower === h.toLowerCase()) return true;
  }

  for (const h of WHISPER_HALLUCINATION_CONTAINS) {
    if (lower.includes(h.toLowerCase())) return true;
  }

  if (/^[♪♫🎵🎶\s.,!?]+$/.test(trimmed)) return true;

  if (/^\.{2,}$/.test(trimmed)) return true;

  const exactRepeat = /^(.{2,30})\1{2,}$/;
  if (exactRepeat.test(trimmed)) return true;

  const isArabic = /[؀-ۿ]/.test(trimmed);
  if (isArabic) {
    const arabicOnly = trimmed.replace(/[^؀-ۿ\s]/g, '').trim();
    const arabicRatio = arabicOnly.length / trimmed.length;
    if (arabicRatio > 0.8) {
      const cleanedForCheck = trimmed.replace(/[؟?!.,،؛\s]+$/g, '').replace(/(.)\1{2,}/g, '$1$1');
      const validShortArabic = /^(ألو|مرحبا|مرحباً|أهلا|أهلاً|هلا|نعم|لا|أيوه|أيوا|أريد|ممكن|طيب|تمام|ماشي|شكرا|شكراً|يعطيك العافية|سلام|السلام عليكم|وعليكم السلام|أبي|أبغى|بدي|عايز|كيف|ليش|وين|متى|كم|مين|شو|إيش|هل|مساعدة|سؤال|استفسار|مشكلة|حساب|فاتورة|رصيد|خدمة|اشتراك)$/i;
      const arabicWords = trimmed.split(/\s+/).filter(w => w.length > 0);

      if (arabicWords.length <= 2 && trimmed.length < 15) {
        if (!validShortArabic.test(cleanedForCheck)) return true;
      }

      if (/الله|سبحان|بسم|صلى|رحمة|الحمد|أعوذ|الشيطان/.test(trimmed) && arabicWords.length <= 6) return true;

      if (/المشاهدة|الاشتراك|القناة|الحلقة|تابعونا|لايك|الجرس/.test(trimmed)) return true;
    }
  }

  const words = trimmed.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 4) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1) return true;

    const windowSize = Math.min(4, Math.floor(words.length / 3));
    if (windowSize >= 2) {
      for (let phraseLen = 2; phraseLen <= windowSize; phraseLen++) {
        const phraseCounts = new Map<string, number>();
        for (let i = 0; i <= words.length - phraseLen; i++) {
          const phrase = words.slice(i, i + phraseLen).join(' ').toLowerCase();
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
        }
        for (const count of Array.from(phraseCounts.values())) {
          if (count >= 3) return true;
        }
      }
    }
  }

  return false;
}

export const BACKGROUND_NOISE_PHRASES: string[] = [
  'pass me the salt',
  'pass the salt',
  'what do you want to eat',
  'what should we eat',
  'what\'s for dinner',
  'what\'s for lunch',
  'let\'s order food',
  'change the channel',
  'what\'s on tv',
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
  'what\'s the score',
  'touchdown',
  'home run',
  'what a play',
  'pass the remote',
  'where\'s the remote',
  'someone\'s at the door',
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

export const BACKGROUND_TOPIC_PATTERNS: RegExp[] = [
  /\b(?:recipe|ingredient|tablespoon|teaspoon|cups? of|oven|stir|chop|dice|bake|fry|boil)\b/i,
  /\b(?:episode|season \d|series|movie|film|actor|actress|character|plot|scene)\b/i,
  /\b(?:homework|math|science|teacher|school|class|exam|test|grade)\b/i,
  /\b(?:walk the dog|feed the cat|pet food|veterinar|litter box)\b/i,
  /\b(?:laundry|dishes|vacuum|mop|sweep|trash|garbage|recycl)\b/i,
  /\b(?:weather forecast|traffic update|sports update|headline)\b/i,
  /\b(?:commercial|advertisement|promo|trailer)\b/i,
];

/**
 * True when a transcript matches household/TV background-speech phrases,
 * or an off-topic pattern with almost no lexical overlap with the recent
 * conversation context.
 */
export function isLikelyBackgroundSpeech(
  text: string,
  conversationMessages: { role: string; content: string }[]
): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 3) return false;

  for (const phrase of BACKGROUND_NOISE_PHRASES) {
    if (trimmed === phrase.toLowerCase() || trimmed.includes(phrase.toLowerCase())) {
      return true;
    }
  }

  for (const pattern of BACKGROUND_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      const recentContext = conversationMessages
        .slice(-6)
        .map(m => m.content.toLowerCase())
        .join(' ');

      const words = trimmed.split(/\s+/).filter(w => w.length > 3);
      const contextOverlap = words.filter(w => recentContext.includes(w)).length;
      const overlapRatio = words.length > 0 ? contextOverlap / words.length : 0;

      if (overlapRatio < 0.15) {
        return true;
      }
    }
  }

  return false;
}

/**
 * True when a transcript's script/character mix clearly contradicts the
 * expected conversation language (e.g. Latin text on an Arabic call).
 */
export function isLanguageMismatch(text: string, expectedLang: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;

  const arabicChars = (trimmed.match(/[؀-ۿ]/g) || []).length;
  const latinChars = (trimmed.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const cjkChars = (trimmed.match(/[一-鿿぀-ゟ゠-ヿ가-힯]/g) || []).length;
  const totalAlpha = arabicChars + latinChars + cjkChars;
  if (totalAlpha < 3) return false;

  if (expectedLang === 'ar') {
    if (arabicChars / totalAlpha < 0.3) return true;
  } else if (expectedLang === 'en') {
    if (arabicChars / totalAlpha > 0.5) return true;
    if (cjkChars / totalAlpha > 0.3) return true;
    const frenchPatterns = /\b(je suis|nous|vous|qu['']|c['']est|pas de|il semble|voulez|s['']il vous|en tout cas|on est)\b/i;
    const spanishPatterns = /\b(está|usted|nosotros|también|pero|porque|entonces|gracias por|quiero|necesito)\b/i;
    if (frenchPatterns.test(trimmed) && latinChars > 10) return true;
    if (spanishPatterns.test(trimmed) && latinChars > 10) return true;
  }

  return false;
}
