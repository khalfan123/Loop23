import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Building2,
  Headphones,
  ShoppingCart,
  Calendar,
  CalendarCheck,
  Settings,
  Plus,
  Save,
  Trash2,
  Loader2,
  GitBranch,
  Mic,
  Globe,
  Languages,
  Check,
  Volume2,
  Square,
  Circle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sparkles,
  Pencil,
  CreditCard,
  Users,
  Megaphone,
  ClipboardList,
} from "lucide-react";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
  voiceName: string | null;
  openaiVoice: string | null;
  systemPrompt: string | null;
  firstMessage: string | null;
  voiceTone: string | null;
}

interface LanguageAgent {
  id: string;
  language: string;
  agentId: string | null;
  agentName: string | null;
  firstMessage: string | null;
  systemPrompt: string | null;
  voiceId: string | null;
  voiceTone: string | null;
}

const NATIVE_NAME_EXAMPLES: Record<string, string[]> = {
  en: ["Sarah Mitchell", "James Anderson", "Emily Parker", "David Thompson", "Rachel Foster"],
  es: ["María García López", "Carlos Rodríguez", "Sofía Martínez", "Alejandro Herrera", "Lucía Fernández"],
  fr: ["Marie Dupont", "Pierre Laurent", "Camille Moreau", "Antoine Lefevre", "Chloé Bernard"],
  de: ["Anna Schmidt", "Hans Müller", "Lena Fischer", "Maximilian Weber", "Sophie Bauer"],
  it: ["Giulia Rossi", "Marco Bianchi", "Francesca Conti", "Alessandro Ferrari", "Elena Moretti"],
  pt: ["Ana Silva", "João Oliveira", "Beatriz Santos", "Pedro Costa", "Mariana Ferreira"],
  zh: ["李小明", "王美玲", "张小红", "陈志强", "刘晓芳"],
  hi: ["प्रिया शर्मा", "राहुल वर्मा", "अनिता गुप्ता", "विकास सिंह", "नेहा पटेल"],
  ar: ["خلفان السلامي", "فاطمة الزهراء", "أحمد المنصوري", "نور الهدى", "سلطان الكعبي"],
  ja: ["田中さくら", "佐藤太郎", "山本花子", "鈴木一郎", "高橋美咲"],
  ko: ["김지민", "이민수", "박서연", "최준호", "정하윤"],
  nl: ["Sophie de Vries", "Jan van den Berg", "Emma Bakker", "Thomas Visser", "Lisa Jansen"],
  pl: ["Anna Kowalska", "Piotr Wiśniewski", "Katarzyna Nowak", "Tomasz Kamiński", "Maja Lewandowska"],
  sv: ["Astrid Lindgren", "Erik Johansson", "Maja Andersson", "Oscar Nilsson", "Elsa Eriksson"],
  no: ["Ingrid Hansen", "Ole Johansen", "Nora Larsen", "Magnus Olsen", "Sofie Berg"],
  fi: ["Aino Virtanen", "Matti Korhonen", "Emilia Mäkinen", "Juhani Laine", "Saara Nieminen"],
  da: ["Ida Nielsen", "Lars Jensen", "Freja Pedersen", "Mikkel Andersen", "Clara Christensen"],
  tr: ["Ayşe Yılmaz", "Mehmet Kaya", "Elif Demir", "Burak Çelik", "Zeynep Öztürk"],
};

function getRandomName(language: string, agentId: string): string {
  const names = NATIVE_NAME_EXAMPLES[language] || NATIVE_NAME_EXAMPLES.en;
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash |= 0;
  }
  return "e.g. " + names[Math.abs(hash) % names.length];
}

const DEFAULT_FIRST_MESSAGES: Record<string, string> = {
  en: "Hello! How can I help you today?",
  es: "¡Hola! ¿En qué puedo ayudarle hoy?",
  fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
  de: "Hallo! Wie kann ich Ihnen heute helfen?",
  it: "Ciao! Come posso aiutarla oggi?",
  pt: "Olá! Como posso ajudá-lo hoje?",
  zh: "您好！今天我能为您做些什么？",
  hi: "नमस्ते! आज मैं आपकी कैसे मदद कर सकता हूं?",
  ar: "مرحباً! كيف يمكنني مساعدتك اليوم؟",
  ja: "こんにちは！本日はどのようなご用件でしょうか？",
  ko: "안녕하세요! 오늘 어떻게 도와드릴까요?",
  nl: "Hallo! Hoe kan ik u vandaag helpen?",
  pl: "Dzień dobry! Jak mogę Panu/Pani dzisiaj pomóc?",
  sv: "Hej! Hur kan jag hjälpa dig idag?",
  no: "Hei! Hvordan kan jeg hjelpe deg i dag?",
  fi: "Hei! Kuinka voin auttaa sinua tänään?",
  da: "Hej! Hvordan kan jeg hjælpe dig i dag?",
  tr: "Merhaba! Size bugün nasıl yardımcı olabilirim?",
};

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "da", label: "Danish" },
  { code: "tr", label: "Turkish" },
];

const POLLY_VOICES = [
  { id: 'Joanna', name: 'Joanna', gender: 'female', style: 'professional', languages: ['en'] },
  { id: 'Matthew', name: 'Matthew', gender: 'male', style: 'conversational', languages: ['en'] },
  { id: 'Ivy', name: 'Ivy', gender: 'female', style: 'youthful', languages: ['en'] },
  { id: 'Ruth', name: 'Ruth', gender: 'female', style: 'authoritative', languages: ['en'] },
  { id: 'Stephen', name: 'Stephen', gender: 'male', style: 'deep', languages: ['en'] },
  { id: 'Gregory', name: 'Gregory', gender: 'male', style: 'calm', languages: ['en'] },
  { id: 'Danielle', name: 'Danielle', gender: 'female', style: 'energetic', languages: ['en'] },
  { id: 'Salli', name: 'Salli', gender: 'female', style: 'pleasant', languages: ['en'] },
  { id: 'Kimberly', name: 'Kimberly', gender: 'female', style: 'bright', languages: ['en'] },
  { id: 'Kendra', name: 'Kendra', gender: 'female', style: 'polished', languages: ['en'] },
  { id: 'Justin', name: 'Justin', gender: 'male', style: 'youthful', languages: ['en'] },
  { id: 'Joey', name: 'Joey', gender: 'male', style: 'casual', languages: ['en'] },
  { id: 'Kevin', name: 'Kevin', gender: 'male', style: 'energetic', languages: ['en'] },
  { id: 'Amy', name: 'Amy', gender: 'female', style: 'professional', languages: ['en'] },
  { id: 'Arthur', name: 'Arthur', gender: 'male', style: 'warm', languages: ['en'] },
  { id: 'Brian', name: 'Brian', gender: 'male', style: 'natural', languages: ['en'] },
  { id: 'Emma', name: 'Emma', gender: 'female', style: 'natural', languages: ['en'] },
  { id: 'Aria', name: 'Aria', gender: 'female', style: 'expressive', languages: ['en'] },
  { id: 'Ayanda', name: 'Ayanda', gender: 'female', style: 'vibrant', languages: ['en'] },
  { id: 'Olivia', name: 'Olivia', gender: 'female', style: 'warm', languages: ['en'] },
  { id: 'Niamh', name: 'Niamh', gender: 'female', style: 'natural', languages: ['en'] },
  { id: 'Kajal', name: 'Kajal', gender: 'female', style: 'natural', languages: ['en', 'hi'] },
  { id: 'Lupe', name: 'Lupe', gender: 'female', style: 'natural', languages: ['es'] },
  { id: 'Pedro', name: 'Pedro', gender: 'male', style: 'natural', languages: ['es'] },
  { id: 'Lucia', name: 'Lucia', gender: 'female', style: 'professional', languages: ['es'] },
  { id: 'Sergio', name: 'Sergio', gender: 'male', style: 'confident', languages: ['es'] },
  { id: 'Mia', name: 'Mia', gender: 'female', style: 'warm', languages: ['es'] },
  { id: 'Andres', name: 'Andres', gender: 'male', style: 'natural', languages: ['es'] },
  { id: 'Lea', name: 'Lea', gender: 'female', style: 'elegant', languages: ['fr'] },
  { id: 'Remi', name: 'Remi', gender: 'male', style: 'smooth', languages: ['fr'] },
  { id: 'Gabrielle', name: 'Gabrielle', gender: 'female', style: 'natural', languages: ['fr'] },
  { id: 'Liam', name: 'Liam', gender: 'male', style: 'clear', languages: ['fr'] },
  { id: 'Isabelle', name: 'Isabelle', gender: 'female', style: 'warm', languages: ['fr'] },
  { id: 'Vicki', name: 'Vicki', gender: 'female', style: 'friendly', languages: ['de'] },
  { id: 'Daniel', name: 'Daniel', gender: 'male', style: 'confident', languages: ['de'] },
  { id: 'Hannah', name: 'Hannah', gender: 'female', style: 'natural', languages: ['de'] },
  { id: 'Bianca', name: 'Bianca', gender: 'female', style: 'elegant', languages: ['it'] },
  { id: 'Adriano', name: 'Adriano', gender: 'male', style: 'smooth', languages: ['it'] },
  { id: 'Camila', name: 'Camila', gender: 'female', style: 'warm', languages: ['pt'] },
  { id: 'Thiago', name: 'Thiago', gender: 'male', style: 'natural', languages: ['pt'] },
  { id: 'Vitoria', name: 'Vitoria', gender: 'female', style: 'professional', languages: ['pt'] },
  { id: 'Ines', name: 'Ines', gender: 'female', style: 'clear', languages: ['pt'] },
  { id: 'Zhiyu', name: 'Zhiyu', gender: 'female', style: 'professional', languages: ['zh'] },
  { id: 'Hiujin', name: 'Hiujin', gender: 'female', style: 'natural', languages: ['zh'] },
  { id: 'Hala', name: 'Hala', gender: 'female', style: 'clear', languages: ['ar'] },
  { id: 'Zayd', name: 'Zayd', gender: 'male', style: 'natural', languages: ['ar'] },
  { id: 'Takumi', name: 'Takumi', gender: 'male', style: 'natural', languages: ['ja'] },
  { id: 'Kazuha', name: 'Kazuha', gender: 'female', style: 'warm', languages: ['ja'] },
  { id: 'Tomoko', name: 'Tomoko', gender: 'female', style: 'clear', languages: ['ja'] },
  { id: 'Seoyeon', name: 'Seoyeon', gender: 'female', style: 'clear', languages: ['ko'] },
  { id: 'Laura', name: 'Laura', gender: 'female', style: 'natural', languages: ['nl'] },
  { id: 'Lisa', name: 'Lisa', gender: 'female', style: 'warm', languages: ['nl'] },
  { id: 'Ola', name: 'Ola', gender: 'female', style: 'friendly', languages: ['pl'] },
  { id: 'Elin', name: 'Elin', gender: 'female', style: 'bright', languages: ['sv'] },
  { id: 'Ida', name: 'Ida', gender: 'female', style: 'natural', languages: ['no'] },
  { id: 'Suvi', name: 'Suvi', gender: 'female', style: 'clear', languages: ['fi'] },
  { id: 'Sofie', name: 'Sofie', gender: 'female', style: 'natural', languages: ['da'] },
  { id: 'Burcu', name: 'Burcu', gender: 'female', style: 'natural', languages: ['tr'] },
];

const ALL_IVR_VOICES = POLLY_VOICES;

const getVoicesForLanguage = (languageCode: string) => {
  return ALL_IVR_VOICES.filter(voice => voice.languages.includes(languageCode));
};

const getDefaultVoiceForLanguage = (langCode: string) => {
  const voices = getVoicesForLanguage(langCode);
  return voices[0]?.id || "Joanna";
};

const getBestVoiceForDept = (deptType: string, langCode: string): string => {
  const voices = getVoicesForLanguage(langCode);
  if (voices.length === 0) return "Joanna";

  const stylePreference: Record<string, string[]> = {
    sales: ["warm", "friendly", "expressive"],
    support: ["professional", "calm", "balanced"],
    scheduling: ["professional", "clear", "balanced"],
    billing: ["professional", "calm", "balanced"],
    hr: ["warm", "friendly", "soft"],
    marketing: ["expressive", "warm", "friendly"],
    complaints: ["calm", "professional", "soft"],
  };
  const preferred = stylePreference[deptType] || stylePreference.support;

  for (const style of preferred) {
    const match = voices.find(v => v.style === style);
    if (match) return match.id;
  }
  return voices[0]?.id || "Joanna";
};

const getBestToneForDept = (deptType: string): string => {
  switch (deptType) {
    case "sales": return "friendly";
    case "support": return "professional";
    case "scheduling": return "professional";
    case "billing": return "professional";
    case "hr": return "friendly";
    case "marketing": return "friendly";
    case "complaints": return "empathetic";
    default: return "professional";
  }
};

const DEFAULT_GREETINGS: Record<string, string> = {
  en: "Thank you for calling. How may I assist you today?",
  es: "Gracias por llamar. ¿En qué puedo ayudarle hoy?",
  fr: "Merci d'avoir appelé. Comment puis-je vous aider aujourd'hui?",
  de: "Vielen Dank für Ihren Anruf. Wie kann ich Ihnen heute helfen?",
  it: "Grazie per aver chiamato. Come posso aiutarla oggi?",
  pt: "Obrigado por ligar. Como posso ajudá-lo hoje?",
  zh: "感谢您的来电。今天我能为您做些什么？",
  hi: "कॉल करने के लिए धन्यवाद। आज मैं आपकी कैसे मदद कर सकता हूं?",
  ar: "شكرا على اتصالك. كيف يمكنني مساعدتك اليوم؟",
  ja: "お電話ありがとうございます。本日はどのようなご用件でしょうか？",
  ko: "전화해 주셔서 감사합니다. 어떻게 도와드릴까요?",
  nl: "Bedankt voor uw telefoontje. Hoe kan ik u vandaag helpen?",
  pl: "Dziękujemy za telefon. Jak mogę Panu/Pani dzisiaj pomóc?",
  sv: "Tack för att du ringer. Hur kan jag hjälpa dig idag?",
  no: "Takk for at du ringer. Hvordan kan jeg hjelpe deg i dag?",
  fi: "Kiitos soitostasi. Kuinka voin auttaa sinua tänään?",
  da: "Tak fordi du ringer. Hvordan kan jeg hjælpe dig i dag?",
  tr: "Aradığınız için teşekkür ederiz. Size bugün nasıl yardımcı olabilirim?",
};

const LANGUAGE_SELECTION_PROMPTS: Record<string, string> = {
  en: "For English",
  es: "Para español",
  fr: "Pour le français",
  de: "Für Deutsch",
  it: "Per l'italiano",
  pt: "Para português",
  zh: "中文请按",
  hi: "हिंदी के लिए",
  ar: "للعربية",
  ja: "日本語の場合",
  ko: "한국어는",
  nl: "Voor Nederlands",
  pl: "Dla polskiego",
  sv: "För svenska",
  no: "For norsk",
  fi: "Suomeksi",
  da: "For dansk",
  tr: "Türkçe için",
};

const DEPT_MENU_SEPARATORS: Record<string, string> = {
  en: ", ",
  fr: ", ",
  it: ", ",
  zh: "，",
  hi: ", ",
  ar: "، ",
  es: ", ",
  de: ", ",
  ja: "、",
  ko: ", ",
  pt: ", ",
  ru: ", ",
  tr: ", ",
  nl: ", ",
  pl: ", ",
  sv: ", ",
  no: ", ",
  fi: ", ",
  da: ", ",
  th: ", ",
  vi: ", ",
  id: ", ",
  ms: ", ",
  tl: ", ",
  ur: "، ",
  bn: ", ",
  ta: ", ",
  te: ", ",
  fa: "، ",
  he: ", ",
};

const DEPT_MENU_TRANSLATIONS: Record<string, Record<string, Record<string, string>>> = {
  en: {
    Sales: { menuItem: "For Sales, press" },
    Support: { menuItem: "For Customer Support, press" },
    Scheduling: { menuItem: "For Scheduling, press" },
  },
  fr: {
    Sales: { menuItem: "Pour les ventes, appuyez sur le" },
    Support: { menuItem: "Pour le service client, appuyez sur le" },
    Scheduling: { menuItem: "Pour la prise de rendez-vous, appuyez sur le" },
  },
  it: {
    Sales: { menuItem: "Per il reparto vendite, premere" },
    Support: { menuItem: "Per l'assistenza clienti, premere" },
    Scheduling: { menuItem: "Per le prenotazioni, premere" },
  },
  zh: {
    Sales: { menuItem: "销售部门请按" },
    Support: { menuItem: "客户支持请按" },
    Scheduling: { menuItem: "预约服务请按" },
  },
  hi: {
    Sales: { menuItem: "बिक्री विभाग के लिए दबाएं" },
    Support: { menuItem: "ग्राहक सहायता के लिए दबाएं" },
    Scheduling: { menuItem: "अपॉइंटमेंट शेड्यूलिंग के लिए दबाएं" },
  },
  ar: {
    Sales: { menuItem: "لقسم المبيعات، اضغط" },
    Support: { menuItem: "لخدمة العملاء، اضغط" },
    Scheduling: { menuItem: "لحجز المواعيد، اضغط" },
  },
  es: {
    Sales: { menuItem: "Para ventas, presione" },
    Support: { menuItem: "Para atención al cliente, presione" },
    Scheduling: { menuItem: "Para agendar una cita, presione" },
  },
  de: {
    Sales: { menuItem: "Für den Vertrieb, drücken Sie" },
    Support: { menuItem: "Für den Kundendienst, drücken Sie" },
    Scheduling: { menuItem: "Für die Terminvereinbarung, drücken Sie" },
  },
  ja: {
    Sales: { menuItem: "営業部門は" },
    Support: { menuItem: "カスタマーサポートは" },
    Scheduling: { menuItem: "予約は" },
  },
  ko: {
    Sales: { menuItem: "영업부는" },
    Support: { menuItem: "고객 지원은" },
    Scheduling: { menuItem: "예약은" },
  },
  pt: {
    Sales: { menuItem: "Para vendas, pressione" },
    Support: { menuItem: "Para atendimento ao cliente, pressione" },
    Scheduling: { menuItem: "Para agendamento, pressione" },
  },
  ru: {
    Sales: { menuItem: "Для отдела продаж нажмите" },
    Support: { menuItem: "Для службы поддержки нажмите" },
    Scheduling: { menuItem: "Для записи на приём нажмите" },
  },
  tr: {
    Sales: { menuItem: "Satış için" },
    Support: { menuItem: "Müşteri destek için" },
    Scheduling: { menuItem: "Randevu almak için" },
  },
  ur: {
    Sales: { menuItem: "سیلز کے لیے دبائیں" },
    Support: { menuItem: "کسٹمر سپورٹ کے لیے دبائیں" },
    Scheduling: { menuItem: "اپائنٹمنٹ کے لیے دبائیں" },
  },
};

const DEPT_TYPE_TO_KEY: Record<string, string> = {
  sales: "Sales",
  support: "Support",
  scheduling: "Scheduling",
  custom: "custom",
};

const normalizeDeptKey = (name: string, type?: string): string => {
  if (type && DEPT_TYPE_TO_KEY[type] && DEPT_TYPE_TO_KEY[type] !== "custom") {
    return DEPT_TYPE_TO_KEY[type];
  }
  const lower = name.toLowerCase().trim();
  if (lower.includes("sales") || lower.includes("sale")) return "Sales";
  if (lower.includes("support") || lower.includes("customer")) return "Support";
  if (lower.includes("schedul") || lower.includes("appointment") || lower.includes("booking")) return "Scheduling";
  return name;
};

const translateDeptMenuItem = (name: string, type: string, langCode: string, keyNum: number): string => {
  const key = normalizeDeptKey(name, type);
  const langTranslations = DEPT_MENU_TRANSLATIONS[langCode];
  if (langTranslations && langTranslations[key]) {
    const item = langTranslations[key].menuItem;
    if (langCode === "ja") return `${item}${keyNum}を押してください`;
    if (langCode === "ko") return `${item} ${keyNum}번을 눌러주세요`;
    if (langCode === "tr") return `${item} ${keyNum} tuşuna basınız`;
    return `${item} ${keyNum}`;
  }
  const fallbackTemplates: Record<string, (deptName: string, num: number) => string> = {
    en: (d, n) => `For ${d}, press ${n}`,
    fr: (d, n) => `Pour ${d}, appuyez sur le ${n}`,
    it: (d, n) => `Per ${d}, premere ${n}`,
    zh: (d, n) => `${d}请按${n}`,
    hi: (d, n) => `${d} के लिए ${n} दबाएं`,
    ar: (d, n) => `لقسم ${d}، اضغط ${n}`,
    es: (d, n) => `Para ${d}, presione ${n}`,
    de: (d, n) => `Für ${d}, drücken Sie ${n}`,
    ja: (d, n) => `${d}は${n}を押してください`,
    ko: (d, n) => `${d}은 ${n}번을 눌러주세요`,
    pt: (d, n) => `Para ${d}, pressione ${n}`,
    ru: (d, n) => `Для ${d} нажмите ${n}`,
    tr: (d, n) => `${d} için ${n} tuşuna basınız`,
    ur: (d, n) => `${d} کے لیے ${n} دبائیں`,
  };
  const fallback = fallbackTemplates[langCode] || fallbackTemplates.en;
  return fallback(name, keyNum);
};

const translateDeptName = (name: string, type: string, langCode: string): string => {
  const key = normalizeDeptKey(name, type);
  const deptNameMap: Record<string, Record<string, string>> = {
    en: { Sales: "Sales", Support: "Customer Support", Scheduling: "Scheduling" },
    fr: { Sales: "ventes", Support: "service client", Scheduling: "prise de rendez-vous" },
    it: { Sales: "vendite", Support: "assistenza clienti", Scheduling: "prenotazioni" },
    zh: { Sales: "销售部门", Support: "客户支持", Scheduling: "预约服务" },
    hi: { Sales: "बिक्री विभाग", Support: "ग्राहक सहायता", Scheduling: "अपॉइंटमेंट शेड्यूलिंग" },
    ar: { Sales: "المبيعات", Support: "خدمة العملاء", Scheduling: "المواعيد" },
    es: { Sales: "ventas", Support: "atención al cliente", Scheduling: "citas" },
    de: { Sales: "Vertrieb", Support: "Kundendienst", Scheduling: "Terminvereinbarung" },
    ja: { Sales: "営業", Support: "カスタマーサポート", Scheduling: "予約" },
    ko: { Sales: "영업", Support: "고객 지원", Scheduling: "예약" },
    pt: { Sales: "vendas", Support: "atendimento ao cliente", Scheduling: "agendamento" },
    ru: { Sales: "продажи", Support: "поддержка", Scheduling: "запись на приём" },
    tr: { Sales: "satış", Support: "müşteri destek", Scheduling: "randevu" },
    ur: { Sales: "سیلز", Support: "کسٹمر سپورٹ", Scheduling: "اپائنٹمنٹ" },
  };
  return deptNameMap[langCode]?.[key] || name;
};

interface DeptInfo {
  name: string;
  type: string;
}

const generateDeptGreeting = (departments: DeptInfo[], langCode: string): string => {
  if (departments.length === 0) return DEFAULT_GREETINGS[langCode] || DEFAULT_GREETINGS.en;
  const separator = DEPT_MENU_SEPARATORS[langCode] || ", ";

  const menuItems = departments.map((dept, idx) =>
    translateDeptMenuItem(dept.name, dept.type, langCode, idx + 1)
  );

  return menuItems.join(separator) + ".";
};

interface LanguageOption {
  id: string;
  language: string;
  voiceId: string;
  greeting: string;
  selectedDepartments?: string[];
}

const generateDefaultLangGreeting = (langOpts: LanguageOption[], companyName?: string): string => {
  const intro = companyName
    ? `Thanks for calling ${companyName}. Please select your preferred language.`
    : 'Please select your preferred language.';

  if (langOpts.length === 0) return intro;

  const langLines = langOpts.map((opt, idx) => {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === opt.language);
    const langName = langInfo?.label || opt.language;
    return `For ${langName}, press ${idx + 1}`;
  });

  return `${intro} ${langLines.join('. ')}.`;
};

interface CanvasDepartment {
  id: string;
  type: "sales" | "support" | "scheduling" | "billing" | "hr" | "marketing" | "complaints" | "custom";
  name: string;
  description: string;
  languageAgents?: LanguageAgent[];
  enableTransfer?: boolean;
  transferNumber?: string;
  transferMessage?: string;
  enableRecording?: boolean;
  enableLanguageDetection?: boolean;
  detectedLanguages?: string[];
  enableEndConversation?: boolean;
  endConversationPhrases?: string[];
  enableAppointmentBooking?: boolean;
  calendarUrl?: string;
  bookingInstructions?: string;
  knowledgeBaseIds?: string[];
}

const departmentTemplates = [
  {
    type: "sales" as const,
    name: "Sales Department",
    description: "Handle sales calls and demos",
    icon: ShoppingCart,
    color: "bg-green-500",
    defaultPrompt: "You are a professional sales representative. Help qualify leads, answer product questions, and schedule demos when appropriate.",
  },
  {
    type: "support" as const,
    name: "Support Department",
    description: "Customer support and issues",
    icon: Headphones,
    color: "bg-blue-500",
    defaultPrompt: "You are a helpful customer support agent. Assist customers with their issues, answer FAQs, and escalate complex problems when needed.",
  },
  {
    type: "scheduling" as const,
    name: "Scheduling Department",
    description: "Book appointments",
    icon: Calendar,
    color: "bg-purple-500",
    defaultPrompt: "You are an appointment scheduling assistant. Help callers book, reschedule, or cancel appointments efficiently.",
  },
  {
    type: "billing" as const,
    name: "Billing Department",
    description: "Billing inquiries and payments",
    icon: CreditCard,
    color: "bg-amber-500",
    defaultPrompt: "You are a billing specialist. Help callers with invoices, payment issues, refund requests, and account balance inquiries.",
  },
  {
    type: "hr" as const,
    name: "HR Department",
    description: "Human resources and recruitment",
    icon: Users,
    color: "bg-teal-500",
    defaultPrompt: "You are an HR representative. Help callers with job inquiries, employee onboarding, benefits questions, and general HR policies.",
  },
  {
    type: "marketing" as const,
    name: "Marketing Department",
    description: "Marketing and partnerships",
    icon: Megaphone,
    color: "bg-pink-500",
    defaultPrompt: "You are a marketing representative. Help callers with partnership inquiries, advertising opportunities, and marketing collaboration requests.",
  },
  {
    type: "complaints" as const,
    name: "Complaints Department",
    description: "Handle complaints and escalations",
    icon: ClipboardList,
    color: "bg-red-500",
    defaultPrompt: "You are a complaints resolution specialist. Listen empathetically to caller concerns, document complaints thoroughly, and work toward satisfactory resolutions.",
  },
];

const WIZARD_STEPS = [
  { id: 1, title: "Phone Numbers", icon: Phone },
  { id: 2, title: "Departments", icon: Building2 },
  { id: 3, title: "IVR Router", icon: GitBranch },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-4 sm:py-6" data-testid="step-indicator">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1 sm:gap-1.5">
              <div
                className={`flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
                data-testid={`step-circle-${step.id}`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-medium ${
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-16 md:w-24 h-0.5 mx-1 sm:mx-2 mb-4 sm:mb-5 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhoneSelectionStep({
  phoneNumbers,
  selectedPhoneIds,
  onTogglePhone,
}: {
  phoneNumbers: PhoneNumber[];
  selectedPhoneIds: string[];
  onTogglePhone: (id: string) => void;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold" data-testid="text-step1-title">Select Phone Numbers</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Choose the phone numbers that will receive inbound calls for this IVR system
        </p>
      </div>

      {selectedPhoneIds.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="default" data-testid="badge-selected-count">
            {selectedPhoneIds.length} selected
          </Badge>
        </div>
      )}

      {phoneNumbers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Phone className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No phone numbers available</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setLocation("/app/phone-numbers")}
            data-testid="button-buy-numbers"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Buy Phone Numbers
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phoneNumbers.map((phone) => {
              const isSelected = selectedPhoneIds.includes(phone.id);
              return (
                <Card
                  key={phone.id}
                  className={`cursor-pointer toggle-elevate ${isSelected ? "toggle-elevated border-green-500" : ""}`}
                  onClick={() => onTogglePhone(phone.id)}
                  data-testid={`card-phone-${phone.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-md ${isSelected ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                      <Phone className={`h-4 w-4 ${isSelected ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground">{phone.provider}</div>
                      {phone.friendlyName && (
                        <div className="text-xs text-muted-foreground truncate">{phone.friendlyName}</div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="p-1 bg-green-500 rounded-full">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setLocation("/app/phone-numbers")}
            data-testid="button-buy-more-numbers"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Buy More Numbers
          </Button>
        </>
      )}
    </div>
  );
}

function DepartmentCard({
  dept,
  agents,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  toast,
  externalGeneratingIds,
}: {
  dept: CanvasDepartment;
  agents: Agent[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CanvasDepartment>) => void;
  onDelete: () => void;
  toast: ReturnType<typeof useToast>["toast"];
  externalGeneratingIds?: Set<string>;
}) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatingLangIds, setGeneratingLangIds] = useState<Set<string>>(new Set());
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isLangGenerating = (langId: string) =>
    generatingLangIds.has(langId) || (externalGeneratingIds?.has(langId) ?? false);

  const languageAgents = dept.languageAgents || [];

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const icons: Record<string, any> = {
    sales: ShoppingCart,
    support: Headphones,
    scheduling: Calendar,
    billing: CreditCard,
    hr: Users,
    marketing: Megaphone,
    complaints: ClipboardList,
    custom: Building2,
  };
  const Icon = icons[dept.type] || Building2;

  const getAgentsForLanguage = (langCode: string) => {
    return agents.filter((agent) => {
      const agentLang = (agent.language || "en").toLowerCase();
      return agentLang === langCode.toLowerCase();
    });
  };

  const getBestAgentForLang = (deptType: string, langCode: string): { id: string; name: string; systemPrompt: string | null; voiceTone: string | null } | null => {
    const langAgents = getAgentsForLanguage(langCode);
    if (langAgents.length === 0) return null;

    const keywords: Record<string, string[]> = {
      sales: ["sales", "sell", "lead", "revenue", "deal", "demo", "vente", "vendita", "venta"],
      support: ["support", "help", "service", "customer", "assist", "issue", "aide", "supporto", "soporte"],
      scheduling: ["schedul", "appointment", "booking", "calendar", "reserve", "rendez-vous", "appuntamento"],
      billing: ["billing", "payment", "invoice", "finance", "account", "refund", "facturation", "fatturazione"],
      hr: ["hr", "human resource", "recruit", "hiring", "onboard", "employee", "ressources humaines", "risorse umane"],
      marketing: ["marketing", "campaign", "brand", "advertis", "partner", "promo", "campagne"],
      complaints: ["complaint", "escalat", "resolve", "grievance", "feedback", "plainte", "reclamo"],
    };

    const deptKeywords = keywords[deptType] || [];
    if (deptKeywords.length > 0) {
      for (const agent of langAgents) {
        const searchText = `${agent.name} ${agent.systemPrompt || ""}`.toLowerCase();
        if (deptKeywords.some((kw) => searchText.includes(kw))) {
          return { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt, voiceTone: agent.voiceTone };
        }
      }
    }

    return { id: langAgents[0].id, name: langAgents[0].name, systemPrompt: langAgents[0].systemPrompt, voiceTone: langAgents[0].voiceTone };
  };

  const handleLanguageChange = (langAgentId: string, newLangCode: string) => {
    const bestAgent = dept.type !== "custom" ? getBestAgentForLang(dept.type, newLangCode) : null;
    const bestVoice = dept.type !== "custom" ? getBestVoiceForDept(dept.type, newLangCode) : getDefaultVoiceForLanguage(newLangCode);
    const bestTone = dept.type !== "custom" ? getBestToneForDept(dept.type) : null;

    const agentFound = !!bestAgent;
    const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
    const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

    const updates: Partial<LanguageAgent> = {
      language: newLangCode,
      agentId: bestAgent?.id || null,
      agentName: bestAgent?.name || null,
      firstMessage: DEFAULT_FIRST_MESSAGES[newLangCode] || DEFAULT_FIRST_MESSAGES.en,
      systemPrompt,
      voiceId: bestVoice || null,
      voiceTone: voiceTone || null,
    };

    updateLanguageAgent(langAgentId, updates);

    if (agentFound) {
      toast({
        title: "Language Changed",
        description: `Auto-selected agent "${bestAgent.name}" for ${SUPPORTED_LANGUAGES.find(l => l.code === newLangCode)?.label}`,
      });
    } else if (dept.type !== "custom") {
      const updatedList = languageAgents.map(la => la.id === langAgentId ? { ...la, ...updates } : la);
      toast({
        title: "Language Changed",
        description: `Generating AI prompt for ${SUPPORTED_LANGUAGES.find(l => l.code === newLangCode)?.label}...`,
      });
      generatePromptForLangAgent(langAgentId, dept.type, dept.name, newLangCode, updatedList);
    }
  };

  const generatePromptForLangAgent = async (langAgentId: string, deptType: string, deptName: string, langCode: string, currentAgents: LanguageAgent[]) => {
    setGeneratingLangIds((prev) => new Set(prev).add(langAgentId));
    try {
      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label || "English";
      const translatedName = translateDeptName(deptName, deptType, langCode);
      const response = await apiRequest("POST", "/api/deprock/generate-prompt", {
        departmentType: deptType,
        departmentName: translatedName,
        language: langLabel,
      });
      const data = await response.json();
      if (data.prompt) {
        onUpdate({
          languageAgents: currentAgents.map((la) =>
            la.id === langAgentId ? { ...la, systemPrompt: data.prompt } : la
          ),
        });
        toast({
          title: "Prompt Generated",
          description: `AI-generated prompt for ${translatedName} (${langLabel})`,
        });
      }
    } catch {
      toast({
        title: "Could not auto-generate prompt",
        description: "You can write one manually or try generating later",
        variant: "destructive",
      });
    } finally {
      setGeneratingLangIds((prev) => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
  };

  const addLanguageAgent = (selectedLangCode: string) => {
    const usedLangs = languageAgents.map((la) => la.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLangCode && !usedLangs.includes(l.code));
    if (!availableLang) return;

    const langCode = availableLang.code;
    const langAgentId = `la-${Date.now()}`;
    const bestAgent = dept.type !== "custom" ? getBestAgentForLang(dept.type, langCode) : null;
    const bestVoice = dept.type !== "custom" ? getBestVoiceForDept(dept.type, langCode) : null;
    const bestTone = dept.type !== "custom" ? getBestToneForDept(dept.type) : null;

    const agentFound = !!bestAgent;
    const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
    const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

    const newLangAgent: LanguageAgent = {
      id: langAgentId,
      language: langCode,
      agentId: bestAgent?.id || null,
      agentName: bestAgent?.name || null,
      firstMessage: DEFAULT_FIRST_MESSAGES[langCode] || DEFAULT_FIRST_MESSAGES.en,
      systemPrompt,
      voiceId: bestVoice || null,
      voiceTone: voiceTone || null,
    };

    const updatedList = [...languageAgents, newLangAgent];
    onUpdate({ languageAgents: updatedList });
    setActiveTabIdx(languageAgents.length);

    if (dept.type !== "custom") {
      const agentMsg = agentFound ? ` — "${bestAgent.name}" selected,` : " added —";
      toast({
        title: "Language Added",
        description: `${availableLang.label}${agentMsg} generating AI prompt...`,
      });
      generatePromptForLangAgent(langAgentId, dept.type, dept.name, langCode, updatedList);
    } else {
      toast({
        title: "Language Added",
        description: `${availableLang.label} added`,
      });
    }
  };

  const removeLanguageAgent = (id: string) => {
    const newList = languageAgents.filter((la) => la.id !== id);
    onUpdate({ languageAgents: newList });
    if (activeTabIdx >= newList.length) {
      setActiveTabIdx(Math.max(0, newList.length - 1));
    }
  };

  const updateLanguageAgent = (id: string, updates: Partial<LanguageAgent>) => {
    const newList = languageAgents.map((la) =>
      la.id === id ? { ...la, ...updates } : la
    );
    onUpdate({ languageAgents: newList });
  };

  const generatePromptForAgent = async (langAgentId: string, agentName: string, language: string, preserveUpdates?: Partial<LanguageAgent>) => {
    setIsGeneratingPrompt(true);
    try {
      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || "English";
      const translatedDeptName = translateDeptName(dept.name, dept.type, language);
      const response = await apiRequest("POST", "/api/deprock/generate-prompt", {
        departmentType: dept.type,
        departmentName: translatedDeptName,
        language: langLabel,
        agentName: agentName,
        features: {
          enableLanguageDetection: dept.enableLanguageDetection,
          enableEndConversation: dept.enableEndConversation,
          enableAppointmentBooking: dept.enableAppointmentBooking,
          enableRecording: dept.enableRecording,
          enableTransfer: dept.enableTransfer,
        },
      });
      const data = await response.json();
      if (data.prompt) {
        updateLanguageAgent(langAgentId, { ...preserveUpdates, systemPrompt: data.prompt });
        toast({
          title: "Prompt Generated",
          description: `AI-generated system prompt for ${translatedDeptName} (${langLabel})`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Generation Failed",
        description: err.message || "Could not generate prompt",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSelectAgent = (langAgentId: string, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      const langAgent = languageAgents.find(la => la.id === langAgentId);
      const language = langAgent?.language || "en";
      const bestVoice = getBestVoiceForDept(dept.type, language);
      const bestTone = getBestToneForDept(dept.type);
      const agentUpdates: Partial<LanguageAgent> = {
        agentId: agent.id,
        agentName: agent.name,
        firstMessage: agent.firstMessage || DEFAULT_FIRST_MESSAGES[language] || DEFAULT_FIRST_MESSAGES.en,
        systemPrompt: agent.systemPrompt || null,
        voiceId: bestVoice,
        voiceTone: agent.voiceTone || bestTone,
      };
      updateLanguageAgent(langAgentId, agentUpdates);
      toast({
        title: "Agent Selected",
        description: `${agent.name} selected — generating AI prompt...`,
      });
      generatePromptForAgent(langAgentId, agent.name, language, agentUpdates);
    }
  };

  const handlePlayVoice = async (voiceId: string) => {
    if (!audioRef.current) return;

    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceId);
    try {
      const langCode = activeLangAgent?.language || "en";
      const sampleText = DEFAULT_GREETINGS[langCode] || DEFAULT_GREETINGS.en;
      const response = await apiRequest("POST", "/api/deprock/voice-preview", {
        voiceId,
        text: sampleText,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      audioRef.current.play();
      audioRef.current.onended = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      audioRef.current.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(url);
      };
    } catch {
      setPlayingVoiceId(null);
      toast({
        title: "Preview Failed",
        description: "Could not preview this voice",
        variant: "destructive",
      });
    }
  };

  const activeLangAgent = languageAgents[activeTabIdx];
  const availableAgentsForActive = activeLangAgent ? getAgentsForLanguage(activeLangAgent.language) : [];

  return (
    <Card data-testid={`card-dept-${dept.id}`}>
      <div
        className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer min-h-[44px]"
        onClick={onToggleExpand}
        data-testid={`button-expand-dept-${dept.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-muted rounded-md">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{dept.name}</div>
            <div className="text-xs text-muted-foreground truncate">{dept.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs">
            {languageAgents.length} lang
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            data-testid={`button-quick-delete-dept-${dept.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="px-3 sm:px-4 pb-4 pt-0 space-y-4 border-t">
          <div className="pt-4">
            <Label>Deprock Department Name</Label>
            <Input
              value={dept.name || ""}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="mt-1.5"
              data-testid="input-dept-name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <Label>Language Agents</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={languageAgents.length >= SUPPORTED_LANGUAGES.length}
                    data-testid="button-add-language"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Language
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SUPPORTED_LANGUAGES
                    .filter((l) => !languageAgents.some((la) => la.language === l.code))
                    .map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => addLanguageAgent(lang.code)}
                        data-testid={`menu-add-language-${lang.code}`}
                      >
                        <Globe className="h-3.5 w-3.5 mr-2" />
                        {lang.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {languageAgents.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {languageAgents.map((la, idx) => (
                  <Badge
                    key={la.id}
                    variant={idx === activeTabIdx ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setActiveTabIdx(idx)}
                    data-testid={`badge-lang-${la.language}`}
                  >
                    {isLangGenerating(la.id) && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {SUPPORTED_LANGUAGES.find((l) => l.code === la.language)?.label || la.language}
                  </Badge>
                ))}
              </div>
            )}

            {languageAgents.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                Click "Add Language" to configure agents
              </div>
            )}
          </div>

          {activeLangAgent && (
            <div className="p-3 sm:p-4 space-y-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Select
                  value={activeLangAgent.language}
                  onValueChange={(val) => handleLanguageChange(activeLangAgent.id, val)}
                >
                  <SelectTrigger className="w-32" data-testid="select-lang-tab">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        disabled={languageAgents.some((la) => la.id !== activeLangAgent.id && la.language === lang.code)}
                      >
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLanguageAgent(activeLangAgent.id)}
                  data-testid="button-remove-lang-agent"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div>
                <Label>Agent Name</Label>
                <Input
                  className="mt-1.5"
                  value={activeLangAgent.agentName || ""}
                  onChange={(e) => updateLanguageAgent(activeLangAgent.id, { agentName: e.target.value })}
                  placeholder={getRandomName(activeLangAgent.language, activeLangAgent.id)}
                  data-testid="input-agent-name"
                />
              </div>

              <div>
                <Label>First Message</Label>
                <p className="text-xs text-muted-foreground mb-1">The greeting the agent speaks when the call connects</p>
                <Input
                  className="mt-1"
                  value={activeLangAgent.firstMessage || ""}
                  onChange={(e) => updateLanguageAgent(activeLangAgent.id, { firstMessage: e.target.value })}
                  placeholder={DEFAULT_FIRST_MESSAGES[activeLangAgent.language] || DEFAULT_FIRST_MESSAGES.en}
                  data-testid="input-first-message"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>System Prompt</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingPrompt || isLangGenerating(activeLangAgent.id)}
                    onClick={() => generatePromptForAgent(activeLangAgent.id, activeLangAgent.agentName || "", activeLangAgent.language)}
                    data-testid="button-generate-prompt"
                  >
                    {(isGeneratingPrompt || isLangGenerating(activeLangAgent.id)) ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {(isGeneratingPrompt || isLangGenerating(activeLangAgent.id)) ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
                <div className="relative mt-1.5">
                  <Textarea
                    value={activeLangAgent.systemPrompt || ""}
                    onChange={(e) => updateLanguageAgent(activeLangAgent.id, { systemPrompt: e.target.value })}
                    rows={4}
                    disabled={isLangGenerating(activeLangAgent.id)}
                    placeholder={isLangGenerating(activeLangAgent.id) ? "Generating prompt with AI..." : "Instructions for the AI agent..."}
                    data-testid="input-agent-prompt"
                  />
                  {isLangGenerating(activeLangAgent.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating AI prompt...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Voice</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Select
                    value={activeLangAgent.voiceId || ""}
                    onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceId: val })}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-voice">
                      <SelectValue placeholder="Select a voice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getVoicesForLanguage(activeLangAgent.language).length > 0 ? (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">AWS Polly Voices</div>
                          {getVoicesForLanguage(activeLangAgent.language).map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} - {voice.gender}, {voice.style}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <div className="px-2 py-2 text-sm text-muted-foreground">No voices available for this language</div>
                      )}
                    </SelectContent>
                  </Select>
                  {activeLangAgent.voiceId && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePlayVoice(activeLangAgent.voiceId!)}
                      data-testid="button-preview-voice"
                    >
                      {playingVoiceId === activeLangAgent.voiceId ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Voice Tone</Label>
                  <Select
                    value={activeLangAgent.voiceTone || ""}
                    onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceTone: val })}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-voice-tone">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language</Label>
                  <div className="mt-1.5 p-2 bg-muted rounded text-sm">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === activeLangAgent.language)?.label}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setFeaturesOpen(!featuresOpen)}
              aria-expanded={featuresOpen}
              data-testid="button-toggle-features"
            >
              <Label className="text-sm font-medium cursor-pointer">Agent Features</Label>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${featuresOpen ? 'rotate-180' : ''}`} />
              <span className="text-xs text-muted-foreground ml-auto">
                {[dept.enableTransfer, dept.enableLanguageDetection, dept.enableEndConversation, dept.enableAppointmentBooking, dept.enableRecording].filter(Boolean).length}/5 enabled
              </span>
            </button>
            {featuresOpen && <div className="mt-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <PhoneForwarded className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <Label className="text-xs">Transfer</Label>
                    </div>
                    <Switch
                      checked={dept.enableTransfer}
                      onCheckedChange={(val) => onUpdate({ enableTransfer: val })}
                      data-testid="switch-dept-transfer"
                      className="scale-75"
                    />
                  </div>
                  {dept.enableTransfer && (
                    <div className="space-y-1.5 pt-1 border-t">
                      <Input
                        value={dept.transferNumber || ""}
                        onChange={(e) => onUpdate({ transferNumber: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        className="h-7 text-xs"
                        data-testid="input-transfer-number"
                      />
                      <Input
                        value={dept.transferMessage || ""}
                        onChange={(e) => onUpdate({ transferMessage: e.target.value })}
                        placeholder="Transfer message..."
                        className="h-7 text-xs"
                        data-testid="input-transfer-message"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2.5 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <Label className="text-xs">Lang Detect</Label>
                    </div>
                    <Switch
                      checked={dept.enableLanguageDetection}
                      onCheckedChange={(val) => onUpdate({ enableLanguageDetection: val })}
                      data-testid="switch-lang-detection"
                      className="scale-75"
                    />
                  </div>
                  {dept.enableLanguageDetection && (
                    <p className="text-[10px] text-muted-foreground pt-1 border-t">Auto-detect 99 languages</p>
                  )}
                </div>

                <div className="p-2.5 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <PhoneOff className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      <Label className="text-xs">End Call</Label>
                    </div>
                    <Switch
                      checked={dept.enableEndConversation}
                      onCheckedChange={(val) => onUpdate({ enableEndConversation: val })}
                      data-testid="switch-end-conversation"
                      className="scale-75"
                    />
                  </div>
                  {dept.enableEndConversation && (
                    <div className="pt-1 border-t">
                      <Textarea
                        value={(dept.endConversationPhrases || ["goodbye", "thank you for calling", "have a nice day"]).join("\n")}
                        onChange={(e) => onUpdate({
                          endConversationPhrases: e.target.value.split("\n").filter(p => p.trim())
                        })}
                        placeholder={"goodbye\nthank you"}
                        rows={2}
                        className="text-[10px] min-h-0"
                        data-testid="input-end-phrases"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2.5 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <Label className="text-xs">Booking</Label>
                    </div>
                    <Switch
                      checked={dept.enableAppointmentBooking}
                      onCheckedChange={(val) => onUpdate({ enableAppointmentBooking: val })}
                      data-testid="switch-appointment"
                      className="scale-75"
                    />
                  </div>
                  {dept.enableAppointmentBooking && (
                    <div className="space-y-1.5 pt-1 border-t">
                      <Input
                        value={dept.calendarUrl || ""}
                        onChange={(e) => onUpdate({ calendarUrl: e.target.value })}
                        placeholder="Calendar URL..."
                        className="h-7 text-xs"
                        data-testid="input-calendar-url"
                      />
                      <Textarea
                        value={dept.bookingInstructions || ""}
                        onChange={(e) => onUpdate({ bookingInstructions: e.target.value })}
                        placeholder="Booking instructions..."
                        rows={2}
                        className="text-[10px] min-h-0"
                        data-testid="input-booking-instructions"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2.5 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <Circle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <Label className="text-xs">Recording</Label>
                    </div>
                    <Switch
                      checked={dept.enableRecording}
                      onCheckedChange={(val) => onUpdate({ enableRecording: val })}
                      data-testid="switch-dept-recording"
                      className="scale-75"
                    />
                  </div>
                  {dept.enableRecording && (
                    <div className="pt-1 border-t">
                      <Badge variant="outline" className="text-[10px]">Disclosure enabled</Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>}
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              data-testid="button-delete-dept"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Deprock Department
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function DepartmentsStep({
  canvasDepartments,
  setCanvasDepartments,
  agents,
  toast,
}: {
  canvasDepartments: CanvasDepartment[];
  setCanvasDepartments: (fn: (prev: CanvasDepartment[]) => CanvasDepartment[]) => void;
  agents: Agent[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [customDeptName, setCustomDeptName] = useState("");
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [generatingDeptLangIds, setGeneratingDeptLangIds] = useState<Set<string>>(new Set());

  const getBestAgentForDept = (deptType: string, langCode: string): { id: string; name: string; systemPrompt: string | null; voiceTone: string | null } | null => {
    const langAgents = agents.filter((a) => (a.language || "en").toLowerCase() === langCode.toLowerCase());
    if (langAgents.length === 0) return null;

    const keywords: Record<string, string[]> = {
      sales: ["sales", "sell", "lead", "revenue", "deal", "demo"],
      support: ["support", "help", "service", "customer", "assist", "issue"],
      scheduling: ["schedul", "appointment", "booking", "calendar", "reserve"],
      billing: ["billing", "payment", "invoice", "finance", "account", "refund"],
      hr: ["hr", "human resource", "recruit", "hiring", "onboard", "employee"],
      marketing: ["marketing", "campaign", "brand", "advertis", "partner", "promo"],
      complaints: ["complaint", "escalat", "resolve", "grievance", "feedback", "issue"],
    };

    const deptKeywords = keywords[deptType] || [];
    if (deptKeywords.length > 0) {
      for (const agent of langAgents) {
        const searchText = `${agent.name} ${agent.systemPrompt || ""}`.toLowerCase();
        if (deptKeywords.some((kw) => searchText.includes(kw))) {
          return { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt, voiceTone: agent.voiceTone };
        }
      }
    }

    return { id: langAgents[0].id, name: langAgents[0].name, systemPrompt: langAgents[0].systemPrompt, voiceTone: langAgents[0].voiceTone };
  };

  const generatePromptForNewDept = async (deptId: string, langAgentId: string, deptType: string, deptName: string, langCode: string) => {
    setGeneratingDeptLangIds((prev) => new Set(prev).add(langAgentId));
    try {
      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label || "English";
      const translatedName = translateDeptName(deptName, deptType, langCode);
      const response = await apiRequest("POST", "/api/deprock/generate-prompt", {
        departmentType: deptType,
        departmentName: translatedName,
        language: langLabel,
      });
      const data = await response.json();
      if (data.prompt) {
        setCanvasDepartments((prev) =>
          prev.map((dept) => {
            if (dept.id !== deptId) return dept;
            return {
              ...dept,
              languageAgents: (dept.languageAgents || []).map((la) =>
                la.id === langAgentId ? { ...la, systemPrompt: data.prompt } : la
              ),
            };
          })
        );
        toast({
          title: "Prompt Generated",
          description: `AI-generated prompt for ${deptName}`,
        });
      }
    } catch {
      toast({
        title: "Could not auto-generate prompt",
        description: "You can write one manually or try generating later",
        variant: "destructive",
      });
    } finally {
      setGeneratingDeptLangIds((prev) => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
  };

  const addDepartment = (template: typeof departmentTemplates[0] | { type: "custom"; name: string }) => {
    const deptType = template.type;
    const newDeptId = `dept-${Date.now()}`;

    const existingLangs = canvasDepartments.length > 0
      ? canvasDepartments[canvasDepartments.length - 1].languageAgents?.map((la) => la.language) || ["en"]
      : ["en"];
    const langsToAdd = Array.from(new Set(existingLangs));

    const languageAgents: LanguageAgent[] = langsToAdd.map((langCode, idx) => {
      const langAgentId = `la-${Date.now()}-${idx}`;
      const bestVoice = deptType !== "custom" ? getBestVoiceForDept(deptType, langCode) : getDefaultVoiceForLanguage(langCode);
      const bestTone = deptType !== "custom" ? getBestToneForDept(deptType) : null;
      const bestAgent = deptType !== "custom" ? getBestAgentForDept(deptType, langCode) : null;
      const agentFound = !!bestAgent;
      const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
      const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

      return {
        id: langAgentId,
        language: langCode,
        agentId: bestAgent?.id || null,
        agentName: bestAgent?.name || null,
        firstMessage: DEFAULT_FIRST_MESSAGES[langCode] || DEFAULT_FIRST_MESSAGES.en,
        systemPrompt,
        voiceId: bestVoice || null,
        voiceTone: voiceTone || null,
      };
    });

    const newDept: CanvasDepartment = {
      id: newDeptId,
      type: deptType as any,
      name: template.name,
      description: deptType === "custom" ? "Custom department" : (template as any).description || "",
      languageAgents,
      enableTransfer: true,
      enableRecording: true,
      enableLanguageDetection: true,
      enableEndConversation: true,
      endConversationPhrases: ["goodbye", "thank you for calling", "have a nice day"],
      enableAppointmentBooking: true,
    };

    setCanvasDepartments((prev) => [...prev, newDept]);
    setActiveDeptId(newDeptId);

    if (deptType !== "custom") {
      const langCount = langsToAdd.length;
      const langLabels = langsToAdd.map(lc => SUPPORTED_LANGUAGES.find(l => l.code === lc)?.label || lc).join(", ");
      toast({
        title: "Deprock Department Added",
        description: `${template.name} created with ${langCount} language${langCount > 1 ? "s" : ""} (${langLabels}) — generating AI prompts...`,
      });
      languageAgents.forEach((la) => {
        generatePromptForNewDept(newDeptId, la.id, deptType, template.name, la.language);
      });
    } else {
      const langCount = langsToAdd.length;
      toast({
        title: "Deprock Department Added",
        description: `${template.name} created with ${langCount} language${langCount > 1 ? "s" : ""}`,
      });
    }
  };

  const updateDepartment = (deptId: string, updates: Partial<CanvasDepartment>) => {
    setCanvasDepartments((prev) =>
      prev.map((dept) => (dept.id === deptId ? { ...dept, ...updates } : dept))
    );
  };

  const deleteDepartment = (deptId: string) => {
    setCanvasDepartments((prev) => prev.filter((d) => d.id !== deptId));
    if (activeDeptId === deptId) {
      const remaining = canvasDepartments.filter((d) => d.id !== deptId);
      setActiveDeptId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast({
      title: "Deprock Department Removed",
      description: "Deprock department has been deleted",
    });
  };

  const startEditName = (dept: CanvasDepartment) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
  };

  const saveEditName = () => {
    if (editingDeptId && editDeptName.trim()) {
      updateDepartment(editingDeptId, { name: editDeptName.trim() });
      toast({ title: "Deprock department renamed" });
    }
    setEditingDeptId(null);
    setEditDeptName("");
  };

  const activeDept = canvasDepartments.find((d) => d.id === activeDeptId) || null;

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      <div className="w-full md:w-[280px] shrink-0 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-3" data-testid="text-add-departments-title">Add Deprock Departments</h3>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Quick Add Templates
            </Label>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-3 gap-1.5">
              {departmentTemplates.map((template) => (
                <Button
                  key={template.type}
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2 px-1 gap-1 text-[11px]"
                  onClick={() => addDepartment(template)}
                  data-testid={`button-add-dept-${template.type}`}
                >
                  <template.icon className="h-4 w-4" />
                  <span className="truncate w-full text-center">{template.name.replace(" Department", "")}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Custom Deprock Department
          </Label>
          <div className="space-y-2">
            <Input
              placeholder="Department name..."
              value={customDeptName}
              onChange={(e) => setCustomDeptName(e.target.value)}
              className="text-sm"
              data-testid="input-custom-dept"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customDeptName.trim()) {
                  addDepartment({ type: "custom", name: customDeptName.trim() });
                  setCustomDeptName("");
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (customDeptName.trim()) {
                  addDepartment({ type: "custom", name: customDeptName.trim() });
                  setCustomDeptName("");
                }
              }}
              disabled={!customDeptName.trim()}
              data-testid="button-add-custom"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Custom
            </Button>
          </div>
        </div>

        {canvasDepartments.length > 0 && (
          <div className="border-t pt-4">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Deprock Departments ({canvasDepartments.length})
            </Label>
            <div className="space-y-1">
              {canvasDepartments.map((dept) => {
                const iconMap: Record<string, any> = {
                  sales: ShoppingCart,
                  support: Headphones,
                  scheduling: Calendar,
                  billing: CreditCard,
                  hr: Users,
                  marketing: Megaphone,
                  complaints: ClipboardList,
                  custom: Building2,
                };
                const DeptIcon = iconMap[dept.type] || Building2;
                const isActive = activeDeptId === dept.id;
                const isEditing = editingDeptId === dept.id;

                return (
                  <div
                    key={dept.id}
                    className={`group flex items-center gap-1 rounded-md transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover-elevate"
                    }`}
                    data-testid={`nav-dept-${dept.id}`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1">
                        <Input
                          value={editDeptName}
                          onChange={(e) => setEditDeptName(e.target.value)}
                          className="h-6 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditName();
                            if (e.key === "Escape") {
                              setEditingDeptId(null);
                              setEditDeptName("");
                            }
                          }}
                          onBlur={saveEditName}
                          data-testid={`input-edit-dept-name-${dept.id}`}
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-1.5 text-sm text-left"
                          onClick={() => setActiveDeptId(dept.id)}
                          data-testid={`button-select-dept-${dept.id}`}
                        >
                          <DeptIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className={`truncate ${isActive ? "font-medium" : ""}`}>{dept.name}</span>
                        </button>
                        <div className="flex items-center shrink-0 invisible group-hover:visible">
                          <button
                            className="p-1 rounded hover-elevate"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditName(dept);
                            }}
                            data-testid={`button-edit-dept-${dept.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            className="p-1 rounded hover-elevate text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDepartment(dept.id);
                            }}
                            data-testid={`button-delete-dept-${dept.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold" data-testid="text-step2-title">Configure Deprock Departments</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Add deprock departments and assign AI agents for each language
          </p>
        </div>

        {canvasDepartments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No deprock departments added yet</p>
            <p className="text-xs mt-1">Use the templates above to get started</p>
          </div>
        ) : !activeDept ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <Settings className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a deprock department to configure</p>
            <p className="text-xs mt-1">Select a department to configure its settings</p>
          </div>
        ) : (
          <DepartmentCard
            key={activeDept.id}
            dept={activeDept}
            agents={agents}
            isExpanded={true}
            onToggleExpand={() => {}}
            onUpdate={(updates) => updateDepartment(activeDept.id, updates)}
            onDelete={() => deleteDepartment(activeDept.id)}
            toast={toast}
            externalGeneratingIds={generatingDeptLangIds}
          />
        )}
      </div>
    </div>
  );
}

function IVRRouterStep({
  ivrEnabled,
  setIvrEnabled,
  multiLangEnabled,
  setMultiLangEnabled,
  languageOptions,
  setLanguageOptions,
  languageSelectionGreetingText,
  setLanguageSelectionGreetingText,
  languageSelectionGreetingVoice,
  setLanguageSelectionGreetingVoice,
  isGreetingCustomized,
  companyDisplayName,
  canvasDepartments,
  selectedPhoneIds,
  toast,
}: {
  ivrEnabled: boolean;
  setIvrEnabled: (val: boolean) => void;
  multiLangEnabled: boolean;
  setMultiLangEnabled: (val: boolean) => void;
  languageOptions: LanguageOption[];
  setLanguageOptions: (opts: LanguageOption[]) => void;
  languageSelectionGreetingText: string;
  setLanguageSelectionGreetingText: (val: string) => void;
  languageSelectionGreetingVoice: string;
  setLanguageSelectionGreetingVoice: (val: string) => void;
  isGreetingCustomized: React.MutableRefObject<boolean>;
  companyDisplayName: string;
  canvasDepartments: CanvasDepartment[];
  selectedPhoneIds: string[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const customizedDeptGreetings = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isGreetingCustomized.current) {
      setLanguageSelectionGreetingText(generateDefaultLangGreeting(languageOptions, companyDisplayName));
    }
  }, [languageOptions, companyDisplayName]);

  const deptInfos: DeptInfo[] = canvasDepartments.map(d => ({ name: d.name || "Department", type: d.type }));
  const deptNamesKey = deptInfos.map(d => `${d.name}:${d.type}`).join("||");

  useEffect(() => {
    if (canvasDepartments.length === 0) return;
    const updatedOptions = languageOptions.map((opt) => {
      if (customizedDeptGreetings.current.has(opt.id)) return opt;
      return {
        ...opt,
        greeting: generateDeptGreeting(deptInfos, opt.language),
        selectedDepartments: canvasDepartments.map(d => d.id),
      };
    });
    const changed = updatedOptions.some((opt, i) => opt.greeting !== languageOptions[i].greeting);
    if (changed) {
      setLanguageOptions(updatedOptions);
    }
  }, [deptNamesKey, canvasDepartments.length]);

  const addLanguageOption = () => {
    const usedLangs = languageOptions.map((o) => o.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;

    const allDeptIds = canvasDepartments.map(d => d.id);

    const newOption: LanguageOption = {
      id: `lang-${Date.now()}`,
      language: availableLang.code,
      voiceId: getDefaultVoiceForLanguage(availableLang.code),
      greeting: generateDeptGreeting(deptInfos, availableLang.code),
      selectedDepartments: allDeptIds,
    };
    setLanguageOptions([...languageOptions, newOption]);
  };

  const updateLanguageOption = (id: string, updates: Partial<LanguageOption>) => {
    setLanguageOptions(
      languageOptions.map((opt) => {
        if (opt.id === id) {
          const updated = { ...opt, ...updates };
          if (updates.language && updates.language !== opt.language) {
            customizedDeptGreetings.current.delete(id);
            if (canvasDepartments.length > 0) {
              updated.greeting = generateDeptGreeting(deptInfos, updates.language);
            } else {
              updated.greeting = DEFAULT_GREETINGS[updates.language] || DEFAULT_GREETINGS.en;
            }
            updated.voiceId = getDefaultVoiceForLanguage(updates.language);
          }
          return updated;
        }
        return opt;
      })
    );
  };

  const removeLanguageOption = (id: string) => {
    customizedDeptGreetings.current.delete(id);
    setLanguageOptions(languageOptions.filter((opt) => opt.id !== id));
  };

  const handlePlayVoice = async (voiceId: string, text?: string) => {
    if (!audioRef.current) return;

    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    const sampleText = text || DEFAULT_GREETINGS.en;
    try {
      setPlayingVoiceId(voiceId);
      const response = await apiRequest("POST", "/api/deprock/voice-preview", { voiceId, text: sampleText });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Preview not available",
          description: errorData.error || "Failed to generate voice preview",
          variant: "destructive",
        });
        setPlayingVoiceId(null);
        return;
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      audioRef.current.onended = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };
    } catch {
      toast({ title: "Preview not available", description: "Failed to generate voice preview", variant: "destructive" });
      setPlayingVoiceId(null);
    }
  };

  const configuredLanguages = useMemo(() => {
    const langSet = new Set<string>();
    canvasDepartments.forEach(d => {
      (d.languageAgents || []).forEach(la => langSet.add(la.language));
    });
    return Array.from(langSet);
  }, [canvasDepartments]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold" data-testid="text-step3-title">IVR Router Setup</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Configure your Interactive Voice Response system and greeting messages
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
        <div>
          <Label className="font-medium">Enable IVR</Label>
          <p className="text-xs text-muted-foreground">Play menu when calls connect</p>
        </div>
        <Switch
          checked={ivrEnabled}
          onCheckedChange={setIvrEnabled}
          data-testid="switch-ivr-enabled"
        />
      </div>

      {ivrEnabled && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <div>
                <Label className="font-medium">Multi-Language Support</Label>
                <p className="text-xs text-muted-foreground">Let callers choose their language</p>
              </div>
            </div>
            <Switch
              checked={multiLangEnabled}
              onCheckedChange={setMultiLangEnabled}
              data-testid="switch-ivr-multilang"
            />
          </div>

          {multiLangEnabled && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Language Selection Greeting</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLanguageSelectionGreetingText(generateDefaultLangGreeting(languageOptions, companyDisplayName));
                      isGreetingCustomized.current = false;
                    }}
                    data-testid="button-reset-lang-greeting"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Reset to default
                  </Button>
                </div>
                <Textarea
                  value={languageSelectionGreetingText}
                  onChange={(e) => {
                    setLanguageSelectionGreetingText(e.target.value);
                    isGreetingCustomized.current = true;
                  }}
                  rows={3}
                  className="text-sm"
                  placeholder='Thanks for calling {Company Name}. Please select your preferred language. For English, press 1...'
                  data-testid="textarea-lang-selection-greeting"
                />
                <p className="text-xs text-muted-foreground">
                  This greeting plays when callers first connect. Your company name from your profile is used automatically.
                </p>
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Greeting Voice</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Select
                      value={languageSelectionGreetingVoice}
                      onValueChange={setLanguageSelectionGreetingVoice}
                    >
                      <SelectTrigger className="flex-1" data-testid="select-greeting-voice">
                        <SelectValue placeholder="Select a voice..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">AWS Polly Voices (English)</div>
                        {POLLY_VOICES.filter(v => v.languages.includes('en')).map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} - {voice.gender}, {voice.style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePlayVoice(languageSelectionGreetingVoice, languageSelectionGreetingText)}
                      data-testid="button-preview-greeting-voice"
                    >
                      {playingVoiceId === languageSelectionGreetingVoice ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Language Options</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLanguageOption}
                    disabled={languageOptions.length >= SUPPORTED_LANGUAGES.length}
                    data-testid="button-add-language"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>

                {languageOptions.map((opt, idx) => (
                  <div key={opt.id} className="p-3 sm:p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">Press {idx + 1}</Badge>
                        <Select
                          value={opt.language}
                          onValueChange={(val) => updateLanguageOption(opt.id, { language: val })}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-lang-option-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <SelectItem
                                key={lang.code}
                                value={lang.code}
                                disabled={languageOptions.some((o) => o.id !== opt.id && o.language === lang.code)}
                              >
                                {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLanguageOption(opt.id)}
                        data-testid={`button-remove-lang-${idx}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Voice</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Select
                          value={opt.voiceId}
                          onValueChange={(val) => updateLanguageOption(opt.id, { voiceId: val })}
                        >
                          <SelectTrigger className="flex-1" data-testid={`select-voice-${idx}`}>
                            <SelectValue placeholder="Select a voice..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getVoicesForLanguage(opt.language).length > 0 ? (
                              <>
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">AWS Polly Voices</div>
                                {getVoicesForLanguage(opt.language).map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.gender}, {voice.style}
                                  </SelectItem>
                                ))}
                              </>
                            ) : (
                              <div className="px-2 py-2 text-sm text-muted-foreground">No voices available for this language</div>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handlePlayVoice(opt.voiceId, opt.greeting)}
                          data-testid={`button-preview-voice-${idx}`}
                        >
                          {playingVoiceId === opt.voiceId ? (
                            <Square className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Label className="text-xs text-muted-foreground">Deprock Department Menu Greeting</Label>
                        {customizedDeptGreetings.current.has(opt.id) && canvasDepartments.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              customizedDeptGreetings.current.delete(opt.id);
                              updateLanguageOption(opt.id, {
                                greeting: generateDeptGreeting(deptInfos, opt.language),
                              });
                            }}
                            data-testid={`button-reset-dept-greeting-${idx}`}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={opt.greeting}
                        onChange={(e) => {
                          customizedDeptGreetings.current.add(opt.id);
                          updateLanguageOption(opt.id, { greeting: e.target.value });
                        }}
                        rows={2}
                        className="mt-1"
                        data-testid={`input-greeting-${idx}`}
                      />
                      {canvasDepartments.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-generated from deprock departments. Edit to customize.
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {languageOptions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Click "Add" to configure language options
                  </div>
                )}
              </div>
            </>
          )}

          {!multiLangEnabled && (
            <div className="space-y-4">
              <div>
                <Label>Default Greeting Message</Label>
                <Textarea
                  value={languageOptions[0]?.greeting || DEFAULT_GREETINGS.en}
                  onChange={(e) => {
                    if (languageOptions.length === 0) {
                      setLanguageOptions([{
                        id: "default",
                        language: "en",
                        voiceId: "Joanna",
                        greeting: e.target.value,
                      }]);
                    } else {
                      updateLanguageOption(languageOptions[0].id, { greeting: e.target.value });
                    }
                  }}
                  rows={3}
                  className="mt-1.5"
                  placeholder="Thank you for calling..."
                  data-testid="input-ivr-greeting"
                />
              </div>

              <div>
                <Label>Greeting Voice</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Select the voice used to speak the greeting to callers</p>
                <div className="flex items-center gap-2">
                  <Select
                    value={languageOptions[0]?.voiceId || "Joanna"}
                    onValueChange={(val) => {
                      if (languageOptions.length === 0) {
                        setLanguageOptions([{
                          id: "default",
                          language: "en",
                          voiceId: val,
                          greeting: DEFAULT_GREETINGS.en,
                        }]);
                      } else {
                        updateLanguageOption(languageOptions[0].id, { voiceId: val });
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-default-voice">
                      <SelectValue placeholder="Select a voice..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">AWS Polly Voices ({SUPPORTED_LANGUAGES.find(l => l.code === (languageOptions[0]?.language || 'en'))?.label || 'English'})</div>
                      {POLLY_VOICES.filter(v => v.languages.includes(languageOptions[0]?.language || 'en')).map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name} - {voice.gender}, {voice.style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePlayVoice(
                      languageOptions[0]?.voiceId || "Joanna",
                      languageOptions[0]?.greeting || DEFAULT_GREETINGS.en
                    )}
                    data-testid="button-preview-default-voice"
                  >
                    {playingVoiceId === (languageOptions[0]?.voiceId || "Joanna") ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Card data-testid="card-summary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Phone Numbers</span>
            <Badge variant="outline">{selectedPhoneIds.length}</Badge>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Deprock Departments</span>
            <Badge variant="outline">{canvasDepartments.length}</Badge>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Languages</span>
            <Badge variant="outline">
              {configuredLanguages.map(lc => SUPPORTED_LANGUAGES.find(l => l.code === lc)?.label || lc).join(", ") || "None"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeprockCanvas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [canvasDepartments, setCanvasDepartments] = useState<CanvasDepartment[]>([]);
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "Joanna", greeting: DEFAULT_GREETINGS.en },
  ]);
  const [languageSelectionGreetingText, setLanguageSelectionGreetingText] = useState('');
  const [languageSelectionGreetingVoice, setLanguageSelectionGreetingVoice] = useState('Joanna');
  const isGreetingCustomized = useRef(false);

  const { data: userProfile } = useQuery<{ company?: string; name?: string }>({
    queryKey: ["/api/auth/me"],
  });
  const companyDisplayName = userProfile?.company || userProfile?.name || '';

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: knowledgeBases = [] } = useQuery<any[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const allDeptLanguages = useMemo(() => {
    const langSet = new Set<string>();
    canvasDepartments.forEach(d => {
      (d.languageAgents || []).forEach(la => langSet.add(la.language));
    });
    return Array.from(langSet);
  }, [canvasDepartments]);

  useEffect(() => {
    if (canvasDepartments.length === 0) return;

    const existingLangs = languageOptions.map(o => o.language);
    const missingLangs = allDeptLanguages.filter(l => !existingLangs.includes(l));
    const removedLangs = existingLangs.filter(l => !allDeptLanguages.includes(l));

    let updatedOptions = [...languageOptions];

    if (removedLangs.length > 0) {
      updatedOptions = updatedOptions.filter(o => allDeptLanguages.includes(o.language));
    }

    if (missingLangs.length > 0) {
      const deptInfos: DeptInfo[] = canvasDepartments.map(d => ({ name: d.name || "Department", type: d.type }));
      const allDeptIds = canvasDepartments.map(d => d.id);
      const newOptions: LanguageOption[] = missingLangs.map(langCode => ({
        id: `lang-${Date.now()}-${langCode}`,
        language: langCode,
        voiceId: getDefaultVoiceForLanguage(langCode),
        greeting: canvasDepartments.length > 0
          ? generateDeptGreeting(deptInfos, langCode)
          : (DEFAULT_GREETINGS[langCode as keyof typeof DEFAULT_GREETINGS] || DEFAULT_GREETINGS.en),
        selectedDepartments: allDeptIds,
      }));
      updatedOptions = [...updatedOptions, ...newOptions];
    }

    if (missingLangs.length > 0 || removedLangs.length > 0) {
      setLanguageOptions(updatedOptions);
    }

    if (allDeptLanguages.length >= 2 && !multiLangEnabled) {
      setMultiLangEnabled(true);
    }
    if (allDeptLanguages.length < 2 && multiLangEnabled) {
      setMultiLangEnabled(false);
    }
  }, [allDeptLanguages.join(",")]);

  const selectedPhones = useMemo(() => {
    return phoneNumbers.filter((p) => selectedPhoneIds.includes(p.id));
  }, [phoneNumbers, selectedPhoneIds]);

  const togglePhone = useCallback((phoneId: string) => {
    setSelectedPhoneIds((prev) =>
      prev.includes(phoneId)
        ? prev.filter((id) => id !== phoneId)
        : [...prev, phoneId]
    );
  }, []);

  const canGoNext = useMemo(() => {
    if (currentStep === 1) return selectedPhoneIds.length > 0;
    if (currentStep === 2) return canvasDepartments.length > 0;
    return true;
  }, [currentStep, selectedPhoneIds.length, canvasDepartments.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const canvasToDbIdMap = new Map<string, string>();

      for (const dept of canvasDepartments) {
        const primaryLang = dept.languageAgents?.[0]?.language || 'en';
        const deptResponse = await apiRequest("POST", "/api/deprock", {
          name: dept.name,
          description: dept.description,
          icon: dept.type,
          color: dept.type === "sales" ? "#22c55e" : dept.type === "support" ? "#3b82f6" : dept.type === "scheduling" ? "#a855f7" : "#6b7280",
          isActive: true,
          language: primaryLang,
        });
        const deptResult = await deptResponse.json();
        canvasToDbIdMap.set(dept.id, deptResult.id);

        const langAgents = dept.languageAgents || [];
        for (let i = 0; i < langAgents.length; i++) {
          const la = langAgents[i];
          if (la.agentId || la.agentName) {
            await apiRequest("POST", `/api/deprock/${deptResult.id}/agents`, {
              agentId: la.agentId || undefined,
              agentName: la.agentName || undefined,
              language: la.language || "en",
              isPrimary: i === 0,
              systemPrompt: la.systemPrompt || undefined,
              voiceTone: la.voiceTone || undefined,
              voiceId: la.voiceId || undefined,
            });
          }
        }
      }

      if (selectedPhones.length > 0 && canvasDepartments.length > 0) {
        const menuOptions = canvasDepartments.map((dept, idx) => ({
          key: String(idx + 1),
          label: dept.name,
          departmentId: canvasToDbIdMap.get(dept.id) || dept.id,
        }));

        const greetingMessage = multiLangEnabled && languageOptions.length > 0
          ? languageSelectionGreetingText || generateDefaultLangGreeting(languageOptions, companyDisplayName)
          : languageOptions[0]?.greeting || DEFAULT_GREETINGS.en;

        for (const phone of selectedPhones) {
          await apiRequest("POST", "/api/deprock/ivr", {
            phoneNumberId: phone.id,
            name: "Auto Distribution",
            isActive: ivrEnabled,
            greetingMessage,
            voiceId: multiLangEnabled ? languageSelectionGreetingVoice : (languageOptions[0]?.voiceId || 'Joanna'),
            menuOptions,
            languageOptions: multiLangEnabled ? languageOptions : languageOptions,
          });
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({
        title: "Configuration Saved",
        description: "All deprock departments and routing have been created successfully.",
      });
      setLocation("/app/deprock");
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (canvasDepartments.length === 0) {
      toast({
        title: "No Deprock Departments",
        description: "Please add at least one deprock department.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/app/deprock")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <StepIndicator currentStep={currentStep} />

        <div className="mt-2">
          {currentStep === 1 && (
            <PhoneSelectionStep
              phoneNumbers={phoneNumbers}
              selectedPhoneIds={selectedPhoneIds}
              onTogglePhone={togglePhone}
            />
          )}
          {currentStep === 2 && (
            <DepartmentsStep
              canvasDepartments={canvasDepartments}
              setCanvasDepartments={setCanvasDepartments}
              agents={agents}
              toast={toast}
            />
          )}
          {currentStep === 3 && (
            <IVRRouterStep
              ivrEnabled={ivrEnabled}
              setIvrEnabled={setIvrEnabled}
              multiLangEnabled={multiLangEnabled}
              setMultiLangEnabled={setMultiLangEnabled}
              languageOptions={languageOptions}
              setLanguageOptions={setLanguageOptions}
              languageSelectionGreetingText={languageSelectionGreetingText}
              setLanguageSelectionGreetingText={setLanguageSelectionGreetingText}
              languageSelectionGreetingVoice={languageSelectionGreetingVoice}
              setLanguageSelectionGreetingVoice={setLanguageSelectionGreetingVoice}
              isGreetingCustomized={isGreetingCustomized}
              companyDisplayName={companyDisplayName}
              canvasDepartments={canvasDepartments}
              selectedPhoneIds={selectedPhoneIds}
              toast={toast}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 sm:gap-3 mt-6 sm:mt-8 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            data-testid="button-previous"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
              disabled={!canGoNext}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">Save & Deploy</span>
              <span className="sm:hidden">Save</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
