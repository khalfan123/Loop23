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
import { OpenAIPoolService } from '../../../services/openai-pool.service';
import { TWILIO_OPENAI_CONFIG } from '../../twilio-openai/config/twilio-openai-config';
import { liveCallRegistry } from '../../../services/live-call-registry';
import { ElevenLabsService } from '../../../services/elevenlabs';
import { webhookDeliveryService } from '../../../services/webhook-delivery';
import { normalizePhoneForStorage } from '../../../utils/phone-e164';

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
  // Prefer Gulf-friendly everyday forms to improve TTS pronunciation for IVR prompts.
  ar: ['صفر', 'واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'],
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

const ARABIC_INDIC_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'] as const;

function getNumberWord(lang: string, digit: number): string {
  const words = NUMBER_WORDS[lang] || NUMBER_WORDS['en'];
  // For Arabic, include both the digit and the spoken word to reduce mispronunciation.
  if (lang === 'ar' && digit >= 0 && digit <= 9) {
    const d = ARABIC_INDIC_DIGITS[digit] || String(digit);
    const w = words[digit] || String(digit);
    return `${d} (${w})`;
  }
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

function isRawElevenLabsId(voiceId: string): boolean {
  return /^[a-zA-Z0-9]{10,30}$/.test(voiceId) && !KNOWN_POLLY_VOICES_EARLY.has(voiceId);
}

function resolveElevenLabsVoiceId(voiceId: string): string | null {
  if (isElevenLabsVoice(voiceId)) return EL_ALIAS_TO_REAL_ID[voiceId] || null;
  if (isRawElevenLabsId(voiceId)) return voiceId;
  return null;
}

function isCartesiaVoiceForIvr(voiceId: string): boolean {
  if (voiceId.startsWith('cartesia_')) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voiceId)) return true;
  return false;
}

const KNOWN_POLLY_VOICES_EARLY = new Set([
  'Hala', 'Zayd', 'Zeina', 'Lucia', 'Lupe', 'Penelope', 'Pedro', 'Miguel', 'Mia',
  'Lea', 'Remi', 'Mathieu', 'Celine', 'Bianca', 'Adriano', 'Giorgio', 'Carla',
  'Vicki', 'Hans', 'Marlene', 'Daniel', 'Zhiyu', 'Kajal', 'Takumi', 'Mizuki',
  'Kazuha', 'Tomoko', 'Seoyeon', 'Jihye', 'Camila', 'Vitoria', 'Thiago', 'Ines',
  'Ruben', 'Laura', 'Lotte', 'Ola', 'Jacek', 'Ewa', 'Maja', 'Elin', 'Astrid',
  'Ida', 'Liv', 'Suvi', 'Filiz', 'Burcu', 'Arlet', 'Jitka', 'Sabrina', 'Jasmine',
  'Hiujin', 'Sofie', 'Hannah', 'Isabelle', 'Lisa', 'Gabrielle', 'Liam',
  'Sergio', 'Andres', 'Joanna', 'Matthew', 'Salli', 'Kimberly', 'Kendra',
  'Joey', 'Justin', 'Ivy', 'Amy', 'Brian', 'Emma', 'Nicole', 'Russell',
  'Ruth', 'Stephen', 'Gregory', 'Danielle',
]);

const EL_TO_POLLY_MAP: Record<string, string> = {
  el_rachel: 'Joanna', el_domi: 'Joanna', el_bella: 'Joanna', el_nicole: 'Joanna',
  el_antoni: 'Matthew', el_josh: 'Matthew', el_arnold: 'Matthew', el_adam: 'Matthew', el_sam: 'Matthew',
  el_marie: 'Lea', el_pierre: 'Remi',
  el_giulia: 'Bianca', el_marco: 'Adriano',
  el_xiaoli: 'Zhiyu', el_wei: 'Zhiyu',
  el_priya: 'Kajal', el_raj: 'Kajal',
  el_fatima: 'Hala', el_omar: 'Zayd',
};

const EL_ALIAS_TO_REAL_ID: Record<string, string> = {
  el_rachel: '21m00Tcm4TlvDq8ikWAM', el_domi: 'AZnzlk1XvdvUeBnXmlld',
  el_bella: 'EXAVITQu4vr4xnSDxMaL', el_antoni: 'ErXwobaYiN019PkySvjV',
  el_elli: 'MF3mGyEYCl7XYWbV9V6O', el_josh: 'TxGEqnHWrfWFTfGW9XjX',
  el_arnold: 'VR6AewLTigWG4xSOukaG', el_adam: 'pNInz6obpgDQGcFmaJgB',
  el_sam: 'yoZ06aMxZJJ28mfd3POQ', el_nicole: 'piTKgcLEGmPE4e6mEKli',
  el_marie: '6vTyAgAT8PncODBcLjRf', el_pierre: 'aQROLel5sQbj1vuIVi6B',
  el_giulia: 'gfKKsLN1k0oYYN9n2dXX', el_marco: 'W71zT1VwIFFx3mMGH2uZ',
  el_xiaoli: 'ByhETIclHirOlWnWKhHc', el_wei: '4VZIsMPtgggwNg7OXbPY',
  el_priya: 'KYiVPerWcenyBTIvWbfY', el_raj: 'zT03pEAEi0VHKciJODfn',
  el_fatima: 'u0TsaWvt0v8migutHM3M', el_omar: 'G1HOkzin3NMwRHSq60UI',
};

function safePollyVoiceId(voiceId: string): string {
  if (isElevenLabsVoice(voiceId)) return EL_TO_POLLY_MAP[voiceId] || 'Joanna';
  if (['alloy','echo','fable','onyx','nova','shimmer'].includes(voiceId)) return 'Joanna';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voiceId)) return 'Joanna';
  if (voiceId.startsWith('cartesia_')) return 'Joanna';
  if (!KNOWN_POLLY_VOICES.has(voiceId)) return 'Joanna';
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

const KNOWN_POLLY_VOICES = new Set([
  ...Object.keys(POLLY_VOICE_LANGUAGE),
  'Joanna', 'Matthew', 'Salli', 'Kimberly', 'Kendra', 'Joey', 'Justin', 'Ivy',
  'Amy', 'Brian', 'Emma', 'Nicole', 'Russell', 'Ruth', 'Stephen', 'Gregory', 'Danielle',
]);

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

function getIvrPollyFallbackVoice(language: string): string {
  const lang = (language || 'en').toLowerCase();
  if (lang === 'ar') return 'Hala';
  if (lang === 'hi') return 'Kajal';
  if (lang === 'zh') return 'Zhiyu';
  if (lang === 'es') return 'Lupe';
  if (lang === 'fr') return 'Lea';
  if (lang === 'de') return 'Vicki';
  if (lang === 'it') return 'Bianca';
  if (lang === 'pt') return 'Camila';
  return 'Joanna';
}

/**
 * IVR audio must be immediate/reliable. ElevenLabs can add seconds of latency per prompt
 * (and can fail transiently), so we always use Polly for IVR prompts and reserve ElevenLabs
 * for the live agent TTS in the media stream.
 */
function sayOrPlay(
  voiceId: string,
  text: string,
  _ivrId: string,
  addBreakAfter: boolean = false,
  speed: number = 0.92,
  language: string = 'en'
): string {
  // Support BOTH:
  // - Polly voices (fast/reliable) by default
  // - ElevenLabs voices when IVR config uses el_* or a raw ElevenLabs voice id
  const elevenVoice = resolveElevenLabsVoiceId(voiceId);
  if (elevenVoice && process.env.ELEVENLABS_API_KEY) {
    const baseUrl = buildBaseUrl();
    const q = new URLSearchParams({
      provider: 'elevenlabs',
      voiceId: elevenVoice,
      text,
      speed: String(speed || 1.0),
      // cache-bust whenever voice/text/speed changes (so IVR updates reflect immediately)
      v: `${elevenVoice}:${speed}:${text.length}`,
    });
    return `<Play>${escapeXml(`${baseUrl}/api/deprock/ivr/tts-audio?${q.toString()}`)}</Play>`;
  }

  // Fallback to Polly (including mapping el_* to a language-appropriate Polly voice).
  if (isElevenLabsVoice(voiceId) || isRawElevenLabsId(voiceId)) {
    const pollyVoice = getIvrPollyFallbackVoice(language);
    return sayWithPolly(pollyVoice, text);
  }
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

router.get('/tts-audio', async (req: Request, res: Response) => {
  try {
    const voiceId = req.query.voiceId as string;
    const provider = req.query.provider as string;
    const text = req.query.text as string;
    const speed = parseFloat(req.query.speed as string) || 1.0;

    if (!voiceId || !text || !provider) {
      return res.status(400).send('Missing required parameters');
    }

    if (provider === 'cartesia') {
      return res.status(400).send('Cartesia Sonic has been deprecated and removed');
    } else if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).send('ElevenLabs not configured');
      }
      const elevenLabsService = new ElevenLabsService(apiKey);
      const audioBuffer = await elevenLabsService.generateVoicePreview({
        voiceId,
        text,
        voiceSettings: { speed },
      });
      res.setHeader('Content-Type', 'audio/mpeg');
      // Cache-busting is done via the `v` query param in TwiML generation.
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(audioBuffer);
    }

    return res.status(400).send('Unknown provider');
  } catch (error: any) {
    logger.error(`[IVR TTS Audio] Error generating audio: ${error.message}`, error, 'DeprockIVR');
    return res.status(500).send('Audio generation failed');
  }
});

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

    if (config.userId) {
      try {
        await webhookDeliveryService.triggerEvent(config.userId, 'ivr.started', {
          callSid: CallSid || null,
          ivrId: config.id,
          ivrName: config.name || null,
          fromNumber: normalizePhoneForStorage(From || ''),
          toNumber: To ? normalizePhoneForStorage(To) : null,
          phoneNumberId: config.phoneNumberId,
          ivrEngine: 'bedrock-polly',
          engine: 'deprock-ivr',
        });
      } catch (e) {
        logger.error(`[Deprock IVR] ivr.started webhook failed: ${(e as Error).message}`, e, 'DeprockIVR');
      }
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
      // DTMF-only + no barge-in to prevent accidental auto-selection from noise/speech.
      twiml += `<Gather input="dtmf" bargeIn="false" timeout="10" numDigits="1" hints="${langHints}" action="${escapeXml(actionUrl)}" method="POST">`;

      // If greetingMessage already contains the department menu (e.g. "For Sales, press 1…"),
      // playing it AND enumerating languages sounds duplicated. In that case, skip the greeting
      // and only enumerate languages.
      const greetingRaw = (config.greetingMessage || '').trim();
      const greetingLooksLikeMenu = /press\s*\d|اضغط|appuyez/i.test(greetingRaw);
      if (greetingLooksLikeMenu) {
        // Option B: greet exactly as configured (single source of truth).
        // Do NOT enumerate language options again.
        twiml += sayOrPlay(voiceId, greetingRaw || getTemplate('en').greeting, ivrId, false, defaultSpeed, 'en');
      } else {
        twiml += sayOrPlay(voiceId, greetingRaw || getTemplate('en').greeting, ivrId, false, defaultSpeed, 'en');
        langOptions.forEach((opt, index) => {
          const digit = index + 1;
          const langTemplate = getTemplate(opt.language);
          const langVoice = opt.voiceId || voiceId;
          const langName = LANGUAGE_NAMES[opt.language] || opt.language;
          const isLast = index === langOptions.length - 1;
          const langSpeed = opt.speed ?? defaultSpeed;
          twiml += sayOrPlay(
            langVoice,
            `${langName}, ${langTemplate.pressKey} ${getNumberWord(opt.language, digit)}`,
            ivrId,
            !isLast,
            langSpeed,
            opt.language
          );
        });
        twiml += sayOrPlay(voiceId, getTemplate('en').repeatMsg, ivrId, false, defaultSpeed, 'en');
      }

      twiml += `</Gather>`;

      const template = getTemplate('en');
      const retryUrl = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=${attempt + 1}`;
      twiml += sayOrPlay(voiceId, template.stillThereMsg, ivrId, false, defaultSpeed, 'en');
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
      // DTMF-only + no barge-in to prevent accidental auto-selection from noise/speech.
      twiml += `<Gather input="dtmf" bargeIn="false" timeout="10" numDigits="1" hints="${menuHints}" action="${escapeXml(actionUrl)}" method="POST">`;

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
      twiml += sayOrPlay(voiceId, template.invalidMsg, ivrId, false, defaultSpeed, 'en');
      const retryHints = langOptions.map((_, i) => String(i + 1)).join(' ') + ' 0';
      twiml += `<Gather input="dtmf" bargeIn="false" timeout="10" numDigits="1" hints="${retryHints}" action="${escapeXml(retryUrl)}" method="POST">`;
      langOptions.forEach((opt, index) => {
        const digit = index + 1;
        const langTemplate = getTemplate(opt.language);
        const langVoice = opt.voiceId || voiceId;
        const langName = LANGUAGE_NAMES[opt.language] || opt.language;
        const isLast = index === langOptions.length - 1;
        const langSpeed = opt.speed ?? defaultSpeed;
        twiml += sayOrPlay(langVoice, `${langName}, ${langTemplate.pressKey} ${getNumberWord(opt.language, digit)}`, ivrId, !isLast, langSpeed, opt.language);
      });
      twiml += sayOrPlay(voiceId, template.repeatMsg, ivrId, false, defaultSpeed, 'en');
      twiml += `</Gather>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    const lang = selectedLang.language;
    const langVoice = selectedLang.voiceId || voiceId;
    const langSpeed = selectedLang.speed ?? defaultSpeed;
    const template = getTemplate(lang);

    if (config.userId) {
      try {
        await webhookDeliveryService.triggerEvent(config.userId, 'ivr.language_selected', {
          callSid,
          ivrId: config.id,
          language: lang,
          languageOptionId: selectedLang.id,
          fromNumber: normalizePhoneForStorage(caller || ''),
          toNumber: req.body.To ? normalizePhoneForStorage(String(req.body.To)) : null,
          phoneNumberId: config.phoneNumberId,
          ivrEngine: 'bedrock-polly',
          engine: 'deprock-ivr',
        });
      } catch (e) {
        logger.error(`[Deprock IVR] ivr.language_selected webhook failed: ${(e as Error).message}`, e, 'DeprockIVR');
      }
    }

    let menuOpts = config.menuOptions as Array<{ key: string; label: string; departmentId: string }> | null;

    if (selectedLang.selectedDepartments && selectedLang.selectedDepartments.length > 0 && menuOpts) {
      const filtered = menuOpts.filter(opt => selectedLang.selectedDepartments!.includes(opt.departmentId));
      if (filtered.length > 0) {
        menuOpts = filtered;
      }
    }

    if (!menuOpts || menuOpts.length === 0) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langSpeed, lang)}<Hangup/></Response>`);
    }

    const baseUrl = buildBaseUrl();
    const actionUrl = `${baseUrl}/api/deprock/ivr/handle-selection?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&lang=${encodeURIComponent(lang)}&attempt=1`;

    let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
    const deptHints = menuOpts.map(opt => opt.key).join(' ') + ' 0';
    twiml += `<Gather input="dtmf" bargeIn="false" timeout="10" numDigits="1" hints="${deptHints}" action="${escapeXml(actionUrl)}" method="POST">`;

    if (selectedLang.greeting) {
      twiml += sayOrPlay(langVoice, selectedLang.greeting, ivrId, false, langSpeed, lang);
    } else {
      twiml += sayOrPlay(langVoice, template.greeting, ivrId, false, langSpeed, lang);
      menuOpts.forEach((opt, index) => {
        const digit = parseInt(opt.key, 10);
        const numberWord = getNumberWord(lang, digit);
        const isLast = index === menuOpts!.length - 1;
        twiml += sayOrPlay(langVoice, `${template.pressKey} ${numberWord}, ${opt.label}`, ivrId, !isLast, langSpeed, lang);
      });
    }
    twiml += sayOrPlay(langVoice, template.repeatMsg, ivrId, false, langSpeed, lang);

    twiml += `</Gather>`;

    const retryUrl2 = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=${attempt + 1}`;
    twiml += sayOrPlay(langVoice, template.stillThereMsg, ivrId, false, langSpeed, lang);
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
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langSpeed, lang)}<Hangup/></Response>`);
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
      twiml += sayOrPlay(langVoice, template.invalidMsg, ivrId, false, langSpeed, lang);
      const selRetryHints = menuOpts.map(opt => opt.key).join(' ') + ' 0';
      twiml += `<Gather input="dtmf" bargeIn="false" timeout="10" numDigits="1" hints="${selRetryHints}" action="${escapeXml(retryUrl)}" method="POST">`;
      menuOpts.forEach((opt, index) => {
        const digit = parseInt(opt.key, 10);
        const numberWord = getNumberWord(lang, digit);
        const isLast = index === menuOpts!.length - 1;
        twiml += sayOrPlay(langVoice, `${template.pressKey} ${numberWord}, ${opt.label}`, ivrId, !isLast, langSpeed, lang);
      });
      twiml += sayOrPlay(langVoice, template.repeatMsg, ivrId, false, langSpeed, lang);
      twiml += `</Gather>`;
      twiml += `</Response>`;

      res.type('text/xml');
      return res.send(twiml);
    }

    const departmentId = selectedOption.departmentId;
    logger.info(`[Deprock IVR] Department selected: ${departmentId}`, undefined, 'DeprockIVR');

    if (config.userId) {
      try {
        await webhookDeliveryService.triggerEvent(config.userId, 'ivr.option_selected', {
          callSid,
          ivrId: config.id,
          departmentId: selectedOption.departmentId,
          departmentLabel: selectedOption.label,
          dtmf: String(Digits || ''),
          language: lang,
          fromNumber: normalizePhoneForStorage(caller || ''),
          toNumber: To ? normalizePhoneForStorage(String(To)) : null,
          phoneNumberId: config.phoneNumberId,
          ivrEngine: 'bedrock-polly',
          engine: 'deprock-ivr',
        });
      } catch (e) {
        logger.error(`[Deprock IVR] ivr.option_selected webhook failed: ${(e as Error).message}`, e, 'DeprockIVR');
      }
    }

    const baseUrl = buildBaseUrl();
    const connectUrl = `${baseUrl}/api/deprock/ivr/connect-agent?ivrId=${encodeURIComponent(ivrId)}&callSid=${encodeURIComponent(callSid)}&caller=${encodeURIComponent(caller)}&lang=${encodeURIComponent(lang)}&departmentId=${encodeURIComponent(departmentId)}&optionLabel=${encodeURIComponent(selectedOption.label)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayOrPlay(langVoice, template.holdMsg, ivrId, false, langSpeed, lang)}
  <Redirect method="POST">${escapeXml(connectUrl)}</Redirect>
</Response>`;

    res.type('text/xml');
    return res.send(twiml);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /handle-selection', error, 'DeprockIVR');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>`);
  }
});

router.post('/connect-agent', async (req: Request, res: Response) => {
  try {
    const { CallSid: bodyCallSid, From: bodyFrom, To } = req.body;
    const ivrId = req.query.ivrId as string;
    const callSid = req.query.callSid as string || bodyCallSid || '';
    const caller = req.query.caller as string || bodyFrom || '';
    const lang = req.query.lang as string || 'en';
    const departmentId = req.query.departmentId as string;
    const optionLabel = req.query.optionLabel as string || '';

    logger.info(`[Deprock IVR] /connect-agent - ivrId=${ivrId}, dept=${departmentId}, lang=${lang}, callSid=${callSid}`, undefined, 'DeprockIVR');

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
    const template = getTemplate(lang);

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
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(langVoice, template.noAgentMsg, ivrId, false, langOption?.speed ?? 0.92, lang)}<Hangup/></Response>`);
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
    // Recommendation: Route live conversations through OpenAI Realtime for <1s voice start.
    // If capacity is unavailable, fall back to Bedrock+Polly.
    const useOpenAIRealtime = true;

    // IVR-selected language is authoritative for this call.
    const selectedLanguage = (lang || 'en').toLowerCase();
    const engineLabel = useOpenAIRealtime ? 'openai-realtime' : 'bedrock-polly';
    const arabicInText = (text?: string | null) => !!text && /[\u0600-\u06FF]/.test(text);
    const englishFallbackGreeting = 'Hello, thank you for calling. How can I help you today?';
    const resolvedFirstMessage =
      selectedLanguage === 'ar'
        ? 'مرحبتين وسهلا، كيف أقدر أساعدك اليوم؟'
        : arabicInText(agent.firstMessage)
          ? englishFallbackGreeting
          : (agent.firstMessage || englishFallbackGreeting);
    const callMetadata: Record<string, unknown> = {
      ivrId: config.id,
      departmentId,
      departmentAgentId: bestAgent.departmentAgent.id,
      language: selectedLanguage,
      // If caller chose a language in IVR, do not auto-switch mid-call.
      languageLocked: true,
      languageLockMode: 'ivr',
      selectedOption: optionLabel,
      engine: engineLabel,
      ivrRouted: true,
      systemPrompt: agent.systemPrompt,
      // Avoid Arabic greeting when caller selected English (or another non-Arabic language).
      firstMessage: resolvedFirstMessage,
      temperature: agent.temperature,
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      transferEnabled: agent.transferEnabled,
      transferPhoneNumber: agent.transferPhoneNumber,
      endConversationEnabled: agent.endConversationEnabled,
      // Language detection can cause unwanted switching even when IVR already selected a language.
      detectLanguageEnabled: false,
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
          const flowFirst = flow.compiledFirstMessage || agent.firstMessage;
          callMetadata.firstMessage =
            selectedLanguage === 'ar'
              ? (arabicInText(flowFirst) ? flowFirst : 'مرحبتين وسهلا، كيف أقدر أساعدك اليوم؟')
              : arabicInText(flowFirst)
                ? englishFallbackGreeting
                : (flowFirst || englishFallbackGreeting);
          callMetadata.compiledTools = flow.compiledTools;
        }
      } catch (flowErr: any) {
        logger.warn(`[Deprock IVR] Failed to load flow data: ${flowErr.message}`, undefined, 'DeprockIVR');
      }
    }

    if (agent.voiceProvider === 'cartesia' || (agent as any).ttsProvider === 'cartesia') {
      res.type('text/xml');
      const msg =
        lang === 'ar'
          ? 'عذراً، هذا الوكيل مُهيأ بصوت غير مدعوم حالياً. يرجى تحديث إعدادات الوكيل ثم المحاولة مرة أخرى.'
          : 'Sorry, this agent is configured with an unsupported voice provider. Please update the agent settings and try again.';
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayWithPolly(langVoice || 'Joanna', msg)}<Hangup/></Response>`);
    } else if (agent.voiceProvider === 'elevenlabs' || (agent as any).ttsProvider === 'elevenlabs') {
      callMetadata.ttsProvider = 'elevenlabs';
      callMetadata.elevenLabsVoiceId = agent.elevenLabsVoiceId;
      callMetadata.elevenLabsApiKey = (agent as any).elevenLabsApiKey;
    }

    let openaiCredentialId: string | null = null;
    let agentVoice: string;
    let openaiModel: string;

    const credential = await OpenAIPoolService.reserveSlot();
    // Department agents often store ElevenLabs aliases (el_fatima, el_rachel, …) in
    // openai_voice. GA Realtime rejects those → silent agent after IVR. Map now.
    const { OpenAIAgentFactory } = await import('../../twilio-openai/services/openai-agent-factory');
    if (!credential) {
      // IMPORTANT: We still route to OpenAI Realtime, using env-key fallback in the stream handler.
      // Pool capacity is an optimization, not a hard requirement for inbound calls.
      logger.warn(
        `[Deprock IVR] OpenAI pool at capacity; using env-key fallback for call ${callSid}`,
        undefined,
        'DeprockIVR'
      );
      openaiCredentialId = null;
      agentVoice = OpenAIAgentFactory.validateVoice(
        (agent.openaiVoice as string) || TWILIO_OPENAI_CONFIG.defaultVoice
      );
      openaiModel = TWILIO_OPENAI_CONFIG.openaiRealtimeModel;
      callMetadata.engine = 'openai-realtime';
      callMetadata.openaiRealtimeEnvFallback = true;
    } else {
      openaiCredentialId = credential.id;
      agentVoice = OpenAIAgentFactory.validateVoice(
        (agent.openaiVoice as string) || TWILIO_OPENAI_CONFIG.defaultVoice
      );
      openaiModel = TWILIO_OPENAI_CONFIG.openaiRealtimeModel;
      callMetadata.engine = 'openai-realtime';
      logger.info(
        `[Deprock IVR] OpenAI Realtime slot reserved (credential: ${credential.id}) for agent ${agent.id}`,
        undefined,
        'DeprockIVR'
      );
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

    logger.info(`[Deprock IVR] Call record created: ${callId}, agent: ${agent.id}, engine: ${actualEngine}, flow: ${callMetadata.isFlowAgent ? 'yes' : 'no'}, lang: ${selectedLanguage}`, undefined, 'DeprockIVR');

    const recordingPromise = (async () => {
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
    })();

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
    // Twilio <Stream> should use wss://. If the app is misconfigured to an http:// domain,
    // we still emit a best-effort ws:// URL for local/dev debugging (Twilio will generally
    // require TLS in production).
    const wsUrl = baseUrl.startsWith('https://')
      ? baseUrl.replace('https://', 'wss://')
      : baseUrl.replace('http://', 'ws://');

    let streamUrl: string;
    if (actualEngine === 'openai-realtime') {
      streamUrl = `${wsUrl}/api/twilio-openai/stream/${callSid}`;
      logger.info(`[Deprock IVR] Routing to OpenAI Realtime stream: ${streamUrl}`, undefined, 'DeprockIVR');
    } else {
      streamUrl = `${wsUrl}/api/bedrock-polly/stream/${callSid}`;
    }

    recordingPromise.catch(() => {});

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" statusCallback="${escapeXml(`${baseUrl}/api/deprock/ivr/stream-status?callSid=${encodeURIComponent(callSid)}&engine=${encodeURIComponent(actualEngine)}`)}" statusCallbackMethod="POST">
      <Parameter name="callId" value="${escapeXml(callId)}" />
      <Parameter name="agentId" value="${escapeXml(agent.id)}" />
    </Stream>
  </Connect>
</Response>`;

    res.type('text/xml');
    return res.send(twiml);

  } catch (error: any) {
    logger.error('[Deprock IVR] Error in /connect-agent', error, 'DeprockIVR');
    try {
      // Persist a breadcrumb so we can debug "connect then error occurred" reports.
      await callErrorLogger.logCallError({
        callId: (req.query.callSid as string) || (req.body?.CallSid as string) || 'unknown',
        engineType: 'ivr',
        errorCategory: 'ivr_connect_agent_failed',
        severity: 'error',
        message: error?.message || 'connect-agent failed',
        metadata: {
          ivrId: req.query.ivrId,
          departmentId: req.query.departmentId,
          lang: req.query.lang,
        },
      });
    } catch {}
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>`);
  }
});

// Twilio <Stream> status callbacks: useful when Twilio can't open the WebSocket (no upgrade logs).
router.post('/stream-status', async (req: Request, res: Response) => {
  try {
    const callSid = (req.query.callSid as string) || (req.body?.CallSid as string) || '';
    const engine = (req.query.engine as string) || '';
    // Twilio sends fields like StreamSid, StreamEvent, Timestamp, etc.
    await callErrorLogger.logCallError({
      engineType: 'twilio-openai',
      errorCategory: 'stream_init',
      severity: 'info',
      message: 'twilio_stream_status',
      metadata: {
        callSid,
        engine,
        body: req.body ?? null,
      },
    });
  } catch {
    // ignore
  }
  res.sendStatus(204);
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
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(voiceId, template.goodbyeMsg, ivrId, false, fallbackSpeed, lang)}<Hangup/></Response>`);
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
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${sayOrPlay(voiceId, template.noAgentMsg, ivrId, false, fallbackSpeed, lang)}<Hangup/></Response>`);
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
    const useOpenAIRealtime = true;

    let fbOpenaiCredentialId: string | null = null;
    let fbAgentVoice: string;
    let fbOpenaiModel: string;
    let fbEngineLabel = useOpenAIRealtime ? 'openai-realtime' : 'bedrock-polly';

    const credential = await OpenAIPoolService.reserveSlot();
    const { OpenAIAgentFactory } = await import('../../twilio-openai/services/openai-agent-factory');
    if (!credential) {
      logger.warn(`[Deprock IVR] No OpenAI capacity for fallback, using Bedrock+Polly for call ${callSid}`, undefined, 'DeprockIVR');
      fbAgentVoice = safePollyVoiceId(agent.awsPollyVoiceId || BEDROCK_POLLY_CONFIG.defaultVoice);
      fbOpenaiModel = BEDROCK_POLLY_CONFIG.defaultModel;
      fbEngineLabel = 'bedrock-polly';
    } else {
      fbOpenaiCredentialId = credential.id;
      fbAgentVoice = OpenAIAgentFactory.validateVoice(
        (agent.openaiVoice as string) || TWILIO_OPENAI_CONFIG.defaultVoice
      );
      fbOpenaiModel = TWILIO_OPENAI_CONFIG.openaiRealtimeModel;
      fbEngineLabel = 'openai-realtime';
      logger.info(`[Deprock IVR] OpenAI Realtime slot reserved for fallback (credential: ${credential.id})`, undefined, 'DeprockIVR');
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
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'wss://');

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
  ${sayOrPlay(langVoice, template.holdMsg, ivrId, false, fallbackSpeed, lang)}
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
