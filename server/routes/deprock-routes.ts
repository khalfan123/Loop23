import { Router, Request, Response } from "express";
import { db } from "../db";
import { departments, departmentAgents, ivrConfigurations, departmentKnowledgeBases, agents, phoneNumbers, flows, incomingConnections, humanIncomingConnections, knowledgeBase, agentNames } from "@shared/schema";
import type { FlowNode, FlowEdge } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { insertDepartmentSchema, insertIvrConfigurationSchema } from "@shared/schema";
import { twilioService } from "../services/twilio";
import { getDomain } from "../utils/domain";
import { awsPollyService } from "../services/aws-polly";
import { awsBedrockService } from "../services/aws-bedrock";
import { ElevenLabsService } from "../services/elevenlabs";
import { cartesiaTTSService } from "../services/cartesia-tts";
import { nanoid } from "nanoid";
import { getOpenAIClient } from "../services/openai-modelfarm";
import { generateAgentAvatar } from "../services/avatar-generator";
import { deprockIvrRouter } from "../engines/twilio-bedrock-polly/routes/ivr-webhooks";
import { applyArabicPronunciationFixes } from "../engines/twilio-bedrock-polly/services/ssml-humanizer";

interface AuthRequest extends Request {
  userId?: string;
}

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", zh: "Chinese", hi: "Hindi", ar: "Arabic", ja: "Japanese",
  ko: "Korean", nl: "Dutch", pl: "Polish", sv: "Swedish", no: "Norwegian",
  fi: "Finnish", da: "Danish", tr: "Turkish",
};

function getDepartmentType(name: string): "sales" | "support" | "scheduling" | "custom" {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("sales") || lowerName.includes("vente")) return "sales";
  if (lowerName.includes("support") || lowerName.includes("help") || lowerName.includes("assistance")) return "support";
  if (lowerName.includes("schedule") || lowerName.includes("appointment") || lowerName.includes("booking") || lowerName.includes("rendez-vous")) return "scheduling";
  return "custom";
}

function generateDefaultFlowNodes(departmentName: string, agentName: string = "your AI assistant", language: string = "en"): { nodes: FlowNode[], edges: FlowEdge[] } {
  const deptType = getDepartmentType(departmentName);
  
  const greetingsByLanguage: Record<string, Record<string, string>> = {
    en: {
      sales: `Hello! I'm ${agentName}. Thank you for calling our sales department. How can I help you today?`,
      support: `Hello! I'm ${agentName}. Thank you for reaching our support team. How may I assist you?`,
      scheduling: `Hello! I'm ${agentName}. Thank you for calling. I can help you schedule an appointment. What day works best for you?`,
      custom: `Hello! Thank you for calling ${departmentName}. I'm ${agentName}. How can I assist you today?`,
    },
    ar: {
      sales: `مرحباً! أنا ${agentName}. شكراً لاتصالك بقسم المبيعات. كيف يمكنني مساعدتك اليوم؟`,
      support: `مرحباً! أنا ${agentName}. شكراً لتواصلك مع فريق الدعم. كيف يمكنني مساعدتك؟`,
      scheduling: `مرحباً! أنا ${agentName}. شكراً لاتصالك. يمكنني مساعدتك في حجز موعد. ما هو اليوم المناسب لك؟`,
      custom: `مرحباً! شكراً لاتصالك بـ ${departmentName}. أنا ${agentName}. كيف يمكنني مساعدتك اليوم؟`,
    },
    es: {
      sales: `¡Hola! Soy ${agentName}. Gracias por llamar a nuestro departamento de ventas. ¿Cómo puedo ayudarle hoy?`,
      support: `¡Hola! Soy ${agentName}. Gracias por contactar con nuestro equipo de soporte. ¿En qué puedo ayudarle?`,
      scheduling: `¡Hola! Soy ${agentName}. Gracias por llamar. Puedo ayudarle a programar una cita. ¿Qué día le viene mejor?`,
      custom: `¡Hola! Gracias por llamar a ${departmentName}. Soy ${agentName}. ¿Cómo puedo ayudarle hoy?`,
    },
    fr: {
      sales: `Bonjour ! Je suis ${agentName}. Merci d'avoir appelé notre service commercial. Comment puis-je vous aider aujourd'hui ?`,
      support: `Bonjour ! Je suis ${agentName}. Merci d'avoir contacté notre équipe d'assistance. Comment puis-je vous aider ?`,
      scheduling: `Bonjour ! Je suis ${agentName}. Merci d'avoir appelé. Je peux vous aider à prendre rendez-vous. Quel jour vous convient ?`,
      custom: `Bonjour ! Merci d'avoir appelé ${departmentName}. Je suis ${agentName}. Comment puis-je vous aider aujourd'hui ?`,
    },
    de: {
      sales: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihren Anruf bei unserer Verkaufsabteilung. Wie kann ich Ihnen heute helfen?`,
      support: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihre Kontaktaufnahme mit unserem Support-Team. Wie kann ich Ihnen helfen?`,
      scheduling: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihren Anruf. Ich kann Ihnen bei der Terminvereinbarung helfen. Welcher Tag passt Ihnen am besten?`,
      custom: `Hallo! Vielen Dank für Ihren Anruf bei ${departmentName}. Ich bin ${agentName}. Wie kann ich Ihnen heute helfen?`,
    },
    it: {
      sales: `Ciao! Sono ${agentName}. Grazie per aver chiamato il nostro reparto vendite. Come posso aiutarla oggi?`,
      support: `Ciao! Sono ${agentName}. Grazie per aver contattato il nostro team di supporto. Come posso aiutarla?`,
      scheduling: `Ciao! Sono ${agentName}. Grazie per aver chiamato. Posso aiutarla a fissare un appuntamento. Quale giorno le va bene?`,
      custom: `Ciao! Grazie per aver chiamato ${departmentName}. Sono ${agentName}. Come posso aiutarla oggi?`,
    },
    pt: {
      sales: `Olá! Eu sou ${agentName}. Obrigado por ligar para o nosso departamento de vendas. Como posso ajudá-lo hoje?`,
      support: `Olá! Eu sou ${agentName}. Obrigado por entrar em contato com nossa equipe de suporte. Como posso ajudá-lo?`,
      scheduling: `Olá! Eu sou ${agentName}. Obrigado por ligar. Posso ajudá-lo a agendar um compromisso. Qual dia é melhor para você?`,
      custom: `Olá! Obrigado por ligar para ${departmentName}. Eu sou ${agentName}. Como posso ajudá-lo hoje?`,
    },
    zh: {
      sales: `您好！我是${agentName}。感谢您致电我们的销售部门。今天我能为您做些什么？`,
      support: `您好！我是${agentName}。感谢您联系我们的支持团队。我能为您提供什么帮助？`,
      scheduling: `您好！我是${agentName}。感谢您来电。我可以帮您预约。请问哪天方便？`,
      custom: `您好！感谢您致电${departmentName}。我是${agentName}。今天我能为您做些什么？`,
    },
    hi: {
      sales: `नमस्ते! मैं ${agentName} हूँ। हमारे बिक्री विभाग में कॉल करने के लिए धन्यवाद। आज मैं आपकी कैसे मदद कर सकता हूँ?`,
      support: `नमस्ते! मैं ${agentName} हूँ। हमारी सहायता टीम से संपर्क करने के लिए धन्यवाद। मैं आपकी कैसे मदद कर सकता हूँ?`,
      scheduling: `नमस्ते! मैं ${agentName} हूँ। कॉल करने के लिए धन्यवाद। मैं आपको अपॉइंटमेंट शेड्यूल करने में मदद कर सकता हूँ। कौन सा दिन आपके लिए सुविधाजनक है?`,
      custom: `नमस्ते! ${departmentName} में कॉल करने के लिए धन्यवाद। मैं ${agentName} हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?`,
    },
    ja: {
      sales: `こんにちは！${agentName}です。営業部門にお電話いただきありがとうございます。本日はどのようなご用件でしょうか？`,
      support: `こんにちは！${agentName}です。サポートチームにお問い合わせいただきありがとうございます。どのようにお手伝いできますか？`,
      scheduling: `こんにちは！${agentName}です。お電話ありがとうございます。予約のお手伝いをいたします。ご都合の良い日はいつですか？`,
      custom: `こんにちは！${departmentName}にお電話いただきありがとうございます。${agentName}です。本日はどのようなご用件でしょうか？`,
    },
    ko: {
      sales: `안녕하세요! ${agentName}입니다. 영업부에 전화해 주셔서 감사합니다. 오늘 어떻게 도와드릴까요?`,
      support: `안녕하세요! ${agentName}입니다. 고객지원팀에 연락해 주셔서 감사합니다. 어떻게 도와드릴까요?`,
      scheduling: `안녕하세요! ${agentName}입니다. 전화해 주셔서 감사합니다. 예약을 도와드리겠습니다. 어떤 날이 편하신가요?`,
      custom: `안녕하세요! ${departmentName}에 전화해 주셔서 감사합니다. ${agentName}입니다. 오늘 어떻게 도와드릴까요?`,
    },
    nl: {
      sales: `Hallo! Ik ben ${agentName}. Bedankt voor het bellen naar onze verkoopafdeling. Hoe kan ik u vandaag helpen?`,
      support: `Hallo! Ik ben ${agentName}. Bedankt voor het contact met ons supportteam. Hoe kan ik u helpen?`,
      scheduling: `Hallo! Ik ben ${agentName}. Bedankt voor het bellen. Ik kan u helpen met het plannen van een afspraak. Welke dag past u het beste?`,
      custom: `Hallo! Bedankt voor het bellen naar ${departmentName}. Ik ben ${agentName}. Hoe kan ik u vandaag helpen?`,
    },
    pl: {
      sales: `Dzień dobry! Jestem ${agentName}. Dziękuję za telefon do naszego działu sprzedaży. W czym mogę pomóc?`,
      support: `Dzień dobry! Jestem ${agentName}. Dziękuję za kontakt z naszym zespołem wsparcia. W czym mogę pomóc?`,
      scheduling: `Dzień dobry! Jestem ${agentName}. Dziękuję za telefon. Mogę pomóc umówić wizytę. Który dzień jest dla Pana/Pani najwygodniejszy?`,
      custom: `Dzień dobry! Dziękuję za telefon do ${departmentName}. Jestem ${agentName}. W czym mogę dziś pomóc?`,
    },
    sv: {
      sales: `Hej! Jag är ${agentName}. Tack för att du ringer vår försäljningsavdelning. Hur kan jag hjälpa dig idag?`,
      support: `Hej! Jag är ${agentName}. Tack för att du kontaktar vårt supportteam. Hur kan jag hjälpa dig?`,
      scheduling: `Hej! Jag är ${agentName}. Tack för att du ringer. Jag kan hjälpa dig boka en tid. Vilken dag passar dig bäst?`,
      custom: `Hej! Tack för att du ringer ${departmentName}. Jag är ${agentName}. Hur kan jag hjälpa dig idag?`,
    },
    no: {
      sales: `Hei! Jeg er ${agentName}. Takk for at du ringer salgsavdelingen vår. Hvordan kan jeg hjelpe deg i dag?`,
      support: `Hei! Jeg er ${agentName}. Takk for at du kontakter supportteamet vårt. Hvordan kan jeg hjelpe deg?`,
      scheduling: `Hei! Jeg er ${agentName}. Takk for at du ringer. Jeg kan hjelpe deg med å bestille en avtale. Hvilken dag passer best for deg?`,
      custom: `Hei! Takk for at du ringer ${departmentName}. Jeg er ${agentName}. Hvordan kan jeg hjelpe deg i dag?`,
    },
    fi: {
      sales: `Hei! Olen ${agentName}. Kiitos soitostasi myyntiosastollemme. Miten voin auttaa sinua tänään?`,
      support: `Hei! Olen ${agentName}. Kiitos yhteydenotostasi tukitiimiimme. Miten voin auttaa sinua?`,
      scheduling: `Hei! Olen ${agentName}. Kiitos soitostasi. Voin auttaa sinua varaamaan ajan. Mikä päivä sopisi sinulle parhaiten?`,
      custom: `Hei! Kiitos soitostasi ${departmentName}. Olen ${agentName}. Miten voin auttaa sinua tänään?`,
    },
    tr: {
      sales: `Merhaba! Ben ${agentName}. Satış departmanımızı aradığınız için teşekkür ederiz. Bugün size nasıl yardımcı olabilirim?`,
      support: `Merhaba! Ben ${agentName}. Destek ekibimize ulaştığınız için teşekkür ederiz. Size nasıl yardımcı olabilirim?`,
      scheduling: `Merhaba! Ben ${agentName}. Aradığınız için teşekkür ederiz. Randevu almanıza yardımcı olabilirim. Hangi gün sizin için uygun?`,
      custom: `Merhaba! ${departmentName}'i aradığınız için teşekkür ederiz. Ben ${agentName}. Bugün size nasıl yardımcı olabilirim?`,
    },
  };

  const kbQuestions: Record<string, string> = {
    en: "Let me check that for you. What would you like to know?",
    ar: "دعني أتحقق من ذلك لك. ماذا تريد أن تعرف؟",
    es: "Déjeme verificar eso por usted. ¿Qué le gustaría saber?",
    fr: "Laissez-moi vérifier cela pour vous. Que souhaitez-vous savoir ?",
    de: "Lassen Sie mich das für Sie überprüfen. Was möchten Sie wissen?",
    it: "Mi permetta di verificare. Cosa vorrebbe sapere?",
    pt: "Deixe-me verificar isso para você. O que gostaria de saber?",
    zh: "让我为您查一下。您想了解什么？",
    hi: "मुझे आपके लिए यह जांचने दीजिए। आप क्या जानना चाहेंगे?",
    ja: "確認させてください。何をお知りになりたいですか？",
    ko: "확인해 보겠습니다. 무엇을 알고 싶으신가요?",
    nl: "Laat me dat voor u controleren. Wat wilt u weten?",
    pl: "Pozwól, że to sprawdzę. Co chciałby Pan/Pani wiedzieć?",
    sv: "Låt mig kolla det åt dig. Vad vill du veta?",
    no: "La meg sjekke det for deg. Hva vil du vite?",
    fi: "Anna minun tarkistaa se sinulle. Mitä haluaisit tietää?",
    tr: "Sizin için kontrol edeyim. Ne bilmek istersiniz?",
  };

  const followUpQuestions: Record<string, string> = {
    en: "Is there anything else I can help you with, or would you like to speak with a team member?",
    ar: "هل هناك أي شيء آخر يمكنني مساعدتك فيه، أم تود التحدث مع أحد أعضاء الفريق؟",
    es: "¿Hay algo más en lo que pueda ayudarle, o le gustaría hablar con un miembro del equipo?",
    fr: "Y a-t-il autre chose que je puisse faire pour vous, ou souhaitez-vous parler à un membre de l'équipe ?",
    de: "Kann ich Ihnen noch bei etwas anderem helfen, oder möchten Sie mit einem Teammitglied sprechen?",
    it: "C'è qualcos'altro in cui posso aiutarla, o vorrebbe parlare con un membro del team?",
    pt: "Há mais alguma coisa em que posso ajudá-lo, ou gostaria de falar com um membro da equipe?",
    zh: "还有什么我可以帮您的吗，或者您想和团队成员交谈？",
    hi: "क्या कुछ और है जिसमें मैं आपकी मदद कर सकता हूँ, या आप किसी टीम सदस्य से बात करना चाहेंगे?",
    ja: "他にお手伝いできることはありますか、またはチームメンバーとお話しされますか？",
    ko: "다른 도움이 필요하신 것이 있으신가요, 아니면 팀원과 통화하시겠습니까?",
    nl: "Is er nog iets anders waarmee ik u kan helpen, of wilt u met een teamlid spreken?",
    pl: "Czy mogę jeszcze w czymś pomóc, czy chciałby Pan/Pani porozmawiać z członkiem zespołu?",
    sv: "Finns det något annat jag kan hjälpa dig med, eller vill du prata med en teammedlem?",
    no: "Er det noe annet jeg kan hjelpe deg med, eller vil du snakke med et teammedlem?",
    fi: "Onko jotain muuta, jossa voin auttaa, vai haluaisitko puhua tiimin jäsenen kanssa?",
    tr: "Size başka bir konuda yardımcı olabilir miyim, yoksa bir ekip üyesiyle konuşmak ister misiniz?",
  };

  const endCallMessages: Record<string, string> = {
    en: "Thank you for calling. Have a great day!",
    ar: "شكراً لاتصالك. أتمنى لك يوماً سعيداً!",
    es: "Gracias por llamar. ¡Que tenga un buen día!",
    fr: "Merci d'avoir appelé. Bonne journée !",
    de: "Vielen Dank für Ihren Anruf. Einen schönen Tag noch!",
    it: "Grazie per aver chiamato. Buona giornata!",
    pt: "Obrigado por ligar. Tenha um ótimo dia!",
    zh: "感谢您的来电。祝您有美好的一天！",
    hi: "कॉल करने के लिए धन्यवाद। आपका दिन शुभ हो!",
    ja: "お電話ありがとうございました。良い一日をお過ごしください！",
    ko: "전화해 주셔서 감사합니다. 좋은 하루 보내세요!",
    nl: "Bedankt voor het bellen. Een fijne dag verder!",
    pl: "Dziękuję za telefon. Miłego dnia!",
    sv: "Tack för att du ringde. Ha en bra dag!",
    no: "Takk for at du ringte. Ha en fin dag!",
    fi: "Kiitos soitosta. Hyvää päivänjatkoa!",
    tr: "Aradığınız için teşekkür ederiz. İyi günler!",
  };

  const langGreetings = greetingsByLanguage[language] || greetingsByLanguage['en'];
  const greetingMessages = langGreetings;

  const nodes: FlowNode[] = [
    {
      id: "greeting",
      type: "message",
      position: { x: 250, y: 50 },
      data: {
        label: "Greeting",
        config: {
          type: "message",
          message: greetingMessages[deptType],
          waitForResponse: false,
        },
      },
    },
    {
      id: "knowledge_base",
      type: "question",
      position: { x: 250, y: 180 },
      data: {
        label: "Knowledge Base",
        config: {
          type: "question",
          question: kbQuestions[language] || kbQuestions['en'],
          variableName: "user_question",
          expectedResponseType: "text",
          waitForResponse: true,
        },
      },
    },
    {
      id: "follow_up",
      type: "question",
      position: { x: 250, y: 310 },
      data: {
        label: "Follow Up Question",
        config: {
          type: "question",
          question: followUpQuestions[language] || followUpQuestions['en'],
          variableName: "wants_more_help",
          expectedResponseType: "yes_no",
          waitForResponse: true,
        },
      },
    },
    {
      id: "condition",
      type: "condition",
      position: { x: 250, y: 440 },
      data: {
        label: "Check Response",
        config: {
          type: "condition",
          conditions: [
            {
              type: "keyword",
              value: "transfer,human,agent,person,team,speak,talk",
              targetNodeId: "transfer",
              label: "Wants Transfer",
            },
            {
              type: "yes_no",
              value: "no",
              targetNodeId: "end",
              label: "No More Help",
            },
          ],
          defaultTargetNodeId: "knowledge_base",
        },
      },
    },
    {
      id: "transfer",
      type: "transfer",
      position: { x: 100, y: 570 },
      data: {
        label: "Transfer Call",
        config: {
          type: "transfer",
          transferNumber: "",
          message: "I'll transfer you now. Please hold.",
        },
      },
    },
    {
      id: "end",
      type: "end",
      position: { x: 400, y: 570 },
      data: {
        label: "End Call",
        config: {
          type: "end",
          message: endCallMessages[language] || endCallMessages['en'],
        },
      },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e-greeting-kb", source: "greeting", target: "knowledge_base" },
    { id: "e-kb-followup", source: "knowledge_base", target: "follow_up" },
    { id: "e-followup-condition", source: "follow_up", target: "condition" },
    { id: "e-condition-transfer", source: "condition", target: "transfer", label: "Transfer", sourceHandle: "transfer" },
    { id: "e-condition-end", source: "condition", target: "end", label: "End", sourceHandle: "end" },
    { id: "e-condition-kb", source: "condition", target: "knowledge_base", label: "More Help", sourceHandle: "default" },
  ];

  return { nodes, edges };
}

const LANG_PROMPTS: Record<string, string> = {
  en: 'For English, press', ar: 'للعربية، اضغط', es: 'Para español, presione', fr: 'Pour le français, appuyez sur',
  de: 'Für Deutsch, drücken Sie', it: 'Per italiano, premere', pt: 'Para português, pressione', zh: '中文请按',
  hi: 'हिंदी के लिए, दबाएं', ja: '日本語は', ko: '한국어는', nl: 'Voor Nederlands, druk op',
  pl: 'Dla polskiego, naciśnij', sv: 'För svenska, tryck', no: 'For norsk, trykk', fi: 'Suomeksi, paina', tr: 'Türkçe için, basın',
};

const DEPT_TEMPLATES: Record<string, { pressKey: string; greeting: string; noInputMsg: string; repeatMsg: string }> = {
  en: { pressKey: 'press', greeting: 'Please listen to the following options.', noInputMsg: 'We did not receive a response.', repeatMsg: 'To repeat these options, press 0.' },
  ar: { pressKey: 'اضغط', greeting: 'يرجى الاستماع إلى الخيارات التالية.', noInputMsg: 'لم نتلق أي استجابة.', repeatMsg: 'لتكرار هذه الخيارات، اضغط 0.' },
  es: { pressKey: 'presione', greeting: 'Por favor escuche las siguientes opciones.', noInputMsg: 'No recibimos respuesta.', repeatMsg: 'Para repetir estas opciones, presione 0.' },
  fr: { pressKey: 'appuyez sur', greeting: 'Veuillez écouter les options suivantes.', noInputMsg: 'Nous n\'avons reçu aucune réponse.', repeatMsg: 'Pour répéter ces options, appuyez sur 0.' },
};

function isElevenLabsVoiceId(vid: string | undefined): boolean {
  if (!vid) return false;
  if (vid.startsWith('el_')) return true;
  if (vid.startsWith('cartesia_')) return false;
  if (/^[a-zA-Z0-9]{10,}$/.test(vid)) return true;
  return false;
}

function isCartesiaVoiceId(vid: string | undefined): boolean {
  if (!vid) return false;
  if (vid.startsWith('cartesia_')) return true;
  return false;
}

function getCartesiaVoiceId(vid: string): string {
  return vid.replace(/^cartesia_/, '');
}

function createWavHeader(dataLength: number, sampleRate: number, bitsPerSample: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

async function generateDeptIvrTwiml(config: any, step: string, digits?: string, lang?: string): Promise<string> {
  const menuOptions = config.menuOptions as Array<{ key: string; label: string; departmentId: string }> || [];
  const langOptions = config.languageOptions as Array<{ id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[] }> | null;
  const rawVoiceId = config.voiceId || 'Joanna';
  const isElVoice = isElevenLabsVoiceId(rawVoiceId);
  const voiceId = (isElVoice || ['alloy','echo','fable','onyx','nova','shimmer'].includes(rawVoiceId)) ? 'Joanna' : rawVoiceId;
  const pollyVoice = `Polly.${voiceId}`;

  function isElevenLabsVid(vid: string | undefined): boolean {
    return isElevenLabsVoiceId(vid);
  }

  function safePollyVoice(vid: string | undefined): string {
    if (!vid) return pollyVoice;
    if (isElevenLabsVoiceId(vid) || ['alloy','echo','fable','onyx','nova','shimmer'].includes(vid)) return 'Polly.Joanna';
    return `Polly.${vid}`;
  }

  function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function generateElevenLabsTts(text: string, elVoiceId: string): Promise<Buffer | null> {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return null;
      const realId = getElevenLabsVoiceId(elVoiceId);
      if (!realId) return null;
      const elService = new ElevenLabsService(apiKey);
      return await elService.generateVoicePreview({ voiceId: realId, text });
    } catch (err) {
      console.error('[Deprock IVR] ElevenLabs TTS failed, falling back to Polly:', err);
      return null;
    }
  }

  function sayTwiml(vid: string | undefined, text: string): string {
    const voice = safePollyVoice(vid);
    return `<Say voice="${voice}">${escapeXml(text)}</Say>`;
  }

  if (step === 'answer') {
    if (langOptions && langOptions.length > 1) {
      const greetingText = config.greetingMessage || 'Thank you for calling. Please select your preferred language.';
      let sayParts = sayTwiml(rawVoiceId, greetingText);
      for (let idx = 0; idx < langOptions.length; idx++) {
        const opt = langOptions[idx];
        const prompt = LANG_PROMPTS[opt.language] || `For ${opt.language}, press`;
        sayParts += sayTwiml(opt.voiceId, `${prompt} ${idx + 1}.`);
      }
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" action="/api/deprock/ivr/sim-dept-lang" method="POST" timeout="10">${sayParts}</Gather><Say voice="${pollyVoice}">We did not receive a response.</Say></Response>`;
    }

    const langCode = langOptions?.[0]?.language || 'en';
    const template = DEPT_TEMPLATES[langCode] || DEPT_TEMPLATES.en;
    let sayParts = '';
    if (config.greetingMessage) {
      sayParts += sayTwiml(rawVoiceId, config.greetingMessage);
    }
    sayParts += sayTwiml(rawVoiceId, template.greeting);
    for (let i = 0; i < menuOptions.length; i++) {
      sayParts += sayTwiml(rawVoiceId, `${template.pressKey} ${i + 1} ${menuOptions[i].label}.`);
    }
    sayParts += sayTwiml(rawVoiceId, template.repeatMsg);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" action="/api/deprock/ivr/sim-dept-select" method="POST" timeout="10">${sayParts}</Gather>${sayTwiml(rawVoiceId, template.noInputMsg)}</Response>`;
  }

  if (step === 'handle-language') {
    if (!langOptions || !digits) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid selection. Goodbye.</Say><Hangup/></Response>`;
    }
    if (digits === '0') {
      return generateDeptIvrTwiml(config, 'answer');
    }
    const idx = parseInt(digits) - 1;
    if (idx < 0 || idx >= langOptions.length) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid selection. Goodbye.</Say><Hangup/></Response>`;
    }
    const selectedLang = langOptions[idx];
    const langCode = selectedLang.language || 'en';
    const langVoice = safePollyVoice(selectedLang.voiceId);
    const template = DEPT_TEMPLATES[langCode] || DEPT_TEMPLATES.en;

    let filteredMenu = menuOptions;
    if (selectedLang.selectedDepartments && selectedLang.selectedDepartments.length > 0) {
      const filtered = menuOptions.filter(opt => selectedLang.selectedDepartments!.includes(opt.departmentId));
      if (filtered.length > 0) filteredMenu = filtered;
    }

    let sayParts = '';
    if (selectedLang.greeting) {
      sayParts += sayTwiml(selectedLang.voiceId, selectedLang.greeting);
    }
    sayParts += `<Say voice="${langVoice}">${escapeXml(template.greeting)}</Say>`;
    for (let i = 0; i < filteredMenu.length; i++) {
      sayParts += `<Say voice="${langVoice}">${escapeXml(template.pressKey)} ${i + 1} ${escapeXml(filteredMenu[i].label)}.</Say>`;
    }
    sayParts += `<Say voice="${langVoice}">${escapeXml(template.repeatMsg)}</Say>`;
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" action="/api/deprock/ivr/sim-dept-select" method="POST" timeout="10">${sayParts}</Gather><Say voice="${langVoice}">${escapeXml(template.noInputMsg)}</Say></Response>`;
  }

  if (step === 'handle-selection') {
    if (!digits) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid selection. Goodbye.</Say><Hangup/></Response>`;
    }
    if (digits === '0') {
      if (langOptions && langOptions.length > 1) {
        return generateDeptIvrTwiml(config, 'answer');
      }
      return generateDeptIvrTwiml(config, 'answer');
    }
    const idx = parseInt(digits) - 1;

    let filteredMenu = menuOptions;
    if (lang && langOptions) {
      const langOption = langOptions.find(l => l.language === lang);
      if (langOption?.selectedDepartments && langOption.selectedDepartments.length > 0) {
        const filtered = menuOptions.filter(opt => langOption.selectedDepartments!.includes(opt.departmentId));
        if (filtered.length > 0) filteredMenu = filtered;
      }
    }

    if (idx < 0 || idx >= filteredMenu.length) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid selection. Goodbye.</Say><Hangup/></Response>`;
    }

    const selected = filteredMenu[idx];
    const langVoice = pollyVoice;
    const deptId = selected.departmentId;

    const deptResult = await db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
    const deptAgents = await db.select().from(departmentAgents).where(eq(departmentAgents.departmentId, deptId));

    if (deptAgents.length > 0) {
      const agentResult = await db.select().from(agents).where(eq(agents.id, deptAgents[0].agentId!)).limit(1);
      const agentName = agentResult[0]?.name || 'Agent';
      const deptName = deptResult[0]?.name || selected.label;
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${langVoice}">Connecting you to ${escapeXml(deptName)}. Please hold.</Say><Connect><Stream url="wss://sim-agent-placeholder"><Parameter name="agentId" value="${escapeXml(deptAgents[0].agentId!)}" /></Stream></Connect></Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${langVoice}">Sorry, no agent is available for this department. Goodbye.</Say><Hangup/></Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unknown step. Goodbye.</Say><Hangup/></Response>`;
}

export function createDeprockRoutes(authenticateToken: (req: Request, res: Response, next: Function) => void) {
  const router = Router();

  router.post("/backfill-avatars", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userAgents = await db
        .select({ id: agents.id, name: agents.name, avatarUrl: agents.avatarUrl, type: agents.type })
        .from(agents)
        .where(and(eq(agents.userId, req.userId!), sql`${agents.type} IN ('inbound', 'incoming')`));

      const missing = userAgents.filter(a => !a.avatarUrl && a.name);
      if (missing.length === 0) {
        return res.json({ message: "All inbound agents already have avatars", count: 0 });
      }

      let generated = 0;
      for (const agent of missing) {
        try {
          console.log(`🎨 [Deprock Backfill] Generating avatar for "${agent.name}"`);
          const avatarUrl = await generateAgentAvatar(agent.name);
          if (avatarUrl) {
            await db.update(agents).set({ avatarUrl }).where(eq(agents.id, agent.id));
            generated++;
            console.log(`✅ [Deprock Backfill] Avatar saved for "${agent.name}": ${avatarUrl}`);
          }
        } catch (err) {
          console.warn(`⚠️ [Deprock Backfill] Failed for "${agent.name}":`, err);
        }
      }

      res.json({ message: `Generated ${generated} avatars for ${missing.length} agents`, count: generated });
    } catch (error: any) {
      console.error("[Deprock Backfill] Error:", error);
      res.status(500).json({ error: "Failed to backfill avatars" });
    }
  });

  router.get("/cartesia-voices", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!cartesiaTTSService.isConfigured()) {
        return res.json([]);
      }
      const voices = await cartesiaTTSService.listVoices();
      res.json(voices);
    } catch (error: any) {
      console.error("[Deprock] Error fetching Cartesia voices:", error.message);
      res.json([]);
    }
  });

  router.post("/cartesia-voices/preview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!cartesiaTTSService.isConfigured()) {
        return res.status(400).json({ error: "Cartesia is not configured" });
      }

      const { voiceId, text, speed, emotion } = req.body;

      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }

      const previewText = text || "Hello! This is a preview of how I'll sound. I can adjust my tone and style based on your preferences.";

      if (previewText.length > 500) {
        return res.status(400).json({ error: "Preview text cannot exceed 500 characters" });
      }

      const validSpeed = typeof speed === 'number' && speed >= 0.5 && speed <= 2.0 ? speed : 1.0;

      let validEmotion = undefined;
      if (Array.isArray(emotion) && emotion.length > 0) {
        const validEmotionNames = ['anger', 'positivity', 'surprise', 'sadness', 'curiosity'];
        const validLevels = ['lowest', 'low', 'medium', 'high', 'highest'];
        validEmotion = emotion.filter((e: any) =>
          e && typeof e.name === 'string' && typeof e.level === 'string' &&
          validEmotionNames.includes(e.name) && validLevels.includes(e.level)
        );
        if (validEmotion.length === 0) validEmotion = undefined;
      }

      const result = await cartesiaTTSService.synthesizeSpeech({
        text: previewText,
        voiceId,
        sampleRate: 24000,
        outputContainer: 'raw',
        speed: validSpeed,
        emotion: validEmotion,
      });

      const pcmData = result.audioStream;
      const wavHeader = Buffer.alloc(44);
      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      const dataSize = pcmData.length;
      const fileSize = 36 + dataSize;

      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(fileSize, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20);
      wavHeader.writeUInt16LE(numChannels, 22);
      wavHeader.writeUInt32LE(sampleRate, 24);
      wavHeader.writeUInt32LE(byteRate, 28);
      wavHeader.writeUInt16LE(blockAlign, 32);
      wavHeader.writeUInt16LE(bitsPerSample, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(dataSize, 40);

      const wavBuffer = Buffer.concat([wavHeader, pcmData]);

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', wavBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(wavBuffer);
    } catch (error: any) {
      console.error("[Deprock] Cartesia voice preview error:", error.message);
      res.status(500).json({ error: error.message || "Failed to generate Cartesia voice preview" });
    }
  });

  router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .orderBy(asc(departments.sortOrder));

      res.json(userDepartments);
    } catch (error: any) {
      console.error("[Deprock] Get all error:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  router.get("/ivr-configs-all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const allIvrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));
      res.json(allIvrConfigs);
    } catch (error: any) {
      console.error('[IVR Configs All] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch IVR configurations' });
    }
  });

  router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const department = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (department.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json({
        ...department[0],
        agents: deptAgents.map(da => ({
          ...da.departmentAgent,
          agent: da.agent,
        })),
      });
    } catch (error: any) {
      console.error("[Deprock] Get one error:", error);
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertDepartmentSchema.parse({
        ...req.body,
        userId: req.userId,
      });

      const existingCount = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

      const departmentLanguage = req.body.language || 'en';
      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(validatedData.name, "your AI assistant", departmentLanguage);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${validatedData.name} Flow`,
            description: `Auto-generated conversation flow for ${validatedData.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        console.log(`[Deprock] Created flow "${newFlow.name}" (${flowId}) for department "${validatedData.name}"`);

        const [newDepartment] = await tx
          .insert(departments)
          .values({
            ...validatedData,
            sortOrder: existingCount.length,
            flowId: flowId,
            engineType: 'bedrock-polly',
          })
          .returning();

        return { department: newDepartment, flow: newFlow };
      });

      res.status(201).json({ ...result.department, flow: result.flow });
    } catch (error: any) {
      console.error("[Deprock] Create error:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, icon, color, isActive, sortOrder } = req.body;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const updated = await db
        .update(departments)
        .set({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(isActive !== undefined && { isActive }),
          ...(sortOrder !== undefined && { sortOrder }),
          updatedAt: new Date(),
        })
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Deprock] Update error:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  router.post("/:id/generate-flow", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existingDept] = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (!existingDept) {
        return res.status(404).json({ error: "Department not found" });
      }

      if (existingDept.flowId) {
        return res.json({ flowId: existingDept.flowId, message: "Flow already exists" });
      }

      const deptLang = req.body.language || 'en';
      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(existingDept.name, "your AI assistant", deptLang);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${existingDept.name} Flow`,
            description: `Auto-generated conversation flow for ${existingDept.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        const [updatedDept] = await tx
          .update(departments)
          .set({ flowId: flowId, updatedAt: new Date() })
          .where(and(eq(departments.id, id), eq(departments.engineType, 'bedrock-polly')))
          .returning();

        return { department: updatedDept, flow: newFlow };
      });

      console.log(`[Deprock] Generated flow for existing department "${existingDept.name}" (${flowId})`);
      res.json(result);
    } catch (error: any) {
      console.error("[Deprock] Generate flow error:", error);
      res.status(500).json({ error: "Failed to generate flow" });
    }
  });

  router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const linkedAgents = await db
        .select({ agentId: departmentAgents.agentId })
        .from(departmentAgents)
        .where(eq(departmentAgents.departmentId, id));

      const linkedAgentIds = [...new Set(linkedAgents.map(a => a.agentId))];

      await db.transaction(async (tx) => {
        if (linkedAgentIds.length > 0) {
          await tx
            .delete(agents)
            .where(and(inArray(agents.id, linkedAgentIds), eq(agents.userId, req.userId!)));
        }

        await tx
          .delete(departments)
          .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));
      });

      if (linkedAgentIds.length > 0) {
        console.log(`[Deprock] Deleted ${linkedAgentIds.length} linked agent(s) for department ${id}`);
      }

      res.json({ success: true, deletedAgents: linkedAgentIds.length });
    } catch (error: any) {
      console.error("[Deprock] Delete error:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  router.post("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { agentId, agentName, language, isPrimary, systemPrompt, firstMessage, voiceTone, voiceId, ttsProvider } = req.body;

      const trimmedAgentName = agentName?.trim();
      if (!agentId && !trimmedAgentName) {
        return res.status(400).json({ error: "agentId or agentName is required" });
      }

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      let resolvedAgentId = agentId;

      if (resolvedAgentId) {
        const existingAgent = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, resolvedAgentId), eq(agents.userId, req.userId!)))
          .limit(1);

        if (existingAgent.length === 0) {
          resolvedAgentId = undefined;
        } else if (trimmedAgentName && existingAgent[0].name !== trimmedAgentName) {
          resolvedAgentId = undefined;
          console.log(`[Deprock] Agent name mismatch: existing="${existingAgent[0].name}" vs provided="${trimmedAgentName}" — creating new agent`);
        }
      }

      if (!resolvedAgentId && trimmedAgentName) {
        const deptKBs = await db
          .select({ knowledgeBaseId: departmentKnowledgeBases.knowledgeBaseId })
          .from(departmentKnowledgeBases)
          .where(eq(departmentKnowledgeBases.departmentId, id));
        let kbIds = deptKBs.map(dk => dk.knowledgeBaseId);

        if (kbIds.length === 0) {
          const userKBs = await db
            .select({ id: knowledgeBase.id })
            .from(knowledgeBase)
            .where(eq(knowledgeBase.userId, req.userId!))
            .limit(50);
          kbIds = userKBs.map(kb => kb.id);
        }

        const isElVoice = isElevenLabsVoiceId(voiceId);
        const isCartesiaVoice = isCartesiaVoiceId(voiceId);
        const agentValues: Record<string, any> = {
          userId: req.userId!,
          name: trimmedAgentName,
          type: 'inbound',
          language: language || 'en',
          telephonyProvider: 'twilio',
          systemPrompt: systemPrompt || null,
          openaiVoice: voiceId || null,
          voiceTone: voiceTone || null,
          firstMessage: firstMessage || null,
          knowledgeBaseOnly: kbIds.length > 0,
          knowledgeBaseIds: kbIds.length > 0 ? kbIds : null,
        };
        if (ttsProvider === 'cartesia' || isCartesiaVoice) {
          agentValues.voiceProvider = 'cartesia';
          agentValues.openaiVoice = isCartesiaVoice ? getCartesiaVoiceId(voiceId) : voiceId;
        } else if (isElVoice) {
          agentValues.voiceProvider = 'elevenlabs';
          agentValues.elevenLabsVoiceId = getElevenLabsVoiceId(voiceId) || voiceId;
        } else if (voiceId) {
          agentValues.voiceProvider = 'aws_polly';
          agentValues.awsPollyVoiceId = voiceId;
        }

        const [newAgent] = await db
          .insert(agents)
          .values(agentValues)
          .returning();
        resolvedAgentId = newAgent.id;
        console.log(`[Deprock] Created new agent "${trimmedAgentName}" (${newAgent.id}) for language ${language}, linked ${kbIds.length} knowledge bases, voiceProvider=${agentValues.voiceProvider || 'aws_polly'}`);

        setImmediate(async () => {
          try {
            console.log(`🎨 [Deprock] Generating avatar for inbound agent "${trimmedAgentName}"`);
            const generatedAvatarUrl = await generateAgentAvatar(trimmedAgentName);
            if (generatedAvatarUrl) {
              await db.update(agents).set({ avatarUrl: generatedAvatarUrl }).where(eq(agents.id, newAgent.id));
              console.log(`✅ [Deprock] Avatar generated and saved for "${trimmedAgentName}": ${generatedAvatarUrl}`);
            }
          } catch (avatarError) {
            console.warn(`⚠️ [Deprock] Avatar generation failed (non-fatal):`, avatarError);
          }
        });
      }

      const newDeptAgent = await db
        .insert(departmentAgents)
        .values({
          departmentId: id,
          agentId: resolvedAgentId,
          language: language || "en",
          isPrimary: isPrimary || false,
          systemPrompt: systemPrompt || null,
          voiceTone: voiceTone || null,
        })
        .returning();

      if (systemPrompt || voiceId || voiceTone || firstMessage) {
        const agentUpdate: Record<string, any> = {};
        if (systemPrompt) agentUpdate.systemPrompt = systemPrompt;
        if (firstMessage) agentUpdate.firstMessage = firstMessage;
        if (voiceId) {
          agentUpdate.openaiVoice = voiceId;
          if (ttsProvider === 'cartesia' || isCartesiaVoiceId(voiceId)) {
            agentUpdate.voiceProvider = 'cartesia';
            agentUpdate.openaiVoice = isCartesiaVoiceId(voiceId) ? getCartesiaVoiceId(voiceId) : voiceId;
          } else if (isElevenLabsVoiceId(voiceId)) {
            agentUpdate.voiceProvider = 'elevenlabs';
            agentUpdate.elevenLabsVoiceId = getElevenLabsVoiceId(voiceId) || voiceId;
          } else {
            agentUpdate.voiceProvider = 'aws_polly';
            agentUpdate.awsPollyVoiceId = voiceId;
          }
        }
        if (voiceTone) agentUpdate.voiceTone = voiceTone;

        await db
          .update(agents)
          .set(agentUpdate)
          .where(and(eq(agents.id, resolvedAgentId), eq(agents.userId, req.userId!)));

        console.log(`[Deprock] Synced agent ${resolvedAgentId} with canvas config: prompt=${!!systemPrompt}, voice=${voiceId || 'unchanged'}, tone=${voiceTone || 'unchanged'}, firstMessage=${!!firstMessage}`);
      }

      const deptData = existingDept[0];
      if (deptData.flowId) {
        if (isPrimary) {
          await db
            .update(flows)
            .set({ agentId: resolvedAgentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Deprock] Synced flow ${deptData.flowId} with primary agent ${resolvedAgentId}`);
        } else {
          const [currentFlow] = await db
            .select()
            .from(flows)
            .where(eq(flows.id, deptData.flowId))
            .limit(1);
          if (currentFlow && !currentFlow.agentId) {
            await db
              .update(flows)
              .set({ agentId: resolvedAgentId, updatedAt: new Date() })
              .where(eq(flows.id, deptData.flowId));
            console.log(`[Deprock] Synced flow ${deptData.flowId} with agent ${resolvedAgentId} (no previous agent)`);
          }
        }
      }

      res.status(201).json(newDeptAgent[0]);
    } catch (error: any) {
      console.error("[Deprock] Add agent error:", error);
      res.status(500).json({ error: "Failed to add agent to department" });
    }
  });

  router.delete("/:id/agents/:agentId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, agentId } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      await db
        .delete(departmentAgents)
        .where(and(
          eq(departmentAgents.departmentId, id),
          eq(departmentAgents.agentId, agentId)
        ));

      const deptData = existingDept[0];
      if (deptData.flowId) {
        const [currentFlow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, deptData.flowId))
          .limit(1);

        if (currentFlow && currentFlow.agentId === agentId) {
          const remainingAgents = await db
            .select()
            .from(departmentAgents)
            .where(eq(departmentAgents.departmentId, id));

          const primaryAgent = remainingAgents.find(a => a.isPrimary);
          const replacementAgentId = primaryAgent?.agentId || remainingAgents[0]?.agentId || null;

          await db
            .update(flows)
            .set({ agentId: replacementAgentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Deprock] Updated flow ${deptData.flowId} agentId to ${replacementAgentId} after removing agent ${agentId}`);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Remove agent error:", error);
      res.status(500).json({ error: "Failed to remove agent from department" });
    }
  });

  router.patch("/:departmentId/agents/:departmentAgentId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { departmentId, departmentAgentId } = req.params;
      const { systemPrompt, voiceTone, voiceId, firstMessage } = req.body;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, departmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const [deptAgent] = await db
        .select()
        .from(departmentAgents)
        .where(and(eq(departmentAgents.id, departmentAgentId), eq(departmentAgents.departmentId, departmentId)))
        .limit(1);

      if (!deptAgent) {
        return res.status(404).json({ error: "Department agent not found" });
      }

      const deptAgentUpdate: Record<string, any> = {};
      if (systemPrompt !== undefined) deptAgentUpdate.systemPrompt = systemPrompt;
      if (voiceTone !== undefined) deptAgentUpdate.voiceTone = voiceTone;

      if (Object.keys(deptAgentUpdate).length > 0) {
        await db
          .update(departmentAgents)
          .set(deptAgentUpdate)
          .where(eq(departmentAgents.id, departmentAgentId));
      }

      const agentUpdate: Record<string, any> = {};
      if (voiceId !== undefined) {
        if (isCartesiaVoiceId(voiceId)) {
          agentUpdate.voiceProvider = 'cartesia';
          agentUpdate.openaiVoice = getCartesiaVoiceId(voiceId);
        } else if (isElevenLabsVoiceId(voiceId)) {
          agentUpdate.voiceProvider = 'elevenlabs';
          agentUpdate.elevenLabsVoiceId = getElevenLabsVoiceId(voiceId) || voiceId;
          agentUpdate.openaiVoice = voiceId;
        } else {
          agentUpdate.voiceProvider = 'aws_polly';
          agentUpdate.awsPollyVoiceId = voiceId;
          agentUpdate.openaiVoice = voiceId;
        }
      }
      if (voiceTone !== undefined) agentUpdate.voiceTone = voiceTone;
      if (systemPrompt !== undefined) agentUpdate.systemPrompt = systemPrompt;
      if (firstMessage !== undefined) agentUpdate.firstMessage = firstMessage;

      if (Object.keys(agentUpdate).length > 0) {
        await db
          .update(agents)
          .set(agentUpdate)
          .where(and(eq(agents.id, deptAgent.agentId), eq(agents.userId, req.userId!)));
      }

      console.log(`[Deprock] Updated agent config for departmentAgent ${departmentAgentId}: voice=${voiceId || 'unchanged'}, tone=${voiceTone || 'unchanged'}, prompt=${!!systemPrompt}, firstMessage=${!!firstMessage}`);

      res.json({ success: true, departmentAgentId, agentId: deptAgent.agentId });
    } catch (error: any) {
      console.error("[Deprock] Update agent config error:", error);
      res.status(500).json({ error: "Failed to update agent configuration" });
    }
  });

  router.get("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json(deptAgents.map(da => ({
        ...da.departmentAgent,
        agent: da.agent,
      })));
    } catch (error: any) {
      console.error("[Deprock] Get agents error:", error);
      res.status(500).json({ error: "Failed to fetch department agents" });
    }
  });

  router.get("/ivr/all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      res.json(ivrConfigs);
    } catch (error: any) {
      console.error("[Deprock] Get IVR configs error:", error);
      res.status(500).json({ error: "Failed to fetch IVR configurations" });
    }
  });

  router.post("/ivr", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, phoneNumberId, name, isActive, greetingMessage, voiceId, voiceName, menuOptions, languageOptions, fallbackDepartmentId } = req.body;

      if (phoneNumberId) {
        const phoneCheck = await db
          .select()
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.userId, req.userId!)))
          .limit(1);
        if (phoneCheck.length === 0) {
          return res.status(400).json({ error: "Invalid phone number" });
        }
      }

      if (fallbackDepartmentId) {
        const deptCheck = await db
          .select()
          .from(departments)
          .where(and(eq(departments.id, fallbackDepartmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
          .limit(1);
        if (deptCheck.length === 0) {
          return res.status(400).json({ error: "Invalid fallback department" });
        }
      }

      if (menuOptions && Array.isArray(menuOptions)) {
        for (const option of menuOptions) {
          if (option.departmentId) {
            const optDeptCheck = await db
              .select()
              .from(departments)
              .where(and(eq(departments.id, option.departmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
              .limit(1);
            if (optDeptCheck.length === 0) {
              return res.status(400).json({ error: `Invalid department in menu option: ${option.label}` });
            }
          }
        }
      }

      if (id) {
        const updated = await db
          .update(ivrConfigurations)
          .set({
            phoneNumberId,
            name,
            isActive,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions,
            languageOptions,
            fallbackDepartmentId,
            updatedAt: new Date(),
          })
          .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')))
          .returning();

        res.json(updated[0]);
      } else {
        let finalMenuOptions = menuOptions;
        if (!menuOptions || menuOptions.length === 0) {
          const userDepartments = await db
            .select()
            .from(departments)
            .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
            .orderBy(asc(departments.sortOrder));
          
          if (userDepartments.length > 0) {
            finalMenuOptions = userDepartments.map((dept, idx) => ({
              key: String(idx + 1),
              label: dept.name,
              departmentId: dept.id,
            }));
            console.log(`[Deprock] Auto-populated ${finalMenuOptions.length} departments into menu options`);
          }
        }

        const newIvr = await db
          .insert(ivrConfigurations)
          .values({
            userId: req.userId!,
            phoneNumberId,
            name: name || "Auto Distribution",
            isActive: isActive ?? true,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions: finalMenuOptions,
            languageOptions,
            fallbackDepartmentId,
            engineType: 'bedrock-polly',
          })
          .returning();

        if (isActive ?? true) {
          try {
            const domain = getDomain();
            const webhookUrl = `${domain}/api/webhooks/twilio/incoming`;

            const userPhones = await db
              .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber, twilioSid: phoneNumbers.twilioSid })
              .from(phoneNumbers)
              .where(and(
                eq(phoneNumbers.userId, req.userId!),
                eq(phoneNumbers.isSystemPool, false),
                eq(phoneNumbers.status, 'active')
              ));

            for (const ph of userPhones) {
              if (!ph.twilioSid) continue;
              try {
                console.log(`[Deprock] Configuring Twilio webhook for phone ${ph.phoneNumber}: ${webhookUrl}`);
                await twilioService.updatePhoneNumber(ph.twilioSid, { voiceUrl: webhookUrl });
                console.log(`[Deprock] Twilio webhook configured for ${ph.phoneNumber}`);
              } catch (phErr: any) {
                console.error(`[Deprock] Failed to configure webhook for ${ph.phoneNumber}:`, phErr.message);
              }
            }
          } catch (twilioError: any) {
            console.error("[Deprock] Failed to configure Twilio webhooks:", twilioError.message);
          }
        }

        res.status(201).json(newIvr[0]);
      }
    } catch (error: any) {
      console.error("[Deprock] Save IVR config error:", error);
      res.status(500).json({ error: "Failed to save IVR configuration" });
    }
  });

  router.patch("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, isActive, greetingMessage, voiceId, languageOptions } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (greetingMessage !== undefined) updateData.greetingMessage = greetingMessage;
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (languageOptions !== undefined) updateData.languageOptions = languageOptions;

      const updated = await db
        .update(ivrConfigurations)
        .set(updateData)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Deprock] Update IVR config error:", error);
      res.status(500).json({ error: "Failed to update IVR configuration" });
    }
  });

  router.delete("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Delete IVR config error:", error);
      res.status(500).json({ error: "Failed to delete IVR configuration" });
    }
  });

  router.post("/sync-webhooks", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const hasActiveIvr = await db
        .select({ id: ivrConfigurations.id })
        .from(ivrConfigurations)
        .where(and(
          eq(ivrConfigurations.userId, req.userId!),
          eq(ivrConfigurations.isActive, true),
          eq(ivrConfigurations.engineType, 'bedrock-polly')
        ))
        .limit(1);

      if (hasActiveIvr.length === 0) {
        return res.status(400).json({ error: "No active Deprock IVR configuration found" });
      }

      const domain = getDomain();
      const webhookUrl = `${domain}/api/webhooks/twilio/incoming`;

      const userPhones = await db
        .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber, twilioSid: phoneNumbers.twilioSid })
        .from(phoneNumbers)
        .where(and(
          eq(phoneNumbers.userId, req.userId!),
          eq(phoneNumbers.isSystemPool, false),
          eq(phoneNumbers.status, 'active')
        ));

      const results: { phoneNumber: string; success: boolean; error?: string }[] = [];

      for (const ph of userPhones) {
        if (!ph.twilioSid) {
          results.push({ phoneNumber: ph.phoneNumber, success: false, error: "No Twilio SID" });
          continue;
        }
        try {
          await twilioService.updatePhoneNumber(ph.twilioSid, { voiceUrl: webhookUrl });
          results.push({ phoneNumber: ph.phoneNumber, success: true });
          console.log(`[Deprock] Webhook synced for ${ph.phoneNumber}`);
        } catch (err: any) {
          results.push({ phoneNumber: ph.phoneNumber, success: false, error: err.message });
          console.error(`[Deprock] Webhook sync failed for ${ph.phoneNumber}:`, err.message);
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ success: true, synced: successCount, total: userPhones.length, results });
    } catch (error: any) {
      console.error("[Deprock] Sync webhooks error:", error);
      res.status(500).json({ error: "Failed to sync webhooks" });
    }
  });

  router.get("/stats/overview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .orderBy(asc(departments.sortOrder));

      const deptStats = await Promise.all(
        userDepartments.map(async (dept) => {
          const deptAgentData = await db
            .select({
              departmentAgent: departmentAgents,
              agent: agents,
            })
            .from(departmentAgents)
            .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
            .where(eq(departmentAgents.departmentId, dept.id));

          return {
            ...dept,
            agentCount: deptAgentData.length,
            languages: [...new Set(deptAgentData.map(a => a.departmentAgent.language))],
            assignedAgents: deptAgentData.map(da => ({
              id: da.departmentAgent.id,
              agentId: da.departmentAgent.agentId,
              agentName: da.agent.name,
              language: da.departmentAgent.language,
              systemPrompt: da.departmentAgent.systemPrompt || da.agent.systemPrompt,
              voiceTone: da.departmentAgent.voiceTone || da.agent.voiceTone,
              voiceId: da.agent.openaiVoice || da.agent.awsPollyVoiceId || da.agent.elevenLabsVoiceId,
              voiceProvider: da.agent.voiceProvider,
              knowledgeBaseIds: da.agent.knowledgeBaseIds,
              isPrimary: da.departmentAgent.isPrimary,
              agentType: da.agent.type,
              firstMessage: da.agent.firstMessage,
            })),
          };
        })
      );

      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      const activeIvrCount = ivrConfigs.filter(ivr => ivr.isActive).length;

      res.json({
        departments: deptStats,
        totalDepartments: userDepartments.length,
        activeIvrCount,
        ivrConfigurations: ivrConfigs,
      });
    } catch (error: any) {
      console.error("[Deprock] Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch department stats" });
    }
  });

  router.delete("/all/clear", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepts = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

      const deptIds = userDepts.map(d => d.id);

      let deletedAgentCount = 0;

      await db.transaction(async (tx) => {
        if (deptIds.length > 0) {
          const linkedAgents = await tx
            .select({ agentId: departmentAgents.agentId })
            .from(departmentAgents)
            .where(inArray(departmentAgents.departmentId, deptIds));

          const linkedAgentIds = [...new Set(linkedAgents.map(a => a.agentId))];

          if (linkedAgentIds.length > 0) {
            await tx
              .delete(agents)
              .where(and(inArray(agents.id, linkedAgentIds), eq(agents.userId, req.userId!)));
            deletedAgentCount = linkedAgentIds.length;
          }
        }

        await tx
          .delete(incomingConnections)
          .where(eq(incomingConnections.userId, req.userId!));

        await tx
          .delete(humanIncomingConnections)
          .where(eq(humanIncomingConnections.userId, req.userId!));

        await tx
          .delete(departments)
          .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

        await tx
          .delete(ivrConfigurations)
          .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));
      });

      console.log(`[Deprock] Cleared all departments and ${deletedAgentCount} linked agent(s)`);
      res.json({ success: true, deletedAgents: deletedAgentCount });
    } catch (error: any) {
      console.error("[Deprock] Delete all error:", error);
      res.status(500).json({ error: "Failed to delete all departments" });
    }
  });

  router.post("/voice-preview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId, text, speed, language } = req.body;
      if (!voiceId || !text) {
        return res.status(400).json({ error: "voiceId and text are required" });
      }

      const isElVoice = isElevenLabsVoiceId(voiceId);
      const isCartesia = isCartesiaVoiceId(voiceId);
      const CARTESIA_UNSUPPORTED_LANGS = new Set(['ar']);
      const cartesiaLangUnsupported = isCartesia && language && CARTESIA_UNSUPPORTED_LANGS.has(language);
      const voiceSpeed = typeof speed === 'number'
        ? (isElVoice
            ? Math.max(0.7, Math.min(1.2, speed))
            : Math.max(0.5, Math.min(1.5, speed)))
        : 1.0;

      if (isCartesia && !cartesiaLangUnsupported) {
        if (!cartesiaTTSService.isConfigured()) {
          return res.status(400).json({ error: "Cartesia API key not configured" });
        }
        const realCartesiaId = getCartesiaVoiceId(voiceId);
        const result = await cartesiaTTSService.synthesizeSpeech({
          text,
          voiceId: realCartesiaId,
          language: language || 'en',
          sampleRate: 24000,
          speed: voiceSpeed !== 1.0 ? voiceSpeed : undefined,
          outputContainer: 'wav',
        });
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Disposition", "inline; filename=preview.wav");
        res.send(result.audioStream);
      } else if (isElVoice) {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenLabsApiKey) {
          return res.status(400).json({ error: "ElevenLabs API key not configured" });
        }

        const realVoiceId = getElevenLabsVoiceId(voiceId);
        if (!realVoiceId) {
          return res.status(400).json({ error: "Invalid ElevenLabs voice ID" });
        }

        const elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
        const audioBuffer = await elevenLabsService.generateVoicePreview({
          voiceId: realVoiceId,
          text,
          voiceSettings: { speed: voiceSpeed },
        });

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", "inline; filename=preview.mp3");
        res.send(audioBuffer);
      } else {
        const LANG_POLLY_FALLBACK: Record<string, string> = { ar: 'Hala', hi: 'Kajal', zh: 'Zhiyu', es: 'Lupe', fr: 'Lea' };
        const pollyVoice = cartesiaLangUnsupported ? (LANG_POLLY_FALLBACK[language!] || 'Joanna') : voiceId;
        const prosodyRate = `${Math.round(voiceSpeed * 100)}%`;
        const ssmlText = `<speak><prosody rate="${prosodyRate}">${applyArabicPronunciationFixes(text)}</prosody></speak>`;
        const result = await awsPollyService.synthesizeSpeech({
          text: ssmlText,
          voiceId: pollyVoice,
          engine: 'neural',
          outputFormat: 'mp3',
          textType: 'ssml',
        });

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", "inline; filename=preview.mp3");
        res.send(result.audioStream);
      }
    } catch (error: any) {
      console.error("[Deprock] Voice preview error:", error);
      res.status(500).json({ error: error.message || "Failed to generate voice preview" });
    }
  });

  router.post("/generate-name", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { language, departmentType, voiceTone } = req.body;
      const userId = req.userId!;
      if (!language) {
        return res.status(400).json({ error: "language is required" });
      }

      try {
        const [randomName] = await db
          .select({ name: agentNames.name })
          .from(agentNames)
          .where(eq(agentNames.language, language))
          .orderBy(sql`RANDOM()`)
          .limit(1);

        if (randomName) {
          return res.json({ name: randomName.name });
        }
      } catch (poolErr) {
        console.warn("[Deprock] Agent names pool lookup failed, falling back to OpenAI:", poolErr);
      }

      const langLabel = SUPPORTED_LANGUAGES[language] || language;
      const deptContext = departmentType && departmentType !== 'custom'
        ? ` who works in a ${departmentType} department`
        : '';

      const toneContext = voiceTone
        ? ` The name should feel appropriate for someone with a ${voiceTone} communication style.`
        : '';

      let companyContext = "";
      try {
        const kbEntries = await db
          .select({ title: knowledgeBase.title, content: knowledgeBase.content, type: knowledgeBase.type })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, userId));

        if (kbEntries.length > 0) {
          const excludedTerms = ['home', 'page', 'sign in', 'signin', 'sign up', 'signup', 'login', 'log in', 'register', 'contact', 'about', 'faq', 'search', 'checkout', 'cart', 'privacy', 'terms'];
          const summaryParts: string[] = [];
          for (const entry of kbEntries) {
            const entryTitle = (entry.title || '').toLowerCase().trim();
            if (excludedTerms.some(ex => entryTitle.includes(ex))) {
              continue;
            }
            const snippet = entry.content ? entry.content.substring(0, 200) : "";
            if (snippet) {
              summaryParts.push(`- ${entry.title}: ${snippet}`);
            }
            if (summaryParts.length >= 5) break;
          }
          if (summaryParts.length > 0) {
            companyContext = ` The agent represents a company with this background: ${summaryParts.join("; ")}. Choose a name that fits the company's brand and culture.`;
          }
        }
      } catch (kbErr) {
        console.warn("[Deprock] Could not fetch knowledge base for name generation:", kbErr);
      }

      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 50,
        temperature: 1.0,
        messages: [
          {
            role: "user",
            content: (() => {
              const latinScriptLangs = ['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'dutch', 'swedish', 'norwegian', 'finnish', 'polish', 'turkish'];
              const isLatinScript = latinScriptLangs.some(l => langLabel.toLowerCase().includes(l));
              const scriptInstruction = isLatinScript
                ? `The name must use standard Latin/English letters as appropriate for a ${langLabel} speaker.`
                : `The name MUST be written in the native script/alphabet of ${langLabel} (e.g. Arabic script for Arabic, Kanji/Hiragana for Japanese, Hangul for Korean, Devanagari for Hindi, Chinese characters for Chinese). Do NOT transliterate into Latin/English letters.`;
              return `Generate exactly one realistic full name (first name and last name) for a person${deptContext} who is a native ${langLabel} speaker.${toneContext}${companyContext} ${scriptInstruction} Output ONLY the name, nothing else.`;
            })(),
          },
        ],
      });

      const name = response.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || "";
      res.json({ name });
    } catch (error: any) {
      console.error("[Deprock] Generate name error:", error);
      res.status(500).json({ error: error.message || "Failed to generate name" });
    }
  });

  router.post("/generate-first-message", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { language, departmentType, departmentName, voiceTone, agentName, companyName } = req.body;
      const userId = req.userId!;
      if (!language) {
        return res.status(400).json({ error: "language is required" });
      }

      const langLabel = SUPPORTED_LANGUAGES[language] || language;
      
      // Build context with agent name, department, and company
      const deptDisplay = departmentName || departmentType || 'General';
      const nameContext = agentName
        ? `The agent's name is "${agentName}" and they work in the "${deptDisplay}" department.`
        : `The agent works in the "${deptDisplay}" department.`;

      const toneContext = voiceTone
        ? `The tone should be ${voiceTone}.`
        : 'The tone should be professional.';

      let companyName_resolved = companyName;
      if (companyName_resolved) {
        companyName_resolved = companyName_resolved
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .replace(/\.[a-z]{2,10}(\/.*)?$/i, '')
          .replace(/[-_]/g, ' ')
          .trim();
        if (companyName_resolved) {
          companyName_resolved = companyName_resolved.charAt(0).toUpperCase() + companyName_resolved.slice(1);
        }
      }
      
      try {
        if (!companyName_resolved) {
          const kbEntries = await db
            .select({ title: knowledgeBase.title, type: knowledgeBase.type })
            .from(knowledgeBase)
            .where(eq(knowledgeBase.userId, userId));

          if (kbEntries.length > 0) {
            const excludedTerms = ['home', 'page', 'sign in', 'signin', 'sign up', 'signup', 'login', 'log in', 'register', 'contact', 'about', 'faq', 'search', 'checkout', 'cart', 'privacy', 'terms', 'product', 'plan', 'package', 'bundle', 'price', 'offer', 'gb', 'days', 'sim'];
            const companyEntry = kbEntries.find(e => {
              const t = (e.title || '').toLowerCase().trim();
              return t && !excludedTerms.some(ex => t.includes(ex));
            });
            if (companyEntry?.title) {
              let resolved = companyEntry.title
                .replace(/^https?:\/\//i, '')
                .replace(/^www\./i, '')
                .replace(/\.[a-z]{2,10}(\/.*)?$/i, '')
                .replace(/[-_]/g, ' ')
                .trim();
              if (resolved) {
                companyName_resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
              }
            }
          }
        }
      } catch (kbErr) {
        console.warn("[Deprock] Could not fetch knowledge base for first message generation:", kbErr);
      }

      const companyPart = companyName_resolved 
        ? ` Include the company name "${companyName_resolved}" naturally in the greeting.`
        : '';

      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 200,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You generate short, natural first greeting messages for AI phone agents. The message should be 1-2 sentences max. It is the very first thing the agent says when answering a call. ${toneContext} Include the agent's name naturally in the introduction. NEVER mention any specific products, plans, packages, prices, or offers — the greeting is purely a welcome message. The ENTIRE message MUST be written in ${langLabel}. Output ONLY the greeting message, no explanations or markdown.`
          },
          {
            role: "user",
            content: `Generate a first greeting message. ${nameContext}${companyPart} The message should:
1. Include the agent's name (${agentName || 'unspecified'})
2. Mention the department/team (${deptDisplay})
${companyName_resolved ? `3. Include the company name "${companyName_resolved}"` : ''}
4. Feel natural, warm, and match the ${voiceTone || 'professional'} tone
5. Be suitable for answering phone calls
6. NEVER mention any specific products, plans, packages, prices, SKUs, or offers
Write it entirely in ${langLabel}.`
          }
        ],
      });

      const firstMessage = response.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || "";
      res.json({ firstMessage });
    } catch (error: any) {
      console.error("[Deprock] Generate first message error:", error);
      const fallbackMessages: Record<string, string> = {
        en: "Hello! How can I help you today?", es: "¡Hola! ¿En qué puedo ayudarle hoy?",
        fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?", de: "Hallo! Wie kann ich Ihnen heute helfen?",
        it: "Ciao! Come posso aiutarla oggi?", pt: "Olá! Como posso ajudá-lo hoje?",
        ar: "مرحباً! كيف يمكنني مساعدتك اليوم؟", ja: "こんにちは！本日はどのようなご用件でしょうか？",
      };
      const lang = req.body?.language || "en";
      const fallback = fallbackMessages[lang] || fallbackMessages.en;
      res.json({ firstMessage: fallback, fallback: true });
    }
  });

  router.post("/generate-prompt", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { departmentType, departmentName, language, agentName, features } = req.body;
      const userId = req.userId!;

      if (!departmentType || !departmentName) {
        return res.status(400).json({ error: "departmentType and departmentName are required" });
      }

      const langLabel = language || "English";
      const featuresList: string[] = [];
      if (features?.enableLanguageDetection) featuresList.push("auto-detect caller language and respond in their language");
      if (features?.enableEndConversation) featuresList.push("intelligently end conversations when appropriate using farewell phrases");
      if (features?.enableAppointmentBooking) featuresList.push("book appointments during calls");
      if (features?.enableRecording) featuresList.push("inform callers that the call is being recorded for quality and training");
      if (features?.enableTransfer) featuresList.push("transfer calls to human operators when needed");

      const featuresContext = featuresList.length > 0
        ? `\nThe agent has these features enabled: ${featuresList.join(", ")}.`
        : "";

      const agentNameContext = agentName
        ? `\nThe agent's name is "${agentName}". Use this name when the agent introduces itself. The name should appear naturally in the language of the prompt.`
        : "";

      let companyContext = "";
      try {
        const kbEntries = await db
          .select({ title: knowledgeBase.title, content: knowledgeBase.content, type: knowledgeBase.type })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, userId));

        if (kbEntries.length > 0) {
          const summaryParts: string[] = [];
          for (const entry of kbEntries) {
            const snippet = entry.content ? entry.content.substring(0, 300) : "";
            if (snippet) {
              summaryParts.push(`- ${entry.title}: ${snippet}`);
            } else {
              summaryParts.push(`- ${entry.title} (${entry.type})`);
            }
            if (summaryParts.length >= 15) break;
          }
          companyContext = `\n\nCOMPANY KNOWLEDGE BASE (use this to personalize the prompt with real company details, products, services, and policies):\n${summaryParts.join("\n")}`;
        }
      } catch (kbErr) {
        console.warn("[Deprock] Could not fetch knowledge base for prompt generation:", kbErr);
      }

      const openai = await getOpenAIClient();

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `You are an expert at writing system prompts for AI phone call agents. Generate a professional, detailed system prompt for a department agent. The prompt should be specific to the department's purpose and include behavioral guidelines, tone instructions, and handling procedures. If company knowledge base information is provided, use it to personalize the prompt with real company details — reference actual products, services, policies, and brand identity instead of using generic placeholders. The entire prompt MUST be written in ${langLabel}. Output ONLY the system prompt text, no explanations or markdown.`
          },
          {
            role: "user",
            content: `Generate a system prompt for a "${departmentName}" department agent.
Department type: ${departmentType}
Primary language: ${langLabel}${agentNameContext}${featuresContext}${companyContext}

The prompt should:
- Define the agent's role clearly for a ${departmentType} department
- Use the department name "${departmentName}" as it is (already translated to ${langLabel})
- Set the appropriate tone and communication style
- Include specific handling procedures for ${departmentType} scenarios
- Provide guidelines for common ${departmentType} situations
- Be professional yet conversational
- If company knowledge base data is available, incorporate specific company details (products, services, policies, brand name) into the prompt instead of generic placeholders
- The ENTIRE prompt must be written in ${langLabel}`
          }
        ],
      });

      const generatedPrompt = response.choices[0]?.message?.content?.trim() || "";
      res.json({ prompt: generatedPrompt });
    } catch (error: unknown) {
      console.error("[Deprock] Generate prompt error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { status?: number })?.status;
      const errorCode = (error as { code?: string })?.code;

      if (msg.includes("No OpenAI API key found") || msg.includes("OPENAI_API_KEY")) {
        return res.status(503).json({
          error: "OpenAI API key is not configured. Please set it in Admin Settings → Credentials → OpenAI, or set the OPENAI_API_KEY environment variable.",
          code: "OPENAI_KEY_MISSING",
        });
      }

      if (statusCode === 401 || errorCode === 'invalid_api_key') {
        return res.status(503).json({
          error: "OpenAI API key is invalid or expired. Please update it in Admin Settings → Credentials → OpenAI.",
          code: "OPENAI_KEY_INVALID",
        });
      }
      res.status(500).json({ error: msg || "Failed to generate prompt" });
    }
  });

  router.post('/tts-preview', async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId: rawVoiceId, text, engine, speed } = req.body;
      
      if (!rawVoiceId || !text) {
        return res.status(400).json({ error: 'voiceId and text are required' });
      }

      const voiceId = rawVoiceId.replace(/^Polly\./, '').replace(/-Neural$/, '');

      if (!awsPollyService.isConfigured()) {
        return res.status(503).json({ error: 'AWS Polly is not configured' });
      }

      const selectedEngine = engine || 'neural';
      const voiceSpeed = typeof speed === 'number' ? Math.max(0.5, Math.min(1.5, speed)) : 0.92;

      const correctedText = applyArabicPronunciationFixes(text);
      const prosodyRate = `${Math.round(voiceSpeed * 100)}%`;
      const ssmlText = `<speak><prosody rate="${prosodyRate}">${correctedText}</prosody></speak>`;

      let result;
      try {
        result = await awsPollyService.synthesizeSpeech({
          text: ssmlText,
          voiceId,
          engine: selectedEngine as any,
          outputFormat: 'mp3',
          textType: 'ssml',
        });
      } catch (engineError: any) {
        if (selectedEngine !== 'neural') {
          result = await awsPollyService.synthesizeSpeech({
            text: ssmlText,
            voiceId,
            engine: 'neural' as any,
            outputFormat: 'mp3',
            textType: 'ssml',
          });
        } else {
          throw engineError;
        }
      }

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.audioStream.length.toString(),
        'Cache-Control': 'no-cache',
      });
      return res.send(result.audioStream);
    } catch (error: any) {
      console.error('[Deprock TTS Preview] Error:', error.message);
      return res.status(500).json({ error: 'Failed to synthesize speech' });
    }
  });

  router.post('/ivr-simulate', async (req: AuthRequest, res: Response) => {
    try {
      const { step, ivrId, digits, lang, attempt } = req.body;
      
      if (!ivrId) {
        return res.status(400).json({ error: 'ivrId is required' });
      }

      const ivrConfig = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, ivrId), eq(ivrConfigurations.userId, req.userId!)))
        .limit(1);

      if (!ivrConfig.length) {
        return res.status(404).json({ error: 'IVR configuration not found' });
      }

      const config = ivrConfig[0];
      const engineType = config.engineType || 'default';

      if (engineType === 'bedrock-polly') {
        const baseUrl = getDomain();
        let url = '';
        const callSid = 'SIM_' + Date.now();
        const caller = '+15551234567';
        
        switch (step) {
          case 'answer':
            url = `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&callSid=${callSid}&caller=${encodeURIComponent(caller)}&attempt=${attempt || 1}`;
            break;
          case 'handle-language':
            url = `${baseUrl}/api/deprock/ivr/handle-language?ivrId=${encodeURIComponent(ivrId)}&callSid=${callSid}&caller=${encodeURIComponent(caller)}&attempt=${attempt || 1}`;
            break;
          case 'handle-selection':
            url = `${baseUrl}/api/deprock/ivr/handle-selection?ivrId=${encodeURIComponent(ivrId)}&callSid=${callSid}&caller=${encodeURIComponent(caller)}&lang=${encodeURIComponent(lang || 'en')}&attempt=${attempt || 1}`;
            break;
          default:
            return res.status(400).json({ error: 'Invalid step' });
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            CallSid: 'SIM_' + Date.now(),
            From: '+15551234567',
            To: '+10000000000',
            ...(digits ? { Digits: digits } : {}),
          }).toString(),
        });

        const twiml = await response.text();
        return res.type('text/xml').send(twiml);
      }

      const twiml = await generateDeptIvrTwiml(config, step, digits, lang);
      return res.type('text/xml').send(twiml);
    } catch (error: any) {
      console.error('[IVR Simulate] Error:', error.message);
      return res.status(500).json({ error: 'Failed to simulate IVR step' });
    }
  });

  router.post("/kb-mastermind/run", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { runKBMastermindForUser } = await import('../services/kb-mastermind');
      const { departmentId } = req.body;

      if (departmentId) {
        const [dept] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.id, departmentId), eq(departments.userId, req.userId!)))
          .limit(1);
        if (!dept) {
          return res.status(404).json({ error: 'Department not found' });
        }
      }

      const stats = await runKBMastermindForUser(req.userId!, departmentId || undefined);
      return res.json({ success: true, stats });
    } catch (error: any) {
      console.error('[KB Mastermind] Manual trigger error:', error.message);
      return res.status(500).json({ error: 'KB Mastermind run failed', message: error.message });
    }
  });

  router.get("/kb-mastermind/status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { getKBMastermindStatus } = await import('../services/kb-mastermind');
      const status = getKBMastermindStatus();
      return res.json({
        success: true,
        isRunning: status.isRunning,
        lastRunAt: status.lastRunAt,
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
  });

  return router;
}

export function createDeprockIvrAudioRoutes() {
  const router = Router();

  router.get("/ivr-greeting-audio/:ivrId", async (req: Request, res: Response) => {
    try {
      const { ivrId } = req.params;
      const textParam = req.query.text as string | undefined;
      const voiceIdParam = req.query.voiceId as string | undefined;
      const langIdx = req.query.idx as string | undefined;

      const ivrConfig = await db
        .select()
        .from(ivrConfigurations)
        .where(eq(ivrConfigurations.id, ivrId))
        .limit(1);

      if (!ivrConfig.length) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      const config = ivrConfig[0];
      let voiceId = voiceIdParam || config.voiceId || "Joanna";
      let text = textParam || config.greetingMessage || "Thank you for calling.";

      if (langIdx !== undefined) {
        const langOptions = config.languageOptions as { voiceId?: string; greeting?: string }[] | null;
        const idx = parseInt(langIdx, 10);
        if (langOptions && langOptions[idx]) {
          if (!voiceIdParam && langOptions[idx].voiceId) {
            voiceId = langOptions[idx].voiceId!;
          }
          if (!textParam && langOptions[idx].greeting) {
            text = langOptions[idx].greeting!;
          }
        }
      }

      const speedParam = req.query.speed as string | undefined;
      const voiceSpeed = speedParam ? Math.max(0.5, Math.min(1.5, parseFloat(speedParam))) : 0.92;
      const cacheKey = `deprock-${ivrId}-${voiceId}-${hashText(text)}-spd${voiceSpeed}`;
      const cached = deprockTtsAudioCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < DEPROCK_TTS_CACHE_TTL) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(cached.buffer);
      }

      let audioBuffer: Buffer;
      const isElVoice = isElevenLabsVoiceId(voiceId);

      if (isElVoice) {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        const realId = getElevenLabsVoiceId(voiceId);

        if (elevenLabsApiKey && realId) {
          try {
            const elService = new ElevenLabsService(elevenLabsApiKey);
            audioBuffer = await elService.generateVoicePreview({ voiceId: realId, text, voiceSettings: { speed: voiceSpeed } });
          } catch (err) {
            console.warn('[Deprock IVR Audio] ElevenLabs TTS failed, falling back to Polly:', err);
            const prosodyRate = `${Math.round(voiceSpeed * 100)}%`;
            const ssmlText = `<speak><prosody rate="${prosodyRate}">${text}</prosody></speak>`;
            const result = await awsPollyService.synthesizeSpeech({
              text: ssmlText, voiceId: 'Joanna', engine: 'neural', outputFormat: 'mp3', textType: 'ssml',
            });
            audioBuffer = result.audioStream;
          }
        } else {
          const prosodyRate = `${Math.round(voiceSpeed * 100)}%`;
          const ssmlText = `<speak><prosody rate="${prosodyRate}">${text}</prosody></speak>`;
          const result = await awsPollyService.synthesizeSpeech({
            text: ssmlText, voiceId: 'Joanna', engine: 'neural', outputFormat: 'mp3', textType: 'ssml',
          });
          audioBuffer = result.audioStream;
        }
      } else {
        const prosodyRate = `${Math.round(voiceSpeed * 100)}%`;
        const ssmlText = `<speak><prosody rate="${prosodyRate}">${text}</prosody></speak>`;
        const result = await awsPollyService.synthesizeSpeech({
          text: ssmlText, voiceId, engine: 'neural', outputFormat: 'mp3', textType: 'ssml',
        });
        audioBuffer = result.audioStream;
      }

      deprockTtsAudioCache.set(cacheKey, { buffer: audioBuffer, timestamp: Date.now() });

      if (deprockTtsAudioCache.size > 100) {
        const now = Date.now();
        for (const [key, val] of deprockTtsAudioCache) {
          if (now - val.timestamp > DEPROCK_TTS_CACHE_TTL) {
            deprockTtsAudioCache.delete(key);
          }
        }
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("[Deprock IVR Audio] Error generating TTS audio:", error);
      res.status(500).json({ error: error.message || "Failed to generate audio" });
    }
  });

  return router;
}

const deprockTtsAudioCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const DEPROCK_TTS_CACHE_TTL = 10 * 60 * 1000;

function getElevenLabsVoiceId(internalId: string): string | null {
  const voiceMap: Record<string, string> = {
    el_rachel: "21m00Tcm4TlvDq8ikWAM",
    el_domi: "AZnzlk1XvdvUeBnXmlld",
    el_bella: "EXAVITQu4vr4xnSDxMaL",
    el_antoni: "ErXwobaYiN019PkySvjV",
    el_elli: "MF3mGyEYCl7XYWbV9V6O",
    el_josh: "TxGEqnHWrfWFTfGW9XjX",
    el_arnold: "VR6AewLTigWG4xSOukaG",
    el_adam: "pNInz6obpgDQGcFmaJgB",
    el_sam: "yoZ06aMxZJJ28mfd3POQ",
    el_nicole: "piTKgcLEGmPE4e6mEKli",
    el_marie: "6vTyAgAT8PncODBcLjRf",
    el_pierre: "aQROLel5sQbj1vuIVi6B",
    el_giulia: "gfKKsLN1k0oYYN9n2dXX",
    el_marco: "W71zT1VwIFFx3mMGH2uZ",
    el_xiaoli: "ByhETIclHirOlWnWKhHc",
    el_wei: "4VZIsMPtgggwNg7OXbPY",
    el_priya: "KYiVPerWcenyBTIvWbfY",
    el_raj: "zT03pEAEi0VHKciJODfn",
    el_fatima: "u0TsaWvt0v8migutHM3M",
    el_omar: "G1HOkzin3NMwRHSq60UI",
  };
  if (voiceMap[internalId]) return voiceMap[internalId];
  if (!internalId.startsWith("el_") && /^[a-zA-Z0-9]{10,}$/.test(internalId)) return internalId;
  return null;
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}
