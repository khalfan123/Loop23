'use strict';
import { Router, Request, Response } from 'express';
import { db } from '../../../db';
import { agents, twilioOpenaiCalls, phoneNumbers, departments, departmentAgents, ivrConfigurations, flows } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateTwiML, BEDROCK_POLLY_CONFIG, getRecordingWebhookUrl } from '../config/config';
import { logger } from '../../../utils/logger';
import { getDomain } from '../../../utils/domain';
import { getTwilioClient } from '../../../services/twilio-connector';
import { applyArabicPronunciationFixes } from '../services/ssml-humanizer';
import { OpenAIPoolService } from '../../plivo/services/openai-pool.service';
import { TWILIO_OPENAI_CONFIG } from '../../twilio-openai/config/twilio-openai-config';
import { liveCallRegistry } from '../../../services/live-call-registry';

function isOpenAIRealtimeAgent(agent: typeof agents.$inferSelect): boolean {
  return agent.telephonyProvider === 'twilio_openai';
}

const POLLY_TO_OPENAI_VOICE_MAP: Record<string, string> = {
  'Joanna': 'alloy',
  'Matthew': 'echo',
  'Salli': 'shimmer',
  'Kendra': 'coral',
  'Kimberly': 'sage',
  'Joey': 'ash',
  'Justin': 'verse',
  'Ivy': 'alloy',
  'Ruth': 'shimmer',
  'Stephen': 'echo',
  'Zeina': 'alloy',
  'Hala': 'shimmer',
  'Zayd': 'ash',
  'Lupe': 'coral',
  'Léa': 'shimmer',
  'Vicki': 'coral',
  'Bianca': 'sage',
  'Camila': 'coral',
  'Zhiyu': 'alloy',
  'Kajal': 'shimmer',
  'Tomoko': 'alloy',
  'Seoyeon': 'shimmer',
};

function mapPollyVoiceToOpenAI(pollyVoice: string | null | undefined, agentOpenAIVoice: string | null | undefined): string {
  if (agentOpenAIVoice) return agentOpenAIVoice;
  if (pollyVoice && POLLY_TO_OPENAI_VOICE_MAP[pollyVoice]) {
    return POLLY_TO_OPENAI_VOICE_MAP[pollyVoice];
  }
  return TWILIO_OPENAI_CONFIG.defaultVoice;
}

const router = Router();

const IVR_TEMPLATES: Record<string, { greeting: string; pressKey: string; invalidMsg: string; noInputMsg: string; holdMsg: string; noAgentMsg: string; goodbyeMsg: string; repeatMsg: string; stillThereMsg: string }> = {
  en: { pressKey: 'press', invalidMsg: 'Invalid selection. Please try again.', noInputMsg: 'We did not receive a response.', holdMsg: 'Please hold while we connect you.', noAgentMsg: 'Sorry, no agent is available at this time.', goodbyeMsg: 'Thank you for calling. Goodbye.', greeting: 'Welcome. Please listen to the following options.', repeatMsg: 'To repeat these options, press 0.', stillThereMsg: 'Are you still there?' },
  ar: { pressKey: 'اضغط', invalidMsg: 'اختيار غير صالح. يرجى المحاولة مرة أخرى.', noInputMsg: 'لم نتلق أي استجابة.', holdMsg: 'يرجى الانتظار بينما نقوم بتوصيلك.', noAgentMsg: 'عذراً، لا يوجد وكيل متاح حالياً.', goodbyeMsg: 'شكراً لاتصالك. مع السلامة.', greeting: 'مرحباً. يرجى الاستماع إلى الخيارات التالية.', repeatMsg: 'لتكرار هذه الخيارات، اضغط 0.', stillThereMsg: 'هل أنت لا تزال هنا؟' },
  es: { pressKey: 'presione', invalidMsg: 'Selección no válida. Por favor, intente de nuevo.', noInputMsg: 'No recibimos respuesta.', holdMsg: 'Por favor espere mientras lo conectamos.', noAgentMsg: 'Lo sentimos, no hay agente disponible en este momento.', goodbyeMsg: 'Gracias por llamar. Adiós.', greeting: 'Bienvenido. Por favor escuche las siguientes opciones.', repeatMsg: 'Para repetir estas opciones, presione 0.', stillThereMsg: '¿Sigues ahí?' },
  fr: { pressKey: 'appuyez sur', invalidMsg: 'Sélection invalide. Veuillez réessayer.', noInputMsg: 'Nous n\'avons reçu aucune réponse.', holdMsg: 'Veuillez patienter pendant que nous vous connectons.', noAgentMsg: 'Désolé, aucun agent n\'est disponible pour le moment.', goodbyeMsg: 'Merci d\'avoir appelé. Au revoir.', greeting: 'Bienvenue. Veuillez écouter les options suivantes.', repeatMsg: 'Pour répéter ces options, appuyez sur 0.', stillThereMsg: 'Êtes-vous toujours là ?' },
  de: { pressKey: 'drücken Sie', invalidMsg: 'Ungültige Auswahl. Bitte versuchen Sie es erneut.', noInputMsg: 'Wir haben keine Antwort erhalten.', holdMsg: 'Bitte warten Sie, während wir Sie verbinden.', noAgentMsg: 'Es tut uns leid, es ist derzeit kein Agent verfügbar.', goodbyeMsg: 'Vielen Dank für Ihren Anruf. Auf Wiedersehen.', greeting: 'Willkommen. Bitte hören Sie sich die folgenden Optionen an.', repeatMsg: 'Um diese Optionen zu wiederholen, drücken Sie 0.', stillThereMsg: 'Sind Sie noch da?' },
  it: { pressKey: 'premere', invalidMsg: 'Selezione non valida. Riprovi per favore.', noInputMsg: 'Non abbiamo ricevuto risposta.', holdMsg: 'Attenda mentre la colleghiamo.', noAgentMsg: 'Siamo spiacenti, nessun agente è disponibile al momento.', goodbyeMsg: 'Grazie per aver chiamato. Arrivederci.', greeting: 'Benvenuto. Ascolti le seguenti opzioni.', repeatMsg: 'Per ripetere queste opzioni, premere 0.', stillThereMsg: 'Sei ancora lì?' },
  pt: { pressKey: 'pressione', invalidMsg: 'Seleção inválida. Por favor, tente novamente.', noInputMsg: 'Não recebemos resposta.', holdMsg: 'Por favor, aguarde enquanto conectamos você.', noAgentMsg: 'Desculpe, nenhum agente está disponível no momento.', goodbyeMsg: 'Obrigado por ligar. Adeus.', greeting: 'Bem-vindo. Por favor, ouça as seguintes opções.', repeatMsg: 'Para repetir essas opções, pressione 0.', stillThereMsg: 'Você ainda está aí?' },
  zh: { pressKey: '请按', invalidMsg: '选择无效。请重试。', noInputMsg: '我们没有收到回复。', holdMsg: '请稍候，我们正在为您转接。', noAgentMsg: '抱歉，目前没有可用的客服。', goodbyeMsg: '感谢您的来电。再见。', greeting: '欢迎。请听以下选项。', repeatMsg: '如需重复这些选项，请按0。', stillThereMsg: '您还在吗？' },
  hi: { pressKey: 'दबाएं', invalidMsg: 'अमान्य चयन। कृपया पुनः प्रयास करें।', noInputMsg: 'हमें कोई प्रतिक्रिया नहीं मिली।', holdMsg: 'कृपया प्रतीक्षा करें जब तक हम आपको जोड़ते हैं।', noAgentMsg: 'क्षमा करें, इस समय कोई एजेंट उपलब्ध नहीं है।', goodbyeMsg: 'कॉल करने के लिए धन्यवाद। अलविदा।', greeting: 'स्वागत है। कृपया निम्नलिखित विकल्प सुनें।', repeatMsg: 'इन विकल्पों को दोबारा सुनने के लिए, 0 दबाएं।', stillThereMsg: 'क्या आप अभी भी यहाँ हैं?' },
  ja: { pressKey: 'を押してください', invalidMsg: '無効な選択です。もう一度お試しください。', noInputMsg: '応答がありませんでした。', holdMsg: 'お繋ぎしますので、少々お待ちください。', noAgentMsg: '申し訳ございません。現在対応可能なエージェントがおりません。', goodbyeMsg: 'お電話ありがとうございました。さようなら。', greeting: 'ようこそ。以下のオプションをお聞きください。', repeatMsg: 'オプションを繰り返すには、0を押してください。', stillThereMsg: 'まだいらっしゃいますか？' },
  ko: { pressKey: '번을 누르세요', invalidMsg: '잘못된 선택입니다. 다시 시도해 주세요.', noInputMsg: '응답을 받지 못했습니다.', holdMsg: '연결해 드리겠습니다. 잠시만 기다려 주세요.', noAgentMsg: '죄송합니다. 현재 사용 가능한 상담원이 없습니다.', goodbyeMsg: '전화해 주셔서 감사합니다. 안녕히 계세요.', greeting: '환영합니다. 다음 옵션을 들어주세요.', repeatMsg: '옵션을 반복하려면 0을 누르세요.', stillThereMsg: '아직 계신가요?' },
  nl: { pressKey: 'druk op', invalidMsg: 'Ongeldige selectie. Probeer het opnieuw.', noInputMsg: 'We hebben geen reactie ontvangen.', holdMsg: 'Een moment geduld terwijl we u doorverbinden.', noAgentMsg: 'Sorry, er is momenteel geen medewerker beschikbaar.', goodbyeMsg: 'Bedankt voor uw oproep. Tot ziens.', greeting: 'Welkom. Luister naar de volgende opties.', repeatMsg: 'Om deze opties te herhalen, druk op 0.', stillThereMsg: 'Bent u er nog?' },
  pl: { pressKey: 'naciśnij', invalidMsg: 'Nieprawidłowy wybór. Spróbuj ponownie.', noInputMsg: 'Nie otrzymaliśmy odpowiedzi.', holdMsg: 'Proszę czekać, łączymy Cię.', noAgentMsg: 'Przepraszamy, żaden agent nie jest obecnie dostępny.', goodbyeMsg: 'Dziękujemy za telefon. Do widzenia.', greeting: 'Witamy. Proszę wysłuchać poniższych opcji.', repeatMsg: 'Aby powtórzyć te opcje, naciśnij 0.', stillThereMsg: 'Czy nadal jesteś na linii?' },
  sv: { pressKey: 'tryck', invalidMsg: 'Ogiltigt val. Försök igen.', noInputMsg: 'Vi fick inget svar.', holdMsg: 'Vänligen vänta medan vi kopplar dig.', noAgentMsg: 'Tyvärr finns ingen agent tillgänglig just nu.', goodbyeMsg: 'Tack för ditt samtal. Hej då.', greeting: 'Välkommen. Lyssna på följande alternativ.', repeatMsg: 'För att upprepa dessa alternativ, tryck 0.', stillThereMsg: 'Är du fortfarande där?' },
  no: { pressKey: 'trykk', invalidMsg: 'Ugyldig valg. Prøv igjen.', noInputMsg: 'Vi mottok ingen respons.', holdMsg: 'Vennligst vent mens vi kobler deg.', noAgentMsg: 'Beklager, ingen agent er tilgjengelig for øyeblikket.', goodbyeMsg: 'Takk for at du ringte. Ha det.', greeting: 'Velkommen. Lytt til følgende alternativer.', repeatMsg: 'For å gjenta disse alternativene, trykk 0.', stillThereMsg: 'Er du fortsatt der?' },
  fi: { pressKey: 'paina', invalidMsg: 'Virheellinen valinta. Yritä uudelleen.', noInputMsg: 'Emme saaneet vastausta.', holdMsg: 'Odota hetki, yhdistämme sinut.', noAgentMsg: 'Valitettavasti yhtään agenttia ei ole saatavilla tällä hetkellä.', goodbyeMsg: 'Kiitos soitostasi. Näkemiin.', greeting: 'Tervetuloa. Kuuntele seuraavat vaihtoehdot.', repeatMsg: 'Toistaaksesi nämä vaihtoehdot, paina 0.', stillThereMsg: 'Oletko vielä siellä?' },
  da: { pressKey: 'tryk', invalidMsg: 'Ugyldigt valg. Prøv igen.', noInputMsg: 'Vi modtog ikke noget svar.', holdMsg: 'Vent venligst, mens vi forbinder dig.', noAgentMsg: 'Beklager, der er ingen agent tilgængelig i øjeblikket.', goodbyeMsg: 'Tak fordi du ringede. Farvel.', greeting: 'Velkommen. Lyt venligst til følgende muligheder.', repeatMsg: 'For at gentage disse muligheder, tryk 0.', stillThereMsg: 'Er du stadig der?' },
  tr: { pressKey: 'basın', invalidMsg: 'Geçersiz seçim. Lütfen tekrar deneyin.', noInputMsg: 'Yanıt alamadık.', holdMsg: 'Sizi bağlarken lütfen bekleyin.', noAgentMsg: 'Üzgünüz, şu anda müsait bir temsilci yok.', goodbyeMsg: 'Aramanız için teşekkür ederiz. Hoşça kalın.', greeting: 'Hoş geldiniz. Lütfen aşağıdaki seçenekleri dinleyin.', repeatMsg: 'Bu seçenekleri tekrarlamak için 0 tuşuna basın.', stillThereMsg: 'Hâlâ orada mısınız?' },
  cs: { pressKey: 'stiskněte', invalidMsg: 'Neplatná volba. Zkuste to prosím znovu.', noInputMsg: 'Neobdrželi jsme žádnou odpověď.', holdMsg: 'Prosím vyčkejte, připojujeme vás.', noAgentMsg: 'Omlouváme se, v tuto chvíli není k dispozici žádný agent.', goodbyeMsg: 'Děkujeme za váš hovor. Na shledanou.', greeting: 'Vítejte. Prosím, vyslechněte si následující možnosti.', repeatMsg: 'Pro zopakování těchto možností stiskněte 0.', stillThereMsg: 'Jste ještě na lince?' },
  ca: { pressKey: 'premeu', invalidMsg: 'Selecció no vàlida. Si us plau, torneu-ho a provar.', noInputMsg: 'No hem rebut cap resposta.', holdMsg: 'Si us plau, espereu mentre us connectem.', noAgentMsg: 'Ho sentim, no hi ha cap agent disponible en aquest moment.', goodbyeMsg: 'Gràcies per trucar. Adéu.', greeting: 'Benvingut. Si us plau, escolteu les opcions següents.', repeatMsg: 'Per repetir aquestes opcions, premeu 0.', stillThereMsg: 'Encara sou aquí?' },
};

const NUMBER_WORDS: Record<string, string[]> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  ar: ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'],
  fr: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'],
  de: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'],
  it: ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'],
  pt: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'],
  zh: ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  hi: ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'],
  ja: ['ゼロ', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  ko: ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'],
  nl: ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen'],
  pl: ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'],
  sv: ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio'],
  no: ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni'],
  fi: ['nolla', 'yksi', 'kaksi', 'kolme', 'neljä', 'viisi', 'kuusi', 'seitsemän', 'kahdeksan', 'yhdeksän'],
  da: ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni'],
  tr: ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'],
  cs: ['nula', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět'],
  ca: ['zero', 'u', 'dos', 'tres', 'quatre', 'cinc', 'sis', 'set', 'vuit', 'nou'],
};

function getTemplate(lang: string) {
  return IVR_TEMPLATES[lang] || IVR_TEMPLATES['en'];
}

function getNumberWord(lang: string, digit: number): string {
  const words = NUMBER_WORDS[lang] || NUMBER_WORDS['en'];
  return words[digit] || String(digit);
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', zh: '中文', hi: 'हिन्दी', ja: '日本語',
  ko: '한국어', nl: 'Nederlands', pl: 'Polski', sv: 'Svenska', no: 'Norsk',
  fi: 'Suomi', da: 'Dansk', tr: 'Türkçe',
  cs: 'Čeština', ca: 'Català',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isElevenLabsVoice(voiceId: string): boolean {
  return voiceId.startsWith('el_');
}

const EL_TO_POLLY_MAP: Record<string, string> = {
  el_rachel: 'Joanna', el_domi: 'Joanna', el_bella: 'Joanna', el_nicole: 'Joanna',
  el_antoni: 'Matthew', el_josh: 'Matthew', el_arnold: 'Matthew', el_adam: 'Matthew', el_sam: 'Matthew',
  el_marie: 'Lea', el_pierre: 'Remi',
  el_giulia: 'Bianca', el_marco: 'Adriano',
  el_xiaoli: 'Zhiyu', el_wei: 'Zhiyu',
  el_priya: 'Kajal', el_raj: 'Kajal',
  el_fatima: 'Hala', el_omar: 'Zayd',
};

function safePollyVoiceId(voiceId: string): string {
  if (isElevenLabsVoice(voiceId)) return EL_TO_POLLY_MAP[voiceId] || 'Joanna';
  if (['alloy','echo','fable','onyx','nova','shimmer'].includes(voiceId)) return 'Joanna';
  return voiceId;
}

const POLLY_VOICE_LANGUAGE: Record<string, string> = {
  Hala: 'arb', Zayd: 'arb', Zeina: 'arb',
  Lucia: 'es-ES', Lupe: 'es-US', Penelope: 'es-US', Pedro: 'es-US', Miguel: 'es-US', Mia: 'es-MX',
  Lea: 'fr-FR', Remi: 'fr-FR', Mathieu: 'fr-FR', Celine: 'fr-FR',
  Bianca: 'it-IT', Adriano: 'it-IT', Giorgio: 'it-IT', Carla: 'it-IT',
  Vicki: 'de-DE', Hans: 'de-DE', Marlene: 'de-DE', Daniel: 'de-DE',
  Zhiyu: 'cmn-CN',
  Kajal: 'hi-IN',
  Takumi: 'ja-JP', Mizuki: 'ja-JP', Kazuha: 'ja-JP', Tomoko: 'ja-JP',
  Seoyeon: 'ko-KR', Jihye: 'ko-KR',
  Camila: 'pt-BR', Vitoria: 'pt-BR', Thiago: 'pt-BR', Ines: 'pt-PT',
  Ruben: 'nl-NL', Laura: 'nl-NL', Lotte: 'nl-NL',
  Ola: 'pl-PL', Jacek: 'pl-PL', Ewa: 'pl-PL', Maja: 'pl-PL',
  Elin: 'sv-SE', Astrid: 'sv-SE',
  Ida: 'nb-NO', Liv: 'nb-NO',
  Suvi: 'fi-FI',
  Filiz: 'tr-TR', Burcu: 'tr-TR',
  Arlet: 'ca-ES',
  Jitka: 'cs-CZ',
  Sabrina: 'de-CH',
  Jasmine: 'en-SG',
  Hiujin: 'yue-CN',
  Sofie: 'da-DK',
  Hannah: 'de-AT',
  Isabelle: 'fr-BE',
  Lisa: 'nl-BE',
  Gabrielle: 'fr-CA', Liam: 'fr-CA',
  Sergio: 'es-ES', Andres: 'es-MX',
};

const NEURAL_ONLY_VOICES = new Set([
  'Hala', 'Zayd',
  'Adriano', 'Thiago',
  'Burcu',
  'Suvi',
  'Ola',
  'Kazuha', 'Tomoko',
  'Laura',
  'Sergio', 'Andres',
  'Ruth', 'Stephen', 'Gregory', 'Danielle',
  'Liam',
  'Jihye',
  'Arlet', 'Jitka', 'Sabrina', 'Jasmine',
]);

function getPollyVoiceName(voiceId: string): string {
  if (NEURAL_ONLY_VOICES.has(voiceId)) {
    return `${voiceId}-Neural`;
  }
  return voiceId;
}

function getPollyLanguage(voiceId: string): string | undefined {
  return POLLY_VOICE_LANGUAGE[voiceId];
}

function sayWithPolly(voiceId: string, text: string): string {
  const safeVoice = safePollyVoiceId(voiceId);
  const corrected = applyArabicPronunciationFixes(text);
  const lang = getPollyLanguage(safeVoice);
  const langAttr = lang ? ` language="${lang}"` : '';
  const pollyName = getPollyVoiceName(safeVoice);
  return `<Say voice="Polly.${escapeXml(pollyName)}"${langAttr}>${escapeXml(corrected)}</Say>`;
}

function sayOrPlay(voiceId: string, text: string, _ivrId: string, addBreakAfter: boolean = false, _speed: number = 0.92): string {
  return sayWithPolly(safePollyVoiceId(voiceId), text);
}

function buildBaseUrl(): string {
  return getDomain();
}

function extractDigitFromInput(body: any): string | null {
  if (body.Digits) return body.Digits;
  if (body.SpeechResult) {
    const speech = body.SpeechResult.trim().toLowerCase();
    const digitMatch = speech.match(/\d/);
    if (digitMatch) return digitMatch[0];
    const allNumberWords: Record<string, string> = {};
    for (const [lang, words] of Object.entries(NUMBER_WORDS)) {
      words.forEach((word, idx) => {
        allNumberWords[word.toLowerCase()] = String(idx);
      });
    }
    if (allNumberWords[speech]) return allNumberWords[speech];
    for (const [word, digit] of Object.entries(allNumberWords)) {
      if (speech.includes(word)) return digit;
    }
  }
  return null;
}

router.post('/answer', async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To } = req.body;
    const ivrId = req.query.ivrId as string;
    const attempt = parseInt(req.query.attempt as string || '1', 10);

    logger.info(`[Deprock IVR] /answer - ivrId=${ivrId}, CallSid=${CallSid}, attempt=${attempt}`, undefined, 'DeprockIVR');

    if (!ivrId) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`);
    }

    const [config] = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId),
        eq(ivrConfigurations.isActive, true),
        eq(ivrConfigurations.engineType, 'bedrock-polly')
      ))
      .limit(1);

    if (!config) {
      logger.info(`[Deprock IVR] Config not found or inactive: ${ivrId}`, undefined, 'DeprockIVR');
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This service is not available. Goodbye.</Say><Hangup/></Response>`);
    }

    if (attempt > 3) {
      const baseUrl = buildBaseUrl();
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(baseUrl)}/api/deprock/ivr/fallback?ivrId=${escapeXml(ivrId)}&amp;callSid=${escapeXml(CallSid || '')}&amp;caller=${escapeXml(From || '')}</Redirect></Response>`);
    }

    const voiceId = config.voiceId || 'Joanna';
    const langOptions = config.languageOptions as Array<{ id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[]; speed?: number }> | null;
    const menuOptions = config.menuOptions as Array<{ key: string; label: string; departmentId: string }> | null;
    const isMultiLanguage = langOptions && langOptions.length > 1;
    const defaultSpeed = langOptions?.[0]?.speed ?? 0.92;

    const baseUrl = buildBaseUrl();

    if (isMultiLanguage && langOptions) {
      let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

      const actionUrl = `${baseUrl}/api/deprock/ivr/handle-language?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(CallSid || '')}&caller=${encodeURIComponent(From || '')}&attempt=1`;
      const langHints = langOptions.map((_, i) => String(i + 1)).join(' ') + ' 0';
      twiml += `<Gather input="dtmf speech" timeout="10" numDigits="1" speechTimeout="3" hints="${langHints}" action="${escapeXml(actionUrl)}" method="POST">`;

      if (config.greetingMessage) {
        twiml += sayOrPlay(voiceId, config.greetingMessage, ivrId, false, defaultSpeed);
      } else {
        twiml += sayOrPlay(voiceId, getTemplate('en').greeting, ivrId, false, defaultSpeed);
        langOptions.forEach((opt, index) => {
          const digit = index + 1;
          const langTemplate = getTemplate(opt.language);
          const langVoice = opt.voiceId || voiceId;
          const langName = LANGUAGE_NAMES[opt.language] || opt.language;
          const isLast = index === langOptions.length - 1;
          const langSpeed = opt.speed ?? defaultSpeed;
          twiml += sayOrPlay(langVoice, `${langName}, ${langTemplate.pressKey} ${getNumberWord(opt.language, digit)}`, ivrId, !isLast, langSpeed);
        });
      }
      twiml += sayOrPlay(voiceId, getTemplate('en').repeatMsg, ivrId, false, defaultSpeed);

      twiml += `</Gather>`;

      const template = getTemplate('en');
      const retryUrl = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=${attempt + 1}`;
      twiml += sayOrPlay(voiceId, template.stillThereMsg, ivrId, false, defaultSpeed);
      twiml += `<Redirect method="POST">${escapeXml(retryUrl)}</Redirect>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    if (menuOptions && menuOptions.length > 0) {
      const lang = 'en';
      const template = getTemplate(lang);

      let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

      if (config.greetingMessage) {
        twiml += sayOrPlay(voiceId, config.greetingMessage, ivrId, false, defaultSpeed);
      } else {
        twiml += sayOrPlay(voiceId, template.greeting, ivrId, false, defaultSpeed);
      }

      const actionUrl = `${baseUrl}/api/deprock/ivr/handle-selection?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(CallSid || '')}&caller=${encodeURIComponent(From || '')}&lang=${encodeURIComponent(lang)}&attempt=1`;
      const menuHints = menuOptions.map(opt => opt.key).join(' ') + ' 0';
      twiml += `<Gather input="dtmf speech" timeout="10" numDigits="1" speechTimeout="3" hints="${menuHints}" action="${escapeXml(actionUrl)}" method="POST">`;

      menuOptions.forEach((opt, index) => {
        const digit = parseInt(opt.key, 10);
        const numberWord = getNumberWord(lang, digit);
        const isLast = index === menuOptions.length - 1;
        twiml += sayOrPlay(voiceId, `${template.pressKey} ${numberWord}, ${opt.label}`, ivrId, !isLast, defaultSpeed);
      });
      twiml += sayOrPlay(voiceId, template.repeatMsg, ivrId, false, defaultSpeed);

      twiml += `</Gather>`;

      const retryUrl = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=${attempt + 1}`;
      twiml += sayOrPlay(voiceId, template.stillThereMsg, ivrId, false, defaultSpeed);
      twiml += `<Redirect method="POST">${escapeXml(retryUrl)}</Redirect>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(voiceId, 'No menu options configured. Goodbye.', ivrId, false, defaultSpeed)}<Hangup/></Response>`);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /answer', error, 'DeprockIVR');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>`);
  }
});

router.post('/handle-language', async (req: Request, res: Response) => {
  try {
    const Digits = extractDigitFromInput(req.body);
    const ivrId = req.query.ivrId as string;
    const callSid = req.query.callSid as string || req.body.CallSid || '';
    const caller = req.query.caller as string || req.body.From || '';
    const attempt = parseInt(req.query.attempt as string || '1', 10);

    logger.info(`[Deprock IVR] /handle-language - Digits=${Digits}, SpeechResult=${req.body.SpeechResult || 'none'}, ivrId=${ivrId}, attempt=${attempt}`, undefined, 'DeprockIVR');

    if (Digits === '0') {
      const baseUrl = buildBaseUrl();
      const restartUrl = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=1`;
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(restartUrl)}</Redirect></Response>`);
    }

    const [config] = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId),
        eq(ivrConfigurations.isActive, true),
        eq(ivrConfigurations.engineType, 'bedrock-polly')
      ))
      .limit(1);

    if (!config) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`);
    }

    const voiceId = config.voiceId || 'Joanna';
    const langOptions = config.languageOptions as Array<{ id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[]; speed?: number }> | null;
    const defaultSpeed = langOptions?.[0]?.speed ?? 0.92;

    if (!langOptions || langOptions.length === 0) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>No language options available. Goodbye.</Say><Hangup/></Response>`);
    }

    const digitIndex = Digits ? parseInt(Digits, 10) - 1 : -1;
    const selectedLang = digitIndex >= 0 ? langOptions[digitIndex] : undefined;

    if (!selectedLang || digitIndex < 0 || digitIndex >= langOptions.length) {
      if (attempt >= 3) {
        const baseUrl = buildBaseUrl();
        res.type('text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(baseUrl)}/api/deprock/ivr/fallback?ivrId=${escapeXml(ivrId)}&amp;callSid=${escapeXml(callSid)}&amp;caller=${escapeXml(caller)}</Redirect></Response>`);
      }

      const template = getTemplate('en');
      const baseUrl = buildBaseUrl();
      const retryUrl = `${baseUrl}/api/deprock/ivr/handle-language?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&attempt=${attempt + 1}`;

      let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
      twiml += sayOrPlay(voiceId, template.invalidMsg, ivrId, false, defaultSpeed);
      const retryHints = langOptions.map((_, i) => String(i + 1)).join(' ') + ' 0';
      twiml += `<Gather input="dtmf speech" timeout="10" numDigits="1" speechTimeout="3" hints="${retryHints}" action="${escapeXml(retryUrl)}" method="POST">`;
      langOptions.forEach((opt, index) => {
        const digit = index + 1;
        const langTemplate = getTemplate(opt.language);
        const langVoice = opt.voiceId || voiceId;
        const langName = LANGUAGE_NAMES[opt.language] || opt.language;
        const isLast = index === langOptions.length - 1;
        const langSpeed = opt.speed ?? defaultSpeed;
        twiml += sayOrPlay(langVoice, `${langName}, ${langTemplate.pressKey} ${getNumberWord(opt.language, digit)}`, ivrId, !isLast, langSpeed);
      });
      twiml += sayOrPlay(voiceId, template.repeatMsg, ivrId, false, defaultSpeed);
      twiml += `</Gather>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    const lang = selectedLang.language;
    const langVoice = selectedLang.voiceId || voiceId;
    const langSpeed = selectedLang.speed ?? defaultSpeed;
    const template = getTemplate(lang);

    let menuOpts = config.menuOptions as Array<{ key: string; label: string; departmentId: string }> | null;

    if (selectedLang.selectedDepartments && selectedLang.selectedDepartments.length > 0 && menuOpts) {
      const filtered = menuOpts.filter(opt => selectedLang.selectedDepartments!.includes(opt.departmentId));
      if (filtered.length > 0) {
        menuOpts = filtered;
      }
    }

    if (!menuOpts || menuOpts.length === 0) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langSpeed)}<Hangup/></Response>`);
    }

    const baseUrl = buildBaseUrl();
    const actionUrl = `${baseUrl}/api/deprock/ivr/handle-selection?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&lang=${encodeURIComponent(lang)}&attempt=1`;

    let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
    const deptHints = menuOpts.map(opt => opt.key).join(' ') + ' 0';
    twiml += `<Gather input="dtmf speech" timeout="10" numDigits="1" speechTimeout="3" hints="${deptHints}" action="${escapeXml(actionUrl)}" method="POST">`;

    if (selectedLang.greeting) {
      twiml += sayOrPlay(langVoice, selectedLang.greeting, ivrId, false, langSpeed);
    } else {
      twiml += sayOrPlay(langVoice, template.greeting, ivrId, false, langSpeed);
      menuOpts.forEach((opt, index) => {
        const digit = parseInt(opt.key, 10);
        const numberWord = getNumberWord(lang, digit);
        const isLast = index === menuOpts!.length - 1;
        twiml += sayOrPlay(langVoice, `${template.pressKey} ${numberWord}, ${opt.label}`, ivrId, !isLast, langSpeed);
      });
    }
    twiml += sayOrPlay(langVoice, template.repeatMsg, ivrId, false, langSpeed);

    twiml += `</Gather>`;

    const retryUrl2 = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=${attempt + 1}`;
    twiml += sayOrPlay(langVoice, template.stillThereMsg, ivrId, false, langSpeed);
    twiml += `<Redirect method="POST">${escapeXml(retryUrl2)}</Redirect>`;
    twiml += `</Response>`;

    logger.info(`[Deprock IVR] /handle-language TwiML for ${ivrId} (voice=${langVoice}→${safePollyVoiceId(langVoice)}, lang=${lang}, depts=${menuOpts?.length || 0}): ${twiml.substring(0, 500)}`, undefined, 'DeprockIVR');

    res.type('text/xml');
    return res.send(twiml);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /handle-language', error, 'DeprockIVR');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>`);
  }
});

router.post('/handle-selection', async (req: Request, res: Response) => {
  try {
    const { CallSid: bodyCallSid, From: bodyFrom, To } = req.body;
    const Digits = extractDigitFromInput(req.body);
    const ivrId = req.query.ivrId as string;
    const callSid = req.query.callSid as string || bodyCallSid || '';
    const caller = req.query.caller as string || bodyFrom || '';
    const lang = req.query.lang as string || 'en';
    const attempt = parseInt(req.query.attempt as string || '1', 10);

    logger.info(`[Deprock IVR] /handle-selection - Digits=${Digits}, SpeechResult=${req.body.SpeechResult || 'none'}, ivrId=${ivrId}, lang=${lang}, attempt=${attempt}`, undefined, 'DeprockIVR');

    if (Digits === '0') {
      const baseUrl = buildBaseUrl();
      const repeatUrl = `${baseUrl}/api/deprock/ivr/handle-language?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&attempt=1`;
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(repeatUrl)}</Redirect></Response>`);
    }

    const [config] = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId),
        eq(ivrConfigurations.isActive, true),
        eq(ivrConfigurations.engineType, 'bedrock-polly')
      ))
      .limit(1);

    if (!config) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`);
    }

    const voiceId = config.voiceId || 'Joanna';
    const langOptions = config.languageOptions as Array<{ id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[]; speed?: number }> | null;
    const langOption = langOptions?.find(l => l.language === lang);
    const langVoice = langOption?.voiceId || voiceId;
    const langSpeed = langOption?.speed ?? 0.92;
    const template = getTemplate(lang);

    let menuOpts = config.menuOptions as Array<{ key: string; label: string; departmentId: string }> | null;

    if (langOption?.selectedDepartments && langOption.selectedDepartments.length > 0 && menuOpts) {
      const filtered = menuOpts.filter(opt => langOption.selectedDepartments!.includes(opt.departmentId));
      if (filtered.length > 0) {
        menuOpts = filtered;
      }
    }

    if (!menuOpts || menuOpts.length === 0) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langSpeed)}<Hangup/></Response>`);
    }

    const selectedOption = menuOpts.find(opt => opt.key === Digits);

    if (!selectedOption) {
      if (attempt >= 3) {
        const baseUrl = buildBaseUrl();
        res.type('text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(baseUrl)}/api/deprock/ivr/fallback?ivrId=${escapeXml(ivrId)}&amp;callSid=${escapeXml(callSid)}&amp;caller=${escapeXml(caller)}&amp;lang=${escapeXml(lang)}</Redirect></Response>`);
      }

      const baseUrl = buildBaseUrl();
      const retryUrl = `${baseUrl}/api/deprock/ivr/handle-selection?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&lang=${encodeURIComponent(lang)}&attempt=${attempt + 1}`;

      let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
      twiml += sayOrPlay(langVoice, template.invalidMsg, ivrId, false, langSpeed);
      const selRetryHints = menuOpts.map(opt => opt.key).join(' ') + ' 0';
      twiml += `<Gather input="dtmf speech" timeout="10" numDigits="1" speechTimeout="3" hints="${selRetryHints}" action="${escapeXml(retryUrl)}" method="POST">`;
      menuOpts.forEach((opt, index) => {
        const digit = parseInt(opt.key, 10);
        const numberWord = getNumberWord(lang, digit);
        const isLast = index === menuOpts!.length - 1;
        twiml += sayOrPlay(langVoice, `${template.pressKey} ${numberWord}, ${opt.label}`, ivrId, !isLast, langSpeed);
      });
      twiml += sayOrPlay(langVoice, template.repeatMsg, ivrId, false, langSpeed);
      twiml += `</Gather>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    const departmentId = selectedOption.departmentId;
    logger.info(`[Deprock IVR] Department selected: ${departmentId}`, undefined, 'DeprockIVR');

    const deptAgents = await db
      .select({
        departmentAgent: departmentAgents,
        agent: agents,
      })
      .from(departmentAgents)
      .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
      .where(eq(departmentAgents.departmentId, departmentId));

    if (!deptAgents || deptAgents.length === 0) {
      logger.info(`[Deprock IVR] No agents found for department ${departmentId}`, undefined, 'DeprockIVR');
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langSpeed)}<Hangup/></Response>`);
    }

    let bestAgent = deptAgents.find(da => da.departmentAgent.language === lang);
    if (!bestAgent) {
      bestAgent = deptAgents.find(da => da.departmentAgent.isPrimary);
    }
    if (!bestAgent) {
      bestAgent = deptAgents[0];
    }

    const agent = bestAgent.agent;

    let phoneRecord: any = null;
    if (config.phoneNumberId) {
      const [pr] = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, config.phoneNumberId))
        .limit(1);
      phoneRecord = pr;
    }

    if (!phoneRecord && To) {
      const normalizedTo = To.replace(/[\s\-\(\)]/g, '');
      const lookupNumber = normalizedTo.startsWith('+') ? normalizedTo : '+' + normalizedTo;
      const [pr] = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.phoneNumber, lookupNumber))
        .limit(1);
      phoneRecord = pr;
    }

    const callId = nanoid();
    const useOpenAIRealtime = isOpenAIRealtimeAgent(agent);

    const agentLanguage = lang || agent.language || 'en';
    const engineLabel = useOpenAIRealtime ? 'openai-realtime' : 'bedrock-polly';
    const callMetadata: Record<string, unknown> = {
      ivrId: config.id,
      departmentId,
      departmentAgentId: bestAgent.departmentAgent.id,
      language: agentLanguage,
      selectedOption: selectedOption.label,
      engine: engineLabel,
      ivrRouted: true,
      systemPrompt: agent.systemPrompt,
      firstMessage: agent.firstMessage,
      temperature: agent.temperature,
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      transferEnabled: agent.transferEnabled,
      transferPhoneNumber: agent.transferPhoneNumber,
      endConversationEnabled: agent.endConversationEnabled,
      detectLanguageEnabled: agent.detectLanguageEnabled,
      appointmentBookingEnabled: agent.appointmentBookingEnabled,
    };

    if (agent.type === 'flow' && agent.flowId) {
      try {
        const [flow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, agent.flowId))
          .limit(1);

        if (flow && flow.compiledSystemPrompt && flow.compiledTools) {
          callMetadata.isFlowAgent = true;
          callMetadata.flowId = flow.id;
          callMetadata.systemPrompt = flow.compiledSystemPrompt;
          callMetadata.firstMessage = flow.compiledFirstMessage || agent.firstMessage;
          callMetadata.compiledTools = flow.compiledTools;
        }
      } catch (flowErr: any) {
        logger.warn(`[Deprock IVR] Failed to load flow data: ${flowErr.message}`, undefined, 'DeprockIVR');
      }
    }

    if (agent.voiceProvider === 'elevenlabs' || (agent as any).ttsProvider === 'elevenlabs') {
      callMetadata.ttsProvider = 'elevenlabs';
      callMetadata.elevenLabsVoiceId = agent.elevenLabsVoiceId;
      callMetadata.elevenLabsApiKey = (agent as any).elevenLabsApiKey;
    }

    let openaiCredentialId: string | null = null;
    let agentVoice: string;
    let openaiModel: string;

    if (useOpenAIRealtime) {
      const credential = await OpenAIPoolService.reserveSlot();
      if (!credential) {
        logger.warn(`[Deprock IVR] No OpenAI capacity available, falling back to Bedrock+Polly for call ${callSid}`, undefined, 'DeprockIVR');
        agentVoice = agent.awsPollyVoiceId || langVoice || (agent.openaiVoice as any) || BEDROCK_POLLY_CONFIG.defaultVoice;
        openaiModel = BEDROCK_POLLY_CONFIG.defaultModel;
        callMetadata.engine = 'bedrock-polly';
        callMetadata.openaiRealtimeFallback = true;
      } else {
        openaiCredentialId = credential.id;
        agentVoice = mapPollyVoiceToOpenAI(agent.awsPollyVoiceId, agent.openaiVoice);
        openaiModel = TWILIO_OPENAI_CONFIG.openaiRealtimeModel;
        logger.info(`[Deprock IVR] OpenAI Realtime slot reserved (credential: ${credential.id}) for agent ${agent.id}`, undefined, 'DeprockIVR');
      }
    } else {
      agentVoice = agent.awsPollyVoiceId || langVoice || (agent.openaiVoice as any) || BEDROCK_POLLY_CONFIG.defaultVoice;
      openaiModel = BEDROCK_POLLY_CONFIG.defaultModel;
    }

    const actualEngine = callMetadata.engine as string;

    await db.insert(twilioOpenaiCalls).values({
      id: callId,
      userId: config.userId,
      agentId: agent.id,
      twilioPhoneNumberId: phoneRecord?.id || null,
      openaiCredentialId,
      twilioCallSid: callSid,
      fromNumber: caller,
      toNumber: To || phoneRecord?.phoneNumber || '',
      openaiVoice: agentVoice,
      openaiModel,
      status: 'in-progress',
      callDirection: 'inbound',
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: callMetadata,
    });

    logger.info(`[Deprock IVR] Call record created: ${callId}, agent: ${agent.id}, engine: ${actualEngine}, flow: ${callMetadata.isFlowAgent ? 'yes' : 'no'}, lang: ${agentLanguage}`, undefined, 'DeprockIVR');

    try {
      const twilioClient = await getTwilioClient();
      const recordingCallback = getRecordingWebhookUrl();
      await twilioClient.calls(callSid).recordings.create({
        recordingStatusCallback: recordingCallback,
        recordingStatusCallbackEvent: ['completed'],
        recordingChannels: 'dual',
      });
      logger.info(`[Deprock IVR] Recording started for IVR call ${callId}`, undefined, 'DeprockIVR');
    } catch (recordError: any) {
      logger.error(`[Deprock IVR] Failed to start recording for IVR call ${callId}`, recordError, 'DeprockIVR');
    }

    liveCallRegistry.registerCall({
      callId,
      userId: config.userId,
      twilioCallSid: callSid,
      direction: 'inbound',
      status: 'in-progress',
      fromNumber: caller,
      toNumber: To || phoneRecord?.phoneNumber || '',
      agentId: agent.id,
      agentName: agent.name || undefined,
      engine: actualEngine === 'openai-realtime' ? 'twilio-openai' : 'bedrock-polly',
      startedAt: new Date(),
      answeredAt: new Date(),
    });

    const baseUrl = buildBaseUrl();
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    let streamUrl: string;
    if (actualEngine === 'openai-realtime') {
      streamUrl = `${wsUrl}/api/twilio-openai/stream/${callSid}`;
      logger.info(`[Deprock IVR] Routing to OpenAI Realtime stream: ${streamUrl}`, undefined, 'DeprockIVR');
    } else {
      streamUrl = `${wsUrl}/api/bedrock-polly/stream/${callSid}`;
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayOrPlay(langVoice, template.holdMsg, ivrId, false, langSpeed)}
  <Connect>
    <Stream url="${escapeXml(streamUrl)}">
      <Parameter name="callId" value="${escapeXml(callId)}" />
      <Parameter name="agentId" value="${escapeXml(agent.id)}" />
    </Stream>
  </Connect>
</Response>`;

    res.type('text/xml');
    return res.send(twiml);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /handle-selection', error, 'DeprockIVR');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>`);
  }
});

router.post('/fallback', async (req: Request, res: Response) => {
  try {
    const ivrId = req.query.ivrId as string;
    const callSid = req.query.callSid as string || req.body.CallSid || '';
    const caller = req.query.caller as string || req.body.From || '';
    const lang = req.query.lang as string || 'en';

    logger.info(`[Deprock IVR] /fallback - ivrId=${ivrId}, callSid=${callSid}`, undefined, 'DeprockIVR');

    if (!ivrId) {
      const template = getTemplate(lang);
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(template.goodbyeMsg)}</Say><Hangup/></Response>`);
    }

    const [config] = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId),
        eq(ivrConfigurations.engineType, 'bedrock-polly')
      ))
      .limit(1);

    if (!config || !config.fallbackDepartmentId) {
      const voiceId = config?.voiceId || 'Joanna';
      const langOptions = config?.languageOptions as Array<{ language: string; speed?: number }> | null;
      const langOpt = langOptions?.find(l => l.language === lang);
      const fallbackSpeed = langOpt?.speed ?? 0.92;
      const template = getTemplate(lang);
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(voiceId, template.goodbyeMsg, ivrId, false, fallbackSpeed)}<Hangup/></Response>`);
    }

    const voiceId = config.voiceId || 'Joanna';
    const langOptions = config.languageOptions as Array<{ language: string; speed?: number }> | null;
    const langOpt = langOptions?.find(l => l.language === lang);
    const fallbackSpeed = langOpt?.speed ?? 0.92;
    const template = getTemplate(lang);

    const deptAgents = await db
      .select({
        departmentAgent: departmentAgents,
        agent: agents,
      })
      .from(departmentAgents)
      .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
      .where(eq(departmentAgents.departmentId, config.fallbackDepartmentId));

    if (!deptAgents || deptAgents.length === 0) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(voiceId, template.noAgentMsg, ivrId, false, fallbackSpeed)}<Hangup/></Response>`);
    }

    let bestAgent = deptAgents.find(da => da.departmentAgent.language === lang);
    if (!bestAgent) {
      bestAgent = deptAgents.find(da => da.departmentAgent.isPrimary);
    }
    if (!bestAgent) {
      bestAgent = deptAgents[0];
    }

    const agent = bestAgent.agent;

    let phoneRecord: any = null;
    if (config.phoneNumberId) {
      const [pr] = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, config.phoneNumberId))
        .limit(1);
      phoneRecord = pr;
    }

    const callId = nanoid();
    const useOpenAIRealtime = isOpenAIRealtimeAgent(agent);

    let fbOpenaiCredentialId: string | null = null;
    let fbAgentVoice: string;
    let fbOpenaiModel: string;
    let fbEngineLabel = useOpenAIRealtime ? 'openai-realtime' : 'bedrock-polly';

    if (useOpenAIRealtime) {
      const credential = await OpenAIPoolService.reserveSlot();
      if (!credential) {
        logger.warn(`[Deprock IVR] No OpenAI capacity for fallback, using Bedrock+Polly for call ${callSid}`, undefined, 'DeprockIVR');
        fbAgentVoice = agent.awsPollyVoiceId || (agent.openaiVoice as any) || BEDROCK_POLLY_CONFIG.defaultVoice;
        fbOpenaiModel = BEDROCK_POLLY_CONFIG.defaultModel;
        fbEngineLabel = 'bedrock-polly';
      } else {
        fbOpenaiCredentialId = credential.id;
        fbAgentVoice = mapPollyVoiceToOpenAI(agent.awsPollyVoiceId, agent.openaiVoice);
        fbOpenaiModel = TWILIO_OPENAI_CONFIG.openaiRealtimeModel;
        logger.info(`[Deprock IVR] OpenAI Realtime slot reserved for fallback (credential: ${credential.id})`, undefined, 'DeprockIVR');
      }
    } else {
      fbAgentVoice = (agent.openaiVoice as any) || BEDROCK_POLLY_CONFIG.defaultVoice;
      fbOpenaiModel = BEDROCK_POLLY_CONFIG.defaultModel;
    }

    const fbCallMetadata: Record<string, unknown> = {
      ivrId: config.id,
      departmentId: config.fallbackDepartmentId,
      isFallback: true,
      language: lang,
      engine: fbEngineLabel,
      ivrRouted: true,
      systemPrompt: agent.systemPrompt,
      firstMessage: agent.firstMessage,
      temperature: agent.temperature,
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      transferEnabled: agent.transferEnabled,
      transferPhoneNumber: agent.transferPhoneNumber,
      endConversationEnabled: agent.endConversationEnabled,
      detectLanguageEnabled: agent.detectLanguageEnabled,
      appointmentBookingEnabled: agent.appointmentBookingEnabled,
    };

    if (agent.type === 'flow' && agent.flowId) {
      try {
        const [flow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, agent.flowId))
          .limit(1);
        if (flow && flow.compiledSystemPrompt && flow.compiledTools) {
          fbCallMetadata.isFlowAgent = true;
          fbCallMetadata.flowId = flow.id;
          fbCallMetadata.systemPrompt = flow.compiledSystemPrompt;
          fbCallMetadata.firstMessage = flow.compiledFirstMessage || agent.firstMessage;
          fbCallMetadata.compiledTools = flow.compiledTools;
        }
      } catch (flowErr: any) {
        logger.warn(`[Deprock IVR] Failed to load flow data for fallback: ${flowErr.message}`, undefined, 'DeprockIVR');
      }
    }

    await db.insert(twilioOpenaiCalls).values({
      id: callId,
      userId: config.userId,
      agentId: agent.id,
      twilioPhoneNumberId: phoneRecord?.id || null,
      openaiCredentialId: fbOpenaiCredentialId,
      twilioCallSid: callSid,
      fromNumber: caller,
      toNumber: phoneRecord?.phoneNumber || '',
      openaiVoice: fbAgentVoice,
      openaiModel: fbOpenaiModel,
      status: 'in-progress',
      callDirection: 'inbound',
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: fbCallMetadata,
    });

    logger.info(`[Deprock IVR] Fallback call record created: ${callId}, agent: ${agent.id}, engine: ${fbEngineLabel}`, undefined, 'DeprockIVR');

    try {
      const twilioClient = await getTwilioClient();
      const recordingCallback = getRecordingWebhookUrl();
      await twilioClient.calls(callSid).recordings.create({
        recordingStatusCallback: recordingCallback,
        recordingStatusCallbackEvent: ['completed'],
        recordingChannels: 'dual',
      });
      logger.info(`[Deprock IVR] Recording started for fallback call ${callId}`, undefined, 'DeprockIVR');
    } catch (recordError: any) {
      logger.error(`[Deprock IVR] Failed to start recording for fallback call ${callId}`, recordError, 'DeprockIVR');
    }

    liveCallRegistry.registerCall({
      callId,
      userId: config.userId,
      twilioCallSid: callSid,
      direction: 'inbound',
      status: 'in-progress',
      fromNumber: caller,
      toNumber: phoneRecord?.phoneNumber || '',
      agentId: agent.id,
      agentName: agent.name || undefined,
      engine: fbEngineLabel === 'openai-realtime' ? 'twilio-openai' : 'bedrock-polly',
      startedAt: new Date(),
      answeredAt: new Date(),
    });

    const baseUrl = buildBaseUrl();
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    let fbStreamUrl: string;
    if (fbEngineLabel === 'openai-realtime') {
      fbStreamUrl = `${wsUrl}/api/twilio-openai/stream/${callSid}`;
      logger.info(`[Deprock IVR] Fallback routing to OpenAI Realtime stream`, undefined, 'DeprockIVR');
    } else {
      fbStreamUrl = `${wsUrl}/api/bedrock-polly/stream/${callSid}`;
    }

    const fbLangOpt = langOptions?.find(l => l.language === lang);
    const langVoice = fbLangOpt?.voiceId || voiceId;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayOrPlay(langVoice, template.holdMsg, ivrId, false, fallbackSpeed)}
  <Connect>
    <Stream url="${escapeXml(fbStreamUrl)}">
      <Parameter name="callId" value="${escapeXml(callId)}" />
      <Parameter name="agentId" value="${escapeXml(agent.id)}" />
    </Stream>
  </Connect>
</Response>`;

    res.type('text/xml');
    return res.send(twiml);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /fallback', error, 'DeprockIVR');
    const template = getTemplate('en');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(template.goodbyeMsg)}</Say><Hangup/></Response>`);
  }
});

export const deprockIvrRouter = router;
