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
import { Slider } from "@/components/ui/slider";
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
  X,
  AudioWaveform,
  Zap,
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
  en: ["Sarah Mitchell", "James Anderson", "Emily Parker", "David Thompson", "Rachel Foster", "Michael Chen", "Olivia Bennett", "Daniel Harris", "Jessica Morgan", "Christopher Lee", "Natalie Brooks", "Andrew Wilson", "Sophia Taylor", "Ryan Clark", "Lauren Adams"],
  es: ["María García López", "Carlos Rodríguez", "Sofía Martínez", "Alejandro Herrera", "Lucía Fernández", "Diego Morales", "Valentina Torres", "Sebastián Ramírez", "Camila Ortiz", "Mateo Jiménez", "Isabella Vargas", "Andrés Castillo", "Daniela Reyes", "Nicolás Mendoza", "Paula Ríos"],
  fr: ["Marie Dupont", "Pierre Laurent", "Camille Moreau", "Antoine Lefevre", "Chloé Bernard", "Julien Martin", "Élodie Dubois", "Lucas Fontaine", "Manon Girard", "Hugo Petit", "Léa Roux", "Thomas Mercier", "Clara Bonnet", "Maxime Chevalier", "Inès Blanc"],
  de: ["Anna Schmidt", "Hans Müller", "Lena Fischer", "Maximilian Weber", "Sophie Bauer"],
  it: ["Giulia Rossi", "Marco Bianchi", "Francesca Conti", "Alessandro Ferrari", "Elena Moretti"],
  pt: ["Ana Silva", "João Oliveira", "Beatriz Santos", "Pedro Costa", "Mariana Ferreira"],
  zh: ["李小明", "王美玲", "张小红", "陈志强", "刘晓芳", "赵雅婷", "黄俊杰", "吴佳琪", "周明华", "林思远", "杨子涵", "何雨桐", "马晓燕", "孙浩然", "朱丽华"],
  hi: ["प्रिया शर्मा", "राहुल वर्मा", "अनिता गुप्ता", "विकास सिंह", "नेहा पटेल", "अमित कुमार", "सुनीता देवी", "रोहित मिश्रा", "कविता चौहान", "मनीष यादव", "पूजा राजपूत", "दीपक त्रिपाठी", "रश्मि अग्रवाल", "संदीप जोशी", "अंजली भट्ट"],
  ar: ["فاطمة الزهراء", "أحمد المنصوري", "نور الهدى", "سلطان الكعبي", "ليلى العمري", "محمد الشامسي", "عائشة البلوشي", "عبدالله الحمادي", "مريم الكتبي", "سعيد الدرمكي", "هند المهيري", "راشد النعيمي", "شمّا الفلاسي", "يوسف الزعابي"],
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

function extractNameFromPrompt(prompt: string, language: string): string | null {
  if (!prompt) return null;
  
  // Try to extract name patterns like "named X", "Your name is X", "I am X", "Call me X", etc.
  const patterns: Record<string, RegExp[]> = {
    en: [
      /named\s+(?:as\s+)?["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:my\s+)?name\s+is\s+["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:you|your\s+(?:name|persona))\s+(?:is|should\s+be)\s+["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /call\s+me\s+["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /i'm\s+(?:a\s+)?([A-Z][a-z]+)/i,
      /act\s+as\s+(?:a\s+)?(?:professional\s+)?([A-Z][a-z]+)/i,
    ],
    ar: [
      /اسمي\s+([\\u0600-\\u06FF]+)/,
      /يمكنك\s+أن\s+تناديني\s+([\\u0600-\\u06FF]+)/,
      /اسمك\s+([\\u0600-\\u06FF]+)/,
    ],
    es: [
      /(?:me\s+)?llamo\s+([A-ZÁ][a-záéíóúñ]+(?:\\s+[A-ZÁ][a-záéíóúñ]+)?)/i,
      /soy\s+([A-ZÁ][a-záéíóúñ]+)/i,
    ],
    fr: [
      /(?:je\s+)?m'appelle\s+([A-Z][a-zà-ÿ]+(?:\\s+[A-Z][a-zà-ÿ]+)?)/i,
      /je\s+suis\s+([A-Z][a-zà-ÿ]+)/i,
    ],
  };
  
  const langPatterns = patterns[language] || patterns.en;
  for (const pattern of langPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

function generateNameFromPrompt(prompt: string, language: string, agentId: string): string {
  // First try to extract explicit name from prompt
  const extractedName = extractNameFromPrompt(prompt, language);
  if (extractedName) {
    return extractedName;
  }
  
  // If no name found, use role keywords from prompt to generate contextual name
  const roleKeywords: Record<string, string[][]> = {
    en: [
      [["sales", "sales agent", "sell"], "Morgan", "Jordan", "Casey"],
      [["support", "customer service", "help"], "Alex", "Taylor", "Riley"],
      [["booking", "schedule", "appointment"], "Sam", "Sidney", "Cameron"],
      [["billing", "payment", "invoice"], "Morgan", "Drew", "Finley"],
      [["hr", "human resources", "recruitment"], "Casey", "Morgan", "Riley"],
      [["marketing", "campaign", "promotion"], "Jordan", "Riley", "Morgan"],
      [["tech", "technical", "support"], "Alex", "Riley", "Jordan"],
    ],
    ar: [
      [["مبيعات", "مندوب", "بيع"], "خلفان", "نور", "سلطان"],
      [["دعم", "خدمة", "مساعدة"], "أحمد", "فاطمة", "نور"],
      [["حجز", "مواعيد", "جدول"], "محمد", "علي", "حسن"],
      [["فاتورة", "دفع", "رسوم"], "علي", "محمد", "سلطان"],
      [["موارد بشرية", "توظيف"], "فاطمة", "نور", "ليلى"],
      [["تسويق", "حملة", "ترويج"], "أحمد", "علي", "حسن"],
    ],
  };
  
  const langRoles = roleKeywords[language] || roleKeywords.en;
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [keywords, ...names] of langRoles) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        let hash = 0;
        for (let i = 0; i < agentId.length; i++) {
          hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
          hash |= 0;
        }
        return names[Math.abs(hash) % names.length];
      }
    }
  }
  
  // Fallback to random placeholder name
  const names = NATIVE_NAME_EXAMPLES[language] || NATIVE_NAME_EXAMPLES.en;
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash |= 0;
  }
  return names[Math.abs(hash) % names.length];
}

function pickRandomName(language: string, agentId: string): string {
  const names = NATIVE_NAME_EXAMPLES[language] || NATIVE_NAME_EXAMPLES.en;
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash |= 0;
  }
  return names[Math.abs(hash) % names.length];
}

function getRandomName(language: string, agentId: string): string {
  return "e.g. " + pickRandomName(language, agentId);
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
  { code: "ar", label: "Arabic" },
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

const ELEVENLABS_VOICES = [
  { id: "el_rachel", name: "Rachel (ElevenLabs)", gender: "female", style: "warm", languages: ["en"] },
  { id: "el_domi", name: "Domi (ElevenLabs)", gender: "female", style: "strong", languages: ["en"] },
  { id: "el_bella", name: "Bella (ElevenLabs)", gender: "female", style: "soft", languages: ["en"] },
  { id: "el_antoni", name: "Antoni (ElevenLabs)", gender: "male", style: "well-rounded", languages: ["en"] },
  { id: "el_elli", name: "Elli (ElevenLabs)", gender: "female", style: "young", languages: ["en"] },
  { id: "el_josh", name: "Josh (ElevenLabs)", gender: "male", style: "deep", languages: ["en"] },
  { id: "el_arnold", name: "Arnold (ElevenLabs)", gender: "male", style: "crisp", languages: ["en"] },
  { id: "el_adam", name: "Adam (ElevenLabs)", gender: "male", style: "deep", languages: ["en"] },
  { id: "el_sam", name: "Sam (ElevenLabs)", gender: "male", style: "raspy", languages: ["en"] },
  { id: "el_nicole", name: "Nicole (ElevenLabs)", gender: "female", style: "whisper", languages: ["en"] },
  { id: "el_marie", name: "Marie (ElevenLabs)", gender: "female", style: "soft", languages: ["fr"] },
  { id: "el_pierre", name: "Pierre (ElevenLabs)", gender: "male", style: "warm", languages: ["fr"] },
  { id: "el_giulia", name: "Giulia (ElevenLabs)", gender: "female", style: "expressive", languages: ["it"] },
  { id: "el_marco", name: "Marco (ElevenLabs)", gender: "male", style: "warm", languages: ["it"] },
  { id: "el_xiaoli", name: "Xiaoli (ElevenLabs)", gender: "female", style: "clear", languages: ["zh"] },
  { id: "el_wei", name: "Wei (ElevenLabs)", gender: "male", style: "professional", languages: ["zh"] },
  { id: "el_priya", name: "Priya (ElevenLabs)", gender: "female", style: "warm", languages: ["hi"] },
  { id: "el_raj", name: "Raj (ElevenLabs)", gender: "male", style: "deep", languages: ["hi"] },
  { id: "el_fatima", name: "Fatima (ElevenLabs)", gender: "female", style: "warm", languages: ["ar"] },
  { id: "el_omar", name: "Omar (ElevenLabs)", gender: "male", style: "deep", languages: ["ar"] },
];

const isElevenLabsVoice = (voiceId: string) => voiceId.startsWith("el_") || (/^[a-zA-Z0-9]{10,}$/.test(voiceId));

const LANG_CODE_MAP: Record<string, string> = {
  english: 'en', arabic: 'ar', french: 'fr', spanish: 'es', hindi: 'hi',
  chinese: 'zh', italian: 'it', german: 'de', portuguese: 'pt', japanese: 'ja',
  korean: 'ko', dutch: 'nl', polish: 'pl', swedish: 'sv', norwegian: 'no',
  finnish: 'fi', danish: 'da', turkish: 'tr',
};

interface ElevenLabsApiVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

function mapApiVoicesToLocal(apiVoices: ElevenLabsApiVoice[]): typeof ELEVENLABS_VOICES {
  const seenIds = new Set(ELEVENLABS_VOICES.map(v => v.id));
  const mapped = apiVoices
    .filter(v => {
      if (seenIds.has(v.voice_id)) return false;
      seenIds.add(v.voice_id);
      return true;
    })
    .map(v => {
      const lang = v.labels?.language?.toLowerCase() || '';
      const langCode = LANG_CODE_MAP[lang] || lang.substring(0, 2) || 'en';
      const gender = v.labels?.gender?.toLowerCase() || 'unknown';
      const accent = v.labels?.accent || '';
      const style = v.category || v.labels?.use_case || 'professional';
      return {
        id: v.voice_id,
        name: `${v.name} (ElevenLabs)`,
        gender: gender as 'male' | 'female',
        style,
        languages: [langCode],
      };
    });
  return mapped;
}

const ALL_IVR_VOICES = [...ELEVENLABS_VOICES];

const getPollyVoicesForLanguage = (languageCode: string) => {
  return POLLY_VOICES.filter(voice => voice.languages.includes(languageCode));
};

const getElevenLabsVoicesForLanguage = (languageCode: string, dynamicVoices: typeof ELEVENLABS_VOICES = []) => {
  const allElVoices = [...ELEVENLABS_VOICES, ...dynamicVoices];
  return allElVoices.filter(voice => voice.languages.includes(languageCode));
};

const getVoicesForLanguage = (languageCode: string, dynamicVoices: typeof ELEVENLABS_VOICES = []) => {
  const allVoices = [...ALL_IVR_VOICES, ...dynamicVoices];
  return allVoices.filter(voice => voice.languages.includes(languageCode));
};

const getDefaultVoiceForLanguage = (langCode: string, dynamicVoices: typeof ELEVENLABS_VOICES = []) => {
  const voices = getVoicesForLanguage(langCode, dynamicVoices);
  return voices[0]?.id || "el_rachel";
};

const getBestVoiceForDept = (deptType: string, langCode: string, dynamicVoices: typeof ELEVENLABS_VOICES = []): string => {
  const voices = getVoicesForLanguage(langCode, dynamicVoices);
  if (voices.length === 0) {
    return "el_rachel";
  }

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
  return voices[0]?.id || "el_rachel";
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
    Billing: { menuItem: "For Billing, press" },
    HR: { menuItem: "For Human Resources, press" },
    Marketing: { menuItem: "For Marketing, press" },
    Complaints: { menuItem: "For Complaints, press" },
  },
  fr: {
    Sales: { menuItem: "Pour les ventes, appuyez sur le" },
    Support: { menuItem: "Pour le service client, appuyez sur le" },
    Scheduling: { menuItem: "Pour la prise de rendez-vous, appuyez sur le" },
    Billing: { menuItem: "Pour la facturation, appuyez sur le" },
    HR: { menuItem: "Pour les ressources humaines, appuyez sur le" },
    Marketing: { menuItem: "Pour le marketing, appuyez sur le" },
    Complaints: { menuItem: "Pour les réclamations, appuyez sur le" },
  },
  it: {
    Sales: { menuItem: "Per il reparto vendite, premere" },
    Support: { menuItem: "Per l'assistenza clienti, premere" },
    Scheduling: { menuItem: "Per le prenotazioni, premere" },
    Billing: { menuItem: "Per la fatturazione, premere" },
    HR: { menuItem: "Per le risorse umane, premere" },
    Marketing: { menuItem: "Per il marketing, premere" },
    Complaints: { menuItem: "Per i reclami, premere" },
  },
  zh: {
    Sales: { menuItem: "销售部门请按" },
    Support: { menuItem: "客户支持请按" },
    Scheduling: { menuItem: "预约服务请按" },
    Billing: { menuItem: "账单部门请按" },
    HR: { menuItem: "人力资源请按" },
    Marketing: { menuItem: "市场营销请按" },
    Complaints: { menuItem: "投诉部门请按" },
  },
  hi: {
    Sales: { menuItem: "बिक्री विभाग के लिए दबाएं" },
    Support: { menuItem: "ग्राहक सहायता के लिए दबाएं" },
    Scheduling: { menuItem: "अपॉइंटमेंट शेड्यूलिंग के लिए दबाएं" },
    Billing: { menuItem: "बिलिंग के लिए दबाएं" },
    HR: { menuItem: "मानव संसाधन के लिए दबाएं" },
    Marketing: { menuItem: "मार्केटिंग के लिए दबाएं" },
    Complaints: { menuItem: "शिकायत के लिए दबाएं" },
  },
  ar: {
    Sales: { menuItem: "لقسم المبيعات، اضغط" },
    Support: { menuItem: "لخدمة العملاء، اضغط" },
    Scheduling: { menuItem: "لحجز المواعيد، اضغط" },
    Billing: { menuItem: "لقسم الفواتير، اضغط" },
    HR: { menuItem: "لقسم الموارد البشرية، اضغط" },
    Marketing: { menuItem: "لقسم التسويق، اضغط" },
    Complaints: { menuItem: "لقسم الشكاوى، اضغط" },
  },
  es: {
    Sales: { menuItem: "Para ventas, presione" },
    Support: { menuItem: "Para atención al cliente, presione" },
    Scheduling: { menuItem: "Para agendar una cita, presione" },
    Billing: { menuItem: "Para facturación, presione" },
    HR: { menuItem: "Para recursos humanos, presione" },
    Marketing: { menuItem: "Para marketing, presione" },
    Complaints: { menuItem: "Para quejas, presione" },
  },
  de: {
    Sales: { menuItem: "Für den Vertrieb, drücken Sie" },
    Support: { menuItem: "Für den Kundendienst, drücken Sie" },
    Scheduling: { menuItem: "Für die Terminvereinbarung, drücken Sie" },
    Billing: { menuItem: "Für die Rechnungsabteilung, drücken Sie" },
    HR: { menuItem: "Für die Personalabteilung, drücken Sie" },
    Marketing: { menuItem: "Für das Marketing, drücken Sie" },
    Complaints: { menuItem: "Für Beschwerden, drücken Sie" },
  },
  ja: {
    Sales: { menuItem: "営業部門は" },
    Support: { menuItem: "カスタマーサポートは" },
    Scheduling: { menuItem: "予約は" },
    Billing: { menuItem: "請求部門は" },
    HR: { menuItem: "人事部門は" },
    Marketing: { menuItem: "マーケティング部門は" },
    Complaints: { menuItem: "苦情対応は" },
  },
  ko: {
    Sales: { menuItem: "영업부는" },
    Support: { menuItem: "고객 지원은" },
    Scheduling: { menuItem: "예약은" },
    Billing: { menuItem: "청구부는" },
    HR: { menuItem: "인사부는" },
    Marketing: { menuItem: "마케팅부는" },
    Complaints: { menuItem: "불만 접수는" },
  },
  pt: {
    Sales: { menuItem: "Para vendas, pressione" },
    Support: { menuItem: "Para atendimento ao cliente, pressione" },
    Scheduling: { menuItem: "Para agendamento, pressione" },
    Billing: { menuItem: "Para faturamento, pressione" },
    HR: { menuItem: "Para recursos humanos, pressione" },
    Marketing: { menuItem: "Para marketing, pressione" },
    Complaints: { menuItem: "Para reclamações, pressione" },
  },
  ru: {
    Sales: { menuItem: "Для отдела продаж нажмите" },
    Support: { menuItem: "Для службы поддержки нажмите" },
    Scheduling: { menuItem: "Для записи на приём нажмите" },
    Billing: { menuItem: "Для отдела выставления счетов нажмите" },
    HR: { menuItem: "Для отдела кадров нажмите" },
    Marketing: { menuItem: "Для отдела маркетинга нажмите" },
    Complaints: { menuItem: "Для подачи жалобы нажмите" },
  },
  tr: {
    Sales: { menuItem: "Satış için" },
    Support: { menuItem: "Müşteri destek için" },
    Scheduling: { menuItem: "Randevu almak için" },
    Billing: { menuItem: "Fatura için" },
    HR: { menuItem: "İnsan kaynakları için" },
    Marketing: { menuItem: "Pazarlama için" },
    Complaints: { menuItem: "Şikâyet için" },
  },
  ur: {
    Sales: { menuItem: "سیلز کے لیے دبائیں" },
    Support: { menuItem: "کسٹمر سپورٹ کے لیے دبائیں" },
    Scheduling: { menuItem: "اپائنٹمنٹ کے لیے دبائیں" },
    Billing: { menuItem: "بلنگ کے لیے دبائیں" },
    HR: { menuItem: "ہیومن ریسورسز کے لیے دبائیں" },
    Marketing: { menuItem: "مارکیٹنگ کے لیے دبائیں" },
    Complaints: { menuItem: "شکایات کے لیے دبائیں" },
  },
};

const DEPT_TYPE_TO_KEY: Record<string, string> = {
  sales: "Sales",
  support: "Support",
  scheduling: "Scheduling",
  billing: "Billing",
  hr: "HR",
  marketing: "Marketing",
  complaints: "Complaints",
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
  if (lower.includes("billing") || lower.includes("invoice") || lower.includes("payment")) return "Billing";
  if (lower.includes("hr") || lower.includes("human resource")) return "HR";
  if (lower.includes("marketing")) return "Marketing";
  if (lower.includes("complaint") || lower.includes("escalat")) return "Complaints";
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
    en: { Sales: "Sales", Support: "Customer Support", Scheduling: "Scheduling", Billing: "Billing", HR: "Human Resources", Marketing: "Marketing", Complaints: "Complaints" },
    fr: { Sales: "ventes", Support: "service client", Scheduling: "prise de rendez-vous", Billing: "facturation", HR: "ressources humaines", Marketing: "marketing", Complaints: "réclamations" },
    it: { Sales: "vendite", Support: "assistenza clienti", Scheduling: "prenotazioni", Billing: "fatturazione", HR: "risorse umane", Marketing: "marketing", Complaints: "reclami" },
    zh: { Sales: "销售部门", Support: "客户支持", Scheduling: "预约服务", Billing: "账单部门", HR: "人力资源", Marketing: "市场营销", Complaints: "投诉部门" },
    hi: { Sales: "बिक्री विभाग", Support: "ग्राहक सहायता", Scheduling: "अपॉइंटमेंट शेड्यूलिंग", Billing: "बिलिंग", HR: "मानव संसाधन", Marketing: "मार्केटिंग", Complaints: "शिकायत" },
    ar: { Sales: "المبيعات", Support: "خدمة العملاء", Scheduling: "المواعيد", Billing: "الفواتير", HR: "الموارد البشرية", Marketing: "التسويق", Complaints: "الشكاوى" },
    es: { Sales: "ventas", Support: "atención al cliente", Scheduling: "citas", Billing: "facturación", HR: "recursos humanos", Marketing: "marketing", Complaints: "quejas" },
    de: { Sales: "Vertrieb", Support: "Kundendienst", Scheduling: "Terminvereinbarung", Billing: "Rechnungsabteilung", HR: "Personalabteilung", Marketing: "Marketing", Complaints: "Beschwerden" },
    ja: { Sales: "営業", Support: "カスタマーサポート", Scheduling: "予約", Billing: "請求", HR: "人事", Marketing: "マーケティング", Complaints: "苦情対応" },
    ko: { Sales: "영업", Support: "고객 지원", Scheduling: "예약", Billing: "청구", HR: "인사", Marketing: "마케팅", Complaints: "불만 접수" },
    pt: { Sales: "vendas", Support: "atendimento ao cliente", Scheduling: "agendamento", Billing: "faturamento", HR: "recursos humanos", Marketing: "marketing", Complaints: "reclamações" },
    ru: { Sales: "продажи", Support: "поддержка", Scheduling: "запись на приём", Billing: "выставление счетов", HR: "кадры", Marketing: "маркетинг", Complaints: "жалобы" },
    tr: { Sales: "satış", Support: "müşteri destek", Scheduling: "randevu", Billing: "fatura", HR: "insan kaynakları", Marketing: "pazarlama", Complaints: "şikâyet" },
    ur: { Sales: "سیلز", Support: "کسٹمر سپورٹ", Scheduling: "اپائنٹمنٹ", Billing: "بلنگ", HR: "ہیومن ریسورسز", Marketing: "مارکیٹنگ", Complaints: "شکایات" },
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
  speed?: number;
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
    <div className="flex items-center justify-center gap-0 py-4 sm:py-6 glass-surface rounded-xl" data-testid="step-indicator">
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
  usedPhoneMap,
}: {
  phoneNumbers: PhoneNumber[];
  selectedPhoneIds: string[];
  onTogglePhone: (id: string) => void;
  usedPhoneMap: Map<string, string>;
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
              const usedByLabel = usedPhoneMap.get(phone.id);
              const isUsed = !!usedByLabel && !isSelected;
              return (
                <Card
                  key={phone.id}
                  className={`glass-card transition-colors ${isUsed ? "opacity-50 cursor-not-allowed" : "cursor-pointer toggle-elevate"} ${isSelected ? "toggle-elevated border-green-500" : ""}`}
                  onClick={() => { if (!isUsed) onTogglePhone(phone.id); }}
                  data-testid={`card-phone-${phone.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-md ${isSelected ? "bg-green-100 dark:bg-green-900/30" : isUsed ? "bg-muted/50" : "bg-muted"}`}>
                      <Phone className={`h-4 w-4 ${isSelected ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm truncate ${isUsed ? "text-muted-foreground" : ""}`}>{phone.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground">{phone.provider}</div>
                      {phone.friendlyName && (
                        <div className="text-xs text-muted-foreground truncate">{phone.friendlyName}</div>
                      )}
                      {isUsed && (
                        <div className="text-[10px] text-orange-500 dark:text-orange-400 mt-0.5 font-medium">In use: {usedByLabel}</div>
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

type VoiceProviderOption = 'elevenlabs';

function VoiceProviderStep({
  selectedProvider,
  onSelectProvider,
}: {
  selectedProvider: VoiceProviderOption;
  onSelectProvider: (provider: VoiceProviderOption) => void;
}) {
  const providers: {
    id: VoiceProviderOption;
    name: string;
    description: string;
    tier: string;
    costLabel: string;
    features: string[];
    color: string;
    recommended?: boolean;
  }[] = [
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      description: 'Premium AI voices with studio-quality voice cloning and emotion control',
      tier: 'Premium',
      costLabel: '~$0.08/min',
      features: [
        'Voice cloning capability',
        '29+ languages supported',
        'Professional studio quality',
        'Emotion-rich delivery',
        'Higher per-minute rate',
      ],
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold" data-testid="text-step2-title">Choose Voice Provider</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Select the text-to-speech engine for your AI agents. This affects voice quality, latency, and cost.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {providers.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          return (
            <Card
              key={provider.id}
              className={`glass-card cursor-pointer transition-all toggle-elevate relative ${
                isSelected ? "toggle-elevated border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/30"
              }`}
              onClick={() => onSelectProvider(provider.id)}
              data-testid={`card-voice-provider-${provider.id}`}
            >
              {provider.recommended && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-primary">
                    <Zap className="h-3 w-3 mr-0.5" />
                    Recommended
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{provider.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{provider.costLabel}</Badge>
                    <Badge variant="outline" className="text-[10px]">{provider.tier}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <ul className="space-y-1.5">
                  {provider.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className={`h-3 w-3 flex-shrink-0 ${isSelected ? 'text-primary' : provider.color}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isSelected && (
                  <div className="mt-3 flex items-center justify-center">
                    <div className="p-1 bg-primary rounded-full">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
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
  externalGeneratingNameIds,
  dynamicElVoices = [],
  voiceProvider,
}: {
  dept: CanvasDepartment;
  agents: Agent[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CanvasDepartment>) => void;
  onDelete: () => void;
  toast: ReturnType<typeof useToast>["toast"];
  externalGeneratingIds?: Set<string>;
  externalGeneratingNameIds?: Set<string>;
  dynamicElVoices?: typeof ELEVENLABS_VOICES;
  voiceProvider: VoiceProviderOption;
}) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatingLangIds, setGeneratingLangIds] = useState<Set<string>>(new Set());
  const [generatingNameLangIds, setGeneratingNameLangIds] = useState<Set<string>>(new Set());
  const [pendingLangAgent, setPendingLangAgent] = useState<LanguageAgent | null>(null);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isLangGenerating = (langId: string) =>
    generatingLangIds.has(langId) || (externalGeneratingIds?.has(langId) ?? false);
  const isNameGenerating = (langId: string) =>
    generatingNameLangIds.has(langId) || (externalGeneratingNameIds?.has(langId) ?? false);

  const languageAgents = dept.languageAgents || [];
  // Ref tracks the latest languageAgents so async callbacks (AI generation)
  // never write back a stale snapshot and clobber concurrent updates.
  const languageAgentsRef = useRef<LanguageAgent[]>(languageAgents);
  useEffect(() => {
    languageAgentsRef.current = languageAgents;
  }, [languageAgents]);

  const uiLanguageAgents = useMemo(() => {
    if (!pendingLangAgent) return languageAgents;
    if (languageAgents.some((la) => la.id === pendingLangAgent.id)) return languageAgents;
    return [...languageAgents, pendingLangAgent];
  }, [languageAgents, pendingLangAgent]);

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
    if (pendingLangAgent && languageAgents.some((la) => la.id === pendingLangAgent.id)) {
      setPendingLangAgent(null);
    }
  }, [languageAgents, pendingLangAgent]);

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
    const bestVoice = dept.type !== "custom" ? getBestVoiceForDept(dept.type, newLangCode, dynamicElVoices) : getDefaultVoiceForLanguage(newLangCode, dynamicElVoices);
    const bestTone = dept.type !== "custom" ? getBestToneForDept(dept.type) : null;

    const agentFound = !!bestAgent;
    const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
    const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

    const nativeExamples = NATIVE_NAME_EXAMPLES[newLangCode] || NATIVE_NAME_EXAMPLES.en;
    const placeholderName = nativeExamples[Math.floor(Math.random() * nativeExamples.length)];
    const updates: Partial<LanguageAgent> = {
      language: newLangCode,
      agentId: bestAgent?.id || null,
      agentName: placeholderName,
      firstMessage: DEFAULT_FIRST_MESSAGES[newLangCode] || DEFAULT_FIRST_MESSAGES.en,
      systemPrompt,
      voiceId: bestVoice || null,
      voiceTone: voiceTone || null,
    };

    updateLanguageAgent(langAgentId, updates);

    generateAiAgentName(langAgentId, newLangCode);

    if (agentFound) {
      toast({
        title: "Language Changed",
        description: `Auto-selected agent for ${SUPPORTED_LANGUAGES.find(l => l.code === newLangCode)?.label}`,
      });
    } else {
      if (dept.type !== "custom") {
        const updatedList = languageAgents.map(la => la.id === langAgentId ? { ...la, ...updates } : la);
        toast({
          title: "Language Changed",
          description: `Generating AI prompt for ${SUPPORTED_LANGUAGES.find(l => l.code === newLangCode)?.label}...`,
        });
        generatePromptForLangAgent(langAgentId, dept.type, dept.name, newLangCode, updatedList);
      }
    }
  };

  const generatePromptForLangAgent = async (langAgentId: string, deptType: string, deptName: string, langCode: string, currentAgents: LanguageAgent[]) => {
    setGeneratingLangIds((prev) => new Set(prev).add(langAgentId));
    const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label || "English";
    const translatedName = translateDeptName(deptName, deptType, langCode);
    const t = toast({
      title: (<div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Generating System Prompt</span></div>),
      description: `Building an AI prompt for ${translatedName} (${langLabel})...`,
      duration: 120000,
    });
    try {
      const response = await apiRequest("POST", "/api/deprock/generate-prompt", {
        departmentType: deptType,
        departmentName: translatedName,
        language: langLabel,
      });
      const data = await response.json();
      if (data.prompt) {
        // Use the ref (latest state) instead of the captured snapshot so we
        // don't clobber concurrent updates (e.g. agentName / firstMessage
        // that arrived from other generators while this one was running).
        const latest = languageAgentsRef.current;
        onUpdate({
          languageAgents: latest.map((la) =>
            la.id === langAgentId ? { ...la, systemPrompt: data.prompt } : la
          ),
        });
        t.update({ id: t.id, title: "✅ System Prompt Generated", description: `AI prompt ready for ${translatedName} (${langLabel})`, duration: 3000 });
      }
    } catch {
      t.update({ id: t.id, title: "❌ Generation Failed", description: "You can write one manually or try generating later", duration: 4000 });
    } finally {
      setGeneratingLangIds((prev) => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
  };

  const addLanguageAgent = (selectedLangCode: string) => {
    const usedLangs = uiLanguageAgents.map((la) => la.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLangCode && !usedLangs.includes(l.code));
    if (!availableLang) return;

    const langCode = availableLang.code;
    const langAgentId = `la-${Date.now()}`;
    const bestAgent = dept.type !== "custom" ? getBestAgentForLang(dept.type, langCode) : null;
    const bestVoice = dept.type !== "custom" ? getBestVoiceForDept(dept.type, langCode, dynamicElVoices) : null;
    const bestTone = dept.type !== "custom" ? getBestToneForDept(dept.type) : null;

    const agentFound = !!bestAgent;
    const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
    const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

    const nativeExamples = NATIVE_NAME_EXAMPLES[langCode] || NATIVE_NAME_EXAMPLES.en;
    const placeholderName = nativeExamples[Math.floor(Math.random() * nativeExamples.length)];

    const newLangAgent: LanguageAgent = {
      id: langAgentId,
      language: langCode,
      agentId: bestAgent?.id || null,
      agentName: placeholderName,
      firstMessage: DEFAULT_FIRST_MESSAGES[langCode] || DEFAULT_FIRST_MESSAGES.en,
      systemPrompt,
      voiceId: bestVoice || null,
      voiceTone: voiceTone || null,
    };

    const updatedList = [...languageAgents, newLangAgent];
    onUpdate({ languageAgents: updatedList });
    // Prevent flicker: keep a temporary UI-only agent until parent state updates.
    setPendingLangAgent(newLangAgent);
    setActiveTabIdx(uiLanguageAgents.length);

    generateAiAgentName(langAgentId, langCode);

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
    // Read from ref to avoid clobbering concurrent updates from other async callbacks.
    const source = languageAgentsRef.current;
    const newList = source.map((la) => {
      if (la.id !== id) return la;
      const merged = { ...la, ...updates };
      if ('agentName' in updates && updates.agentName !== undefined) {
        const currentAgent = agents?.find((a: Agent) => a.id === la.agentId);
        if (currentAgent && updates.agentName !== currentAgent.name) {
          merged.agentId = null;
        }
      }
      return merged;
    });
    languageAgentsRef.current = newList;
    onUpdate({ languageAgents: newList });
  };

  const generateAiAgentName = async (langAgentId: string, langCode: string) => {
    const langAgent = languageAgents.find(la => la.id === langAgentId);
    const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label || langCode;
    setGeneratingNameLangIds(prev => new Set(prev).add(langAgentId));
    const t = toast({
      title: (<div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Generating Agent Name</span></div>),
      description: `Creating an AI-powered name for your ${langLabel} agent...`,
      duration: 60000,
    });
    try {
      const response = await apiRequest("POST", "/api/deprock/generate-name", {
        language: langCode,
        departmentType: dept.type,
        departmentName: dept.name,
        voiceTone: langAgent?.voiceTone || undefined,
      });
      const data = await response.json();
      if (data.name) {
        updateLanguageAgent(langAgentId, { agentName: data.name, agentId: null });
        setGeneratingNameLangIds(prev => {
          const next = new Set(prev);
          next.delete(langAgentId);
          return next;
        });
        t.update({ id: t.id, title: "✅ Agent Name Generated", description: `${data.name} — ready for your ${langLabel} agent`, duration: 3000 });
        setTimeout(() => generateAiFirstMessage(langAgentId, langCode), 300);
      }
    } catch {
      t.update({ id: t.id, title: "❌ Name Generation Failed", description: "Could not generate agent name", duration: 3000 });
    } finally {
      setGeneratingNameLangIds(prev => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
  };

  const generateAiFirstMessage = async (langAgentId: string, langCode: string) => {
    const langAgent = languageAgents.find(la => la.id === langAgentId);
    const translatedDeptName = translateDeptName(dept.name, dept.type, langCode);
    const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label || langCode;
    setGeneratingLangIds(prev => new Set(prev).add(langAgentId));
    const t = toast({
      title: (<div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Generating First Message</span></div>),
      description: `Crafting a greeting for your ${langLabel} agent...`,
      duration: 60000,
    });
    try {
      const response = await apiRequest("POST", "/api/deprock/generate-first-message", {
        language: langCode,
        departmentType: dept.type,
        departmentName: translatedDeptName,
        voiceTone: langAgent?.voiceTone || undefined,
        agentName: langAgent?.agentName || undefined,
      });
      const data = await response.json();
      if (data.firstMessage) {
        updateLanguageAgent(langAgentId, { firstMessage: data.firstMessage });
        t.update({ id: t.id, title: "✅ First Message Generated", description: `Greeting ready for your ${langLabel} agent`, duration: 3000 });
      }
    } catch {
      t.update({ id: t.id, title: "❌ Generation Failed", description: "Could not generate first message", duration: 3000 });
    } finally {
      setGeneratingLangIds(prev => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
  };

  const generatePromptForAgent = async (langAgentId: string, agentName: string, language: string, preserveUpdates?: Partial<LanguageAgent>) => {
    setIsGeneratingPrompt(true);
    const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || "English";
    const translatedDeptName = translateDeptName(dept.name, dept.type, language);
    const t = toast({
      title: (<div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Generating System Prompt</span></div>),
      description: `Building an AI prompt for ${translatedDeptName} (${langLabel})...`,
      duration: 120000,
    });
    try {
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
        t.update({ id: t.id, title: "✅ System Prompt Generated", description: `AI prompt ready for ${translatedDeptName} (${langLabel})`, duration: 3000 });
      }
    } catch (err: any) {
      t.update({ id: t.id, title: "❌ Generation Failed", description: err.message || "Could not generate prompt", duration: 4000 });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSelectAgent = (langAgentId: string, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      const langAgent = languageAgents.find(la => la.id === langAgentId);
      const language = langAgent?.language || "en";
      const bestVoice = getBestVoiceForDept(dept.type, language, dynamicElVoices);
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

  const handlePlayVoice = async (voiceId: string, customText?: string) => {
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
      const sampleText = customText || DEFAULT_GREETINGS[langCode] || DEFAULT_GREETINGS.en;
      const response = await apiRequest("POST", "/api/deprock/voice-preview", {
        voiceId,
        text: sampleText,
        language: langCode,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
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

  const activeLangAgent = uiLanguageAgents[activeTabIdx];
  const availableAgentsForActive = activeLangAgent ? getAgentsForLanguage(activeLangAgent.language) : [];

  const enabledFeaturesCount = [dept.enableTransfer, dept.enableLanguageDetection, dept.enableEndConversation, dept.enableAppointmentBooking, dept.enableRecording].filter(Boolean).length;

  return (
    <Card className="glass-card" data-testid={`card-dept-${dept.id}`}>
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer"
        onClick={onToggleExpand}
        data-testid={`button-expand-dept-${dept.id}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-muted rounded">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[13px] truncate">{dept.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
            {languageAgents.length} lang
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
            {enabledFeaturesCount}/5
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            data-testid={`button-quick-delete-dept-${dept.id}`}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="px-3 pb-3 pt-0 space-y-3 border-t min-h-[320px]">
          <div className="pt-3 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Department Name</Label>
              <Input
                value={dept.name || ""}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="mt-1 h-8 text-sm"
                data-testid="input-dept-name"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Languages</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="text-[10px] text-primary hover:underline font-medium disabled:opacity-50"
                      disabled={uiLanguageAgents.length >= SUPPORTED_LANGUAGES.length}
                      data-testid="button-add-language"
                    >
                      + Add
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SUPPORTED_LANGUAGES
                      .filter((l) => !uiLanguageAgents.some((la) => la.language === l.code))
                      .map((lang) => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => addLanguageAgent(lang.code)}
                          data-testid={`menu-add-language-${lang.code}`}
                        >
                          <Globe className="h-3 w-3 mr-1.5" />
                          {lang.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {uiLanguageAgents.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {uiLanguageAgents.map((la, idx) => (
                    <Badge
                      key={la.id}
                      variant={idx === activeTabIdx ? "default" : "outline"}
                      className="cursor-pointer text-[10px] px-1.5 py-0 h-5"
                      onClick={() => setActiveTabIdx(idx)}
                      data-testid={`badge-lang-${la.language}`}
                    >
                      {isLangGenerating(la.id) && (
                        <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                      )}
                      {SUPPORTED_LANGUAGES.find((l) => l.code === la.language)?.label || la.language}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-muted-foreground italic">No languages configured</div>
              )}
            </div>
          </div>

          {activeLangAgent && (
            <div className="p-2.5 space-y-2.5 border rounded bg-muted/20 relative min-h-[200px]">
              {(() => {
                const nameBusy = isNameGenerating(activeLangAgent.id);
                const msgBusy = isLangGenerating(activeLangAgent.id);
                const promptBusy = isGeneratingPrompt;
                if (!nameBusy && !msgBusy && !promptBusy) return null;
                const steps = [
                  { key: "name", label: "Agent name", busy: nameBusy, done: !nameBusy && !!activeLangAgent.agentName },
                  { key: "msg", label: "First message", busy: msgBusy, done: !msgBusy && !!activeLangAgent.firstMessage },
                  { key: "prompt", label: "System prompt", busy: promptBusy, done: !promptBusy && !!activeLangAgent.systemPrompt },
                ];
                return (
                  <div
                    className="relative overflow-hidden mb-2 rounded-md border border-primary/15 bg-gradient-to-r from-primary/[0.04] via-primary/[0.07] to-primary/[0.04] px-3 py-2 shadow-sm"
                    data-testid="lang-loading-overlay"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                          Preparing your {SUPPORTED_LANGUAGES.find(l => l.code === activeLangAgent.language)?.label || ""} agent
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                        {steps.filter(s => s.done).length}/{steps.length}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {steps.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-3 shrink-0">
                          {i > 0 && <div className="h-px w-6 bg-primary/15" />}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {s.busy ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : s.done ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-muted-foreground/40 bg-background" />
                            )}
                            <span className={`text-[10.5px] font-medium ${s.busy ? "text-primary" : s.done ? "text-foreground/70" : "text-muted-foreground"}`}>
                              {s.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden bg-primary/10">
                      <div className="h-full w-full bg-primary/40 animate-pulse" />
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Select
                    value={activeLangAgent.language}
                    onValueChange={(val) => handleLanguageChange(activeLangAgent.id, val)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-lang-tab">
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
                  <span className="text-[10px] text-muted-foreground">Agent Config</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeLanguageAgent(activeLangAgent.id)}
                  data-testid="button-remove-lang-agent"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">
                      Agent Name
                      {isNameGenerating(activeLangAgent.id) && (
                        <span className="ml-1 text-[10px] text-primary animate-pulse">generating...</span>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1"
                      disabled={isNameGenerating(activeLangAgent.id) || isLangGenerating(activeLangAgent.id)}
                      onClick={() => generateAiAgentName(activeLangAgent.id, activeLangAgent.language)}
                      data-testid="button-generate-agent-name"
                    >
                      {isNameGenerating(activeLangAgent.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="relative mt-0.5">
                    <Input
                      className="h-7 text-xs"
                      value={activeLangAgent.agentName || ""}
                      onChange={(e) => updateLanguageAgent(activeLangAgent.id, { agentName: e.target.value })}
                      placeholder={isNameGenerating(activeLangAgent.id) ? "Generating name..." : getRandomName(activeLangAgent.language, activeLangAgent.id)}
                      data-testid="input-agent-name"
                    />
                    {isNameGenerating(activeLangAgent.id) && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Voice Tone</Label>
                  <Select
                    value={activeLangAgent.voiceTone || ""}
                    onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceTone: val })}
                  >
                    <SelectTrigger className="mt-0.5 h-7 text-xs" data-testid="select-voice-tone">
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
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">
                    First Message
                    {isLangGenerating(activeLangAgent.id) && (
                      <span className="ml-1 text-[10px] text-primary animate-pulse">generating...</span>
                    )}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1"
                    disabled={isLangGenerating(activeLangAgent.id) || isNameGenerating(activeLangAgent.id)}
                    onClick={() => generateAiFirstMessage(activeLangAgent.id, activeLangAgent.language)}
                    data-testid="button-generate-first-message"
                  >
                    {isLangGenerating(activeLangAgent.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="relative mt-0.5">
                  <Input
                    className="h-7 text-xs"
                    value={activeLangAgent.firstMessage || ""}
                    onChange={(e) => updateLanguageAgent(activeLangAgent.id, { firstMessage: e.target.value })}
                    placeholder={isLangGenerating(activeLangAgent.id) ? "Generating first message..." : (DEFAULT_FIRST_MESSAGES[activeLangAgent.language] || DEFAULT_FIRST_MESSAGES.en)}
                    data-testid="input-first-message"
                  />
                  {isLangGenerating(activeLangAgent.id) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Voice</Label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Select
                    value={activeLangAgent.voiceId || ""}
                    onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceId: val })}
                  >
                    <SelectTrigger className="flex-1 h-7 text-xs" data-testid="select-voice">
                      <SelectValue placeholder="Select a voice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getVoicesForLanguage(activeLangAgent.language, dynamicElVoices).length > 0 ? (
                        <>
                          {getVoicesForLanguage(activeLangAgent.language, dynamicElVoices).map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} - {voice.gender}, {voice.style}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No voices for this language</div>
                      )}
                    </SelectContent>
                  </Select>
                  {activeLangAgent.voiceId && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handlePlayVoice(activeLangAgent.voiceId!)}
                      data-testid="button-preview-voice"
                    >
                      {playingVoiceId === activeLangAgent.voiceId ? (
                        <Square className="h-3 w-3" />
                      ) : (
                        <Volume2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">
                    System Prompt
                    {isGeneratingPrompt && (
                      <span className="ml-1 text-[10px] text-primary animate-pulse">generating...</span>
                    )}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    disabled={isGeneratingPrompt || isLangGenerating(activeLangAgent.id)}
                    onClick={() => generatePromptForAgent(activeLangAgent.id, activeLangAgent.agentName || "", activeLangAgent.language)}
                    data-testid="button-generate-prompt"
                  >
                    {(isGeneratingPrompt || isLangGenerating(activeLangAgent.id)) ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {(isGeneratingPrompt || isLangGenerating(activeLangAgent.id)) ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
                <div className="relative mt-0.5">
                  <Textarea
                    value={activeLangAgent.systemPrompt || ""}
                    onChange={(e) => updateLanguageAgent(activeLangAgent.id, { systemPrompt: e.target.value })}
                    rows={3}
                    className="text-xs"
                    disabled={isLangGenerating(activeLangAgent.id)}
                    placeholder={isLangGenerating(activeLangAgent.id) ? "Generating prompt with AI..." : "Instructions for the AI agent..."}
                    data-testid="input-agent-prompt"
                  />
                  {(isLangGenerating(activeLangAgent.id) || isGeneratingPrompt) && !activeLangAgent.systemPrompt && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating AI prompt...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 w-full text-left py-1"
              onClick={() => setFeaturesOpen(!featuresOpen)}
              aria-expanded={featuresOpen}
              data-testid="button-toggle-features"
            >
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${featuresOpen ? 'rotate-180' : ''}`} />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Features</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{enabledFeaturesCount}/5</span>
            </button>
            {featuresOpen && <div className="mt-2">
              <div className="grid grid-cols-5 gap-1.5">
                <div className="p-2 border rounded space-y-1.5">
                  <div className="flex items-center justify-between">
                    <PhoneForwarded className="h-3 w-3 text-blue-500" />
                    <Switch
                      checked={dept.enableTransfer}
                      onCheckedChange={(val) => onUpdate({ enableTransfer: val })}
                      data-testid="switch-dept-transfer"
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="text-[10px] font-medium leading-tight">Transfer</div>
                  {dept.enableTransfer && (
                    <div className="space-y-1 pt-1 border-t">
                      <Input
                        value={dept.transferNumber || ""}
                        onChange={(e) => onUpdate({ transferNumber: e.target.value })}
                        placeholder="+1 555..."
                        className="h-6 text-[10px] px-1.5"
                        data-testid="input-transfer-number"
                      />
                      <Input
                        value={dept.transferMessage || ""}
                        onChange={(e) => onUpdate({ transferMessage: e.target.value })}
                        placeholder="Message..."
                        className="h-6 text-[10px] px-1.5"
                        data-testid="input-transfer-message"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2 border rounded space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Languages className="h-3 w-3 text-green-500" />
                    <Switch
                      checked={dept.enableLanguageDetection}
                      onCheckedChange={(val) => onUpdate({ enableLanguageDetection: val })}
                      data-testid="switch-lang-detection"
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="text-[10px] font-medium leading-tight">Detect</div>
                  {dept.enableLanguageDetection && (
                    <p className="text-[9px] text-muted-foreground pt-1 border-t leading-tight">99 languages</p>
                  )}
                </div>

                <div className="p-2 border rounded space-y-1.5">
                  <div className="flex items-center justify-between">
                    <PhoneOff className="h-3 w-3 text-orange-500" />
                    <Switch
                      checked={dept.enableEndConversation}
                      onCheckedChange={(val) => onUpdate({ enableEndConversation: val })}
                      data-testid="switch-end-conversation"
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="text-[10px] font-medium leading-tight">End Call</div>
                  {dept.enableEndConversation && (
                    <div className="pt-1 border-t">
                      <Textarea
                        value={(dept.endConversationPhrases || ["goodbye", "thank you for calling", "have a nice day"]).join("\n")}
                        onChange={(e) => onUpdate({
                          endConversationPhrases: e.target.value.split("\n").filter(p => p.trim())
                        })}
                        placeholder={"goodbye\nthank you"}
                        rows={2}
                        className="text-[9px] min-h-0 px-1.5"
                        data-testid="input-end-phrases"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2 border rounded space-y-1.5">
                  <div className="flex items-center justify-between">
                    <CalendarCheck className="h-3 w-3 text-purple-500" />
                    <Switch
                      checked={dept.enableAppointmentBooking}
                      onCheckedChange={(val) => onUpdate({ enableAppointmentBooking: val })}
                      data-testid="switch-appointment"
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="text-[10px] font-medium leading-tight">Booking</div>
                  {dept.enableAppointmentBooking && (
                    <div className="space-y-1 pt-1 border-t">
                      <Input
                        value={dept.calendarUrl || ""}
                        onChange={(e) => onUpdate({ calendarUrl: e.target.value })}
                        placeholder="URL..."
                        className="h-6 text-[10px] px-1.5"
                        data-testid="input-calendar-url"
                      />
                    </div>
                  )}
                </div>

                <div className="p-2 border rounded space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Circle className="h-3 w-3 text-red-500" />
                    <Switch
                      checked={dept.enableRecording}
                      onCheckedChange={(val) => onUpdate({ enableRecording: val })}
                      data-testid="switch-dept-recording"
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="text-[10px] font-medium leading-tight">Record</div>
                  {dept.enableRecording && (
                    <p className="text-[9px] text-muted-foreground pt-1 border-t leading-tight">Disclosure on</p>
                  )}
                </div>
              </div>
            </div>}
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
  dynamicElVoices = [],
  voiceProvider,
}: {
  canvasDepartments: CanvasDepartment[];
  setCanvasDepartments: (fn: (prev: CanvasDepartment[]) => CanvasDepartment[]) => void;
  agents: Agent[];
  toast: ReturnType<typeof useToast>["toast"];
  dynamicElVoices?: typeof ELEVENLABS_VOICES;
  voiceProvider: VoiceProviderOption;
}) {
  const [customDeptName, setCustomDeptName] = useState("");
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [generatingDeptLangIds, setGeneratingDeptLangIds] = useState<Set<string>>(new Set());
  const [generatingNameDeptIds, setGeneratingNameDeptIds] = useState<Set<string>>(new Set());

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

  const generateAiNameForNewDept = async (deptId: string, langAgentId: string, langCode: string, deptType: string, deptName: string) => {
    setGeneratingNameDeptIds((prev) => new Set(prev).add(langAgentId));
    try {
      // Generate AI name with the provided department info
      const nameResponse = await apiRequest("POST", "/api/deprock/generate-name", {
        language: langCode,
        departmentType: deptType,
        departmentName: deptName,
      });
      const nameData = await nameResponse.json();
      
      if (nameData.name) {
        // Update with the generated name, then switch loading state to first message
        setCanvasDepartments((prev) =>
          prev.map((d) => {
            if (d.id !== deptId) return d;
            return {
              ...d,
              languageAgents: (d.languageAgents || []).map((la) =>
                la.id === langAgentId ? { ...la, agentName: nameData.name, agentId: null } : la
              ),
            };
          })
        );
        setGeneratingNameDeptIds((prev) => {
          const next = new Set(prev);
          next.delete(langAgentId);
          return next;
        });

        // Then generate the first message with the new name
        setGeneratingDeptLangIds((prev) => new Set(prev).add(langAgentId));
        try {
          const translatedDeptName = translateDeptName(deptName, deptType, langCode);
          
          const msgResponse = await apiRequest("POST", "/api/deprock/generate-first-message", {
            language: langCode,
            departmentType: deptType,
            departmentName: translatedDeptName,
            agentName: nameData.name,
          });
          const msgData = await msgResponse.json();
          
          if (msgData.firstMessage) {
            setCanvasDepartments((prev) =>
              prev.map((d) => {
                if (d.id !== deptId) return d;
                return {
                  ...d,
                  languageAgents: (d.languageAgents || []).map((la) =>
                    la.id === langAgentId ? { ...la, firstMessage: msgData.firstMessage } : la
                  ),
                };
              })
            );
          }
        } catch {
          // If first message generation fails, that's ok - at least we have the name
        } finally {
          setGeneratingDeptLangIds((prev) => {
            const next = new Set(prev);
            next.delete(langAgentId);
            return next;
          });
        }
      }
    } catch {
    } finally {
      setGeneratingNameDeptIds((prev) => {
        const next = new Set(prev);
        next.delete(langAgentId);
        return next;
      });
    }
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
      const bestVoice = deptType !== "custom" ? getBestVoiceForDept(deptType, langCode, dynamicElVoices) : getDefaultVoiceForLanguage(langCode, dynamicElVoices);
      const bestTone = deptType !== "custom" ? getBestToneForDept(deptType) : null;
      const bestAgent = deptType !== "custom" ? getBestAgentForDept(deptType, langCode) : null;
      const agentFound = !!bestAgent;
      const systemPrompt = agentFound ? (bestAgent.systemPrompt || "") : "";
      const voiceTone = agentFound ? (bestAgent.voiceTone || bestTone) : bestTone;

      const nativeExamples = NATIVE_NAME_EXAMPLES[langCode] || NATIVE_NAME_EXAMPLES.en;
      const placeholderName = nativeExamples[Math.floor(Math.random() * nativeExamples.length)];

      return {
        id: langAgentId,
        language: langCode,
        agentId: bestAgent?.id || null,
        agentName: placeholderName,
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

    languageAgents.forEach((la) => {
      // Always generate unique AI names for new departments
      generateAiNameForNewDept(newDeptId, la.id, la.language, deptType, template.name);
    });

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
            externalGeneratingNameIds={generatingNameDeptIds}
            dynamicElVoices={dynamicElVoices}
            voiceProvider={voiceProvider}
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
  ivrVoiceSpeed,
  setIvrVoiceSpeed,
  selectedLangTab,
  setSelectedLangTab,
  toast,
  dynamicElVoices = [],
  voiceProvider,
  dynamicCartesiaVoices = [],
  customizedDeptGreetings,
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
  ivrVoiceSpeed: number;
  setIvrVoiceSpeed: (val: number) => void;
  selectedLangTab: string;
  setSelectedLangTab: (val: string) => void;
  toast: ReturnType<typeof useToast>["toast"];
  dynamicElVoices?: typeof ELEVENLABS_VOICES;
  voiceProvider: VoiceProviderOption;
  dynamicCartesiaVoices?: typeof CARTESIA_DEFAULT_VOICES;
  customizedDeptGreetings: React.MutableRefObject<Set<string>>;
}) {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const addLanguageOption = () => {
    const usedLangs = languageOptions.map((o) => o.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;

    const allDeptIds = canvasDepartments.map(d => d.id);

    const newId = `lang-${Date.now()}`;
    const newOption: LanguageOption = {
      id: newId,
      language: availableLang.code,
      voiceId: getDefaultVoiceForLanguage(availableLang.code, dynamicElVoices),
      greeting: generateDeptGreeting(deptInfos, availableLang.code),
      selectedDepartments: allDeptIds,
    };
    setLanguageOptions([...languageOptions, newOption]);
    setSelectedLangTab(newId);
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
            updated.voiceId = getDefaultVoiceForLanguage(updates.language, dynamicElVoices);
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

  const handlePlayVoice = async (voiceId: string, text?: string, speed?: number, language?: string) => {
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
      const response = await apiRequest("POST", "/api/deprock/voice-preview", { voiceId, text: sampleText, speed, language });

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
      audioRef.current.play().catch(() => {});
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

      <div className="flex items-center justify-between gap-3 flex-wrap p-3 glass-surface rounded-xl">
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
                        {getVoicesForLanguage('en', dynamicElVoices).map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} - {voice.gender}, {voice.style}
                          </SelectItem>
                        ))}
                        {getVoicesForLanguage('en', dynamicElVoices).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No voices available</div>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePlayVoice(languageSelectionGreetingVoice, languageSelectionGreetingText, ivrVoiceSpeed, 'en')}
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
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="text-greeting-voice-speed">{ivrVoiceSpeed.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[ivrVoiceSpeed]}
                    onValueChange={([value]) => setIvrVoiceSpeed(value)}
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    className="mt-1.5"
                    data-testid="slider-greeting-voice-speed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Slower speeds improve clarity for IVR menus (recommended: 0.85-0.95)</p>
                </div>
              </div>

              <div className="space-y-0">
                <Label className="mb-2 block">Language Options</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-end bg-muted/40 border-b overflow-x-auto" data-testid="language-tab-bar">
                    {languageOptions.map((opt, idx) => {
                      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label || opt.language;
                      const isActive = selectedLangTab === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedLangTab(opt.id)}
                          className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-r transition-colors ${
                            isActive
                              ? 'bg-background text-foreground border-b-2 border-b-primary -mb-px z-10'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                          }`}
                          data-testid={`tab-lang-${idx}`}
                        >
                          <span className="text-xs font-mono opacity-60">{idx + 1}</span>
                          <span>{langLabel}</span>
                          {languageOptions.length > 1 && (
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLanguageOption(opt.id);
                                if (selectedLangTab === opt.id) {
                                  const remaining = languageOptions.filter(o => o.id !== opt.id);
                                  if (remaining.length > 0) setSelectedLangTab(remaining[0].id);
                                }
                              }}
                              className="ml-1 rounded-sm hover:bg-destructive/10 hover:text-destructive p-0.5"
                              data-testid={`button-remove-lang-${idx}`}
                            >
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={addLanguageOption}
                      disabled={languageOptions.length >= SUPPORTED_LANGUAGES.length}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid="button-add-language"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                  </div>

                  {(() => {
                    const activeOpt = languageOptions.find(o => o.id === selectedLangTab) || languageOptions[0];
                    if (!activeOpt) {
                      return (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Click "Add" to configure language options
                        </div>
                      );
                    }
                    const activeIdx = languageOptions.findIndex(o => o.id === activeOpt.id);
                    return (
                      <div className="p-3 sm:p-4 space-y-3" data-testid={`lang-panel-${activeIdx}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">Press {activeIdx + 1}</Badge>
                            <Select
                              value={activeOpt.language}
                              onValueChange={(val) => updateLanguageOption(activeOpt.id, { language: val })}
                            >
                              <SelectTrigger className="w-32" data-testid={`select-lang-option-${activeIdx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUPPORTED_LANGUAGES.map((lang) => (
                                  <SelectItem
                                    key={lang.code}
                                    value={lang.code}
                                    disabled={languageOptions.some((o) => o.id !== activeOpt.id && o.language === lang.code)}
                                  >
                                    {lang.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Voice</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Select
                              value={activeOpt.voiceId}
                              onValueChange={(val) => updateLanguageOption(activeOpt.id, { voiceId: val })}
                            >
                              <SelectTrigger className="flex-1" data-testid={`select-voice-${activeIdx}`}>
                                <SelectValue placeholder="Select a voice..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getVoicesForLanguage(activeOpt.language, dynamicElVoices).length > 0 ? (
                                  <>
                                    {getVoicesForLanguage(activeOpt.language, dynamicElVoices).map((voice) => (
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
                              onClick={() => handlePlayVoice(activeOpt.voiceId, activeOpt.greeting, activeOpt.speed ?? 0.92, activeOpt.language)}
                              data-testid={`button-preview-voice-${activeIdx}`}
                            >
                              {playingVoiceId === activeOpt.voiceId ? (
                                <Square className="h-4 w-4" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                            <span className="text-xs font-mono text-muted-foreground" data-testid={`text-voice-speed-${activeIdx}`}>{(activeOpt.speed ?? 0.92).toFixed(2)}x</span>
                          </div>
                          <Slider
                            value={[activeOpt.speed ?? 0.92]}
                            onValueChange={([value]) => updateLanguageOption(activeOpt.id, { speed: value })}
                            min={0.5}
                            max={1.5}
                            step={0.05}
                            className="mt-1.5"
                            data-testid={`slider-voice-speed-${activeIdx}`}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Slower speeds improve clarity for IVR menus (recommended: 0.85-0.95)</p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Label className="text-xs text-muted-foreground">Deprock Department Menu Greeting</Label>
                            {customizedDeptGreetings.current.has(activeOpt.id) && canvasDepartments.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  customizedDeptGreetings.current.delete(activeOpt.id);
                                  updateLanguageOption(activeOpt.id, {
                                    greeting: generateDeptGreeting(deptInfos, activeOpt.language),
                                  });
                                }}
                                data-testid={`button-reset-dept-greeting-${activeIdx}`}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset
                              </Button>
                            )}
                          </div>
                          <Textarea
                            value={activeOpt.greeting}
                            onChange={(e) => {
                              customizedDeptGreetings.current.add(activeOpt.id);
                              updateLanguageOption(activeOpt.id, { greeting: e.target.value });
                            }}
                            rows={2}
                            className="mt-1"
                            data-testid={`input-greeting-${activeIdx}`}
                          />
                          {canvasDepartments.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Auto-generated from deprock departments. Edit to customize.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
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
                        voiceId: getDefaultVoiceForLanguage('en', dynamicElVoices),
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
                    value={languageOptions[0]?.voiceId || "el_rachel"}
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
                      {(() => {
                        const lang = languageOptions[0]?.language || 'en';
                        const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label || 'English';
                        const allVoices = getVoicesForLanguage(lang, dynamicElVoices);
                        return (
                          <>
                            {allVoices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} - {voice.gender}, {voice.style}
                              </SelectItem>
                            ))}
                            {allVoices.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">No voices for this language</div>
                            )}
                          </>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePlayVoice(
                      languageOptions[0]?.voiceId || "el_rachel",
                      languageOptions[0]?.greeting || DEFAULT_GREETINGS.en,
                      languageOptions[0]?.speed ?? ivrVoiceSpeed,
                      languageOptions[0]?.language || 'en'
                    )}
                    data-testid="button-preview-default-voice"
                  >
                    {playingVoiceId === (languageOptions[0]?.voiceId || "el_rachel") ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="text-default-voice-speed">{(languageOptions[0]?.speed ?? ivrVoiceSpeed).toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[languageOptions[0]?.speed ?? ivrVoiceSpeed]}
                    onValueChange={([value]) => {
                      if (languageOptions[0]) {
                        updateLanguageOption(languageOptions[0].id, { speed: value });
                      }
                      setIvrVoiceSpeed(value);
                    }}
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    className="mt-1.5"
                    data-testid="slider-default-voice-speed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Slower speeds improve clarity for IVR menus (recommended: 0.85-0.95)</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Card className="glass-card" data-testid="card-summary">
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

  const { data: dynamicElVoices = [] } = useQuery<ElevenLabsApiVoice[], Error, typeof ELEVENLABS_VOICES>({
    queryKey: ["/api/elevenlabs/voices"],
    select: (data) => mapApiVoicesToLocal(data || []),
    staleTime: 5 * 60 * 1000,
  });

  const apiCartesiaVoices: typeof CARTESIA_DEFAULT_VOICES = [];

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [selectedVoiceProvider, setSelectedVoiceProvider] = useState<VoiceProviderOption>('elevenlabs');
  const [canvasDepartments, setCanvasDepartments] = useState<CanvasDepartment[]>([]);
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [selectedLangTab, setSelectedLangTab] = useState<string>("default");
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "el_rachel", greeting: DEFAULT_GREETINGS.en },
  ]);
  const [languageSelectionGreetingText, setLanguageSelectionGreetingText] = useState('');
  const [languageSelectionGreetingVoice, setLanguageSelectionGreetingVoice] = useState('el_rachel');
  const [ivrVoiceSpeed, setIvrVoiceSpeed] = useState(0.92);
  const isGreetingCustomized = useRef(false);
  const customizedDeptGreetings = useRef<Set<string>>(new Set());

  const { data: userProfile, isLoading: loadingProfile } = useQuery<{ company?: string; name?: string }>({
    queryKey: ["/api/auth/me"],
  });
  const companyDisplayName = userProfile?.company || userProfile?.name || '';

  const { data: phoneNumbers = [], isLoading: loadingPhones } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [], isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: knowledgeBases = [], isLoading: loadingKB } = useQuery<any[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const { data: allIvrConfigs = [], isLoading: loadingIvr } = useQuery<{ id: string; phoneNumberId: string | null; name: string | null; engineType: string | null; isActive: boolean | null }[]>({
    queryKey: ["/api/deprock/ivr-configs-all"],
  });

  const { data: incomingConnsData, isLoading: loadingConns } = useQuery<{ connections: { id: number; phoneNumberId: string | null; agentId?: string | null }[] }>({
    queryKey: ["/api/incoming-connections"],
  });

  const dataLoading = loadingProfile || loadingPhones || loadingAgents || loadingKB || loadingIvr || loadingConns;
  const [initialReady, setInitialReady] = useState(false);
  useEffect(() => {
    if (!dataLoading && !initialReady) {
      const timer = setTimeout(() => setInitialReady(true), 800);
      return () => clearTimeout(timer);
    }
  }, [dataLoading, initialReady]);
  const pageLoading = !initialReady;
  const allIncomingConns = incomingConnsData?.connections ?? [];

  const usedPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    // Only active IVR configs block a phone number
    allIvrConfigs.forEach((ivr) => {
      if (ivr.phoneNumberId && ivr.isActive !== false) {
        const label = ivr.name || (ivr.engineType === 'bedrock-polly' ? 'Deprock IVR' : 'Department IVR');
        map.set(ivr.phoneNumberId, label);
      }
    });
    allIncomingConns.forEach((conn) => {
      if (conn.phoneNumberId && !map.has(conn.phoneNumberId)) {
        map.set(conn.phoneNumberId, 'Incoming Connection');
      }
    });
    return map;
  }, [allIvrConfigs, allIncomingConns]);

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
        voiceId: getDefaultVoiceForLanguage(langCode, dynamicElVoices, selectedVoiceProvider, apiCartesiaVoices),
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

  const parentDeptInfos: DeptInfo[] = useMemo(() =>
    canvasDepartments.map(d => ({ name: d.name || "Department", type: d.type })),
    [canvasDepartments]
  );
  const parentDeptNamesKey = parentDeptInfos.map(d => `${d.name}:${d.type}`).join("||");

  useEffect(() => {
    if (canvasDepartments.length === 0) return;
    setLanguageOptions(prev => {
      const updatedOptions = prev.map((opt) => {
        if (customizedDeptGreetings.current.has(opt.id)) return opt;
        return {
          ...opt,
          greeting: generateDeptGreeting(parentDeptInfos, opt.language),
          selectedDepartments: canvasDepartments.map(d => d.id),
        };
      });
      const changed = updatedOptions.some((opt, i) => opt.greeting !== prev[i]?.greeting);
      return changed ? updatedOptions : prev;
    });
  }, [parentDeptNamesKey, canvasDepartments.length]);

  const prevVoiceProviderRef = useRef(selectedVoiceProvider);
  useEffect(() => {
    if (prevVoiceProviderRef.current === selectedVoiceProvider) return;
    prevVoiceProviderRef.current = selectedVoiceProvider;
    setLanguageOptions(prev =>
      prev.map(opt => ({
        ...opt,
        voiceId: getDefaultVoiceForLanguage(opt.language, dynamicElVoices, selectedVoiceProvider, apiCartesiaVoices),
      }))
    );
    setLanguageSelectionGreetingVoice(
      getDefaultVoiceForLanguage('en', dynamicElVoices, selectedVoiceProvider, apiCartesiaVoices)
    );
  }, [selectedVoiceProvider, dynamicElVoices, apiCartesiaVoices]);

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
  }, [currentStep, selectedPhoneIds.length, selectedVoiceProvider, canvasDepartments.length]);

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
              firstMessage: la.firstMessage || DEFAULT_FIRST_MESSAGES[la.language] || DEFAULT_FIRST_MESSAGES.en,
              voiceTone: la.voiceTone || undefined,
              voiceId: la.voiceId || undefined,
              ttsProvider: selectedVoiceProvider,
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
            voiceId: multiLangEnabled ? languageSelectionGreetingVoice : (languageOptions[0]?.voiceId || 'el_rachel'),
            menuOptions,
            languageOptions: (multiLangEnabled ? languageOptions : languageOptions).map(opt => ({
              ...opt,
              speed: opt.speed ?? ivrVoiceSpeed,
            })),
          });
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
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

  if (pageLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center" data-testid="page-loading">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

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
              usedPhoneMap={usedPhoneMap}
            />
          )}
          {currentStep === 2 && (
            <DepartmentsStep
              canvasDepartments={canvasDepartments}
              setCanvasDepartments={setCanvasDepartments}
              agents={agents}
              toast={toast}
              dynamicElVoices={dynamicElVoices}
              voiceProvider={selectedVoiceProvider}
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
              ivrVoiceSpeed={ivrVoiceSpeed}
              setIvrVoiceSpeed={setIvrVoiceSpeed}
              selectedLangTab={selectedLangTab}
              setSelectedLangTab={setSelectedLangTab}
              toast={toast}
              dynamicElVoices={dynamicElVoices}
              voiceProvider={selectedVoiceProvider}
              customizedDeptGreetings={customizedDeptGreetings}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 sm:gap-3 mt-6 sm:mt-8 pt-4 border-t border-border/30">
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

          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
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
