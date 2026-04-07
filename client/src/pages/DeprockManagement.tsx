import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import IncomingCallCanvas from "@/pages/IncomingCallCanvas";
import HumanAgentCanvas from "@/pages/HumanAgentCanvas";
import DeprockCallSimulator from "@/pages/DeprockCallSimulator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Phone, 
  Building2, 
  Users, 
  Settings, 
  GitBranch,
  Mic,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Loader2,
  PhoneIncoming,
  Network,
  Power,
  Headphones,
  LayoutGrid,
  PhoneForwarded,
  PhoneOff,
  Languages,
  CalendarCheck,
  Circle,
  Check,
  Volume2,
  Square,
  Sparkles,
  Globe,
  RotateCcw,
  Eye,
  Play,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  flowId?: string | null;
  agentCount?: number;
  languages?: string[];
  assignedAgents?: Array<{
    id: string;
    agentId: string;
    agentName: string;
    language: string;
    systemPrompt: string | null;
    voiceTone: string | null;
    voiceId: string | null;
    voiceProvider: string | null;
    knowledgeBaseIds: string[] | null;
    isPrimary: boolean;
    agentType: string;
    firstMessage: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentAgent {
  id: string;
  departmentId: string;
  agentId: string;
  language: string;
  isPrimary: boolean;
  agent: {
    id: string;
    name: string;
    type: string;
    language: string | null;
  };
}

interface IvrConfiguration {
  id: string;
  phoneNumberId: string | null;
  name: string;
  isActive: boolean;
  voiceName: string | null;
  menuOptions: { key: string; label: string; departmentId: string }[] | null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  status: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
  voiceName: string | null;
  openaiVoice: string | null;
  systemPrompt: string | null;
  voiceTone: string | null;
}

interface LanguageAgentConfig {
  id: string;
  language: string;
  agentId: string | null;
  agentName: string | null;
  systemPrompt: string | null;
  voiceId: string | null;
  voiceTone: string | null;
  voiceSpeed?: number;
}

interface NewAgentConfig {
  id: string;
  agentId: string;
  agentName: string;
  language: string;
  voiceId: string;
  voiceTone: string;
  systemPrompt: string;
  voiceSpeed?: number;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
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
  return apiVoices
    .filter(v => {
      if (seenIds.has(v.voice_id)) return false;
      seenIds.add(v.voice_id);
      return true;
    })
    .map(v => {
      const lang = v.labels?.language?.toLowerCase() || '';
      const langCode = LANG_CODE_MAP[lang] || lang.substring(0, 2) || 'en';
      const gender = v.labels?.gender?.toLowerCase() || 'unknown';
      const style = v.category || v.labels?.use_case || 'professional';
      return {
        id: v.voice_id,
        name: `${v.name} (ElevenLabs)`,
        gender: gender as 'male' | 'female',
        style,
        languages: [langCode],
      };
    });
}

const ALL_IVR_VOICES = [...ELEVENLABS_VOICES];

const CARTESIA_DEFAULT_VOICES = [
  { id: "cartesia_a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man (Cartesia)", gender: "male", style: "warm", languages: ["en"] },
  { id: "cartesia_79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Lady (Cartesia)", gender: "female", style: "professional", languages: ["en"] },
  { id: "cartesia_87748186-23bb-4571-8b85-4d0e4e7e7196", name: "Calm Lady (Cartesia)", gender: "female", style: "calm", languages: ["en"] },
  { id: "cartesia_ee7ea9f8-c0c1-498c-9f62-dc2627e1e3ef", name: "Confident Man (Cartesia)", gender: "male", style: "professional", languages: ["en"] },
  { id: "cartesia_c2ac25f9-ecc4-4f56-9095-651354df60c0", name: "Customer Support (Cartesia)", gender: "female", style: "friendly", languages: ["en"] },
  { id: "cartesia_41534e16-2966-4c6b-9670-111411def906", name: "Wise Man (Cartesia)", gender: "male", style: "deep", languages: ["en"] },
  { id: "cartesia_248be419-c632-4f23-adf1-5324ed7dbf1d", name: "Pleasant Man (Cartesia)", gender: "male", style: "friendly", languages: ["en"] },
  { id: "cartesia_bf991597-6c13-47e4-8411-91ec2de5c466", name: "Newsman (Cartesia)", gender: "male", style: "crisp", languages: ["en"] },
  { id: "cartesia_b7d50908-b179-4d51-8d53-8b2a5d5e1bf3", name: "Friendly Sidekick (Cartesia)", gender: "male", style: "expressive", languages: ["en"] },
  { id: "cartesia_00a77add-48d5-4ef6-8157-71e5437b282d", name: "Sarah (Cartesia)", gender: "female", style: "soft", languages: ["en", "es", "fr", "de", "it", "pt", "zh", "hi", "ar", "ja", "ko"] },
  { id: "cartesia_f114a467-c40a-4db8-964d-aaba89cd08fa", name: "Friendly French Man (Cartesia)", gender: "male", style: "warm", languages: ["fr"] },
  { id: "cartesia_a3520a8f-226a-428d-9fcd-b0a4711a6829", name: "French Narrator Lady (Cartesia)", gender: "female", style: "professional", languages: ["fr"] },
  { id: "cartesia_ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3", name: "Spanish Narrator Lady (Cartesia)", gender: "female", style: "warm", languages: ["es"] },
  { id: "cartesia_846d6cb0-2301-48b6-9683-48f5618ea2f6", name: "Spanish Narrator Man (Cartesia)", gender: "male", style: "professional", languages: ["es"] },
  { id: "cartesia_5c42302c-f55f-481a-b895-80c1cda8c4e2", name: "Chinese Female Voice (Cartesia)", gender: "female", style: "clear", languages: ["zh"] },
  { id: "cartesia_daf747c6-6bc2-4083-bd59-aa94dce23f5d", name: "Hindi Female Voice (Cartesia)", gender: "female", style: "warm", languages: ["hi"] },
  { id: "cartesia_2b568345-1d48-4047-b25f-7baccf842eb0", name: "Arabic Male Voice (Cartesia)", gender: "male", style: "professional", languages: ["ar"] },
];

const isCartesiaVoice = (voiceId: string) => voiceId.startsWith("cartesia_");

const getVoicesForLanguage = (languageCode: string, dynamicVoices: typeof ELEVENLABS_VOICES = [], dynamicCartesiaVoices: typeof CARTESIA_DEFAULT_VOICES = []) => {
  const allElVoices = [...ALL_IVR_VOICES, ...dynamicVoices];
  const allCartesiaVoices = dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES;
  const allVoices = [...allElVoices, ...allCartesiaVoices];
  return allVoices.filter(voice => voice.languages.includes(languageCode));
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
  fr: "Pour le français",
  it: "Per l'italiano",
  zh: "中文请按",
  hi: "हिंदी के लिए",
  ar: "للعربية",
};

const DEPT_MENU_TEMPLATES: Record<string, { prefix: string; pressKey: string; separator: string }> = {
  en: { prefix: "For", pressKey: "press", separator: ", " },
  fr: { prefix: "Pour", pressKey: "appuyez sur", separator: ", " },
  it: { prefix: "Per", pressKey: "premere", separator: ", " },
  zh: { prefix: "如需", pressKey: "请按", separator: "，" },
  hi: { prefix: "के लिए", pressKey: "दबाएं", separator: ", " },
  ar: { prefix: "لـ", pressKey: "اضغط", separator: "، " },
};

const DEPT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  Sales: {
    en: "Sales", fr: "Ventes", it: "Vendite", zh: "销售", hi: "बिक्री", ar: "المبيعات",
    es: "Ventas", de: "Vertrieb", ja: "営業", ko: "영업", pt: "Vendas", ru: "Продажи", tr: "Satış", ur: "سیلز"
  },
  Support: {
    en: "Support", fr: "Assistance", it: "Supporto", zh: "客服", hi: "सहायता", ar: "الدعم",
    es: "Soporte", de: "Kundendienst", ja: "サポート", ko: "고객 지원", pt: "Suporte", ru: "Поддержка", tr: "Destek", ur: "سپورٹ"
  },
  Scheduling: {
    en: "Scheduling", fr: "Planification", it: "Programmazione", zh: "预约", hi: "शेड्यूलिंग", ar: "الجدولة",
    es: "Citas", de: "Terminvereinbarung", ja: "予約", ko: "예약", pt: "Agendamento", ru: "Запись на приём", tr: "Randevu", ur: "اپائنٹمنٹ"
  },
  Billing: {
    en: "Billing", fr: "Facturation", it: "Fatturazione", zh: "账单", hi: "बिलिंग", ar: "الفواتير",
    es: "Facturación", de: "Rechnungsabteilung", ja: "請求", ko: "청구", pt: "Faturamento", ru: "Выставление счетов", tr: "Fatura", ur: "بلنگ"
  },
  "Technical Support": {
    en: "Technical Support", fr: "Support Technique", it: "Supporto Tecnico", zh: "技术支持", hi: "तकनीकी सहायता", ar: "الدعم الفني",
    es: "Soporte Técnico", de: "Technischer Support", ja: "テクニカルサポート", ko: "기술 지원", pt: "Suporte Técnico", ru: "Техническая поддержка", tr: "Teknik Destek", ur: "ٹیکنیکل سپورٹ"
  },
  "Customer Service": {
    en: "Customer Service", fr: "Service Client", it: "Servizio Clienti", zh: "客户服务", hi: "ग्राहक सेवा", ar: "خدمة العملاء",
    es: "Atención al Cliente", de: "Kundenservice", ja: "カスタマーサービス", ko: "고객 서비스", pt: "Atendimento ao Cliente", ru: "Обслуживание клиентов", tr: "Müşteri Hizmetleri", ur: "کسٹمر سروس"
  },
  Appointments: {
    en: "Appointments", fr: "Rendez-vous", it: "Appuntamenti", zh: "预约", hi: "अपॉइंटमेंट", ar: "المواعيد",
    es: "Citas", de: "Termine", ja: "予約", ko: "예약", pt: "Agendamento", ru: "Запись", tr: "Randevu", ur: "اپائنٹمنٹ"
  },
  General: {
    en: "General", fr: "Général", it: "Generale", zh: "通用", hi: "सामान्य", ar: "عام",
    es: "General", de: "Allgemein", ja: "一般", ko: "일반", pt: "Geral", ru: "Общий", tr: "Genel", ur: "عمومی"
  },
  Marketing: {
    en: "Marketing", fr: "Marketing", it: "Marketing", zh: "市场营销", hi: "मार्केटिंग", ar: "التسويق",
    es: "Marketing", de: "Marketing", ja: "マーケティング", ko: "마케팅", pt: "Marketing", ru: "Маркетинг", tr: "Pazarlama", ur: "مارکیٹنگ"
  },
  "Human Resources": {
    en: "Human Resources", fr: "Ressources Humaines", it: "Risorse Umane", zh: "人力资源", hi: "मानव संसाधन", ar: "الموارد البشرية",
    es: "Recursos Humanos", de: "Personalabteilung", ja: "人事", ko: "인사", pt: "Recursos Humanos", ru: "Кадры", tr: "İnsan Kaynakları", ur: "ہیومن ریسورسز"
  },
  Complaints: {
    en: "Complaints", fr: "Réclamations", it: "Reclami", zh: "投诉", hi: "शिकायत", ar: "الشكاوى",
    es: "Quejas", de: "Beschwerden", ja: "苦情", ko: "불만", pt: "Reclamações", ru: "Жалобы", tr: "Şikâyet", ur: "شکایات"
  },
};

const translateDeptName = (name: string, langCode: string): string => {
  const translations = DEPT_NAME_TRANSLATIONS[name];
  if (translations && translations[langCode]) {
    return translations[langCode];
  }
  const lower = name.toLowerCase().trim();
  for (const [key, trans] of Object.entries(DEPT_NAME_TRANSLATIONS)) {
    if (lower.includes(key.toLowerCase()) && trans[langCode]) {
      return trans[langCode];
    }
  }
  return name;
};

const generateDeptGreeting = (deptNames: string[], langCode: string): string => {
  const template = DEPT_MENU_TEMPLATES[langCode] || DEPT_MENU_TEMPLATES.en;
  if (deptNames.length === 0) return DEFAULT_GREETINGS[langCode] || DEFAULT_GREETINGS.en;
  
  const menuItems = deptNames.map((name, idx) => {
    const translatedName = translateDeptName(name, langCode);
    if (langCode === "ar") {
      return `لـ${translatedName} ${template.pressKey} ${idx + 1}`;
    } else if (langCode === "zh") {
      return `${template.prefix}${translatedName}${template.pressKey}${idx + 1}`;
    } else if (langCode === "hi") {
      return `${translatedName} ${template.prefix} ${idx + 1} ${template.pressKey}`;
    }
    return `${template.prefix} ${translatedName} ${template.pressKey} ${idx + 1}`;
  });
  
  return menuItems.join(template.separator) + ".";
};

interface LanguageOption {
  id: string;
  language: string;
  voiceId: string;
  greeting: string;
  selectedDepartments?: string[];
  speed?: number;
}

const departmentIcons = [
  { value: "phone", label: "Phone", icon: Phone },
  { value: "building-2", label: "Building", icon: Building2 },
  { value: "users", label: "Users", icon: Users },
  { value: "headphones", label: "Headphones", icon: Headphones },
  { value: "settings", label: "Settings", icon: Settings },
];

const departmentColors = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#a855f7", label: "Purple" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
];

export default function DeprockManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: dynamicElVoices = [] } = useQuery<ElevenLabsApiVoice[], Error, typeof ELEVENLABS_VOICES>({
    queryKey: ["/api/elevenlabs/voices"],
    select: (data) => mapApiVoicesToLocal(data || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dynamicCartesiaVoices = [] } = useQuery<any[], Error, typeof CARTESIA_DEFAULT_VOICES>({
    queryKey: ["/api/deprock/cartesia-voices"],
    select: (data) => {
      if (!Array.isArray(data) || data.length === 0) return CARTESIA_DEFAULT_VOICES;
      const seenIds = new Set<string>();
      return data
        .filter((v: any) => {
          if (seenIds.has(v.id)) return false;
          seenIds.add(v.id);
          return true;
        })
        .map((v: any) => ({
          id: `cartesia_${v.id}`,
          name: `${v.name || "Unknown"} (Cartesia)`,
          gender: (v.gender || "unknown") as string,
          style: "professional",
          languages: [(v.language || "en").toLowerCase().split('-')[0].split('_')[0]],
        }));
    },
    staleTime: 10 * 60 * 1000,
  });
  
  const [activeTab, setActiveTab] = useState<"org-map" | "departments" | "incoming-connections" | "human-connections">("org-map");
  const [showSimulator, setShowSimulator] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showIvrSettingsDialog, setShowIvrSettingsDialog] = useState(false);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    description: "",
    icon: "building-2",
    color: "#3b82f6",
  });
  
  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string; language: string; systemPrompt: string; voiceTone: string; voiceId: string; voiceSpeed: number }>({
    agentId: "",
    language: "en",
    systemPrompt: "",
    voiceTone: "",
    voiceId: "",
    voiceSpeed: 1.0,
  });
  
  const [viewAgentDetail, setViewAgentDetail] = useState<{
    id: string;
    agentId: string;
    departmentId: string;
    agentName: string;
    language: string;
    systemPrompt: string | null;
    voiceTone: string | null;
    voiceId: string | null;
    voiceProvider: string | null;
    knowledgeBaseIds: string[] | null;
    isPrimary: boolean;
    agentType: string;
    firstMessage: string | null;
  } | null>(null);

  const [editAgentDetail, setEditAgentDetail] = useState<{
    voiceId: string;
    voiceTone: string;
    firstMessage: string;
    systemPrompt: string;
    voiceSpeed: number;
  } | null>(null);

  const [generatingPromptFor, setGeneratingPromptFor] = useState<'firstMessage' | 'systemPrompt' | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedPhoneForIvr, setSelectedPhoneForIvr] = useState<string>("");
  const [ivrName, setIvrName] = useState<string>("Auto Distribution");
  const [editingIvrName, setEditingIvrName] = useState<string | null>(null);
  const [editIvrNameValue, setEditIvrNameValue] = useState<string>("");
  
  const [showFlowDetails, setShowFlowDetails] = useState(false);
  const [ivrConfigOpen, setIvrConfigOpen] = useState(false);
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "el_rachel", greeting: DEFAULT_GREETINGS.en }
  ]);
  const ivrAudioRef = useRef<HTMLAudioElement | null>(null);
  const [ivrPlayingVoiceId, setIvrPlayingVoiceId] = useState<string | null>(null);
  const [languageSelectionGreetingText, setLanguageSelectionGreetingText] = useState('');
  const [languageSelectionGreetingVoice, setLanguageSelectionGreetingVoice] = useState('el_rachel');
  const [ivrVoiceSpeed, setIvrVoiceSpeed] = useState(0.92);
  const isGreetingCustomized = useRef(false);
  
  const [languageAgents, setLanguageAgents] = useState<LanguageAgentConfig[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [newAgents, setNewAgents] = useState<NewAgentConfig[]>([]);
  const [expandedNewAgents, setExpandedNewAgents] = useState<Set<string>>(new Set());
  
  const [deptFeatures, setDeptFeatures] = useState({
    enableTransfer: false,
    transferNumber: "",
    transferMessage: "",
    enableLanguageDetection: false,
    enableEndConversation: false,
    endConversationPhrases: ["goodbye", "thank you for calling", "have a nice day"],
    enableAppointmentBooking: false,
    calendarUrl: "",
    bookingInstructions: "",
    enableRecording: false,
  });
  
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
    if (viewAgentDetail) {
      setEditAgentDetail({
        voiceId: viewAgentDetail.voiceId || '',
        voiceTone: viewAgentDetail.voiceTone || '',
        firstMessage: viewAgentDetail.firstMessage || '',
        systemPrompt: viewAgentDetail.systemPrompt || '',
        voiceSpeed: (viewAgentDetail as any).voiceSpeed ?? 1.0,
      });
    } else {
      setEditAgentDetail(null);
    }
  }, [viewAgentDetail]);

  const { data: userProfile } = useQuery<{ company?: string; name?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: statsData, isLoading: statsLoading, isFetching: statsRefetching } = useQuery<{
    departments: Department[];
    totalDepartments: number;
    activeIvrCount: number;
    ivrConfigurations: IvrConfiguration[];
  }>({
    queryKey: ["/api/deprock/stats/overview"],
  });

  const { data: phoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: departmentAgents, refetch: refetchDepartmentAgents } = useQuery<DepartmentAgent[]>({
    queryKey: ["/api/deprock", selectedDepartment?.id, "agents"],
    enabled: !!selectedDepartment,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: typeof newDepartment) => {
      setCreatingDepartment(true);
      const response = await apiRequest("POST", "/api/deprock", data);
      return response.json();
    },
    onSuccess: async (dept: any) => {
      for (const agent of newAgents) {
        if (agent.agentId) {
          try {
            await apiRequest("POST", `/api/deprock/${dept.id}/agents`, {
              agentId: agent.agentId,
              language: agent.language,
              systemPrompt: agent.systemPrompt || undefined,
              voiceTone: agent.voiceTone || undefined,
              voiceId: agent.voiceId || undefined,
              voiceSpeed: agent.voiceSpeed,
            });
          } catch (e) {
            console.error("Failed to add agent:", e);
          }
        }
      }
      setShowCreateDialog(false);
      setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
      setNewAgents([]);
      setExpandedNewAgents(new Set());
      await queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      setCreatingDepartment(false);
      toast({ title: "Deprock department created successfully" });
    },
    onError: (error: any) => {
      setCreatingDepartment(false);
      toast({ title: "Failed to create deprock department", variant: "destructive" });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      return apiRequest("PATCH", `/api/deprock/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      setShowCreateDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Deprock department updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update deprock department", variant: "destructive" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/deprock/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      setShowDeleteDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Deprock department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete deprock department", variant: "destructive" });
    },
  });

  const deleteAllDepartmentsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/deprock/all/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections/human"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      setShowDeleteAllDialog(false);
      toast({ title: "Call center organization cleared successfully" });
    },
    onError: () => {
      toast({ title: "Failed to clear call center organization", variant: "destructive" });
    },
  });

  const addAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId, language, systemPrompt, voiceTone, voiceId, voiceSpeed }: { departmentId: string; agentId: string; language: string; systemPrompt?: string; voiceTone?: string; voiceId?: string; voiceSpeed?: number }) => {
      return apiRequest("POST", `/api/deprock/${departmentId}/agents`, { agentId, language, systemPrompt, voiceTone, voiceId, voiceSpeed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      refetchDepartmentAgents();
      setShowAddAgentDialog(false);
      setSelectedAgent({ agentId: "", language: "en", systemPrompt: "", voiceTone: "", voiceId: "", voiceSpeed: 1.0 });
      toast({ title: "Agent added to deprock department" });
    },
    onError: () => {
      toast({ title: "Failed to add agent", variant: "destructive" });
    },
  });

  const removeAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId }: { departmentId: string; agentId: string }) => {
      return apiRequest("DELETE", `/api/deprock/${departmentId}/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      refetchDepartmentAgents();
      toast({ title: "Agent removed from deprock department" });
    },
    onError: () => {
      toast({ title: "Failed to remove agent", variant: "destructive" });
    },
  });

  const updateAgentConfigMutation = useMutation({
    mutationFn: async (data: { departmentId: string; departmentAgentId: string; voiceId: string; voiceTone: string; firstMessage: string; systemPrompt: string; voiceSpeed?: number }) => {
      return apiRequest("PATCH", `/api/deprock/${data.departmentId}/agents/${data.departmentAgentId}`, {
        voiceId: data.voiceId,
        voiceTone: data.voiceTone,
        firstMessage: data.firstMessage,
        systemPrompt: data.systemPrompt,
        voiceSpeed: data.voiceSpeed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/deprock-linked"] });
      toast({ title: "Agent configuration updated" });
      setViewAgentDetail(null);
      setEditAgentDetail(null);
    },
    onError: () => {
      toast({ title: "Failed to update agent configuration", variant: "destructive" });
    },
  });

  const createIvrMutation = useMutation({
    mutationFn: async (data: { phoneNumberId: string; name: string }) => {
      const departments = statsData?.departments || [];
      const menuOptions = departments.map((dept, idx) => ({
        key: String(idx + 1),
        label: dept.name,
        departmentId: dept.id,
      }));
      return apiRequest("POST", "/api/deprock/ivr", {
        phoneNumberId: data.phoneNumberId,
        name: data.name,
        isActive: true,
        menuOptions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setShowIvrSettingsDialog(false);
      setSelectedPhoneForIvr("");
      setIvrName("Auto Distribution");
      toast({ title: "Phone number assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign phone number", variant: "destructive" });
    },
  });

  const updateIvrMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/deprock/ivr/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      setEditingIvrName(null);
      setEditIvrNameValue("");
      toast({ title: "IVR configuration updated" });
    },
    onError: () => {
      toast({ title: "Failed to update IVR configuration", variant: "destructive" });
    },
  });

  const syncWebhooksMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/deprock/sync-webhooks", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({ title: "All phone numbers synced for incoming calls" });
    },
    onError: () => {
      toast({ title: "Failed to sync phone numbers", variant: "destructive" });
    },
  });

  const saveIvrConfigMutation = useMutation({
    mutationFn: async () => {
      const activeIvr = ivrConfigurations.find(i => i.isActive);
      
      const greetingMessage = multiLangEnabled && languageOptions.length > 0
        ? languageSelectionGreetingText || generateDefaultLanguageSelectionGreeting()
        : languageOptions[0]?.greeting || DEFAULT_GREETINGS.en;

      const singleLangOptions = [{
        ...languageOptions[0] || { id: "default", language: "en", voiceId: "el_rachel", greeting: DEFAULT_GREETINGS.en },
        speed: languageOptions[0]?.speed ?? ivrVoiceSpeed,
      }];

      if (activeIvr) {
        return apiRequest("PATCH", `/api/deprock/ivr/${activeIvr.id}`, {
          isActive: ivrEnabled,
          greetingMessage,
          voiceId: multiLangEnabled ? languageSelectionGreetingVoice : (languageOptions[0]?.voiceId || 'el_rachel'),
          languageOptions: multiLangEnabled ? languageOptions : singleLangOptions,
        });
      } else {
        return apiRequest("POST", "/api/deprock/ivr", {
          name: "Main IVR",
          isActive: ivrEnabled,
          greetingMessage,
          voiceId: multiLangEnabled ? languageSelectionGreetingVoice : (languageOptions[0]?.voiceId || 'el_rachel'),
          languageOptions: multiLangEnabled ? languageOptions : singleLangOptions,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock/stats/overview"] });
      setIvrConfigOpen(false);
      toast({ title: "IVR configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save IVR configuration", variant: "destructive" });
    },
  });

  const generateFlowMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      const response = await apiRequest("POST", `/api/deprock/${departmentId}/generate-flow`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deprock"] });
      if (data.flowId || data.department?.flowId) {
        const flowId = data.flowId || data.department?.flowId;
        setLocation(`/app/flows/${flowId}`);
      }
    },
    onError: () => {
      toast({ title: "Failed to generate flow", variant: "destructive" });
    },
  });

  const handleFlowClick = (dept: Department) => {
    if (dept.flowId) {
      setLocation(`/app/deprock/flows/${dept.flowId}`);
    } else {
      generateFlowMutation.mutate(dept.id);
    }
  };

  useEffect(() => {
    ivrAudioRef.current = new Audio();
    return () => {
      if (ivrAudioRef.current) {
        ivrAudioRef.current.pause();
        ivrAudioRef.current = null;
      }
    };
  }, []);

  const generateDefaultLanguageSelectionGreeting = () => {
    const companyName = userProfile?.company || userProfile?.name || '';
    if (companyName) {
      return `Thanks for calling ${companyName}. Please select your preferred language.`;
    }
    return 'Please select your preferred language.';
  };

  useEffect(() => {
    if (!isGreetingCustomized.current) {
      setLanguageSelectionGreetingText(generateDefaultLanguageSelectionGreeting());
    }
  }, [languageOptions, userProfile]);

  const languageSelectionGreeting = languageSelectionGreetingText || generateDefaultLanguageSelectionGreeting();

  const getDefaultVoiceForLanguage = (langCode: string) => {
    const voices = getVoicesForLanguage(langCode, dynamicElVoices, dynamicCartesiaVoices);
    return voices[0]?.id || "el_rachel";
  };

  const addLanguageOption = () => {
    const usedLangs = languageOptions.map((o) => o.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;
    
    const allDeptIds = departments.map(d => d.id);
    const allDeptNames = departments.map(d => d.name);
    
    const newOption: LanguageOption = {
      id: `lang-${Date.now()}`,
      language: availableLang.code,
      voiceId: getDefaultVoiceForLanguage(availableLang.code),
      greeting: generateDeptGreeting(allDeptNames, availableLang.code),
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
            const deptNames = (opt.selectedDepartments || [])
              .map(deptId => departments.find(d => d.id === deptId)?.name)
              .filter(Boolean) as string[];
            updated.greeting = generateDeptGreeting(
              deptNames.length > 0 ? deptNames : departments.map(d => d.name), 
              updates.language
            );
            updated.voiceId = getDefaultVoiceForLanguage(updates.language);
          }
          return updated;
        }
        return opt;
      })
    );
  };

  const removeLanguageOption = (id: string) => {
    setLanguageOptions(languageOptions.filter((opt) => opt.id !== id));
  };

  const handleIvrVoicePreview = async (voiceId: string, greetingText: string, speed?: number, language?: string) => {
    if (!ivrAudioRef.current) return;
    
    if (ivrPlayingVoiceId === voiceId) {
      ivrAudioRef.current.pause();
      ivrAudioRef.current.currentTime = 0;
      setIvrPlayingVoiceId(null);
      return;
    }
    
    try {
      setIvrPlayingVoiceId(voiceId);
      const response = await apiRequest("POST", "/api/deprock/voice-preview", { voiceId, text: greetingText, speed: speed ?? ivrVoiceSpeed, language });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({ 
          title: "Preview not available", 
          description: errorData.error || "Failed to generate voice preview", 
          variant: "destructive" 
        });
        setIvrPlayingVoiceId(null);
        return;
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      ivrAudioRef.current.src = audioUrl;
      ivrAudioRef.current.play().catch(() => {});
      ivrAudioRef.current.onended = () => {
        setIvrPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };
      ivrAudioRef.current.onerror = () => {
        setIvrPlayingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };
    } catch {
      toast({ title: "Preview not available", description: "Failed to generate voice preview", variant: "destructive" });
      setIvrPlayingVoiceId(null);
    }
  };

  const toggleDepartmentExpanded = (id: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addNewAgentConfig = () => {
    const id = `new-${Date.now()}`;
    setNewAgents(prev => [...prev, {
      id,
      agentId: "",
      agentName: "",
      language: "en",
      voiceId: "",
      voiceTone: "",
      systemPrompt: "",
    }]);
    setExpandedNewAgents(prev => new Set(prev).add(id));
  };

  const updateNewAgent = (id: string, updates: Partial<NewAgentConfig>) => {
    setNewAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const toggleAgentExpanded = (id: string) => {
    setExpandedNewAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateOrUpdate = () => {
    if (selectedDepartment) {
      updateDepartmentMutation.mutate({
        id: selectedDepartment.id,
        data: newDepartment,
      });
    } else {
      createDepartmentMutation.mutate(newDepartment);
    }
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setNewDepartment({
      name: dept.name,
      description: dept.description || "",
      icon: dept.icon,
      color: dept.color,
    });
    setShowCreateDialog(true);
  };

  const openConfigSheet = (dept: Department) => {
    setSelectedDepartment(dept);
    setNewDepartment({
      name: dept.name,
      description: dept.description || "",
      icon: dept.icon,
      color: dept.color,
    });
    setActiveTabIdx(0);
    setShowConfigSheet(true);
  };
  
  useEffect(() => {
    if (showConfigSheet && departmentAgents && departmentAgents.length > 0) {
      const loadedAgents: LanguageAgentConfig[] = departmentAgents.map((da) => {
        const agentDetails = agents?.find(a => a.id === da.agentId);
        return {
          id: da.id,
          language: da.language || "en",
          agentId: da.agentId,
          agentName: da.agent?.name || null,
          systemPrompt: agentDetails?.systemPrompt || null,
          voiceId: agentDetails?.openaiVoice || agentDetails?.voiceName || null,
          voiceTone: agentDetails?.voiceTone || null,
        };
      });
      setLanguageAgents(loadedAgents);
      setActiveTabIdx(0);
    } else if (showConfigSheet && (!departmentAgents || departmentAgents.length === 0)) {
      setLanguageAgents([{
        id: `la-${Date.now()}`,
        language: "en",
        agentId: null,
        agentName: null,
        systemPrompt: null,
        voiceId: null,
        voiceTone: null,
      }]);
    }
  }, [showConfigSheet, departmentAgents, agents]);
  
  const getAgentsForLanguage = (langCode: string) => {
    return (agents || []).filter((agent) => {
      const agentLang = (agent.language || "en").toLowerCase();
      return agentLang === langCode.toLowerCase();
    });
  };
  
  const addLanguageAgent = () => {
    const usedLangs = languageAgents.map((la) => la.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;
    
    const newLangAgent: LanguageAgentConfig = {
      id: `la-${Date.now()}`,
      language: availableLang.code,
      agentId: null,
      agentName: null,
      systemPrompt: null,
      voiceId: null,
      voiceTone: null,
    };
    
    setLanguageAgents([...languageAgents, newLangAgent]);
    setActiveTabIdx(languageAgents.length);
  };
  
  const removeLanguageAgent = (id: string) => {
    const newList = languageAgents.filter((la) => la.id !== id);
    setLanguageAgents(newList);
    if (activeTabIdx >= newList.length) {
      setActiveTabIdx(Math.max(0, newList.length - 1));
    }
  };
  
  const updateLanguageAgent = (id: string, updates: Partial<LanguageAgentConfig>) => {
    const newList = languageAgents.map((la) => 
      la.id === id ? { ...la, ...updates } : la
    );
    setLanguageAgents(newList);
  };
  
  const handleSelectAgentForLang = (langAgentId: string, agentId: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    if (agent) {
      updateLanguageAgent(langAgentId, {
        agentId: agent.id,
        agentName: agent.name,
        systemPrompt: agent.systemPrompt || null,
        voiceId: agent.openaiVoice || agent.voiceName || null,
        voiceTone: agent.voiceTone || null,
      });
    }
  };
  
  const handlePlayVoice = async (voiceId: string, text?: string, speed?: number, language?: string) => {
    if (!audioRef.current) return;
    
    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }
    
    try {
      setPlayingVoiceId(voiceId);
      const response = await apiRequest("POST", "/api/deprock/voice-preview", { voiceId, text: text || "Hello, this is a voice preview.", speed: speed ?? 1.0, language });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({ 
          title: "Preview not available", 
          description: errorData.error || "Failed to generate voice preview", 
          variant: "destructive" 
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
  
  const activeLangAgent = languageAgents[activeTabIdx];
  const availableAgentsForActive = activeLangAgent ? getAgentsForLanguage(activeLangAgent.language) : [];

  const departments = statsData?.departments || [];
  const ivrConfigurations = statsData?.ivrConfigurations || [];
  const activeIvr = ivrConfigurations.find(ivr => ivr.isActive);
  const activePhoneNumber = phoneNumbers?.find(p => p.id === activeIvr?.phoneNumberId);

  useEffect(() => {
    if (activeIvr) {
      const savedLangOptions = (activeIvr as any).languageOptions as LanguageOption[] | null;
      if (savedLangOptions && savedLangOptions.length > 1) {
        setMultiLangEnabled(true);
        setLanguageOptions(savedLangOptions);
      } else if (savedLangOptions && savedLangOptions.length === 1) {
        setMultiLangEnabled(false);
        setLanguageOptions(savedLangOptions);
        if (savedLangOptions[0].speed !== undefined) {
          setIvrVoiceSpeed(savedLangOptions[0].speed);
        }
      }
      if ((activeIvr as any).greetingMessage) {
        setLanguageSelectionGreetingText((activeIvr as any).greetingMessage);
        isGreetingCustomized.current = true;
      }
      if ((activeIvr as any).voiceId) {
        setLanguageSelectionGreetingVoice((activeIvr as any).voiceId);
      }
    }
  }, [activeIvr]);

  useEffect(() => {
    if (departments.length > 0 && languageOptions.length > 0) {
      setLanguageOptions(prevOptions => 
        prevOptions.map(opt => {
          const selectedDepts = opt.selectedDepartments || departments.map(d => d.id);
          const deptNames = selectedDepts
            .map(id => departments.find(d => d.id === id)?.name)
            .filter(Boolean) as string[];
          return {
            ...opt,
            greeting: generateDeptGreeting(deptNames.length > 0 ? deptNames : departments.map(d => d.name), opt.language),
            selectedDepartments: selectedDepts.filter(id => departments.some(d => d.id === id)),
          };
        })
      );
    }
  }, [departments]);
  
  const assignedPhoneIds = useMemo(() => {
    return new Set(ivrConfigurations.map(ivr => ivr.phoneNumberId).filter(Boolean));
  }, [ivrConfigurations]);
  
  const unassignedPhones = useMemo(() => {
    return (phoneNumbers || []).filter(p => !assignedPhoneIds.has(p.id));
  }, [phoneNumbers, assignedPhoneIds]);

  const assignedPhones = useMemo(() => {
    return (phoneNumbers || []).filter(p => assignedPhoneIds.has(p.id));
  }, [phoneNumbers, assignedPhoneIds]);

  if (statsLoading && !statsData) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="deprock-loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title="VIEWS">
        <SubPanelItem
          icon={<Network className="w-4 h-4" />}
          label="Call Center Setup"
          isActive={activeTab === 'org-map'}
          onClick={() => setActiveTab('org-map')}
        />
        <SubPanelItem
          icon={<PhoneIncoming className="w-4 h-4" />}
          label="Assign AI Agent"
          isActive={activeTab === 'incoming-connections'}
          onClick={() => setActiveTab('incoming-connections')}
        />
        <SubPanelItem
          icon={<PhoneForwarded className="w-4 h-4" />}
          label="Assign Human Agent"
          isActive={activeTab === 'human-connections'}
          onClick={() => setActiveTab('human-connections')}
        />
      </SubPanelSection>

      <SubPanelSection title="STATS">
        <div className="px-2.5 py-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Departments</span>
            <span className="font-medium">{departments.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active IVR</span>
            <span className="font-medium text-emerald-600">{statsData?.activeIvrCount || 0}</span>
          </div>
        </div>
      </SubPanelSection>
    </div>
  );

  return (
    <ThreeColumnLayout
      subPanel={subPanelContent}
      subPanelWidth="sm"
      subPanelHeader={<span className="font-medium text-sm">Deprock Management</span>}
    >
      <div className="flex flex-col h-[calc(100vh-120px)]" data-testid="deprock-management-page">
        {(creatingDepartment || (statsRefetching && !statsLoading)) && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0" data-testid="deprock-refetch-spinner">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{creatingDepartment ? "Creating department..." : "Updating..."}</span>
          </div>
        )}
        {activeTab === 'org-map' && (
          <div className="space-y-5 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Network className="h-4 w-4 text-foreground shrink-0" />
                <span className="font-medium text-sm sm:text-base truncate">Call Center Setup</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const activeIvrItem = ivrConfigurations.find(i => i.isActive);
                    if (activeIvrItem) {
                      setIvrEnabled(activeIvrItem.isActive);
                      const savedLangOptions = activeIvrItem.languageOptions as LanguageOption[] | null;
                      if (savedLangOptions && savedLangOptions.length > 0) {
                        setMultiLangEnabled(savedLangOptions.length > 1);
                        setLanguageOptions(savedLangOptions);
                      } else {
                        setMultiLangEnabled(false);
                        setLanguageOptions([{
                          id: "default",
                          language: "en",
                          voiceId: "el_rachel",
                          greeting: activeIvrItem.greetingMessage || DEFAULT_GREETINGS.en,
                        }]);
                      }
                    } else {
                      setIvrEnabled(true);
                      setMultiLangEnabled(false);
                      setLanguageOptions([{
                        id: "default",
                        language: "en",
                        voiceId: "el_rachel",
                        greeting: DEFAULT_GREETINGS.en,
                      }]);
                    }
                    setIvrConfigOpen(true);
                  }}
                  data-testid="deprock-button-configure-ivr"
                >
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Configure IVR</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/app/deprock/canvas")}
                  data-testid="deprock-button-open-canvas"
                >
                  <LayoutGrid className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Setup Call Center</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSimulator(true)}
                  data-testid="deprock-button-call-simulator"
                >
                  <Headphones className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Call Simulator</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteAllDialog(true)}
                  disabled={departments.length === 0}
                  data-testid="deprock-button-delete-all"
                >
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Delete All</span>
                </Button>
              </div>
            </div>

            {/* ── Call Routing Pipeline ── */}
            <div data-testid="deprock-call-center-org-card">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
                Call Routing Flow
              </div>
              <div className="flex items-stretch gap-0 overflow-x-auto pb-1">

                {/* Stage 1 — Inbound Numbers */}
                <div className="flex-1 min-w-[110px]">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 h-full flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">Inbound</span>
                    {assignedPhones.length > 0 ? (
                      <div className="flex flex-col gap-1 w-full mt-0.5" data-testid="deprock-text-phone-count">
                        {assignedPhones.map((p) => (
                          <div key={p.id} className="bg-emerald-100 dark:bg-emerald-900/40 rounded-md px-1.5 py-0.5 text-center">
                            <span className="text-[10px] font-mono font-medium text-emerald-800 dark:text-emerald-300 block leading-snug truncate">
                              {p.phoneNumber}
                            </span>
                            {p.friendlyName && (
                              <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 leading-tight truncate block">
                                {p.friendlyName}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground leading-tight" data-testid="deprock-text-phone-count">No number</span>
                    )}
                    {unassignedPhones.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 cursor-pointer text-orange-500 border-orange-300 mt-0.5" onClick={() => setShowIvrSettingsDialog(true)} data-testid="deprock-unassigned-numbers-panel">
                        {unassignedPhones.length} unassigned
                      </Badge>
                    )}
                    {ivrConfigurations.some(i => i.isActive) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[9px] px-1.5 py-0 text-blue-500 hover:text-blue-700"
                        onClick={() => syncWebhooksMutation.mutate()}
                        disabled={syncWebhooksMutation.isPending}
                        data-testid="deprock-button-sync-webhooks"
                      >
                        {syncWebhooksMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-0.5" />}
                        Sync All
                      </Button>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 shrink-0 self-center">
                  <div className="h-px w-4 bg-border/60" />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 -ml-0.5" />
                </div>

                {/* Stage 2 — IVR Router */}
                <div className="flex-1 min-w-[100px]">
                  <div className={`rounded-xl border p-3 h-full flex flex-col items-center text-center gap-1.5 ${ivrConfigurations.find(i => i.isActive) ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30' : 'border-border/30 bg-muted/20'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${ivrConfigurations.find(i => i.isActive) ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-muted/50'}`}>
                      <GitBranch className={`h-4 w-4 ${ivrConfigurations.find(i => i.isActive) ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50'}`} />
                    </div>
                    <span className={`text-[11px] font-semibold leading-tight ${ivrConfigurations.find(i => i.isActive) ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/60'}`}>IVR Router</span>
                    <span className="text-[11px] text-muted-foreground leading-tight line-clamp-1">
                      {ivrConfigurations.find(i => i.isActive)?.name || 'Not configured'}
                    </span>
                    {multiLangEnabled && languageOptions.length > 1 && (
                      <span className="text-[10px] text-blue-500 leading-tight">{languageOptions.length} languages</span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 shrink-0 self-center">
                  <div className="h-px w-4 bg-border/60" />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 -ml-0.5" />
                </div>

                {/* Stage 3 — Departments */}
                <div className="flex-1 min-w-[100px]">
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 p-3 h-full flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 leading-tight">Departments</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {departments.length} dept{departments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 shrink-0 self-center">
                  <div className="h-px w-4 bg-border/60" />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 -ml-0.5" />
                </div>

                {/* Stage 4 — AI Agents */}
                <div className="flex-1 min-w-[100px]">
                  <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/30 p-3 h-full flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                      <Mic className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 leading-tight">AI Agents</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {agents?.length || 0} agent{(agents?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Routing Destinations (Department cards) ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Routing Destinations
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedDepartment(null);
                    setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                    setNewAgents([]);
                    setExpandedNewAgents(new Set());
                    setShowCreateDialog(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Department
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-h-[180px]">
                {departments.map((dept, idx) => (
                  <DeprockDepartmentCard
                    key={dept.id}
                    department={dept}
                    index={idx + 1}
                    onEdit={() => openConfigSheet(dept)}
                    onDelete={() => {
                      setSelectedDepartment(dept);
                      setShowDeleteDialog(true);
                    }}
                    onFlow={() => handleFlowClick(dept)}
                    onAddAgent={() => {
                      setSelectedDepartment(dept);
                      setShowAddAgentDialog(true);
                    }}
                    onViewAgent={(agentData) => setViewAgentDetail(agentData)}
                  />
                ))}

                {creatingDepartment && (
                  <div className="rounded-2xl border border-border/20 min-h-[160px] flex flex-col items-center justify-center bg-muted/20 animate-pulse" data-testid="creating-department-placeholder">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                    <span className="text-xs text-muted-foreground">Creating department...</span>
                  </div>
                )}

                <div
                  className="rounded-2xl border border-dashed border-border/40 hover-elevate cursor-pointer min-h-[160px] flex flex-col items-center justify-center glass-surface"
                  onClick={() => {
                    setSelectedDepartment(null);
                    setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                    setNewAgents([]);
                    setExpandedNewAgents(new Set());
                    setShowCreateDialog(true);
                  }}
                  data-testid="deprock-add-department-card"
                >
                  <div className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center mb-2">
                    <Plus className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                  <span className="text-xs text-muted-foreground/60">Add Department</span>
                </div>
              </div>
            </div>

            {multiLangEnabled && languageOptions.length > 1 && departments.length > 0 && (
              <div className="border border-border/30 rounded-xl glass-card" data-testid="deprock-auto-greetings-table">
                <button
                  onClick={() => setShowFlowDetails(!showFlowDetails)}
                  className="w-full flex items-center justify-between gap-2 p-4 hover-elevate rounded-lg text-left"
                >
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    <span className="font-medium text-sm">Language & Greeting Details</span>
                  </div>
                  {showFlowDetails ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showFlowDetails && (
                  <div className="p-3 sm:p-4 pt-0 space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Language</th>
                              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium">Generated Greeting</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {languageOptions.map((opt) => {
                              const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label || opt.language;
                              return (
                                <tr key={opt.id}>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{langLabel}</Badge>
                                    </div>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                                    <div className="text-muted-foreground italic">"{opt.greeting}"</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {activePhoneNumber && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Language Selection Greeting</span>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground italic">"{languageSelectionGreeting}"</p>
                        </div>
                        <div className="space-y-1">
                          {languageOptions.map((opt, idx) => {
                            const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label;
                            const nativePrompt = LANGUAGE_SELECTION_PROMPTS[opt.language] || `For ${opt.language}`;
                            return (
                              <div key={opt.id} className="bg-muted/50 rounded p-2 flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {idx + 1}
                                </Badge>
                                <span className="text-sm text-muted-foreground italic">"{nativePrompt}, {idx + 1}"</span>
                                <Badge variant="outline" className="text-xs ml-auto shrink-0">
                                  <Volume2 className="h-3 w-3 mr-1" />
                                  {langLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="h-4 w-4 text-foreground shrink-0" />
                <span className="font-medium text-sm sm:text-base">Departments</span>
              </div>
              <Button 
                onClick={() => {
                  setSelectedDepartment(null);
                  setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                  setNewAgents([]);
                  setExpandedNewAgents(new Set());
                  setShowCreateDialog(true);
                }}
                data-testid="deprock-button-add-department"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Department</span>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {departments.map((dept, idx) => (
                <DeprockDepartmentCard
                  key={dept.id}
                  department={dept}
                  index={idx + 1}
                  onEdit={() => openConfigSheet(dept)}
                  onDelete={() => {
                    setSelectedDepartment(dept);
                    setShowDeleteDialog(true);
                  }}
                  onFlow={() => handleFlowClick(dept)}
                  onAddAgent={() => {
                    setSelectedDepartment(dept);
                    setShowAddAgentDialog(true);
                  }}
                  onViewAgent={(agentData) => setViewAgentDetail(agentData)}
                />
              ))}

              <div 
                className="rounded-2xl border border-dashed border-border/40 hover-elevate cursor-pointer min-h-[200px] flex flex-col items-center justify-center glass-surface"
                onClick={() => {
                  setSelectedDepartment(null);
                  setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                  setNewAgents([]);
                  setExpandedNewAgents(new Set());
                  setShowCreateDialog(true);
                }}
                data-testid="deprock-add-department-card-tab"
              >
                <div className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center mb-2">
                  <Plus className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <span className="text-xs text-muted-foreground/60">Add Department</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'incoming-connections' && (
          <div className="h-[calc(100vh-200px)] min-h-[300px]">
            <IncomingCallCanvas embedded={true} />
          </div>
        )}

        {activeTab === 'human-connections' && (
          <div className="h-[calc(100vh-200px)] min-h-[300px]">
            <HumanAgentCanvas embedded={true} />
          </div>
        )}

      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setNewAgents([]);
          setExpandedNewAgents(new Set());
        }
      }}>
        <DialogContent className={!selectedDepartment ? "w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[85vh] overflow-y-auto" : "w-[calc(100vw-2rem)] sm:w-full"} data-testid="deprock-dialog-create-department">
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment ? "Edit Deprock Department" : "Create New Deprock Department"}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartment 
                ? "Update your deprock department settings" 
                : "Add a new deprock department with AI agents to your call center"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Department Name</Label>
              <Input
                id="name"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                placeholder="e.g., Sales, Support, Scheduling"
                data-testid="deprock-input-department-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDepartment.description}
                onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                placeholder="What does this department handle?"
                data-testid="deprock-input-department-description"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select 
                  value={newDepartment.icon} 
                  onValueChange={(v) => setNewDepartment({ ...newDepartment, icon: v })}
                >
                  <SelectTrigger data-testid="deprock-select-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentIcons.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <icon.icon className="h-4 w-4" />
                          {icon.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Select 
                  value={newDepartment.color} 
                  onValueChange={(v) => setNewDepartment({ ...newDepartment, color: v })}
                >
                  <SelectTrigger data-testid="deprock-select-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedDepartment && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Language Agents</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addNewAgentConfig}
                    data-testid="deprock-button-add-new-agent"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Agent
                  </Button>
                </div>

                {newAgents.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg" data-testid="deprock-empty-agents-placeholder">
                    No agents configured yet. Click "Add Agent" to assign AI agents to this department.
                  </div>
                )}

                {newAgents.map((agent, idx) => (
                  <div key={agent.id} className="border rounded-lg p-4 space-y-3" data-testid={`deprock-new-agent-config-${idx}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{agent.agentName || `Agent ${idx + 1}`}</span>
                        {agent.language && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {SUPPORTED_LANGUAGES.find(l => l.code === agent.language)?.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleAgentExpanded(agent.id)}
                          data-testid={`deprock-button-toggle-agent-${idx}`}
                        >
                          {expandedNewAgents.has(agent.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => setNewAgents(prev => prev.filter(a => a.id !== agent.id))}
                          data-testid={`deprock-button-remove-agent-${idx}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedNewAgents.has(agent.id) && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Language</Label>
                            <Select value={agent.language} onValueChange={(v) => updateNewAgent(agent.id, { language: v, voiceId: "", agentId: "", agentName: "" })}>
                              <SelectTrigger data-testid={`deprock-select-agent-language-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUPPORTED_LANGUAGES.map(lang => (
                                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Select Agent</Label>
                            <Select 
                              value={agent.agentId} 
                              onValueChange={(v) => {
                                const selectedAgentData = agents?.find(a => a.id === v);
                                if (selectedAgentData) {
                                  updateNewAgent(agent.id, { 
                                    agentId: selectedAgentData.id, 
                                    agentName: selectedAgentData.name,
                                    voiceId: selectedAgentData.openaiVoice || selectedAgentData.voiceName || "",
                                    voiceTone: selectedAgentData.voiceTone || "",
                                    systemPrompt: selectedAgentData.systemPrompt || "",
                                  });
                                }
                              }}
                            >
                              <SelectTrigger data-testid={`deprock-select-agent-id-${idx}`}>
                                <SelectValue placeholder="Select an agent..." />
                              </SelectTrigger>
                              <SelectContent>
                                {agents?.filter(a => a.language === agent.language).map(existingAgent => (
                                  <SelectItem key={existingAgent.id} value={existingAgent.id}>
                                    {existingAgent.name}
                                  </SelectItem>
                                ))}
                                {(agents?.filter(a => a.language === agent.language).length || 0) === 0 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">No agents for this language</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Voice</Label>
                          <div className="flex items-center gap-1">
                            <Select value={agent.voiceId} onValueChange={(v) => {
                              const voice = [...ALL_IVR_VOICES, ...dynamicElVoices, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].find(voice => voice.id === v);
                              updateNewAgent(agent.id, { voiceId: v, voiceTone: voice?.style || "" });
                            }}>
                              <SelectTrigger className="flex-1" data-testid={`deprock-select-agent-voice-${idx}`}>
                                <SelectValue placeholder="Select voice..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getVoicesForLanguage(agent.language, dynamicElVoices, dynamicCartesiaVoices).map(voice => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.gender}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {agent.voiceId && (
                              <Button variant="outline" size="icon" onClick={() => handlePlayVoice(agent.voiceId, undefined, agent.voiceSpeed ?? 1.0, agent.language)} data-testid={`deprock-button-preview-voice-${idx}`}>
                                {playingVoiceId === agent.voiceId ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Agent Voice Speed</Label>
                            <span className="text-xs font-mono text-muted-foreground" data-testid={`text-mgmt-new-agent-speed-${idx}`}>{(agent.voiceSpeed ?? 1.0).toFixed(2)}x</span>
                          </div>
                          <Slider
                            value={[agent.voiceSpeed ?? 1.0]}
                            min={0.5}
                            max={1.5}
                            step={0.01}
                            onValueChange={([val]) => updateNewAgent(agent.id, { voiceSpeed: val })}
                            className="mt-1"
                            data-testid={`slider-mgmt-new-agent-speed-${idx}`}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                            <span>0.5x Slow</span>
                            <span>1.0x Normal</span>
                            <span>1.5x Fast</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Voice Tone</Label>
                          <Select value={agent.voiceTone} onValueChange={(v) => updateNewAgent(agent.id, { voiceTone: v })}>
                            <SelectTrigger data-testid={`deprock-select-agent-tone-${idx}`}>
                              <SelectValue placeholder="Select tone..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="warm">Warm</SelectItem>
                              <SelectItem value="calm">Calm</SelectItem>
                              <SelectItem value="balanced">Balanced</SelectItem>
                              <SelectItem value="expressive">Expressive</SelectItem>
                              <SelectItem value="authoritative">Authoritative</SelectItem>
                              <SelectItem value="empathetic">Empathetic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">System Prompt</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const lang = SUPPORTED_LANGUAGES.find(l => l.code === agent.language)?.label || "English";
                                const voice = [...ALL_IVR_VOICES, ...dynamicElVoices, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].find(v => v.id === agent.voiceId);
                                const voiceStyle = voice?.style || agent.voiceTone || "professional";
                                const autoPrompt = `You are a ${voiceStyle} AI assistant for the ${newDepartment.name || "department"}. You speak ${lang} fluently and help callers with their inquiries. Be helpful, clear, and efficient in your responses. Always maintain a ${voiceStyle} tone throughout the conversation.`;
                                updateNewAgent(agent.id, { systemPrompt: autoPrompt });
                              }}
                              data-testid={`deprock-button-auto-prompt-${idx}`}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Auto
                            </Button>
                          </div>
                          <Textarea
                            value={agent.systemPrompt}
                            onChange={(e) => updateNewAgent(agent.id, { systemPrompt: e.target.value })}
                            placeholder="Enter instructions for the AI agent..."
                            rows={3}
                            data-testid={`deprock-textarea-agent-prompt-${idx}`}
                          />
                        </div>

                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setNewAgents([]);
              setExpandedNewAgents(new Set());
            }} data-testid="deprock-button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOrUpdate}
              disabled={!newDepartment.name || createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              data-testid="deprock-button-save"
            >
              {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedDepartment ? "Save Changes" : "Create Deprock Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAgentDialog} onOpenChange={setShowAddAgentDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full" data-testid="deprock-dialog-add-agent">
          <DialogHeader>
            <DialogTitle>Add Agent to {selectedDepartment?.name}</DialogTitle>
            <DialogDescription>
              Assign an AI agent to handle calls for this deprock department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select 
                value={selectedAgent.language} 
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, language: v, agentId: "" })}
              >
                <SelectTrigger data-testid="deprock-select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{agents?.find(a => a.id === selectedAgent.agentId)?.name || "Select Agent"}</Label>
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {agents?.filter((agent) => agent.language === selectedAgent.language).map((agent) => (
                  <div 
                    key={agent.id}
                    className={`px-3 py-2 cursor-pointer hover-elevate ${selectedAgent.agentId === agent.id ? 'bg-primary/10' : ''}`}
                    onClick={() => setSelectedAgent({ ...selectedAgent, agentId: agent.id })}
                    data-testid={`deprock-agent-option-${agent.id}`}
                  >
                    {agent.name}
                  </div>
                ))}
                {agents?.filter((agent) => agent.language === selectedAgent.language).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No agents available for this language</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedAgent.voiceId}
                  onValueChange={(v) => {
                    const voice = [...ALL_IVR_VOICES, ...dynamicElVoices, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].find(voice => voice.id === v);
                    setSelectedAgent({ 
                      ...selectedAgent, 
                      voiceId: v,
                      voiceTone: voice?.style || ""
                    });
                  }}
                >
                  <SelectTrigger className="flex-1" data-testid="deprock-select-voice">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getVoicesForLanguage(selectedAgent.language, dynamicElVoices, dynamicCartesiaVoices).map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} - {voice.gender}, {voice.style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent.voiceId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePlayVoice(selectedAgent.voiceId, undefined, selectedAgent.voiceSpeed ?? 1.0, selectedAgent.language)}
                    data-testid="deprock-button-preview-agent-voice"
                  >
                    {playingVoiceId === selectedAgent.voiceId ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Agent Voice Speed</Label>
                <span className="text-xs font-mono text-muted-foreground" data-testid="text-mgmt-selected-agent-speed">{(selectedAgent.voiceSpeed ?? 1.0).toFixed(2)}x</span>
              </div>
              <Slider
                value={[selectedAgent.voiceSpeed ?? 1.0]}
                min={0.5}
                max={1.5}
                step={0.01}
                onValueChange={([val]) => setSelectedAgent({ ...selectedAgent, voiceSpeed: val })}
                className="mt-1"
                data-testid="slider-mgmt-selected-agent-speed"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0.5x Slow</span>
                <span>1.0x Normal</span>
                <span>1.5x Fast</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Voice Tone</Label>
              <Select
                value={selectedAgent.voiceTone}
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, voiceTone: v })}
              >
                <SelectTrigger data-testid="deprock-select-voice-tone">
                  <SelectValue placeholder="Select tone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="expressive">Expressive</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>System Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const lang = languages.find(l => l.value === selectedAgent.language)?.label || "English";
                    const voice = [...ALL_IVR_VOICES, ...dynamicElVoices, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].find(v => v.id === selectedAgent.voiceId);
                    const voiceStyle = voice?.style || "professional";
                    const autoPrompt = `You are a ${voiceStyle} AI assistant for the ${selectedDepartment?.name || "department"}. You speak ${lang} fluently and help callers with their inquiries. Be helpful, clear, and efficient in your responses. Always maintain a ${voiceStyle} tone throughout the conversation.`;
                    setSelectedAgent({ ...selectedAgent, systemPrompt: autoPrompt });
                  }}
                  data-testid="deprock-button-auto-prompt"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Auto Prompt
                </Button>
              </div>
              <Textarea
                placeholder="Enter instructions for the AI agent..."
                value={selectedAgent.systemPrompt}
                onChange={(e) => setSelectedAgent({ ...selectedAgent, systemPrompt: e.target.value })}
                rows={4}
                data-testid="deprock-textarea-system-prompt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAgentDialog(false)} data-testid="deprock-button-cancel-agent">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedDepartment && selectedAgent.agentId) {
                  addAgentMutation.mutate({
                    departmentId: selectedDepartment.id,
                    agentId: selectedAgent.agentId,
                    language: selectedAgent.language,
                    systemPrompt: selectedAgent.systemPrompt || undefined,
                    voiceTone: selectedAgent.voiceTone || undefined,
                    voiceId: selectedAgent.voiceId || undefined,
                    voiceSpeed: selectedAgent.voiceSpeed,
                  });
                }
              }}
              disabled={!selectedAgent.agentId || addAgentMutation.isPending}
              data-testid="deprock-button-add-agent"
            >
              {addAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="deprock-dialog-delete-department">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deprock Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDepartment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="deprock-button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDepartment && deleteDepartmentMutation.mutate(selectedDepartment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="deprock-button-confirm-delete"
            >
              {deleteDepartmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent data-testid="deprock-dialog-delete-all">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Call Center Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all departments, IVR configurations, AI agent connections, and human agent connections. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="deprock-button-cancel-delete-all">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllDepartmentsMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="deprock-button-confirm-delete-all"
            >
              {deleteAllDepartmentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showIvrSettingsDialog} onOpenChange={setShowIvrSettingsDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl" data-testid="deprock-dialog-ivr-settings">
          <DialogHeader>
            <DialogTitle>Assign Phone Number</DialogTitle>
            <DialogDescription>
              Assign a phone number to your call center. All your active phone numbers will be configured to route incoming calls through Deprock.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Phone Number</Label>
              <Select 
                value={selectedPhoneForIvr} 
                onValueChange={setSelectedPhoneForIvr}
              >
                <SelectTrigger data-testid="deprock-select-phone-for-ivr">
                  <SelectValue placeholder="Choose a phone number..." />
                </SelectTrigger>
                <SelectContent>
                  {unassignedPhones.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                      {phone.phoneNumber} {phone.friendlyName && `(${phone.friendlyName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unassignedPhones.length === 0 && (
                <p className="text-sm text-muted-foreground">No unassigned phone numbers available</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Configuration Name</Label>
              <Input
                value={ivrName}
                onChange={(e) => setIvrName(e.target.value)}
                placeholder="Auto Distribution"
                data-testid="deprock-input-ivr-name"
              />
            </div>
            {departments.length > 0 && (
              <div className="space-y-2">
                <Label>Departments to Route To</Label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept, idx) => (
                    <Badge key={dept.id} variant="outline" style={{ borderColor: dept.color }}>
                      Press {idx + 1}: {dept.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIvrSettingsDialog(false)} data-testid="deprock-button-cancel-ivr">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedPhoneForIvr) {
                  createIvrMutation.mutate({
                    phoneNumberId: selectedPhoneForIvr,
                    name: ivrName,
                  });
                }
              }}
              disabled={!selectedPhoneForIvr || createIvrMutation.isPending}
              data-testid="deprock-button-assign-phone"
            >
              {createIvrMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showConfigSheet} onOpenChange={setShowConfigSheet}>
        <SheetContent className="w-[100vw] max-w-[100vw] sm:max-w-[450px] md:max-w-[550px]" data-testid="deprock-sheet-department-config">
          <SheetHeader>
            <SheetTitle>Deprock Department Configuration</SheetTitle>
          </SheetHeader>
          
          {selectedDepartment && (
            <ScrollArea className="h-[calc(100vh-100px)] pr-4 mt-4">
              <div className="space-y-4">
                <div>
                  <Label>Department Name</Label>
                  <Input
                    value={newDepartment.name}
                    onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                    className="mt-1.5"
                    data-testid="deprock-input-config-dept-name"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Language Agents</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addLanguageAgent}
                      disabled={languageAgents.length >= SUPPORTED_LANGUAGES.length}
                      data-testid="deprock-button-add-language"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Language
                    </Button>
                  </div>
                  
                  {languageAgents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {languageAgents.map((la, idx) => (
                        <Badge
                          key={la.id}
                          variant={idx === activeTabIdx ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setActiveTabIdx(idx)}
                          data-testid={`deprock-badge-lang-${la.language}`}
                        >
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
                  <Card className="glass-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Select
                        value={activeLangAgent.language}
                        onValueChange={(val) => {
                          updateLanguageAgent(activeLangAgent.id, { 
                            language: val,
                            agentId: null,
                            agentName: null,
                            systemPrompt: null,
                            voiceId: null,
                          });
                        }}
                      >
                        <SelectTrigger className="w-32" data-testid="deprock-select-lang-tab">
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
                        data-testid="deprock-button-remove-lang-agent"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label>Agent Name</Label>
                      {availableAgentsForActive.length === 0 ? (
                        <p className="text-sm text-muted-foreground mt-1.5">
                          No agents configured for {SUPPORTED_LANGUAGES.find((l) => l.code === activeLangAgent.language)?.label}
                        </p>
                      ) : (
                        <Select
                          value={activeLangAgent.agentId || ""}
                          onValueChange={(val) => handleSelectAgentForLang(activeLangAgent.id, val)}
                        >
                          <SelectTrigger className="mt-1.5" data-testid="deprock-select-agent-name">
                            <SelectValue placeholder="Select an agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAgentsForActive.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    <div>
                      <Label>System Prompt</Label>
                      <Textarea
                        value={activeLangAgent.systemPrompt || ""}
                        onChange={(e) => updateLanguageAgent(activeLangAgent.id, { systemPrompt: e.target.value })}
                        rows={4}
                        className="mt-1.5"
                        placeholder="Instructions for the AI agent..."
                        data-testid="deprock-input-agent-prompt"
                      />
                    </div>
                    
                    <div>
                      <Label>Voice</Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Select
                          value={activeLangAgent.voiceId || ""}
                          onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceId: val })}
                        >
                          <SelectTrigger className="flex-1" data-testid="deprock-select-voice">
                            <SelectValue placeholder="Select a voice..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getVoicesForLanguage(activeLangAgent.language, dynamicElVoices, dynamicCartesiaVoices).map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} - {voice.gender}, {voice.style}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {activeLangAgent.voiceId && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePlayVoice(activeLangAgent.voiceId!, undefined, activeLangAgent.voiceSpeed ?? 1.0, activeLangAgent.language)}
                            data-testid="deprock-button-preview-voice"
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
                    
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Agent Voice Speed</Label>
                        <span className="text-xs font-mono text-muted-foreground" data-testid="text-mgmt-agent-voice-speed">{(activeLangAgent.voiceSpeed ?? 1.0).toFixed(2)}x</span>
                      </div>
                      <Slider
                        value={[activeLangAgent.voiceSpeed ?? 1.0]}
                        min={0.5}
                        max={1.5}
                        step={0.01}
                        onValueChange={([val]) => updateLanguageAgent(activeLangAgent.id, { voiceSpeed: val })}
                        className="mt-1"
                        data-testid="slider-mgmt-agent-voice-speed"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>0.5x Slow</span>
                        <span>1.0x Normal</span>
                        <span>1.5x Fast</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Voice Tone</Label>
                        <Select
                          value={activeLangAgent.voiceTone || ""}
                          onValueChange={(val) => updateLanguageAgent(activeLangAgent.id, { voiceTone: val })}
                        >
                          <SelectTrigger className="mt-1.5" data-testid="deprock-select-voice-tone">
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
                  </Card>
                )}
                
                <div className="pt-2">
                  <Label className="text-sm font-medium">Agent Features</Label>
                  <div className="space-y-4 mt-3">
                    <Card className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PhoneForwarded className="h-4 w-4 text-blue-500" />
                          <div>
                            <Label className="text-sm">Enable Call Transfer</Label>
                            <p className="text-xs text-muted-foreground">Transfer to human operators</p>
                          </div>
                        </div>
                        <Switch
                          checked={deptFeatures.enableTransfer}
                          onCheckedChange={(val) => setDeptFeatures({ ...deptFeatures, enableTransfer: val })}
                          data-testid="deprock-switch-dept-transfer"
                        />
                      </div>
                      {deptFeatures.enableTransfer && (
                        <div className="space-y-2 pl-6 border-l-2 border-blue-200">
                          <div>
                            <Label className="text-xs">Transfer Number</Label>
                            <Input
                              value={deptFeatures.transferNumber}
                              onChange={(e) => setDeptFeatures({ ...deptFeatures, transferNumber: e.target.value })}
                              placeholder="+1 (555) 123-4567"
                              className="mt-1"
                              data-testid="deprock-input-transfer-number"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Transfer Message</Label>
                            <Input
                              value={deptFeatures.transferMessage}
                              onChange={(e) => setDeptFeatures({ ...deptFeatures, transferMessage: e.target.value })}
                              placeholder="Please hold while I transfer you..."
                              className="mt-1"
                              data-testid="deprock-input-transfer-message"
                            />
                          </div>
                        </div>
                      )}
                    </Card>
                    
                    <Card className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-green-500" />
                          <div>
                            <Label className="text-sm">Enable Language Detection</Label>
                            <p className="text-xs text-muted-foreground">Auto-detect caller's language (99 languages)</p>
                          </div>
                        </div>
                        <Switch
                          checked={deptFeatures.enableLanguageDetection}
                          onCheckedChange={(val) => setDeptFeatures({ ...deptFeatures, enableLanguageDetection: val })}
                          data-testid="deprock-switch-lang-detection"
                        />
                      </div>
                    </Card>
                    
                    <Card className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PhoneOff className="h-4 w-4 text-orange-500" />
                          <div>
                            <Label className="text-sm">Enable End Conversation</Label>
                            <p className="text-xs text-muted-foreground">Intelligently end calls when appropriate</p>
                          </div>
                        </div>
                        <Switch
                          checked={deptFeatures.enableEndConversation}
                          onCheckedChange={(val) => setDeptFeatures({ ...deptFeatures, enableEndConversation: val })}
                          data-testid="deprock-switch-end-conversation"
                        />
                      </div>
                    </Card>
                    
                    <Card className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-purple-500" />
                          <div>
                            <Label className="text-sm">Enable Appointment Booking</Label>
                            <p className="text-xs text-muted-foreground">Book appointments during calls</p>
                          </div>
                        </div>
                        <Switch
                          checked={deptFeatures.enableAppointmentBooking}
                          onCheckedChange={(val) => setDeptFeatures({ ...deptFeatures, enableAppointmentBooking: val })}
                          data-testid="deprock-switch-appointment"
                        />
                      </div>
                    </Card>
                    
                    <Card className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Circle className="h-4 w-4 text-red-500" />
                          <div>
                            <Label className="text-sm">Enable Call Recording</Label>
                            <p className="text-xs text-muted-foreground">Record for quality and training</p>
                          </div>
                        </div>
                        <Switch
                          checked={deptFeatures.enableRecording}
                          onCheckedChange={(val) => setDeptFeatures({ ...deptFeatures, enableRecording: val })}
                          data-testid="deprock-switch-dept-recording"
                        />
                      </div>
                    </Card>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background pb-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateDepartmentMutation.mutate({
                        id: selectedDepartment.id,
                        data: newDepartment,
                      });
                      setShowConfigSheet(false);
                    }}
                    disabled={updateDepartmentMutation.isPending}
                    data-testid="deprock-button-save-config"
                  >
                    {updateDepartmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfigSheet(false)}
                    data-testid="deprock-button-cancel-config"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={ivrConfigOpen} onOpenChange={setIvrConfigOpen}>
        <SheetContent className="w-[100vw] max-w-[100vw] sm:max-w-[450px] md:max-w-[550px]" data-testid="deprock-sheet-ivr-config">
          <SheetHeader>
            <SheetTitle>IVR Configuration</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label className="font-medium">Enable IVR</Label>
                  <p className="text-xs text-muted-foreground">Play menu when calls connect</p>
                </div>
                <Switch
                  checked={ivrEnabled}
                  onCheckedChange={setIvrEnabled}
                  data-testid="deprock-switch-ivr-enabled"
                />
              </div>
              
              {ivrEnabled && (
                <>
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
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
                      data-testid="deprock-switch-ivr-multilang"
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
                              setLanguageSelectionGreetingText(generateDefaultLanguageSelectionGreeting());
                              isGreetingCustomized.current = false;
                            }}
                            data-testid="deprock-button-reset-lang-greeting"
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
                          data-testid="deprock-textarea-lang-selection-greeting"
                        />
                        <p className="text-xs text-muted-foreground">
                          This greeting plays when callers first connect. Replace "Company Name" with your business name.
                        </p>
                        <div className="mt-2">
                          <Label className="text-xs text-muted-foreground">Greeting Voice</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Select
                              value={languageSelectionGreetingVoice}
                              onValueChange={setLanguageSelectionGreetingVoice}
                            >
                              <SelectTrigger className="flex-1" data-testid="deprock-select-greeting-voice">
                                <SelectValue placeholder="Select a voice..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getVoicesForLanguage("en", dynamicElVoices, dynamicCartesiaVoices).map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.gender}, {voice.style}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleIvrVoicePreview(languageSelectionGreetingVoice, languageSelectionGreetingText, ivrVoiceSpeed)}
                              data-testid="deprock-button-preview-greeting-voice"
                            >
                              {ivrPlayingVoiceId === languageSelectionGreetingVoice ? (
                                <Square className="h-4 w-4" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                            <span className="text-xs font-mono text-muted-foreground" data-testid="text-mgmt-greeting-voice-speed">{ivrVoiceSpeed.toFixed(2)}x</span>
                          </div>
                          <Slider
                            value={[ivrVoiceSpeed]}
                            min={0.5}
                            max={1.5}
                            step={0.01}
                            onValueChange={([val]) => setIvrVoiceSpeed(val)}
                            className="mt-1"
                            data-testid="slider-mgmt-greeting-voice-speed"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                            <span>0.5x Slow</span>
                            <span>1.0x Normal</span>
                            <span>1.5x Fast</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Language Options</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addLanguageOption}
                            disabled={languageOptions.length >= SUPPORTED_LANGUAGES.length}
                            data-testid="deprock-button-add-language"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>
                        </div>
                        
                        {languageOptions.map((opt, idx) => (
                          <Card key={opt.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">Press {idx + 1}</Badge>
                                <Select
                                  value={opt.language}
                                  onValueChange={(val) => updateLanguageOption(opt.id, { language: val })}
                                >
                                  <SelectTrigger className="w-32" data-testid={`deprock-select-lang-option-${idx}`}>
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
                                data-testid={`deprock-button-remove-lang-${idx}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Voice</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Select
                                    value={opt.voiceId}
                                    onValueChange={(val) => updateLanguageOption(opt.id, { voiceId: val })}
                                  >
                                    <SelectTrigger className="flex-1" data-testid={`deprock-select-voice-${idx}`}>
                                      <SelectValue placeholder="Select a voice..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getVoicesForLanguage(opt.language, dynamicElVoices, dynamicCartesiaVoices).length > 0 ? (
                                        <>
                                          {getVoicesForLanguage(opt.language, dynamicElVoices, dynamicCartesiaVoices).map((voice) => (
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
                                    onClick={() => handleIvrVoicePreview(opt.voiceId, opt.greeting, opt.speed ?? 0.92, opt.language)}
                                    data-testid={`deprock-button-preview-voice-${idx}`}
                                  >
                                    {ivrPlayingVoiceId === opt.voiceId ? (
                                      <Square className="h-4 w-4" />
                                    ) : (
                                      <Volume2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                                  <span className="text-xs font-mono text-muted-foreground" data-testid={`text-mgmt-voice-speed-${idx}`}>{(opt.speed ?? 0.92).toFixed(2)}x</span>
                                </div>
                                <Slider
                                  value={[opt.speed ?? 0.92]}
                                  min={0.5}
                                  max={1.5}
                                  step={0.01}
                                  onValueChange={([val]) => updateLanguageOption(opt.id, { speed: val })}
                                  className="mt-1"
                                  data-testid={`slider-mgmt-voice-speed-${idx}`}
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                  <span>0.5x Slow</span>
                                  <span>1.0x Normal</span>
                                  <span>1.5x Fast</span>
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs text-muted-foreground">Menu Departments</Label>
                                <div className="mt-1 space-y-1">
                                  {departments.map((dept, deptIdx) => (
                                    <div 
                                      key={dept.id} 
                                      className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                                      onClick={() => {
                                        const currentDepts = opt.selectedDepartments || [];
                                        const newDepts = currentDepts.includes(dept.id)
                                          ? currentDepts.filter(d => d !== dept.id)
                                          : [...currentDepts, dept.id];
                                        const deptNames = newDepts.map(id => departments.find(d => d.id === id)?.name || "").filter(Boolean);
                                        updateLanguageOption(opt.id, { 
                                          selectedDepartments: newDepts,
                                          greeting: generateDeptGreeting(deptNames, opt.language)
                                        });
                                      }}
                                      data-testid={`deprock-dept-select-${idx}-${deptIdx}`}
                                    >
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${(opt.selectedDepartments || []).includes(dept.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                        {(opt.selectedDepartments || []).includes(dept.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                                      </div>
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                                      <span className="text-sm flex-1">{dept.name}</span>
                                      {(opt.selectedDepartments || []).includes(dept.id) && (
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {(opt.selectedDepartments || []).indexOf(dept.id) + 1}
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                  {departments.length === 0 && (
                                    <div className="text-xs text-muted-foreground p-2 text-center border rounded">
                                      No departments available
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">Greeting Message</Label>
                                  <Badge variant="secondary" className="text-xs">Editable</Badge>
                                </div>
                                <Textarea
                                  value={opt.greeting}
                                  onChange={(e) => updateLanguageOption(opt.id, { greeting: e.target.value })}
                                  placeholder="Select departments above to generate greeting, or type your own..."
                                  rows={3}
                                  className="mt-1 text-sm"
                                  data-testid={`deprock-textarea-greeting-${idx}`}
                                />
                              </div>
                            </div>
                          </Card>
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
                    <div className="space-y-3">
                      <div>
                        <Label>Default Greeting Message</Label>
                        <Textarea
                          value={languageOptions[0]?.greeting || DEFAULT_GREETINGS.en}
                          onChange={(e) => {
                            if (languageOptions.length === 0) {
                              setLanguageOptions([{
                                id: "default",
                                language: "en",
                                voiceId: "el_rachel",
                                greeting: e.target.value,
                              }]);
                            } else {
                              updateLanguageOption(languageOptions[0].id, { greeting: e.target.value });
                            }
                          }}
                          rows={3}
                          className="mt-1.5"
                          placeholder="Thank you for calling..."
                          data-testid="deprock-textarea-default-greeting"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Voice Speed</Label>
                          <span className="text-xs font-mono text-muted-foreground" data-testid="text-mgmt-default-voice-speed">{(languageOptions[0]?.speed ?? ivrVoiceSpeed).toFixed(2)}x</span>
                        </div>
                        <Slider
                          value={[languageOptions[0]?.speed ?? ivrVoiceSpeed]}
                          min={0.5}
                          max={1.5}
                          step={0.01}
                          onValueChange={([val]) => {
                            setIvrVoiceSpeed(val);
                            if (languageOptions.length > 0) {
                              updateLanguageOption(languageOptions[0].id, { speed: val });
                            }
                          }}
                          className="mt-1"
                          data-testid="slider-mgmt-default-voice-speed"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>0.5x Slow</span>
                          <span>1.0x Normal</span>
                          <span>1.5x Fast</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIvrConfigOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveIvrConfigMutation.mutate()}
                  disabled={saveIvrConfigMutation.isPending}
                >
                  {saveIvrConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Configuration
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={!!viewAgentDetail} onOpenChange={(open) => {
        if (!open) {
          if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            const src = previewAudioRef.current.src;
            if (src.startsWith('blob:')) URL.revokeObjectURL(src);
            previewAudioRef.current = null;
          }
          setPreviewingVoice(false);
          setViewAgentDetail(null);
          setEditAgentDetail(null);
          setGeneratingPromptFor(null);
        }
      }}>
        <SheetContent className="w-full sm:max-w-md" data-testid="deprock-agent-detail-sheet">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap" data-testid="deprock-agent-detail-title">
              <Mic className="h-4 w-4" />
              {viewAgentDetail?.agentName}
            </SheetTitle>
          </SheetHeader>
          {viewAgentDetail && editAgentDetail && (
            <ScrollArea className="h-[calc(100vh-120px)] pr-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" data-testid="deprock-agent-detail-language">
                    {SUPPORTED_LANGUAGES.find(l => l.code === viewAgentDetail.language)?.label || viewAgentDetail.language}
                  </Badge>
                  <Badge variant="secondary" data-testid="deprock-agent-detail-type">
                    {viewAgentDetail.agentType}
                  </Badge>
                  {viewAgentDetail.isPrimary && (
                    <Badge data-testid="deprock-agent-detail-primary">
                      Primary
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Voice</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={previewingVoice || !editAgentDetail.voiceId || ![...ALL_IVR_VOICES, ...dynamicElVoices, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].some(v => v.id === editAgentDetail.voiceId)}
                      onClick={async () => {
                        if (!editAgentDetail.voiceId) return;
                        setPreviewingVoice(true);
                        try {
                          if (previewAudioRef.current) {
                            previewAudioRef.current.pause();
                            previewAudioRef.current = null;
                          }
                          const allVoicesList = [...ALL_IVR_VOICES, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)];
                          const voiceInfo = allVoicesList.find(v => v.id === editAgentDetail.voiceId);
                          const voiceName = voiceInfo?.name || editAgentDetail.voiceId;
                          const voiceLang = voiceInfo?.languages?.[0] || 'en';
                          const sampleText = editAgentDetail.firstMessage || `Hello, I am ${voiceName}. This is how I sound.`;
                          const res = await apiRequest("POST", "/api/deprock/voice-preview", {
                            voiceId: editAgentDetail.voiceId,
                            text: sampleText.substring(0, 200),
                            speed: editAgentDetail.voiceSpeed ?? 1.0,
                            language: voiceLang,
                          });
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const audio = new Audio(url);
                          previewAudioRef.current = audio;
                          audio.onended = () => {
                            setPreviewingVoice(false);
                            URL.revokeObjectURL(url);
                            previewAudioRef.current = null;
                          };
                          audio.onerror = () => {
                            setPreviewingVoice(false);
                            URL.revokeObjectURL(url);
                            previewAudioRef.current = null;
                          };
                          await audio.play();
                        } catch (err) {
                          toast({ title: "Failed to preview voice", variant: "destructive" });
                          setPreviewingVoice(false);
                        }
                      }}
                      data-testid="deprock-agent-detail-play-voice"
                    >
                      {previewingVoice ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  {(() => {
                    const currentVoiceId = editAgentDetail.voiceId;
                    const allCartesia = dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES;
                    const isKnownVoice = [...ALL_IVR_VOICES, ...dynamicElVoices, ...allCartesia].some(v => v.id === currentVoiceId);
                    const filteredEL = getVoicesForLanguage(viewAgentDetail.language, dynamicElVoices, dynamicCartesiaVoices);
                    const currentInFiltered = filteredEL.some(v => v.id === currentVoiceId);
                    return (
                      <Select
                        value={isKnownVoice ? currentVoiceId : ''}
                        onValueChange={(val) => setEditAgentDetail(prev => prev ? { ...prev, voiceId: val } : prev)}
                      >
                        <SelectTrigger data-testid="deprock-agent-detail-select-voice">
                          <SelectValue placeholder={
                            currentVoiceId && !isKnownVoice 
                              ? `${currentVoiceId} (unknown)` 
                              : "Select a voice"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {!currentInFiltered && isKnownVoice && currentVoiceId && (
                            <SelectItem key={currentVoiceId} value={currentVoiceId} data-testid={`deprock-agent-detail-voice-option-${currentVoiceId}`}>
                              {[...ALL_IVR_VOICES, ...(dynamicCartesiaVoices.length > 0 ? dynamicCartesiaVoices : CARTESIA_DEFAULT_VOICES)].find(v => v.id === currentVoiceId)?.name || currentVoiceId} (current)
                            </SelectItem>
                          )}
                          {filteredEL.map(voice => (
                            <SelectItem key={voice.id} value={voice.id} data-testid={`deprock-agent-detail-voice-option-${voice.id}`}>
                              {voice.name} ({voice.gender}, {voice.style})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Agent Voice Speed</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="text-agent-detail-voice-speed">{(editAgentDetail.voiceSpeed ?? 1.0).toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[editAgentDetail.voiceSpeed ?? 1.0]}
                    min={0.5}
                    max={1.5}
                    step={0.01}
                    onValueChange={([val]) => setEditAgentDetail(prev => prev ? { ...prev, voiceSpeed: val } : prev)}
                    className="mt-1"
                    data-testid="slider-agent-detail-voice-speed"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>0.5x Slow</span>
                    <span>1.0x Normal</span>
                    <span>1.5x Fast</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Voice Tone</Label>
                  <Select
                    value={editAgentDetail.voiceTone}
                    onValueChange={(val) => setEditAgentDetail(prev => prev ? { ...prev, voiceTone: val } : prev)}
                  >
                    <SelectTrigger data-testid="deprock-agent-detail-select-voice-tone">
                      <SelectValue placeholder="Select voice tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {["professional", "friendly", "calm", "energetic", "authoritative", "warm", "casual", "formal"].map(tone => (
                        <SelectItem key={tone} value={tone} data-testid={`deprock-agent-detail-tone-option-${tone}`}>
                          {tone.charAt(0).toUpperCase() + tone.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">First Message</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={generatingPromptFor === 'firstMessage'}
                      onClick={() => {
                        setGeneratingPromptFor('firstMessage');
                        const agentName = viewAgentDetail.agentName;
                        const lang = viewAgentDetail.language;
                        const greetings: Record<string, string> = {
                          en: `Hello! I'm ${agentName}. How can I assist you today?`,
                          ar: `\u0645\u0631\u062d\u0628\u0627\u064b! \u0623\u0646\u0627 ${agentName}. \u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0627\u0644\u064a\u0648\u0645\u061f`,
                          es: `\u00a1Hola! Soy ${agentName}. \u00bfEn qu\u00e9 puedo ayudarte hoy?`,
                          fr: `Bonjour ! Je suis ${agentName}. Comment puis-je vous aider aujourd'hui ?`,
                          de: `Hallo! Ich bin ${agentName}. Wie kann ich Ihnen heute helfen?`,
                          it: `Ciao! Sono ${agentName}. Come posso aiutarti oggi?`,
                          pt: `Ol\u00e1! Eu sou ${agentName}. Como posso ajud\u00e1-lo hoje?`,
                          zh: `\u4f60\u597d\uff01\u6211\u662f${agentName}\u3002\u4eca\u5929\u6211\u80fd\u4e3a\u60a8\u505a\u4ec0\u4e48\uff1f`,
                          hi: `\u0928\u092e\u0938\u094d\u0924\u0947! \u092e\u0948\u0902 ${agentName} \u0939\u0942\u0901\u0964 \u0906\u091c \u092e\u0948\u0902 \u0906\u092a\u0915\u0940 \u0915\u0948\u0938\u0947 \u092e\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u0940 \u0939\u0942\u0901?`,
                          ja: `\u3053\u3093\u306b\u3061\u306f\uff01${agentName}\u3067\u3059\u3002\u672c\u65e5\u306f\u3069\u306e\u3088\u3046\u306a\u3054\u7528\u4ef6\u3067\u3057\u3087\u3046\u304b\uff1f`,
                          ko: `\uc548\ub155\ud558\uc138\uc694! ${agentName}\uc785\ub2c8\ub2e4. \uc624\ub298 \uc5b4\ub5bb\uac8c \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694?`,
                          nl: `Hallo! Ik ben ${agentName}. Hoe kan ik u vandaag helpen?`,
                          pl: `Cze\u015b\u0107! Jestem ${agentName}. Jak mog\u0119 Ci dzi\u015b pom\u00f3c?`,
                          sv: `Hej! Jag \u00e4r ${agentName}. Hur kan jag hj\u00e4lpa dig idag?`,
                          no: `Hei! Jeg er ${agentName}. Hvordan kan jeg hjelpe deg i dag?`,
                          fi: `Hei! Olen ${agentName}. Kuinka voin auttaa sinua t\u00e4n\u00e4\u00e4n?`,
                          tr: `Merhaba! Ben ${agentName}. Size bug\u00fcn nas\u0131l yard\u0131mc\u0131 olabilirim?`,
                        };
                        const msg = greetings[lang] || greetings.en;
                        setEditAgentDetail(prev => prev ? { ...prev, firstMessage: msg } : prev);
                        setGeneratingPromptFor(null);
                      }}
                      data-testid="deprock-agent-detail-generate-first-message"
                    >
                      {generatingPromptFor === 'firstMessage' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={editAgentDetail.firstMessage}
                    onChange={(e) => setEditAgentDetail(prev => prev ? { ...prev, firstMessage: e.target.value } : prev)}
                    rows={3}
                    data-testid="deprock-agent-detail-textarea-first-message"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">System Prompt</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={generatingPromptFor === 'systemPrompt'}
                      onClick={async () => {
                        setGeneratingPromptFor('systemPrompt');
                        try {
                          const deptName = departments.find(d => d.id === viewAgentDetail.departmentId)?.name || 'Department';
                          const res = await apiRequest("POST", "/api/deprock/generate-prompt", {
                            departmentType: "general",
                            departmentName: deptName,
                            language: viewAgentDetail.language,
                            agentName: viewAgentDetail.agentName,
                          });
                          const data = await res.json();
                          if (data.prompt) {
                            setEditAgentDetail(prev => prev ? { ...prev, systemPrompt: data.prompt } : prev);
                          }
                        } catch (err) {
                          toast({ title: "Failed to generate prompt", variant: "destructive" });
                        } finally {
                          setGeneratingPromptFor(null);
                        }
                      }}
                      data-testid="deprock-agent-detail-generate-system-prompt"
                    >
                      {generatingPromptFor === 'systemPrompt' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={editAgentDetail.systemPrompt}
                    onChange={(e) => setEditAgentDetail(prev => prev ? { ...prev, systemPrompt: e.target.value } : prev)}
                    rows={8}
                    data-testid="deprock-agent-detail-textarea-system-prompt"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Knowledge Bases</Label>
                  <p className="text-sm" data-testid="deprock-agent-detail-kb-count">
                    {viewAgentDetail.knowledgeBaseIds && viewAgentDetail.knowledgeBaseIds.length > 0
                      ? `${viewAgentDetail.knowledgeBaseIds.length} knowledge base${viewAgentDetail.knowledgeBaseIds.length !== 1 ? 's' : ''} attached`
                      : "None attached"}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewAgentDetail(null);
                      setEditAgentDetail(null);
                    }}
                    data-testid="deprock-agent-detail-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateAgentConfigMutation.mutate({
                        departmentId: viewAgentDetail.departmentId,
                        departmentAgentId: viewAgentDetail.id,
                        voiceId: editAgentDetail.voiceId,
                        voiceTone: editAgentDetail.voiceTone,
                        firstMessage: editAgentDetail.firstMessage,
                        systemPrompt: editAgentDetail.systemPrompt,
                        voiceSpeed: editAgentDetail.voiceSpeed,
                      });
                    }}
                    disabled={updateAgentConfigMutation.isPending}
                    data-testid="deprock-agent-detail-save"
                  >
                    {updateAgentConfigMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
      </div>
      {showSimulator && (
        <DeprockCallSimulator onClose={() => setShowSimulator(false)} />
      )}
    </ThreeColumnLayout>
  );
}

interface DeprockDepartmentCardProps {
  department: Department;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onFlow: () => void;
  onAddAgent: () => void;
  onViewAgent: (agent: { id: string; agentId: string; departmentId: string; agentName: string; language: string; systemPrompt: string | null; voiceTone: string | null; voiceId: string | null; voiceProvider: string | null; knowledgeBaseIds: string[] | null; isPrimary: boolean; agentType: string; firstMessage: string | null }) => void;
}

function DeprockDepartmentCard({
  department,
  index,
  onEdit,
  onDelete,
  onFlow,
  onAddAgent,
  onViewAgent,
}: DeprockDepartmentCardProps) {
  const IconComponent = departmentIcons.find(i => i.value === department.icon)?.icon || Building2;
  const agentCount = department.agentCount || 0;
  const langCount = (department.languages || []).length || 1;
  const agents = department.assignedAgents || [];

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-border/20"
      data-testid={`deprock-department-card-${department.id}`}
    >
      {/* Colored header band */}
      <div
        className="px-3 py-2.5 flex items-center gap-2.5"
        style={{ backgroundColor: department.color || "#3b82f6" }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <IconComponent className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-semibold truncate">{department.name}</span>
            <span className="text-white/50 text-[10px] shrink-0">#{index}</span>
          </div>
          {department.description && (
            <p className="text-white/70 text-[10px] truncate leading-snug">{department.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="w-6 h-6 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={onEdit}
            data-testid={`deprock-button-edit-${department.id}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            className="w-6 h-6 rounded flex items-center justify-center text-white/60 hover:text-red-200 hover:bg-white/10 transition-colors"
            onClick={onDelete}
            data-testid={`deprock-button-delete-${department.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="bg-card border-x border-b border-border/20 rounded-b-2xl px-3 py-2.5 space-y-2.5">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap" data-testid={`deprock-badge-ivr-active-${department.id}`}>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${department.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${department.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            {department.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid={`deprock-badge-ai-voice-${department.id}`}>
            <Mic className="h-2.5 w-2.5" />
            {agentCount} Agent{agentCount !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Globe className="h-2.5 w-2.5" />
            {langCount} Lang{langCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Agents */}
        <div data-testid={`deprock-agent-list-${department.id}`}>
          {agents.length > 0 ? (
            <div className="flex items-start gap-2.5 flex-wrap py-0.5">
              {agents.map((agent: any) => {
                const initials = agent.agentName
                  .split(/\s+/)
                  .map((w: string) => w.charAt(0).toUpperCase())
                  .slice(0, 2)
                  .join('');
                const langLabel = languages.find(l => l.value === agent.language)?.label || agent.language;
                return (
                  <div
                    key={agent.id}
                    className="flex flex-col items-center gap-1 cursor-pointer group"
                    onClick={() => onViewAgent({
                      id: agent.id,
                      agentId: agent.agentId,
                      departmentId: department.id,
                      agentName: agent.agentName,
                      language: agent.language,
                      systemPrompt: agent.systemPrompt ?? null,
                      voiceTone: agent.voiceTone ?? null,
                      voiceId: agent.voiceId ?? null,
                      voiceProvider: agent.voiceProvider ?? null,
                      knowledgeBaseIds: agent.knowledgeBaseIds ?? null,
                      isPrimary: agent.isPrimary ?? false,
                      agentType: agent.agentType ?? 'incoming',
                      firstMessage: agent.firstMessage ?? null,
                    })}
                    data-testid={`deprock-view-agent-${agent.id}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: `${department.color}15`, borderColor: `${department.color}40` }}
                      title={agent.agentName}
                    >
                      <span className="text-[11px] font-semibold" style={{ color: department.color }}>{initials}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 leading-tight text-center max-w-[48px] truncate">{langLabel}</span>
                  </div>
                );
              })}
              <div
                className="flex flex-col items-center gap-1 cursor-pointer group"
                onClick={onAddAgent}
                data-testid={`deprock-button-add-agent-${department.id}`}
              >
                <div className="w-8 h-8 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
                  <Plus className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary/70" />
                </div>
                <span className="text-[10px] text-muted-foreground/50 leading-tight">Add</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-2">
              <div
                className="flex flex-col items-center gap-1 cursor-pointer group"
                onClick={onAddAgent}
                data-testid={`deprock-button-add-agent-${department.id}`}
              >
                <div className="w-8 h-8 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
                  <Plus className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary/70" />
                </div>
                <span className="text-[10px] text-muted-foreground/50 leading-tight">Add Agent</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="pt-1 border-t border-border/20">
          <button
            onClick={onFlow}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-colors hover:bg-muted/60"
            style={{ color: department.color || undefined }}
            data-testid={`deprock-button-flow-${department.id}`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            View Flow
          </button>
        </div>
      </div>
    </div>
  );
}
