'use strict';

export type SentimentLevel = 'positive' | 'neutral' | 'cautious' | 'negative' | 'critical';

export interface SentimentResult {
  score: number;
  level: SentimentLevel;
  alert: boolean;
  reason: string | null;
}

interface CallSentimentState {
  messageCount: number;
  cumulativeScore: number;
  negativeStreak: number;
  alerted: boolean;
  lastLevel: SentimentLevel;
}

const NEGATIVE_PATTERNS: Record<string, { patterns: RegExp[]; weight: number; reason: string }[]> = {
  en: [
    { patterns: [/\b(fuck|shit|damn|ass|hell|crap|bullshit|piss)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/\b(speak|talk)\s+(to|with)\s+(a\s+)?(manager|supervisor|human|person|someone\s+else|real\s+person)\b/i], weight: -4, reason: 'escalation request' },
    { patterns: [/\b(cancel|terminate|end)\s+(my\s+)?(account|subscription|service|contract|membership)\b/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(lawsuit|lawyer|attorney|legal\s+action|sue\s+you|report\s+you|bbb|complaint|consumer\s+protection)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(worst|terrible|horrible|awful|disgusting|pathetic|useless|incompetent|ridiculous)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(angry|furious|livid|outraged|fed\s+up|sick\s+of|tired\s+of|had\s+enough)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(scam|fraud|rip\s*off|steal|cheat|dishonest|liar)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/\b(waste\s+of\s+(my\s+)?time|don'?t\s+care|not\s+listening|you'?re\s+not\s+helping)\b/i], weight: -2, reason: 'frustration' },
    { patterns: [/\b(never\s+(again|calling|using|buying)|done\s+with\s+(you|this))\b/i], weight: -3, reason: 'abandonment signal' },
    { patterns: [/\b(already\s+(called|told|said|explained)\s+(you|this|that)\s+(multiple|many|several|three|four|five|\d+)\s+times)\b/i], weight: -3, reason: 'repeated contact frustration' },
    { patterns: [/\b(stop\s+calling|do\s+not\s+call|remove\s+my\s+number|take\s+me\s+off)\b/i], weight: -4, reason: 'DNC request' },
  ],
  es: [
    { patterns: [/\b(mierda|joder|coño|puta|carajo|cabrón|chingada)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/\b(hablar\s+con|quiero\s+(?:un|el)\s+)(gerente|supervisor|jefe|persona\s+real|humano)\b/i], weight: -4, reason: 'escalation request' },
    { patterns: [/\b(cancelar|terminar)\s+(mi\s+)?(cuenta|suscripción|servicio|contrato)\b/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(demanda|abogado|acción\s+legal|denunciar|denuncia)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(peor|terrible|horrible|pésimo|asqueroso|inútil|ridículo|incompetente)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(furioso|enojado|harto|cansado\s+de|no\s+me\s+importa)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(estafa|fraude|robo|mentiroso|deshonesto)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/\b(dejen\s+de\s+llamar|no\s+me\s+llamen|quiten\s+mi\s+número)\b/i], weight: -4, reason: 'DNC request' },
  ],
  fr: [
    { patterns: [/\b(merde|putain|connard|bordel|enculé)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/\b(parler\s+(?:à|avec)\s+(?:un\s+)?)(responsable|superviseur|directeur|humain|personne\s+réelle)\b/i], weight: -4, reason: 'escalation request' },
    { patterns: [/\b(annuler|résilier)\s+(mon\s+)?(compte|abonnement|contrat|service)\b/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(avocat|procès|action\s+en\s+justice|plainte|porter\s+plainte)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(pire|terrible|horrible|nul|lamentable|incompétent|ridicule)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(furieux|en\s+colère|ras\s+le\s+bol|marre|excédé)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(arnaque|fraude|voleur|menteur|malhonnête)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/\b(arrêtez\s+d'?appeler|ne\s+m'?appelez\s+plus|retirez\s+mon\s+numéro)\b/i], weight: -4, reason: 'DNC request' },
  ],
  de: [
    { patterns: [/\b(scheiße|verdammt|arschloch|fick|mist)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/\b(sprechen\s+(?:mit|zu)\s+(?:einem\s+)?)(manager|vorgesetzten|chef|menschen|person)\b/i], weight: -4, reason: 'escalation request' },
    { patterns: [/\b(kündigen|stornieren)\s+(mein(?:en?|e)?\s+)?(konto|abonnement|vertrag|dienst)\b/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(anwalt|klage|rechtliche\s+schritte|beschwerde|verbraucherschutz)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(schlimmste|schrecklich|furchtbar|erbärmlich|nutzlos|inkompetent|lächerlich)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(wütend|sauer|genug|satt|reicht)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(betrug|abzocke|betrüger|lügner|unehrlich)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/\b(hören\s+sie\s+auf.*anzurufen|rufen\s+sie\s+nicht\s+mehr\s+an|meine\s+nummer\s+entfernen)\b/i], weight: -4, reason: 'DNC request' },
  ],
  pt: [
    { patterns: [/\b(merda|porra|caralho|foda|droga)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/\b(falar\s+com\s+(?:o\s+)?)(gerente|supervisor|responsável|pessoa\s+real|humano)\b/i], weight: -4, reason: 'escalation request' },
    { patterns: [/\b(cancelar|encerrar)\s+(minha?\s+)?(conta|assinatura|serviço|contrato)\b/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(advogado|processo|ação\s+judicial|reclamação|procon|denúncia)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(pior|terrível|horrível|péssimo|nojento|inútil|ridículo|incompetente)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(furioso|irritado|cheio|cansado\s+disso|de\s+saco\s+cheio)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(golpe|fraude|roubo|mentiroso|desonesto)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/\b(parem\s+de\s+ligar|não\s+me\s+liguem|tirem\s+meu\s+número)\b/i], weight: -4, reason: 'DNC request' },
  ],
  hi: [
    { patterns: [/\b(बकवास|साला|कमीना|बेवकूफ|गधा|हरामी)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/(मैनेजर|सुपरवाइजर|बॉस|इंसान|असली\s+व्यक्ति)\s*(से\s+बात)/i], weight: -4, reason: 'escalation request' },
    { patterns: [/(कैंसल|बंद|रद्द)\s*(करो|करें|कर\s+दो).*?(अकाउंट|खाता|सर्विस|सेवा)/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(वकील|कानूनी\s+कार्रवाई|मुकदमा|शिकायत|कंज्यूमर\s+फोरम)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(बेकार|घटिया|भयानक|निकम्मा|बेहूदा)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(गुस्सा|नाराज|परेशान|तंग\s+आ\s+गया|बहुत\s+हो\s+गया)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(धोखा|फ्रॉड|चोर|झूठा|बेईमान)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/(फोन\s+मत\s+करो|कॉल\s+बंद\s+करो|नंबर\s+हटाओ)/i], weight: -4, reason: 'DNC request' },
  ],
  ar: [
    { patterns: [/\b(حمار|غبي|كلب|ابن|لعنة|تبا)\b/i], weight: -3, reason: 'profanity' },
    { patterns: [/(أريد|أبغى|عايز)\s*(أتكلم|أكلم|التحدث)\s*(مع|إلى)\s*(المدير|المسؤول|شخص|إنسان)/i], weight: -4, reason: 'escalation request' },
    { patterns: [/(إلغاء|ألغي|إغلاق)\s*(حسابي|اشتراكي|الخدمة|العقد)/i], weight: -3, reason: 'cancellation intent' },
    { patterns: [/\b(محامي|قضية|إجراء\s+قانوني|شكوى|حماية\s+المستهلك)\b/i], weight: -5, reason: 'legal threat' },
    { patterns: [/\b(أسوأ|فظيع|مريع|سيء|مقرف|عديم\s+الفائدة)\b/i], weight: -2, reason: 'strong dissatisfaction' },
    { patterns: [/\b(غاضب|زعلان|طفشت|تعبت|يكفي|ضاق\s+خلقي)\b/i], weight: -3, reason: 'caller frustration' },
    { patterns: [/\b(نصب|احتيال|سرقة|كذاب|غشاش)\b/i], weight: -4, reason: 'fraud accusation' },
    { patterns: [/(توقفوا\s+عن\s+الاتصال|لا\s+تتصلوا|احذفوا\s+رقمي)/i], weight: -4, reason: 'DNC request' },
  ],
};

const POSITIVE_PATTERNS: Record<string, RegExp[]> = {
  en: [
    /\b(thank\s+you|thanks|great|perfect|excellent|wonderful|amazing|awesome|appreciate|love\s+it|sounds\s+good|that'?s?\s+great|happy|pleased|satisfied)\b/i,
  ],
  es: [/\b(gracias|perfecto|excelente|maravilloso|genial|encanta|fantástico|contento|satisfecho)\b/i],
  fr: [/\b(merci|parfait|excellent|magnifique|génial|super|formidable|content|satisfait)\b/i],
  de: [/\b(danke|perfekt|ausgezeichnet|wunderbar|großartig|toll|zufrieden|glücklich)\b/i],
  pt: [/\b(obrigad[oa]|perfeito|excelente|maravilhoso|ótimo|incrível|satisfeito|contente)\b/i],
  hi: [/\b(धन्यवाद|शुक्रिया|बहुत\s+अच्छा|बढ़िया|शानदार|खुश|संतुष्ट)\b/i],
  ar: [/\b(شكرا|ممتاز|رائع|جميل|عظيم|سعيد|راضي)\b/i],
};

const ALERT_THRESHOLD = -6;
const CRITICAL_THRESHOLD = -10;
const NEGATIVE_STREAK_ALERT = 3;

const callStates: Map<string, CallSentimentState> = new Map();

function getLanguagePatterns(lang: string) {
  const key = lang.substring(0, 2).toLowerCase();
  return {
    negative: NEGATIVE_PATTERNS[key] || NEGATIVE_PATTERNS['en'],
    positive: POSITIVE_PATTERNS[key] || POSITIVE_PATTERNS['en'],
  };
}

export class RealtimeSentimentService {
  static analyzeSentiment(callId: string, message: string, language: string = 'en'): SentimentResult {
    let state = callStates.get(callId);
    if (!state) {
      state = {
        messageCount: 0,
        cumulativeScore: 0,
        negativeStreak: 0,
        alerted: false,
        lastLevel: 'neutral',
      };
      callStates.set(callId, state);
    }

    state.messageCount++;
    const { negative, positive } = getLanguagePatterns(language);

    let messageScore = 0;
    let worstReason: string | null = null;
    let worstWeight = 0;

    for (const entry of negative) {
      for (const pattern of entry.patterns) {
        if (pattern.test(message)) {
          messageScore += entry.weight;
          if (entry.weight < worstWeight) {
            worstWeight = entry.weight;
            worstReason = entry.reason;
          }
          break;
        }
      }
    }

    let positiveHits = 0;
    for (const pattern of positive) {
      if (pattern.test(message)) {
        positiveHits++;
      }
    }
    if (positiveHits > 0) {
      messageScore += Math.min(positiveHits * 1.5, 3);
    }

    state.cumulativeScore += messageScore;

    if (messageScore < 0) {
      state.negativeStreak++;
    } else if (messageScore > 0) {
      state.negativeStreak = Math.max(0, state.negativeStreak - 1);
    }

    let level: SentimentLevel;
    if (state.cumulativeScore <= CRITICAL_THRESHOLD) {
      level = 'critical';
    } else if (state.cumulativeScore <= ALERT_THRESHOLD) {
      level = 'negative';
    } else if (state.cumulativeScore < -2) {
      level = 'cautious';
    } else if (state.cumulativeScore > 3) {
      level = 'positive';
    } else {
      level = 'neutral';
    }
    state.lastLevel = level;

    const shouldAlert = !state.alerted && (
      level === 'critical' ||
      level === 'negative' ||
      state.negativeStreak >= NEGATIVE_STREAK_ALERT ||
      messageScore <= -4
    );

    if (shouldAlert) {
      state.alerted = true;
    }

    const alertReason = shouldAlert
      ? (worstReason || (state.negativeStreak >= NEGATIVE_STREAK_ALERT ? 'sustained negative sentiment' : 'negative sentiment detected'))
      : null;

    return {
      score: state.cumulativeScore,
      level,
      alert: shouldAlert,
      reason: alertReason,
    };
  }

  static getCallState(callId: string): CallSentimentState | undefined {
    return callStates.get(callId);
  }

  static resetCall(callId: string): void {
    callStates.delete(callId);
  }

  static getCurrentLevel(callId: string): SentimentLevel {
    return callStates.get(callId)?.lastLevel || 'neutral';
  }

  static isAlerted(callId: string): boolean {
    return callStates.get(callId)?.alerted || false;
  }
}
