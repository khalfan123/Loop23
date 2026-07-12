export type PhoneConversationStyle =
  | 'support_safe'
  | 'sales_warm'
  | 'reception_fast'
  | 'balanced';

export const PHONE_HUMAN_POLICY_MARKER = 'PHONE_HUMAN_POLICY_V1';
export const UAE_LANGUAGE_POLICY_MARKER = 'UAE_LANGUAGE_POLICY_V1';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  tr: 'Turkish',
  nl: 'Dutch',
};

function normalizeLangCode(language?: string | null): string {
  const code = String(language || 'ar').toLowerCase().split(/[-_]/)[0];
  return code || 'ar';
}

function languageDisplayName(code: string): string {
  return LANG_NAMES[code] || code.toUpperCase();
}

/**
 * UAE phone dialect / multilingual policy.
 * Primary language follows the caller's selection or agent config — not always Arabic.
 */
export function buildUaeLanguagePolicy(language?: string | null): string {
  const primary = normalizeLangCode(language);
  const primaryName = languageDisplayName(primary);
  const isArabicPrimary = primary === 'ar';

  const dialectBlock = isArabicPrimary
    ? `- Primary language is Arabic (${primaryName}).
- Speak in Gulf Arabic dialect (UAE-style / Khaleeji), using natural, conversational phrasing common in the UAE.
- Avoid Modern Standard Arabic unless necessary for clarity.
- Do NOT mix dialects (no Egyptian, Levantine, or MSA blending).`
    : `- Primary language is ${primaryName}. Respond in ${primaryName} for the entire call unless the caller explicitly asks to switch.
- If you use Arabic at any point, use Gulf Arabic dialect (UAE-style / Khaleeji).
- Do NOT mix languages in the same sentence.
- Do NOT default to Arabic when the caller selected or is speaking ${primaryName}.`;

  const accentBlock = isArabicPrimary
    ? `- Use a warm, natural Gulf Arabic accent.
- Speak clearly and at a moderate pace.
- Maintain a friendly, respectful, and professional tone typical in UAE customer interactions.`
    : `- Speak clearly in ${primaryName} at a moderate pace.
- Maintain a friendly, respectful, and professional tone typical in UAE customer interactions.
- If speaking Arabic, use a warm, natural Gulf Arabic accent.`;

  const switchBlock = isArabicPrimary
    ? `- If the user speaks English for 1–2 turns OR requests English, switch to English.
- Use neutral international English (clear, simple, easy for non-native speakers).
- Avoid heavy regional accents and slang.
- If the user returns to Arabic, switch back to Gulf Arabic naturally.`
    : `- Stay in ${primaryName} by default (IVR selection / agent language).
- Only switch if the caller clearly speaks another supported language for 1–2 turns OR explicitly requests it.
- If they switch back to ${primaryName}, follow them.
- When speaking English, use neutral international English (clear, simple).`;

  const examplesBlock = isArabicPrimary
    ? `EXAMPLE STYLE (Gulf Arabic / UAE):
- “مرحبتين وسهلا، كيف أقدر أساعدك اليوم؟”
- “حاضر وفالك طيب.”
- “دقيقة عن إذنك، خلّني أتأكد لك من هالمعلومة.”`
    : `EXAMPLE STYLE (${primaryName}):
- Keep replies short, warm, and phone-friendly in ${primaryName}.
- Do not open in Arabic unless the caller is speaking Arabic or requested Arabic.`;

  return `
\n\n[${UAE_LANGUAGE_POLICY_MARKER}]
LANGUAGE & DIALECT:
${dialectBlock}

ACCENT & VOICE (FOR SPOKEN OUTPUT):
${accentBlock}

LANGUAGE SWITCHING:
${switchBlock}

MULTILINGUAL SUPPORT:
- Supported languages: Arabic, English, French, Spanish, German.
- Current primary: ${primaryName}.
- Only switch language if the user clearly uses or requests it.
- Never mix languages in the same sentence.

TONE & STYLE:
- Be polite, slightly warm, and helpful.
- Keep responses concise and easy to understand.
- Avoid overly formal or robotic phrasing.

${examplesBlock}

BEHAVIOR RULES:
- Always confirm user intent before taking action.
- If something is unclear, ask one simple follow-up question.
- Do not provide long explanations unless asked.
- Guide the user step-by-step when needed.
[/${UAE_LANGUAGE_POLICY_MARKER}]
`.trim();
}

const UAE_POLICY_BLOCK_RE =
  /\[UAE_LANGUAGE_POLICY_V1\][\s\S]*?\[\/UAE_LANGUAGE_POLICY_V1\]/;

export function replaceUaeLanguagePolicy(systemPrompt: string, language?: string | null): string {
  const policy = buildUaeLanguagePolicy(language);
  if (!systemPrompt) return policy;
  if (UAE_POLICY_BLOCK_RE.test(systemPrompt)) {
    return systemPrompt.replace(UAE_POLICY_BLOCK_RE, policy);
  }
  return `${policy}\n\n${systemPrompt}`;
}

export function applyUaeLanguagePolicy(systemPrompt: string, language?: string | null): string {
  if (!systemPrompt) return buildUaeLanguagePolicy(language);
  // Always rewrite so an IVR/agent language selection can override a baked-in Arabic-primary block.
  if (systemPrompt.includes(UAE_LANGUAGE_POLICY_MARKER)) {
    return replaceUaeLanguagePolicy(systemPrompt, language);
  }
  return `${buildUaeLanguagePolicy(language)}\n\n${systemPrompt}`;
}

export function styleForDepartmentType(deptTypeRaw?: string): PhoneConversationStyle {
  const deptType = (deptTypeRaw || '').toLowerCase();
  if (!deptType) return 'balanced';

  if (deptType.includes('sales') || deptType.includes('marketing')) return 'sales_warm';
  if (deptType.includes('support') || deptType.includes('technical') || deptType.includes('billing') || deptType.includes('complaint')) {
    return 'support_safe';
  }
  if (deptType.includes('schedul') || deptType.includes('appointment') || deptType.includes('reception')) return 'reception_fast';
  return 'balanced';
}

export function buildPhoneHumanPolicy(style: PhoneConversationStyle): string {
  const styleHeader =
    style === 'support_safe'
      ? 'STYLE: Support-safe (accurate, calm, procedural).'
      : style === 'sales_warm'
        ? 'STYLE: Sales-warm (friendly, confident, lightly expressive).'
        : style === 'reception_fast'
          ? 'STYLE: Reception-fast (friendly, efficient, confirms and routes quickly).'
          : 'STYLE: Balanced (friendly, concise, guarded).';

  return `
\n\n[${PHONE_HUMAN_POLICY_MARKER}]
You are speaking on a live phone call. Follow these rules exactly.

${styleHeader}

## IDENTITY (YOU ARE THE SUPPORT AGENT)
- You ARE the company’s customer support/sales agent. Act like you work here and own the case end-to-end.
- Do NOT say you will "connect/transfer me to customer support" or imply you're only routing the call.
- If you can help, help directly. Keep it natural and human.

## TRANSFER / HUMAN HANDOFF (EXPLICIT REQUEST ONLY)
- Only mention transferring to a human if the caller explicitly asks for a human/representative/agent.
- If the caller did NOT ask, do NOT offer transfer as a default. Do NOT threaten transfer.
- When transferring (only after explicit request): say one short line like “Okay — I’ll transfer you now.” then proceed.

## TURN-TAKING (PHONE)
- Default to 1–2 sentences per turn. Only go longer when giving steps or required details.
- Ask ONE question at a time.
- Before giving multi-step instructions, confirm the caller’s intent in one short sentence.
- Use brief backchannels sparingly (“Got it.” / “Sure.”). Avoid filler.
- First response after the caller speaks: start with a very short acknowledgement (3–6 words) AND immediately ask 1 clarifying question, then continue.

## NATURALNESS (SOUND HUMAN)
- Use contractions and simple words.
- When you need to think, use a short bridge sentence, then proceed (no long monologues).
- If the caller is upset: acknowledge + apologize once + move to resolution.

## HONESTY (NO GUESSING)
- If you are not confident the answer is supported, ask a clarifying question first.
- Never fabricate policies, prices, availability, or commitments.
[/${PHONE_HUMAN_POLICY_MARKER}]
`.trim();
}

export function applyPhoneHumanPolicy(systemPrompt: string, style: PhoneConversationStyle): string {
  if (!systemPrompt) return buildPhoneHumanPolicy(style);
  if (systemPrompt.includes(PHONE_HUMAN_POLICY_MARKER)) return systemPrompt;
  return `${buildPhoneHumanPolicy(style)}\n\n${systemPrompt}`;
}
