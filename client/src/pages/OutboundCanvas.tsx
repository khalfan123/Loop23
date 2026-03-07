import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  FileText,
  Users,
  Loader2,
  Globe,
  Sparkles,
  Check,
  CheckCircle2,
  ChevronRight,
  Search,
  Plus,
  ClipboardList,
  PhoneOutgoing,
  Send,
  LayoutTemplate,
  UserPlus,
  Filter,
  MapPin,
  FolderOpen,
  TrendingUp,
  Headphones,
  DollarSign,
  Heart,
  Building,
  Plane,
  Briefcase,
  Calendar,
  ShoppingCart,
  MessageSquare,
  Zap,
  BookOpen,
  Link,
  Brain,
  AudioWaveform,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileUp,
  Info,
  Volume2,
  Square,
  Wand2,
  Tag,
  Package,
  Pencil,
  PhoneOff,
  Bot,
} from "lucide-react";
import { FORM_TEMPLATES, FORM_TEMPLATE_CATEGORIES, type FormTemplate } from "@/data/form-templates";
import { AuthStorage } from "@/lib/auth-storage";

const PHONE_COUNTRY_PREFIXES: [string, string, string][] = [
  ["+1", "US/CA", "🇺🇸"],
  ["+44", "UK", "🇬🇧"],
  ["+91", "India", "🇮🇳"],
  ["+61", "Australia", "🇦🇺"],
  ["+33", "France", "🇫🇷"],
  ["+49", "Germany", "🇩🇪"],
  ["+39", "Italy", "🇮🇹"],
  ["+34", "Spain", "🇪🇸"],
  ["+81", "Japan", "🇯🇵"],
  ["+86", "China", "🇨🇳"],
  ["+82", "S. Korea", "🇰🇷"],
  ["+55", "Brazil", "🇧🇷"],
  ["+52", "Mexico", "🇲🇽"],
  ["+7", "Russia", "🇷🇺"],
  ["+90", "Turkey", "🇹🇷"],
  ["+966", "Saudi Arabia", "🇸🇦"],
  ["+971", "UAE", "🇦🇪"],
  ["+27", "South Africa", "🇿🇦"],
  ["+234", "Nigeria", "🇳🇬"],
  ["+62", "Indonesia", "🇮🇩"],
  ["+60", "Malaysia", "🇲🇾"],
  ["+65", "Singapore", "🇸🇬"],
  ["+63", "Philippines", "🇵🇭"],
  ["+31", "Netherlands", "🇳🇱"],
  ["+46", "Sweden", "🇸🇪"],
  ["+47", "Norway", "🇳🇴"],
  ["+45", "Denmark", "🇩🇰"],
  ["+358", "Finland", "🇫🇮"],
  ["+48", "Poland", "🇵🇱"],
  ["+92", "Pakistan", "🇵🇰"],
  ["+20", "Egypt", "🇪🇬"],
  ["+212", "Morocco", "🇲🇦"],
  ["+254", "Kenya", "🇰🇪"],
  ["+251", "Ethiopia", "🇪🇹"],
  ["+54", "Argentina", "🇦🇷"],
  ["+56", "Chile", "🇨🇱"],
  ["+57", "Colombia", "🇨🇴"],
  ["+51", "Peru", "🇵🇪"],
  ["+66", "Thailand", "🇹🇭"],
  ["+84", "Vietnam", "🇻🇳"],
  ["+880", "Bangladesh", "🇧🇩"],
  ["+94", "Sri Lanka", "🇱🇰"],
  ["+353", "Ireland", "🇮🇪"],
  ["+41", "Switzerland", "🇨🇭"],
  ["+43", "Austria", "🇦🇹"],
  ["+32", "Belgium", "🇧🇪"],
  ["+351", "Portugal", "🇵🇹"],
  ["+30", "Greece", "🇬🇷"],
  ["+972", "Israel", "🇮🇱"],
  ["+964", "Iraq", "🇮🇶"],
];

const SORTED_PREFIXES = [...PHONE_COUNTRY_PREFIXES].sort((a, b) => b[0].length - a[0].length);

function getCountryFromPhone(phone: string): { name: string; flag: string } | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  for (const [prefix, name, flag] of SORTED_PREFIXES) {
    if (cleaned.startsWith(prefix)) return { name, flag };
  }
  return null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string;
  numberType: string | null;
  capabilities: unknown;
  status: string;
  isSystemPool: boolean;
}

interface DeduplicatedContact {
  id: string;
  phone: string;
  email: string | null;
  names: Array<{ firstName: string; lastName: string | null }>;
  campaigns: Array<{ id: string; name: string }>;
  status: string;
  source: string;
  callCount: number;
}

interface ContactGroup {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

interface GroupMembership {
  contact_phone: string;
  group_id: string;
  group_name: string;
  group_color: string;
}

interface FormItem {
  id: string;
  name: string;
  description: string | null;
  fields?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[] | null;
    order: number;
  }>;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  isTemplate: boolean;
  nodeCount: number;
  preview: string[];
}

interface KnowledgeBaseItem {
  id: string;
  title: string;
  type: string;
  content: string | null;
  url: string | null;
  chunkCount: number;
  ragStatus: string;
  isRAGEnabled: boolean;
}

interface PollyVoice {
  id: string;
  name: string;
  description: string;
  gender: 'Female' | 'Male';
  language: string;
  engine: 'neural' | 'generative';
}

interface ElevenLabsVoiceItem {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

const POLLY_VOICES: PollyVoice[] = [
  { id: 'Joanna', name: 'Joanna', description: 'Clear, professional US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Matthew', name: 'Matthew', description: 'Warm, conversational US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Ruth', name: 'Ruth', description: 'Mature, authoritative US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Stephen', name: 'Stephen', description: 'Deep, resonant US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Danielle', name: 'Danielle', description: 'Modern, energetic US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Gregory', name: 'Gregory', description: 'Calm, reassuring US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Salli', name: 'Salli', description: 'Soft, pleasant US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Joey', name: 'Joey', description: 'Casual, friendly US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Amy', name: 'Amy', description: 'Professional British English female voice', gender: 'Female', language: 'en-GB', engine: 'neural' },
  { id: 'Arthur', name: 'Arthur', description: 'Warm British English male voice', gender: 'Male', language: 'en-GB', engine: 'neural' },
  { id: 'Emma', name: 'Emma', description: 'Natural British English female voice', gender: 'Female', language: 'en-GB', engine: 'neural' },
  { id: 'Brian', name: 'Brian', description: 'Natural British English male voice', gender: 'Male', language: 'en-GB', engine: 'neural' },
  { id: 'Olivia', name: 'Olivia', description: 'Warm Australian English female voice', gender: 'Female', language: 'en-AU', engine: 'neural' },
  { id: 'Aria', name: 'Aria', description: 'Expressive New Zealand English female voice', gender: 'Female', language: 'en-NZ', engine: 'neural' },
  { id: 'Niamh', name: 'Niamh', description: 'Natural Irish English female voice', gender: 'Female', language: 'en-IE', engine: 'neural' },
  { id: 'Ayanda', name: 'Ayanda', description: 'Vibrant South African English female voice', gender: 'Female', language: 'en-ZA', engine: 'neural' },
  { id: 'Lea', name: 'Lea', description: 'Elegant French female voice', gender: 'Female', language: 'fr-FR', engine: 'neural' },
  { id: 'Remi', name: 'Remi', description: 'Smooth French male voice', gender: 'Male', language: 'fr-FR', engine: 'neural' },
  { id: 'Gabrielle', name: 'Gabrielle', description: 'Natural Canadian French female voice', gender: 'Female', language: 'fr-CA', engine: 'neural' },
  { id: 'Liam', name: 'Liam', description: 'Clear Canadian French male voice', gender: 'Male', language: 'fr-CA', engine: 'neural' },
  { id: 'Lupe', name: 'Lupe', description: 'Natural US Spanish female voice', gender: 'Female', language: 'es-US', engine: 'neural' },
  { id: 'Pedro', name: 'Pedro', description: 'Natural US Spanish male voice', gender: 'Male', language: 'es-US', engine: 'neural' },
  { id: 'Lucia', name: 'Lucia', description: 'Professional Castilian Spanish female voice', gender: 'Female', language: 'es-ES', engine: 'neural' },
  { id: 'Sergio', name: 'Sergio', description: 'Confident Castilian Spanish male voice', gender: 'Male', language: 'es-ES', engine: 'neural' },
  { id: 'Mia', name: 'Mia', description: 'Warm Mexican Spanish female voice', gender: 'Female', language: 'es-MX', engine: 'neural' },
  { id: 'Andres', name: 'Andres', description: 'Natural Mexican Spanish male voice', gender: 'Male', language: 'es-MX', engine: 'neural' },
  { id: 'Vicki', name: 'Vicki', description: 'Friendly German female voice', gender: 'Female', language: 'de-DE', engine: 'neural' },
  { id: 'Daniel', name: 'Daniel', description: 'Confident German male voice', gender: 'Male', language: 'de-DE', engine: 'neural' },
  { id: 'Hannah', name: 'Hannah', description: 'Natural Austrian German female voice', gender: 'Female', language: 'de-AT', engine: 'neural' },
  { id: 'Bianca', name: 'Bianca', description: 'Elegant Italian female voice', gender: 'Female', language: 'it-IT', engine: 'neural' },
  { id: 'Adriano', name: 'Adriano', description: 'Smooth Italian male voice', gender: 'Male', language: 'it-IT', engine: 'neural' },
  { id: 'Kajal', name: 'Kajal', description: 'Natural Hindi female voice', gender: 'Female', language: 'hi-IN', engine: 'neural' },
  { id: 'Zhiyu', name: 'Zhiyu', description: 'Professional Mandarin Chinese female voice', gender: 'Female', language: 'cmn-CN', engine: 'neural' },
  { id: 'Hiujin', name: 'Hiujin', description: 'Natural Cantonese Chinese female voice', gender: 'Female', language: 'yue-CN', engine: 'neural' },
  { id: 'Hala', name: 'Hala', description: 'Clear Gulf Arabic female voice', gender: 'Female', language: 'ar-AE', engine: 'neural' },
  { id: 'Zayd', name: 'Zayd', description: 'Natural Gulf Arabic male voice', gender: 'Male', language: 'ar-AE', engine: 'neural' },
  { id: 'Takumi', name: 'Takumi', description: 'Natural Japanese male voice', gender: 'Male', language: 'ja-JP', engine: 'neural' },
  { id: 'Kazuha', name: 'Kazuha', description: 'Warm Japanese female voice', gender: 'Female', language: 'ja-JP', engine: 'neural' },
  { id: 'Seoyeon', name: 'Seoyeon', description: 'Clear Korean female voice', gender: 'Female', language: 'ko-KR', engine: 'neural' },
  { id: 'Camila', name: 'Camila', description: 'Warm Brazilian Portuguese female voice', gender: 'Female', language: 'pt-BR', engine: 'neural' },
  { id: 'Thiago', name: 'Thiago', description: 'Natural Brazilian Portuguese male voice', gender: 'Male', language: 'pt-BR', engine: 'neural' },
  { id: 'Ines', name: 'Ines', description: 'Clear Portuguese female voice', gender: 'Female', language: 'pt-PT', engine: 'neural' },
  { id: 'Laura', name: 'Laura', description: 'Natural Dutch female voice', gender: 'Female', language: 'nl-NL', engine: 'neural' },
  { id: 'Ola', name: 'Ola', description: 'Friendly Polish female voice', gender: 'Female', language: 'pl-PL', engine: 'neural' },
  { id: 'Suvi', name: 'Suvi', description: 'Clear Finnish female voice', gender: 'Female', language: 'fi-FI', engine: 'neural' },
  { id: 'Ida', name: 'Ida', description: 'Natural Norwegian female voice', gender: 'Female', language: 'nb-NO', engine: 'neural' },
  { id: 'Elin', name: 'Elin', description: 'Bright Swedish female voice', gender: 'Female', language: 'sv-SE', engine: 'neural' },
  { id: 'Sofie', name: 'Sofie', description: 'Natural Danish female voice', gender: 'Female', language: 'da-DK', engine: 'neural' },
  { id: 'Burcu', name: 'Burcu', description: 'Natural Turkish female voice', gender: 'Female', language: 'tr-TR', engine: 'neural' },
];

const POLLY_LANGUAGE_MAP: Record<string, string> = {
  'en-US': 'English (US)', 'en-GB': 'English (UK)', 'en-AU': 'English (AU)',
  'en-NZ': 'English (NZ)', 'en-IE': 'English (IE)', 'en-ZA': 'English (ZA)',
  'fr-FR': 'French', 'fr-CA': 'French (CA)',
  'es-US': 'Spanish (US)', 'es-ES': 'Spanish (ES)', 'es-MX': 'Spanish (MX)',
  'de-DE': 'German', 'de-AT': 'German (AT)',
  'it-IT': 'Italian', 'hi-IN': 'Hindi',
  'cmn-CN': 'Chinese (Mandarin)', 'yue-CN': 'Chinese (Cantonese)',
  'ar-AE': 'Arabic (Gulf)', 'ja-JP': 'Japanese', 'ko-KR': 'Korean',
  'pt-BR': 'Portuguese (BR)', 'pt-PT': 'Portuguese (PT)',
  'nl-NL': 'Dutch', 'pl-PL': 'Polish', 'fi-FI': 'Finnish',
  'nb-NO': 'Norwegian', 'sv-SE': 'Swedish', 'da-DK': 'Danish', 'tr-TR': 'Turkish',
};

const POLLY_LANG_TO_SHORT: Record<string, string> = {
  'en-US': 'en', 'en-GB': 'en', 'en-AU': 'en', 'en-NZ': 'en', 'en-IE': 'en', 'en-ZA': 'en',
  'fr-FR': 'fr', 'fr-CA': 'fr', 'es-US': 'es', 'es-ES': 'es', 'es-MX': 'es',
  'de-DE': 'de', 'de-AT': 'de', 'it-IT': 'it', 'hi-IN': 'hi',
  'cmn-CN': 'zh', 'yue-CN': 'zh', 'ar-AE': 'ar',
  'ja-JP': 'ja', 'ko-KR': 'ko', 'pt-BR': 'pt', 'pt-PT': 'pt',
  'nl-NL': 'nl', 'pl-PL': 'pl', 'fi-FI': 'fi',
  'nb-NO': 'no', 'sv-SE': 'sv', 'da-DK': 'da', 'tr-TR': 'tr',
};

const getLanguageLabel = (code: string) => {
  const labels: Record<string, string> = {
    en: "English", ar: "Arabic", fr: "French", hi: "Hindi",
    it: "Italian", zh: "Chinese", es: "Spanish", de: "German",
    pt: "Portuguese", ja: "Japanese", ko: "Korean", ru: "Russian",
    nl: "Dutch", tr: "Turkish", pl: "Polish", sv: "Swedish",
    no: "Norwegian", fi: "Finnish", da: "Danish",
  };
  return labels[code] || code.toUpperCase();
};

const USE_CASE_CATEGORIES = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "support", label: "Support", icon: Headphones },
  { id: "collections", label: "Collections", icon: DollarSign },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "surveys", label: "Surveys", icon: MessageSquare },
  { id: "healthcare", label: "Healthcare", icon: Heart },
  { id: "realestate", label: "Real Estate", icon: Building },
  { id: "hospitality", label: "Travel", icon: Plane },
  { id: "finance", label: "Finance", icon: Briefcase },
  { id: "ecommerce", label: "E-Commerce", icon: ShoppingCart },
];

function categorizeTemplate(id: string): string {
  if (id.match(/lead|cold.call|demo|upsell|win.back|referral|pricing|trial|quote|renewal|competitor|flash|product.launch|seasonal|vip|contract|negotiation/)) return "sales";
  if (id.match(/general.inquiry|complaint|tech|billing|account.verif|password|service.activ|service.cancel|escalation|warranty|refund|shipping|product.return|faq|feature.request/)) return "support";
  if (id.match(/past.due|collections|payment.plan|auto.pay|payment.method|dispute|credit.card|invoice/)) return "collections";
  if (id.match(/appointment|no.show|waitlist|recurring|multi.provider|group.booking|same.day|virtual/)) return "appointments";
  if (id.match(/nps|survey|satisfaction|market.research|exit.interview|feedback|beta.tester/)) return "surveys";
  if (id.match(/prescription|lab.result|insurance.verif|pre.visit|post.discharge|medication|preventive|specialist|telehealth|patient/)) return "healthcare";
  if (id.match(/property|viewing|buyer|mortgage|open.house|seller|offer|closing/)) return "realestate";
  if (id.match(/hotel|concierge|loyalty|flight|travel/)) return "hospitality";
  if (id.match(/fraud|kyc|investment|credit.limit|policy|claims|retirement|loan/)) return "finance";
  if (id.match(/order|payment.reminder|payment.confirm|data.collection/)) return "ecommerce";
  return "sales";
}

function getGreetingExample(category: string, templateId?: string | null): string {
  if (templateId?.match(/appointment|no.show|waitlist|recurring|multi.provider|group.booking|same.day|virtual/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling to book an appointment — can I have a moment of your time?";
  if (templateId?.match(/lead|cold.call|demo|product.launch/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm reaching out because we have something that could really help your business — do you have a quick minute?";
  if (templateId?.match(/upsell|renewal|win.back|contract/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about your account — I have a great offer I'd love to share with you.";
  if (templateId?.match(/past.due|collections|payment.plan|invoice/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your account balance — do you have a moment to discuss?";
  if (templateId?.match(/survey|nps|satisfaction|feedback|market.research/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. We'd love your feedback — do you have a couple of minutes for a quick survey?";
  if (templateId?.match(/general.inquiry|complaint|tech|billing|support/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm following up on your recent inquiry — is now a good time to chat?";
  if (templateId?.match(/prescription|lab.result|insurance|pre.visit|post.discharge|patient/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your upcoming visit — do you have a moment?";
  if (templateId?.match(/property|viewing|buyer|mortgage|open.house/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about a property that matches what you're looking for — got a minute?";
  if (templateId?.match(/hotel|concierge|loyalty|flight|travel/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about your upcoming reservation — do you have a moment?";
  if (templateId?.match(/fraud|kyc|investment|credit.limit|policy|claims|loan/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your account — it's important, do you have a moment?";
  if (templateId?.match(/order|payment.reminder|payment.confirm/))
    return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about your recent order — do you have a quick moment?";
  switch (category) {
    case "appointments": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling to book an appointment — can I have a moment of your time?";
    case "sales": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm reaching out because we have something that could really help — do you have a quick minute?";
    case "collections": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your account balance — do you have a moment?";
    case "surveys": return "Hi {{firstName}}, this is [Agent] from [Company]. We'd love your feedback — do you have a couple minutes?";
    case "support": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm following up on your recent inquiry — is now a good time?";
    case "healthcare": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your upcoming visit — do you have a moment?";
    case "realestate": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about a property listing — got a minute?";
    case "hospitality": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about your reservation — do you have a moment?";
    case "finance": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling regarding your account — do you have a moment?";
    case "ecommerce": return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about your recent order — do you have a quick moment?";
    default: return "Hi {{firstName}}, this is [Agent] from [Company]. I'm calling about something that might interest you — do you have a moment?";
  }
}

const STEPS = [
  { id: 1, label: "Use Case", icon: Sparkles },
  { id: 2, label: "Contacts", icon: Users },
  { id: 3, label: "Phone", icon: Phone },
  { id: 4, label: "Voice & Agent", icon: AudioWaveform },
  { id: 5, label: "Knowledge", icon: Brain },
  { id: 6, label: "Launch", icon: Send },
];

function OutboundWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [useCaseCategory, setUseCaseCategory] = useState("all");
  const [useCaseSearch, setUseCaseSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedVoiceProvider, setSelectedVoiceProvider] = useState<'polly' | 'elevenlabs'>('polly');
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentNameSuggestions, setAgentNameSuggestions] = useState<string[]>([]);
  const [suggestingAgentName, setSuggestingAgentName] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [callScript, setCallScript] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<string[]>([]);
  const [knowledgeBaseOnly, setKnowledgeBaseOnly] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [expandedScript, setExpandedScript] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [voiceLanguageFilter, setVoiceLanguageFilter] = useState("en-US");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'Female' | 'Male'>('all');
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const [productOrService, setProductOrService] = useState("");
  const [personalizationVars, setPersonalizationVars] = useState<string[]>([]);
  const hasAutoGenerated = useRef(false);
  const [campaignGoal, setCampaignGoal] = useState("");
  const [isGeneratingUseCases, setIsGeneratingUseCases] = useState(false);
  const [onDemandUseCases, setOnDemandUseCases] = useState<Array<{ id: string; name: string; description: string; category: string }>>([]);

  interface AiUseCase {
    id: string;
    name: string;
    description: string;
    category: string;
  }

  const { data: aiUseCases = [], isLoading: aiUseCasesLoading } = useQuery<AiUseCase[]>({
    queryKey: ["/api/campaigns/use-cases"],
  });

  const displayedAiUseCases = onDemandUseCases.length > 0 ? onDemandUseCases : aiUseCases;
  const hasAiUseCases = displayedAiUseCases.length > 0 && !displayedAiUseCases[0]?.id?.startsWith('default-');

  const handleGenerateUseCases = async () => {
    setIsGeneratingUseCases(true);
    try {
      const res = await apiRequest("POST", "/api/campaigns/generate-use-cases", {
        goal: campaignGoal.trim() || undefined,
      });
      const data = await res.json();
      const useCasesList = Array.isArray(data) ? data : (data.useCases || []);
      if (useCasesList.length > 0) {
        setOnDemandUseCases(useCasesList);
        toast({ title: "Use cases generated", description: `${useCasesList.length} tailored use cases ready` });
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Could not generate use cases", variant: "destructive" });
    } finally {
      setIsGeneratingUseCases(false);
    }
  };

  const handleSelectAiUseCase = (uc: AiUseCase) => {
    setSelectedTemplateId(`ai-${uc.id}`);
    setCampaignName(uc.name + " Campaign");
    setCallScript(
      `Campaign: "${uc.name}"\nObjective: ${uc.description}\n\nBe professional, friendly, and natural. Keep responses concise (1-3 sentences). Use natural conversation patterns — vary your sentence openings, use appropriate fillers, and mirror the caller's energy.`
    );
  };

  const { data: flowTemplates = [], isLoading: templatesLoading } = useQuery<FlowTemplate[]>({
    queryKey: ["/api/flow-automation/flow-templates"],
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: phoneNumbers = [], isLoading: phonesLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: elevenLabsVoices = [], isLoading: elVoicesLoading } = useQuery<ElevenLabsVoiceItem[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: forms = [], isLoading: formsLoading } = useQuery<FormItem[]>({
    queryKey: ["/api/flow-automation/forms"],
  });

  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const { data: groupMemberships = [] } = useQuery<GroupMembership[]>({
    queryKey: ["/api/contact-group-memberships"],
  });

  const { data: knowledgeBases = [], isLoading: kbLoading } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/rag-knowledge"],
  });

  useEffect(() => {
    if (knowledgeBases.length > 0) {
      setSelectedKnowledgeBaseIds(knowledgeBases.map(kb => kb.id));
    }
  }, [knowledgeBases]);

  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/rag-knowledge/url", { url, name: url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag-knowledge"] });
      setReferenceUrl("");
      toast({ title: "URL Imported", description: "Content scraped and added to your knowledge base." });
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message || "Could not import URL", variant: "destructive" });
    },
  });

  const generateGreetingMutation = useMutation({
    mutationFn: async () => {
      const template = flowTemplates.find(t => t.id === selectedTemplateId);
      const _pollyVoice = POLLY_VOICES.find(v => v.id === selectedVoiceId);
      const agentLang = _pollyVoice ? (POLLY_LANG_TO_SHORT[_pollyVoice.language] || 'en') : 'en';
      const sampleContact = selectedContacts[0] || null;
      const contactName = sampleContact?.names?.[0]
        ? `${sampleContact.names[0].firstName} ${sampleContact.names[0].lastName || ''}`.trim()
        : undefined;
      const res = await apiRequest("POST", "/api/campaigns/generate-greeting", {
        campaignName,
        useCase: template?.name || undefined,
        useCaseDescription: template?.description || undefined,
        language: agentLang,
        agentName: agentName.trim() || undefined,
        companyName: currentUser?.company || undefined,
        contactName,
        productOrService: productOrService.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.greeting) {
        setGreetingMessage(data.greeting);
      }
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate greeting", variant: "destructive" });
    },
  });

  const generateAllContentMutation = useMutation({
    mutationFn: async () => {
      const template = flowTemplates.find(t => t.id === selectedTemplateId);
      const _pollyVoice = POLLY_VOICES.find(v => v.id === selectedVoiceId);
      const agentLang = _pollyVoice ? (POLLY_LANG_TO_SHORT[_pollyVoice.language] || 'en') : 'en';
      const sampleContact = selectedContacts[0] || null;
      const contactSample = sampleContact ? {
        firstName: sampleContact.names?.[0]?.firstName || sampleContact.phone,
        lastName: sampleContact.names?.[0]?.lastName || '',
        email: sampleContact.email || '',
        customFields: (sampleContact as any).customFields || {},
      } : null;
      const res = await apiRequest("POST", "/api/campaigns/generate-outbound-content", {
        useCase: template?.name || undefined,
        useCaseDescription: template?.description || undefined,
        category: template?.category || undefined,
        agentName: agentName.trim() || undefined,
        companyName: currentUser?.company || undefined,
        language: agentLang,
        contactSample,
        productOrService: productOrService.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.greeting) setGreetingMessage(data.greeting);
      const combinedScript = [data.callScript, data.systemPrompt].filter(Boolean).join('\n\n');
      if (combinedScript) setCallScript(combinedScript);
      if (data.availableVariables) setPersonalizationVars(data.availableVariables);
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate outbound content", variant: "destructive" });
    },
  });

  const suggestFormMutation = useMutation({
    mutationFn: async () => {
      const template = flowTemplates.find(t => t.id === selectedTemplateId);
      const useCase = template?.name || 'General calling campaign';
      const _pollyVoice = POLLY_VOICES.find(v => v.id === selectedVoiceId);
      const agentLang = _pollyVoice ? (POLLY_LANG_TO_SHORT[_pollyVoice.language] || 'en') : 'en';

      const genRes = await apiRequest("POST", "/api/campaigns/generate-form", {
        useCase,
        language: agentLang,
      });
      const generated = await genRes.json();

      const createRes = await apiRequest("POST", "/api/campaigns/create-form", {
        formName: generated.formName,
        formDescription: generated.formDescription,
        fields: generated.fields,
      });
      return createRes.json();
    },
    onSuccess: (data: any) => {
      if (data.formId) {
        setSelectedFormId(data.formId);
        queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/forms"] });
      }
    },
    onError: () => {
      toast({ title: "Failed to generate form", description: "Could not create a suggested form", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (currentStep === 5 && !hasAutoGenerated.current && selectedVoiceId && selectedContactIds.length > 0) {
      if (!greetingMessage && !callScript) {
        hasAutoGenerated.current = true;
        generateAllContentMutation.mutate();
      }
    }
  }, [currentStep, selectedVoiceId, selectedContactIds.length]);

  const contacts = contactsData || [];

  const contactGroupsByPhone = useMemo(() => {
    const map = new Map<string, GroupMembership[]>();
    groupMemberships.forEach((m) => {
      const existing = map.get(m.contact_phone) || [];
      existing.push(m);
      map.set(m.contact_phone, existing);
    });
    return map;
  }, [groupMemberships]);

  const contactCountryMap = useMemo(() => {
    const map = new Map<string, { name: string; flag: string } | null>();
    contacts.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, getCountryFromPhone(c.phone));
    });
    return map;
  }, [contacts]);

  const availableCountries = useMemo(() => {
    const countrySet = new Map<string, string>();
    contactCountryMap.forEach((val) => {
      if (val) countrySet.set(val.name, val.flag);
    });
    return Array.from(countrySet.entries())
      .map(([name, flag]) => ({ name, flag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contactCountryMap]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (groupFilter !== "all") {
      result = result.filter((c) => {
        const groups = contactGroupsByPhone.get(c.phone);
        return groups?.some((g) => g.group_id === groupFilter);
      });
    }
    if (countryFilter !== "all") {
      result = result.filter((c) => {
        const country = contactCountryMap.get(c.id);
        return country?.name === countryFilter;
      });
    }
    if (contactSearch.trim()) {
      const q = contactSearch.trim().toLowerCase();
      result = result.filter((c) => {
        const name = c.names?.[0]
          ? `${c.names[0].firstName} ${c.names[0].lastName || ""}`.trim()
          : "";
        return (
          c.phone.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [contacts, contactSearch, groupFilter, countryFilter, contactCountryMap, contactGroupsByPhone]);


  const filteredTemplates = useMemo(() => {
    let result = FORM_TEMPLATES;
    if (selectedTemplateCategory !== "All") {
      result = result.filter((t) => t.category === selectedTemplateCategory);
    }
    if (templateSearch.trim()) {
      const q = templateSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedTemplateCategory, templateSearch]);

  const pollyLanguageOptions = useMemo(() => {
    const langs = new Map<string, string>();
    POLLY_VOICES.forEach(v => {
      if (!langs.has(v.language)) langs.set(v.language, POLLY_LANGUAGE_MAP[v.language] || v.language);
    });
    return Array.from(langs.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const filteredPollyVoices = useMemo(() => {
    let voices = POLLY_VOICES.filter(v => v.language === voiceLanguageFilter);
    if (voiceGenderFilter !== 'all') {
      voices = voices.filter(v => v.gender === voiceGenderFilter);
    }
    return voices;
  }, [voiceLanguageFilter, voiceGenderFilter]);

  const filteredElevenLabsVoices = useMemo(() => {
    let voices = elevenLabsVoices;
    if (voiceGenderFilter !== 'all') {
      voices = voices.filter(v => {
        const gender = v.labels?.gender || '';
        return gender.toLowerCase() === voiceGenderFilter.toLowerCase();
      });
    }
    if (voiceSearch.trim()) {
      const q = voiceSearch.trim().toLowerCase();
      voices = voices.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.labels?.accent || '').toLowerCase().includes(q) ||
        (v.labels?.description || '').toLowerCase().includes(q)
      );
    }
    return voices;
  }, [elevenLabsVoices, voiceGenderFilter, voiceSearch]);

  const filteredFlowTemplates = useMemo(() => {
    let result = flowTemplates;
    if (useCaseCategory !== "all") {
      result = result.filter((t) => categorizeTemplate(t.id) === useCaseCategory);
    }
    if (useCaseSearch.trim()) {
      const q = useCaseSearch.trim().toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [flowTemplates, useCaseCategory, useCaseSearch]);

  const selectedFlowTemplate = useMemo(() => {
    return flowTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [flowTemplates, selectedTemplateId]);


  const selectedPhone = useMemo(() => {
    return phoneNumbers.find((p) => p.id === selectedPhoneId) || null;
  }, [phoneNumbers, selectedPhoneId]);

  const selectedForm = useMemo(() => {
    return forms.find((f) => f.id === selectedFormId) || null;
  }, [forms, selectedFormId]);

  const selectedContacts = useMemo(() => {
    return contacts.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const selectAllContacts = () => {
    setSelectedContactIds(filteredContacts.map((c) => c.id));
  };

  const clearContacts = () => {
    setSelectedContactIds([]);
  };

  const playVoicePreview = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId === voiceId && previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setPreviewingVoiceId(null);
      setPreviewAudio(null);
      return;
    }
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    setPreviewingVoiceId(voiceId);
    const audio = new Audio(`/api/bedrock-polly/voice-preview/${voiceId}`);
    audio.onended = () => {
      setPreviewingVoiceId(null);
      setPreviewAudio(null);
    };
    audio.onerror = () => {
      setPreviewingVoiceId(null);
      setPreviewAudio(null);
      toast({ title: "Preview Failed", description: "Could not play voice preview", variant: "destructive" });
    };
    audio.play();
    setPreviewAudio(audio);
  };

  const playElevenLabsPreview = async (voiceId: string, previewUrl: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId === voiceId && previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      if (previewAudio.src.startsWith('blob:')) URL.revokeObjectURL(previewAudio.src);
      setPreviewingVoiceId(null);
      setPreviewAudio(null);
      return;
    }
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      if (previewAudio.src.startsWith('blob:')) URL.revokeObjectURL(previewAudio.src);
    }

    if (previewUrl) {
      setPreviewingVoiceId(voiceId);
      const audio = new Audio(previewUrl);
      audio.onended = () => { setPreviewingVoiceId(null); setPreviewAudio(null); };
      audio.onerror = () => { setPreviewingVoiceId(null); setPreviewAudio(null); toast({ title: "Preview Failed", variant: "destructive" }); };
      audio.play();
      setPreviewAudio(audio);
      return;
    }

    setVoicePreviewLoading(true);
    setPreviewingVoiceId(voiceId);
    try {
      const token = AuthStorage.getToken();
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ voiceId, text: "Hi there! This is a quick call regarding an exciting opportunity we have for you. Do you have a moment to chat?" }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPreviewingVoiceId(null); setPreviewAudio(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewingVoiceId(null); setPreviewAudio(null); URL.revokeObjectURL(url); toast({ title: "Preview Failed", variant: "destructive" }); };
      audio.play();
      setPreviewAudio(audio);
    } catch {
      toast({ title: "Preview Failed", description: "Could not play voice preview", variant: "destructive" });
      setPreviewingVoiceId(null);
    } finally {
      setVoicePreviewLoading(false);
    }
  };

  const isOutboundCapable = (phone: PhoneNumber) => {
    if (phone.status && phone.status !== 'active') return false;
    if (phone.isSystemPool) return false;
    const caps = phone.capabilities as any;
    if (caps && caps.voice === false) return false;
    if (phone.country === 'AE' && phone.numberType === 'toll_free') return false;
    if (phone.phoneNumber?.startsWith('+9718')) return false;
    return true;
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return true;
      case 2: return selectedContactIds.length > 0;
      case 3: {
        if (!selectedPhoneId) return false;
        const phone = phoneNumbers.find(p => p.id === selectedPhoneId);
        return phone ? isOutboundCapable(phone) : false;
      }
      case 4: return selectedVoiceId !== null && agentName.trim().length > 0;
      case 5: return true;
      case 6: return campaignName.trim().length > 0;
      default: return false;
    }
  };

  const goNext = () => {
    if (canProceed(currentStep) && currentStep < 6) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (nextStep === 5 && !generateGreetingMutation.isPending) {
        generateGreetingMutation.mutate();
      }
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const applyFormTemplate = (template: FormTemplate) => {
    const templateDescription = template.fields
      .map((f) => {
        let desc = `- ${f.label} (${f.type}${f.required ? ", required" : ""})`;
        if (f.options && f.options.length > 0) {
          desc += `: ${f.options.join(", ")}`;
        }
        return desc;
      })
      .join("\n");

    const scriptAddition = `\n\nDuring the call, collect the following information using this form:\nForm: ${template.name}\n${templateDescription}`;

    setCallScript((prev) => prev + scriptAddition);
    setShowTemplates(false);
    toast({
      title: "Template Applied",
      description: `"${template.name}" form fields added to your call script.`,
    });
  };

  const handleSelectUseCase = (templateId: string | null) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = flowTemplates.find((t) => t.id === templateId);
      if (template) {
        setCampaignName(template.name + " Campaign");
        setCallScript(
          `You are an AI phone agent conducting a "${template.name}" call.\n\n${template.description}\n\nBe professional, friendly, and natural. Keep responses concise (1-3 sentences). Use natural conversation patterns — vary your sentence openings, use appropriate fillers, and mirror the caller's energy.`
        );
      }
    }
  };

  const getContextLine = () => {
    const parts: string[] = [];
    if (selectedTemplateId) {
      const t = flowTemplates.find((f) => f.id === selectedTemplateId);
      if (t) parts.push(t.name);
    }
    if (selectedContactIds.length > 0) parts.push(`${selectedContactIds.length} contacts`);
    if (selectedPhone) parts.push(selectedPhone.phoneNumber);
    if (selectedVoiceName) parts.push(selectedVoiceName);
    if (knowledgeBases.length > 0) parts.push(`${knowledgeBases.length} KB`);
    return parts.length > 0 ? parts.join(" → ") : "";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVoiceId) throw new Error("No voice selected");
      if (!selectedPhoneId) throw new Error("No phone number selected");
      if (selectedContactIds.length === 0) throw new Error("No contacts selected");
      if (!campaignName.trim()) throw new Error("Campaign name is required");

      const template = flowTemplates.find(t => t.id === selectedTemplateId);
      const aiUseCase = !template && selectedTemplateId?.startsWith('ai-')
        ? displayedAiUseCases.find(uc => `ai-${uc.id}` === selectedTemplateId)
        : null;
      const useCaseSource = template || aiUseCase;
      const finalAgentName = agentName.trim() || (useCaseSource ? `${useCaseSource.name} Agent` : `${campaignName} Agent`);

      const categoryGoals: Record<string, string> = {
        'Sales': 'YOUR GOAL: Qualify the lead, pitch the value, and either close the sale or schedule a follow-up demo/meeting. Ask about their current situation, identify pain points, and present how your solution solves them.',
        'Support': 'YOUR GOAL: Resolve the customer\'s issue or concern. Ask clarifying questions, provide clear solutions, and confirm the issue is resolved before ending the call.',
        'Collections': 'YOUR GOAL: Negotiate a payment arrangement. Be firm but empathetic. Discuss the outstanding amount, offer payment options, and secure a commitment or payment date.',
        'Appointments': 'YOUR GOAL: Confirm or schedule an appointment. Verify availability, propose times, confirm the details, and remind them what to bring or prepare.',
        'Healthcare': 'YOUR GOAL: Confirm the patient\'s appointment, collect any needed info, and remind them of preparation steps. Be compassionate and HIPAA-mindful.',
        'Real Estate': 'YOUR GOAL: Qualify the lead\'s property interest, schedule a viewing or consultation, and collect their requirements (budget, location, size preferences).',
        'Insurance': 'YOUR GOAL: Qualify the prospect, understand their coverage needs, present relevant options, and schedule a detailed consultation or close the policy.',
        'Education': 'YOUR GOAL: Engage the prospective student, explain program benefits, answer questions about curriculum/costs, and guide them toward enrollment or a campus visit.',
        'Financial Services': 'YOUR GOAL: Understand the client\'s financial situation, present relevant products/services, and schedule a consultation or secure an application.',
        'Surveys': 'YOUR GOAL: Complete the survey by asking each question clearly, recording responses, and thanking them for their time. Keep it concise and respectful.',
        'Reminders': 'YOUR GOAL: Deliver the reminder clearly, confirm acknowledgment, and ask if they have any questions. Keep it brief and friendly.',
        'Follow-up': 'YOUR GOAL: Check in on their experience, gather feedback, address any concerns, and identify opportunities for additional value.',
      };

      const category = useCaseSource?.category || '';
      const goalSection = categoryGoals[category] || 'YOUR GOAL: Achieve the purpose of this call as described in your use case and script. Drive the conversation toward a clear outcome.';
      const useCaseContext = useCaseSource
        ? `USE CASE: ${useCaseSource.name}\nDESCRIPTION: ${useCaseSource.description}\nCATEGORY: ${useCaseSource.category}\n\n${goalSection}`
        : `GENERAL OUTBOUND CALL\n\n${goalSection}`;
      const scriptSection = callScript
        ? `\nCALL SCRIPT & CONVERSATION GUIDE (follow these points step-by-step as your playbook):\n${callScript}\n\nIMPORTANT: Follow the script above as a GUIDE — cover each point in order but use your own natural words. Do NOT read it verbatim. Adapt based on the person's responses while staying on track.`
        : '';

      const outboundSystemPrompt = `You are ${finalAgentName}, an experienced outbound calling agent${currentUser?.company ? ` from ${currentUser.company}` : ''}. You are confident, friendly, and goal-oriented. You know exactly why you're calling and what outcome you want.

${useCaseContext}
${scriptSection}

OUTBOUND CALLING INSTRUCTIONS:
- You INITIATED this call. You called the person, they did not call you.
- After your greeting, WAIT for the person to respond. Then continue the conversation naturally.
- State the purpose of your call clearly within your first 1-2 responses.
- Follow your CALL SCRIPT step-by-step as a conversation playbook. Cover each point in order.
- When the person responds, address their question/objection THEN steer back to the next point in your script.
- Ask qualifying questions to understand their needs and move toward your goal.
- Handle objections with empathy: acknowledge their concern, then pivot back to value.
- If they say "not interested" — ask ONE follow-up question before accepting ("Just curious, what would need to change for this to make sense?").
- If they say "I'm busy" — offer to call back at a better time.
- If the person asks questions, answer them knowledgeably using your script and knowledge base.
- Keep responses SHORT — 1 to 3 sentences. This is a phone call, not an email.
- Be warm, natural, and conversational. You are a real person, not a robot.
- When the conversation goal is achieved or the person firmly declines, wrap up naturally and end the call.

SUCCESS CRITERIA: The call is successful when you achieve your stated goal above, or when you've secured a concrete next step (callback time, meeting, follow-up).
FAILURE HANDLING: If the person firmly declines, thank them for their time and end the call politely. Never be pushy or aggressive.`;

      const isPolly = selectedVoiceProvider === 'polly';
      const pollyVoice = isPolly ? POLLY_VOICES.find(v => v.id === selectedVoiceId) : null;
      const shortLang = isPolly && pollyVoice ? (POLLY_LANG_TO_SHORT[pollyVoice.language] || 'en') : 'en';

      const agentPayload: Record<string, any> = {
        type: 'incoming',
        name: finalAgentName,
        systemPrompt: outboundSystemPrompt,
        firstMessage: greetingMessage || undefined,
        language: shortLang,
        endConversationEnabled: true,
      };

      if (isPolly) {
        agentPayload.voiceProvider = 'aws_polly';
        agentPayload.awsPollyVoiceId = selectedVoiceId;
        agentPayload.voiceName = pollyVoice?.name || selectedVoiceId;
        agentPayload.telephonyProvider = 'twilio';
      } else {
        agentPayload.voiceProvider = 'elevenlabs';
        agentPayload.elevenLabsVoiceId = selectedVoiceId;
        agentPayload.voiceName = selectedVoiceName || selectedVoiceId;
        agentPayload.telephonyProvider = 'elevenlabs';
      }

      const agentRes = await apiRequest("POST", "/api/agents", agentPayload);
      const agent = await agentRes.json();

      const payload: Record<string, any> = {
        name: campaignName,
        type: "outbound",
        agentId: agent.id,
        phoneNumberId: selectedPhoneId,
        script: callScript || null,
        selectedFormId: selectedFormId || undefined,
        knowledgeBaseIds: selectedKnowledgeBaseIds.length > 0 ? selectedKnowledgeBaseIds : undefined,
        knowledgeBaseOnly: knowledgeBaseOnly || undefined,
        greetingMessage: greetingMessage.trim() || undefined,
      };

      const res = await apiRequest("POST", "/api/campaigns", payload);
      const campaign = await res.json();

      if (campaign?.id && selectedContactIds.length > 0) {
        await apiRequest("POST", `/api/campaigns/${campaign.id}/contacts/assign`, {
          contactIds: selectedContactIds,
        });
      }

      if (campaign?.id) {
        await apiRequest("POST", `/api/campaigns/${campaign.id}/execute`);
      }

      return campaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      toast({
        title: "Campaign Launched",
        description: `"${campaignName}" is now calling ${selectedContactIds.length} contact(s).`,
      });
      if (data?.id) {
        setLocation(`/app/campaigns/${data.id}`);
      } else {
        setLocation("/app/campaigns");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Launch Failed",
        description: error.message || "Failed to create outbound campaign",
        variant: "destructive",
      });
    },
  });

  const renderStepIndicator = () => (
    <div className="border-b glass-surface px-2 sm:px-3 py-1" data-testid="outbound-step-indicator">
      <div className="flex items-center gap-0.5 text-[11px] sm:text-xs overflow-x-auto scrollbar-none">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => { if (isCompleted) setCurrentStep(step.id); }}
                className={`transition-colors ${
                  isActive
                    ? "text-foreground font-semibold"
                    : isCompleted
                    ? "text-primary cursor-pointer hover:underline"
                    : "text-muted-foreground/50"
                }`}
                disabled={!isCompleted && !isActive}
                data-testid={`button-outbound-step-${step.id}`}
              >
                {step.label}
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className={`h-3 w-3 flex-shrink-0 ${currentStep > step.id ? "text-primary/50" : "text-muted-foreground/30"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-3" data-testid="outbound-step-1">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Choose Your Use Case</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Describe your goal or pick a template</p>
      </div>

      <div className="w-full max-w-3xl mx-auto space-y-3">
        <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">What do you want to achieve?</span>
          </div>
          <Textarea
            value={campaignGoal}
            onChange={(e) => setCampaignGoal(e.target.value)}
            placeholder="e.g. I want to follow up with customers who purchased our premium plan and upsell add-on services..."
            className="min-h-[60px] text-xs resize-none"
            data-testid="textarea-campaign-goal"
          />
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleGenerateUseCases}
            disabled={isGeneratingUseCases}
            data-testid="button-generate-use-cases"
          >
            {isGeneratingUseCases ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Analyzing your business & generating use cases...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1.5" />
                Generate Tailored Use Cases
              </>
            )}
          </Button>
        </div>

        {(aiUseCasesLoading || isGeneratingUseCases) && (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {!aiUseCasesLoading && !isGeneratingUseCases && hasAiUseCases && (
          <>
            <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium">
              <Sparkles className="h-3 w-3" />
              {onDemandUseCases.length > 0 ? "AI-generated use cases tailored to your goal" : "AI-generated use cases based on your knowledge base"}
            </div>
            <div className="grid gap-1.5 sm:gap-2 grid-cols-1 sm:grid-cols-2">
              {displayedAiUseCases.map((uc) => {
                const isSelected = selectedTemplateId === `ai-${uc.id}`;
                return (
                  <Card
                    key={uc.id}
                    className={`glass-card cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:bg-accent/30 hover:shadow-sm"
                    }`}
                    onClick={() => handleSelectAiUseCase(uc)}
                    data-testid={`card-ai-usecase-${uc.id}`}
                  >
                    <CardContent className="p-2 flex items-start gap-2">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-md flex-shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-purple-100 dark:bg-purple-900/30"
                      }`}>
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs truncate">{uc.name}</span>
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" variant="outline">
                            AI
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{uc.description}</p>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 mt-1">
                          {uc.category}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-background px-2 text-muted-foreground">or pick a template below</span>
              </div>
            </div>
          </>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={useCaseSearch}
            onChange={(e) => setUseCaseSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 h-9 text-sm"
            data-testid="input-usecase-search"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {USE_CASE_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = useCaseCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setUseCaseCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                <CatIcon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <Card
          className={`glass-card cursor-pointer transition-all border-2 border-dashed ${
            selectedTemplateId === null
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30"
          }`}
          onClick={() => handleSelectUseCase(null)}
          data-testid="card-usecase-scratch"
        >
          <CardContent className="p-2.5 flex items-center gap-2.5">
            <div className={`flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 ${
              selectedTemplateId === null ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}>
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs">Start from Scratch</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Custom campaign with your own script</p>
            </div>
            {selectedTemplateId === null && (
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            )}
          </CardContent>
        </Card>

        {templatesLoading ? (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[35vh] sm:max-h-[400px] -mx-1 px-1">
            <div className="grid gap-1.5 sm:gap-2 grid-cols-1 sm:grid-cols-2">
              {filteredFlowTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const category = categorizeTemplate(template.id);
                const catDef = USE_CASE_CATEGORIES.find((c) => c.id === category);
                const CatIcon = catDef?.icon || Sparkles;
                const popular = template.id.match(/lead.qual|appointment|cold.call|nps|demo.sched|complaint|payment.remind/);

                return (
                  <Card
                    key={template.id}
                    className={`glass-card cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:bg-accent/30 hover:shadow-sm"
                    }`}
                    onClick={() => handleSelectUseCase(template.id)}
                    data-testid={`card-usecase-${template.id}`}
                  >
                    <CardContent className="p-2 flex items-start gap-2">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-md flex-shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : <CatIcon className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs truncate">{template.name}</span>
                          {popular && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" variant="outline">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                            {catDef?.label || "General"}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">{template.nodeCount} steps</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!templatesLoading && filteredFlowTemplates.length === 0 && useCaseSearch.trim() && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No use cases match "{useCaseSearch}"
          </p>
        )}
      </div>
    </div>
  );

  const selectGroupContacts = (groupId: string) => {
    const groupContactIds = contacts
      .filter((c) => {
        const groups = contactGroupsByPhone.get(c.phone);
        return groups?.some((g) => g.group_id === groupId);
      })
      .map((c) => c.id);
    setSelectedContactIds((prev) => {
      const allAlreadySelected = groupContactIds.every((id) => prev.includes(id));
      if (allAlreadySelected) {
        return prev.filter((id) => !groupContactIds.includes(id));
      }
      return [...new Set([...prev, ...groupContactIds])];
    });
  };

  const renderStep2 = () => {
    const VISIBLE_LIMIT = 50;
    const visibleContacts = filteredContacts.slice(0, VISIBLE_LIMIT);
    const hasMore = filteredContacts.length > VISIBLE_LIMIT;

    return (
    <div className="space-y-3" data-testid="outbound-step-2">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Select Contacts</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Choose people to call ({contacts.length} total)</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-2">
        {contactGroups.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quick Select by Group</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {contactGroups.map((g) => {
                const groupContactCount = contacts.filter((c) => {
                  const groups = contactGroupsByPhone.get(c.phone);
                  return groups?.some((gr) => gr.group_id === g.id);
                }).length;
                const groupContactIds = contacts
                  .filter((c) => {
                    const groups = contactGroupsByPhone.get(c.phone);
                    return groups?.some((gr) => gr.group_id === g.id);
                  })
                  .map((c) => c.id);
                const allSelected = groupContactIds.length > 0 && groupContactIds.every((id) => selectedContactIds.includes(id));
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGroupContacts(g.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      allSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted border-transparent"
                    }`}
                    data-testid={`button-select-group-${g.id}`}
                  >
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: allSelected ? 'currentColor' : g.color }} />
                    {g.name}
                    <span className={`text-[10px] ${allSelected ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                      {groupContactCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="pl-9 h-8 text-xs"
              data-testid="input-contact-search"
            />
          </div>
          {availableCountries.length > 0 && (
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs flex-shrink-0" data-testid="select-country-filter">
                <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {availableCountries.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.flag} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {contactsLoading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No contacts found. Add contacts first.</p>
            <Button variant="outline" size="sm" onClick={() => setLocation("/app/contacts")} data-testid="button-go-contacts">
              <UserPlus className="h-4 w-4 mr-1" />
              Go to Contacts
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  <span className="text-primary">{selectedContactIds.length}</span>
                  <span className="text-muted-foreground"> / {filteredContacts.length} selected</span>
                </span>
                {(groupFilter !== "all" || countryFilter !== "all" || contactSearch.trim()) && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Filtered
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={selectAllContacts}
                  data-testid="button-select-all-contacts"
                >
                  {selectedContactIds.length === filteredContacts.length && filteredContacts.length > 0 ? "Deselect All" : "Select All"}
                </Button>
                {selectedContactIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={clearContacts}
                    data-testid="button-clear-contacts"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[42vh] sm:max-h-[420px] border rounded-lg">
              <div className="divide-y">
                {visibleContacts.map((contact) => {
                  const isSelected = selectedContactIds.includes(contact.id);
                  const displayName = contact.names?.[0]
                    ? `${contact.names[0].firstName} ${contact.names[0].lastName || ""}`.trim()
                    : "Unknown";
                  const country = contactCountryMap.get(contact.id);
                  const groups = contactGroupsByPhone.get(contact.phone);

                  return (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-accent/40"
                      }`}
                      onClick={() => toggleContact(contact.id)}
                      data-testid={`card-contact-${contact.id}`}
                    >
                      <div className={`flex items-center justify-center h-6 w-6 rounded-md flex-shrink-0 border ${
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border"
                      }`}>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className={`flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0 text-xs font-medium ${
                        isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{displayName}</span>
                          {country && <span className="text-[11px]" title={country.name}>{country.flag}</span>}
                          {groups && groups.length > 0 && (
                            <div className="flex items-center gap-0.5">
                              {groups.slice(0, 2).map((g) => (
                                <span key={g.group_id} className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.group_color }} title={g.group_name} />
                              ))}
                              {groups.length > 2 && <span className="text-[9px] text-muted-foreground">+{groups.length - 2}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {contact.phone}
                          {contact.email && <span className="ml-2">{contact.email}</span>}
                        </div>
                      </div>
                      {contact.callCount > 0 && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {contact.callCount} call{contact.callCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div className="px-3 py-2 text-center border-t bg-muted/30">
                  <span className="text-[11px] text-muted-foreground">
                    Showing {VISIBLE_LIMIT} of {filteredContacts.length} contacts — use search or groups to narrow down
                  </span>
                </div>
              )}
            </div>

            {filteredContacts.length === 0 && contactSearch.trim() && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No contacts match "{contactSearch}"
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
  };

  const renderStep3 = () => (
    <div className="space-y-3" data-testid="outbound-step-3">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Select Caller ID</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Choose the phone number for outbound calls</p>
      </div>

      {phonesLoading ? (
        <div className="space-y-2 w-full max-w-2xl mx-auto">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="text-center py-6">
          <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">No phone numbers available.</p>
          <Button variant="outline" size="sm" onClick={() => setLocation("/app/phone-numbers")} data-testid="button-buy-numbers">
            <Plus className="h-4 w-4 mr-1" />
            Buy Phone Number
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto grid gap-1.5 grid-cols-1 sm:grid-cols-2">
          {phoneNumbers.map((phone) => {
            const isSelected = selectedPhoneId === phone.id;
            const canOutbound = isOutboundCapable(phone);
            const caps = phone.capabilities as any;
            let disabledReason = '';
            if (!canOutbound) {
              if (phone.status && phone.status !== 'active') disabledReason = 'Inactive';
              else if (phone.isSystemPool) disabledReason = 'Shared pool';
              else if (caps && caps.voice === false) disabledReason = 'No voice';
              else if ((phone.country === 'AE' && phone.numberType === 'toll_free') || phone.phoneNumber?.startsWith('+9718')) disabledReason = 'UAE toll-free';
            }
            return (
              <Card
                key={phone.id}
                className={`glass-card transition-colors ${
                  !canOutbound
                    ? "opacity-40 cursor-not-allowed border-dashed"
                    : isSelected
                    ? "border-primary bg-primary/5 cursor-pointer"
                    : "hover:border-primary/50 cursor-pointer"
                }`}
                onClick={() => canOutbound && setSelectedPhoneId(phone.id)}
                data-testid={`card-phone-${phone.id}`}
              >
                <CardContent className="p-2.5 flex items-center gap-2.5">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-md flex-shrink-0 ${
                    !canOutbound
                      ? "bg-muted text-muted-foreground"
                      : isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-green-100 dark:bg-green-900/30"
                  }`}>
                    {!canOutbound ? (
                      <PhoneOff className="h-3.5 w-3.5" />
                    ) : isSelected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Phone className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${!canOutbound ? 'line-through' : ''}`}>{phone.phoneNumber}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      {phone.numberType && <span className="capitalize">{phone.numberType}</span>}
                      {phone.country && <span>{phone.country}</span>}
                      {phone.friendlyName && <span className="truncate">{phone.friendlyName}</span>}
                      {disabledReason && (
                        <Badge variant="destructive" className="text-[9px] font-normal">
                          {disabledReason}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-3" data-testid="outbound-step-4">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Voice & Agent</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Choose a voice and name your AI calling agent</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-3">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 border">
          {(['elevenlabs', 'polly'] as const).map(provider => (
            <button
              key={provider}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedVoiceProvider === provider
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setSelectedVoiceProvider(provider);
                setSelectedVoiceId(null);
                setSelectedVoiceName("");
                setVoiceGenderFilter('all');
                setVoiceSearch("");
              }}
              data-testid={`tab-voice-${provider}`}
            >
              {provider === 'elevenlabs' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <AudioWaveform className="h-3 w-3" />
                  ElevenLabs
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <AudioWaveform className="h-3 w-3" />
                  AWS Polly
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {(['all', 'Female', 'Male'] as const).map(g => (
              <button
                key={g}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  voiceGenderFilter === g
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setVoiceGenderFilter(g)}
                data-testid={`button-gender-${g}`}
              >
                {g === 'all' ? 'All' : g}
              </button>
            ))}
          </div>
          {selectedVoiceProvider === 'polly' ? (
            <Select value={voiceLanguageFilter} onValueChange={(val) => {
              setVoiceLanguageFilter(val);
              setSelectedVoiceId(null);
              setSelectedVoiceName("");
            }}>
              <SelectTrigger className="w-[150px] h-8 text-xs flex-shrink-0 ml-auto" data-testid="select-voice-language">
                <Globe className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pollyLanguageOptions.map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="relative flex-1 ml-auto max-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Search voices..."
                className="pl-8 h-8 text-xs"
                data-testid="input-voice-search"
              />
            </div>
          )}
        </div>

        {selectedVoiceProvider === 'polly' ? (
          <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 max-h-[42vh] sm:max-h-[380px] overflow-y-auto border rounded-lg p-2">
            {filteredPollyVoices.map(voice => {
              const isSelected = selectedVoiceId === voice.id && selectedVoiceProvider === 'polly';
              return (
                <div
                  key={voice.id}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "hover:bg-accent/30 border-transparent hover:border-border"
                  }`}
                  onClick={() => {
                    setSelectedVoiceId(voice.id);
                    setSelectedVoiceName(voice.name);
                    setSelectedVoiceProvider('polly');
                  }}
                  data-testid={`voice-option-${voice.id}`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : voice.gender === 'Female'
                      ? "bg-pink-100 dark:bg-pink-900/30 text-pink-600"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  }`}>
                    {isSelected ? <Check className="h-3 w-3" /> : voice.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium truncate block">{voice.name}</span>
                    <span className="text-[9px] text-muted-foreground truncate block">{voice.description}</span>
                  </div>
                  <button
                    className={`h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0 ${
                      previewingVoiceId === voice.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    }`}
                    onClick={(e) => { e.stopPropagation(); playVoicePreview(voice.id, e); }}
                    data-testid={`button-preview-voice-${voice.id}`}
                  >
                    {previewingVoiceId === voice.id ? (
                      <Square className="h-2 w-2" />
                    ) : (
                      <Volume2 className="h-2.5 w-2.5" />
                    )}
                  </button>
                </div>
              );
            })}
            {filteredPollyVoices.length === 0 && (
              <div className="col-span-3 text-center py-6 text-[10px] text-muted-foreground">
                No voices match filters
              </div>
            )}
          </div>
        ) : (
          elVoicesLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredElevenLabsVoices.length === 0 ? (
            <div className="text-center py-8">
              <AudioWaveform className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">
                {voiceSearch.trim() ? `No voices match "${voiceSearch.trim()}"` : "No ElevenLabs voices available"}
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 max-h-[42vh] sm:max-h-[380px] overflow-y-auto border rounded-lg p-2">
              {filteredElevenLabsVoices.map(voice => {
                const isSelected = selectedVoiceId === voice.voice_id && selectedVoiceProvider === 'elevenlabs';
                const gender = voice.labels?.gender || '';
                const accent = voice.labels?.accent || '';
                const description = voice.labels?.description || voice.category || '';
                return (
                  <div
                    key={voice.voice_id}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "hover:bg-accent/30 border-transparent hover:border-border"
                    }`}
                    onClick={() => {
                      setSelectedVoiceId(voice.voice_id);
                      setSelectedVoiceName(voice.name);
                      setSelectedVoiceProvider('elevenlabs');
                    }}
                    data-testid={`voice-option-el-${voice.voice_id}`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : gender.toLowerCase() === 'female'
                        ? "bg-pink-100 dark:bg-pink-900/30 text-pink-600"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                    }`}>
                      {isSelected ? <Check className="h-3 w-3" /> : voice.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium truncate block">{voice.name}</span>
                      <span className="text-[9px] text-muted-foreground truncate block">
                        {[gender, accent, description].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <button
                      className={`h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0 ${
                        previewingVoiceId === voice.voice_id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent text-muted-foreground"
                      }`}
                      onClick={(e) => playElevenLabsPreview(voice.voice_id, voice.preview_url, e)}
                      data-testid={`button-preview-voice-el-${voice.voice_id}`}
                    >
                      {voicePreviewLoading && previewingVoiceId === voice.voice_id ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : previewingVoiceId === voice.voice_id ? (
                        <Square className="h-2 w-2" />
                      ) : (
                        <Volume2 className="h-2.5 w-2.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {selectedVoiceId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium">Selected: {selectedVoiceName}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
              {selectedVoiceProvider === 'elevenlabs' ? 'ElevenLabs' : 'AWS Polly'}
            </Badge>
          </div>
        )}

        {selectedVoiceId && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <Label className="font-medium text-sm">Agent Name *</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g., Sara, Alex, Jordan..."
                className="flex-1 h-9 text-sm"
                data-testid="input-agent-name"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 gap-1.5 flex-shrink-0"
                disabled={suggestingAgentName}
                onClick={async () => {
                  setSuggestingAgentName(true);
                  setAgentNameSuggestions([]);
                  try {
                    const template = flowTemplates.find(t => t.id === selectedTemplateId);
                    const pollyVoice = selectedVoiceProvider === 'polly' ? POLLY_VOICES.find(v => v.id === selectedVoiceId) : null;
                    const elVoice = selectedVoiceProvider === 'elevenlabs' ? elevenLabsVoices.find(v => v.voice_id === selectedVoiceId) : null;
                    const voiceGender = pollyVoice?.gender || elVoice?.labels?.gender || '';
                    const res = await apiRequest("POST", "/api/campaigns/suggest-agent-name", {
                      useCase: template?.name || '',
                      useCaseDescription: template?.description || '',
                      voiceName: selectedVoiceName,
                      voiceGender,
                      campaignName,
                      companyName: currentUser?.company || '',
                    });
                    const data = await res.json();
                    if (data.suggestions?.length) {
                      setAgentNameSuggestions(data.suggestions);
                    }
                  } catch (err) {
                    console.error("Failed to suggest agent names:", err);
                  } finally {
                    setSuggestingAgentName(false);
                  }
                }}
                data-testid="button-suggest-agent-name"
              >
                {suggestingAgentName ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">Suggest</span>
              </Button>
            </div>
            {agentNameSuggestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Suggestions:</span>
                {agentNameSuggestions.map((name) => (
                  <button
                    key={name}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      agentName === name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted border-border hover:border-primary/40"
                    }`}
                    onClick={() => setAgentName(name)}
                    data-testid={`button-agent-suggestion-${name}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">This is the name your AI agent will use when introducing itself on calls.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4" data-testid="outbound-step-5">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Knowledge & Script</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Configure knowledge base and call script</p>
      </div>

      {generateAllContentMutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800" data-testid="status-generating-content">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          <span className="text-sm text-violet-700 dark:text-violet-400 font-medium">Generating personalized content...</span>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-cyan-600" />
            <Label className="font-medium text-sm">Knowledge Base</Label>
            <Badge variant="outline" className="text-[10px] ml-auto bg-green-500/10 text-green-600 border-green-500/20">
              {knowledgeBases.length > 0 ? `${knowledgeBases.length} auto-included` : 'None available'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            All your knowledge base articles are automatically used as background information during calls.
          </p>

          {kbLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : knowledgeBases.length === 0 ? (
            <div className="text-center py-4 border-2 border-dashed rounded-lg">
              <BookOpen className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No knowledge bases yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Import a URL below to add reference material.</p>
            </div>
          ) : (
            <div className="bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                    {knowledgeBases.length} knowledge base article{knowledgeBases.length !== 1 ? 's' : ''} will be used automatically
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-indigo-600" />
            <Label className="font-medium text-sm">Import Reference URL</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste a website URL to scrape its content and add it to your knowledge base.
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://example.com/product-info"
              className="h-9 text-sm flex-1"
              data-testid="input-reference-url"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3"
              onClick={() => referenceUrl.trim() && importUrlMutation.mutate(referenceUrl.trim())}
              disabled={!referenceUrl.trim() || importUrlMutation.isPending}
              data-testid="button-import-url"
            >
              {importUrlMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            <Label className="font-medium text-sm">Product / Service (Optional)</Label>
          </div>
          <Input
            value={productOrService}
            onChange={(e) => setProductOrService(e.target.value)}
            placeholder="e.g. Cloud-based CRM solution for small businesses"
            className="text-sm"
            data-testid="input-product-service"
          />
          <p className="text-xs text-muted-foreground">
            Describe what you're offering. This helps generate more targeted scripts.
          </p>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-600" />
              <Label className="font-medium text-sm">AI-Powered Personalization</Label>
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              onClick={() => generateAllContentMutation.mutate()}
              disabled={generateAllContentMutation.isPending}
              data-testid="button-generate-all-content"
            >
              {generateAllContentMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generates a personalized greeting, call script, and system prompt using your use case, contact data, and product info. Template variables like <code className="bg-muted px-1 rounded text-[10px]">{"{{firstName}}"}</code> are replaced with real contact data per call.
          </p>
          {personalizationVars.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Variables:</span>
              {personalizationVars.map((v) => (
                <Badge key={v} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <Label className="font-medium text-sm">Greeting Message</Label>
              {generateGreetingMutation.isPending && (
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 animate-pulse">
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                  Auto-generating...
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => generateGreetingMutation.mutate()}
              disabled={generateGreetingMutation.isPending}
              data-testid="button-generate-greeting"
            >
              {generateGreetingMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Regenerate
            </Button>
          </div>
          <Input
            value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            placeholder={generateGreetingMutation.isPending ? "Generating greeting based on your use case..." : `e.g. ${getGreetingExample(selectedTemplateId ? categorizeTemplate(selectedTemplateId) : '', selectedTemplateId)}`}
            className="text-sm"
            data-testid="input-greeting-message"
          />
          <p className="text-xs text-muted-foreground">
            Auto-generated based on your use case. Use <code className="bg-muted px-1 rounded text-[10px]">{"{{firstName}}"}</code>, <code className="bg-muted px-1 rounded text-[10px]">{"{{company}}"}</code> etc. for per-contact personalization.
          </p>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label className="font-medium text-sm">Call Script / System Prompt</Label>
          <Textarea
            value={callScript}
            onChange={(e) => setCallScript(e.target.value)}
            placeholder="Step 1: Greet {{firstName}} warmly and introduce yourself...&#10;Step 2: Ask about their current {{industry}} challenges..."
            className="min-h-[120px] text-sm"
            data-testid="textarea-call-script"
          />
          <p className="text-xs text-muted-foreground">
            {selectedFlowTemplate
              ? `Pre-filled from "${selectedFlowTemplate.name}" template. Edit as needed. Use {{variable}} placeholders for contact-specific data.`
              : "This prompt guides the AI agent's behavior. Use {{variable}} placeholders for per-contact personalization."}
          </p>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              <Label className="font-medium">Quick Add Templates</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              data-testid="button-toggle-templates"
            >
              <LayoutTemplate className="h-3.5 w-3.5 mr-1" />
              {showTemplates ? "Hide" : "Browse"}
            </Button>
          </div>

          {showTemplates && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-9 h-8 text-sm"
                    data-testid="input-template-search"
                  />
                </div>
                <Select value={selectedTemplateCategory} onValueChange={setSelectedTemplateCategory}>
                  <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="select-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-y-auto max-h-[240px]">
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="glass-card cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => applyFormTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex items-center justify-center h-7 w-7 rounded flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30">
                            <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                                {template.category}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{template.fields.length} fields</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {filteredTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No templates match your search
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <Label className="font-medium">Attach Form (Optional)</Label>
            </div>
            {selectedTemplateId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => suggestFormMutation.mutate()}
                disabled={suggestFormMutation.isPending}
                data-testid="button-suggest-form"
              >
                {suggestFormMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                {suggestFormMutation.isPending ? "Generating..." : "Suggest Form"}
              </Button>
            )}
          </div>

          {formsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-3 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              <FileText className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
              <p className="text-xs">No forms available.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[160px]">
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                {forms.map((form) => {
                  const isSelected = selectedFormId === form.id;
                  return (
                    <Card
                      key={form.id}
                      className={`glass-card cursor-pointer transition-colors ${
                        isSelected ? "border-emerald-500 bg-emerald-500/5" : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedFormId(isSelected ? null : form.id)}
                      data-testid={`card-form-${form.id}`}
                    >
                      <CardContent className="p-2.5 flex items-center gap-2.5">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-md flex-shrink-0 ${
                          isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 dark:bg-emerald-900/30"
                        }`}>
                          {isSelected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{form.name}</div>
                          {form.description && (
                            <p className="text-xs text-muted-foreground truncate">{form.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-4" data-testid="outbound-step-6">
      <div className="text-center mb-1">
        <h2 className="text-sm sm:text-base font-semibold">Review & Launch</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">Review your campaign before launching</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="space-y-2">
          <Label className="font-medium text-sm">Campaign Name *</Label>
          <Input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g., Q1 Sales Follow-up, Product Launch Calls..."
            data-testid="input-campaign-name"
          />
        </div>

        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {selectedFlowTemplate && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Use Case</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-auto"
                    onClick={() => setCurrentStep(1)}
                    data-testid="button-edit-usecase-review"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {selectedFlowTemplate.name}
                </Badge>
              </div>
            )}

            <div className={selectedFlowTemplate ? "border-t pt-3" : ""}>
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-4 w-4 text-violet-600" />
                <span className="font-medium text-sm">Contacts ({selectedContacts.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-auto"
                  onClick={() => setCurrentStep(2)}
                  data-testid="button-edit-contacts-review"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedContacts.slice(0, 5).map((contact) => {
                  const name = contact.names?.[0]
                    ? `${contact.names[0].firstName} ${contact.names[0].lastName || ""}`.trim()
                    : contact.phone;
                  return (
                    <Badge key={contact.id} variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400 text-[10px]">
                      {name}
                    </Badge>
                  );
                })}
                {selectedContacts.length > 5 && (
                  <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400 text-[10px]">
                    +{selectedContacts.length - 5} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Phone className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Caller ID</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-auto"
                  onClick={() => setCurrentStep(3)}
                  data-testid="button-edit-phone-review"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              {selectedPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{selectedPhone.phoneNumber}</span>
                  {selectedPhone.numberType && <span className="text-xs text-muted-foreground capitalize">({selectedPhone.numberType})</span>}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AudioWaveform className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Voice & Agent</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-auto"
                  onClick={() => setCurrentStep(4)}
                  data-testid="button-edit-voice-review"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              {selectedVoiceId && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium">{agentName || 'Unnamed Agent'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AudioWaveform className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{selectedVoiceName}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${
                      selectedVoiceProvider === 'polly'
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    }`}>
                      {selectedVoiceProvider === 'polly' ? 'AWS Polly' : 'ElevenLabs'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {knowledgeBases.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-cyan-600" />
                  <span className="font-medium text-sm">Knowledge Base</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20">
                    {knowledgeBases.length} auto-included
                  </Badge>
                </div>
              </div>
            )}

            {greetingMessage && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Greeting Message</span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-2.5 text-xs italic" data-testid="text-review-greeting">
                  "{greetingMessage}"
                </div>
              </div>
            )}

            {callScript && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Call Script</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setExpandedScript(!expandedScript)}
                    data-testid="button-expand-script"
                  >
                    {expandedScript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                <div className={`bg-muted rounded-md p-2.5 text-xs ${expandedScript ? "max-h-[300px]" : "max-h-[80px]"} overflow-y-auto`}>
                  {expandedScript ? callScript : (callScript.slice(0, 200) + (callScript.length > 200 ? "..." : ""))}
                </div>
              </div>
            )}

            {selectedForm && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-sm">Form</span>
                </div>
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400 text-[10px]">
                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                  {selectedForm.name}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedVoiceProvider === 'polly' && (
          <div className="bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/15 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <span className="font-medium text-orange-700 dark:text-orange-400">Performance Tips</span>
                <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>SSML Humanizer adds natural prosody and pauses automatically</li>
                  <li>Neural engine delivers low-latency responses with high voice quality</li>
                  <li>Streaming audio reduces perceived wait time</li>
                  {selectedKnowledgeBaseIds.length > 0 && (
                    <li>RAG retrieval adds ~100ms — preload for faster responses</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          Launching <span className="font-medium text-foreground">"{campaignName || "..."}"</span> —{" "}
          {selectedContactIds.length} contact(s) with <span className="font-medium text-foreground">{selectedVoiceName || "..."}</span> voice{" "}
          from <span className="font-medium text-foreground">{selectedPhone?.phoneNumber}</span>.
          {selectedKnowledgeBaseIds.length > 0 && ` ${selectedKnowledgeBaseIds.length} knowledge base(s) connected.`}
          {callScript ? " Custom script applied." : ""}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col relative -m-6 overflow-hidden" style={{ width: 'calc(100% + 3rem)', height: 'calc(100dvh - env(safe-area-inset-bottom, 0px) - 48px)' }}>
      <div className="flex items-center px-2 sm:px-3 py-1.5 border-b glass-surface gap-1.5 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 flex-shrink-0" onClick={() => setLocation("/app/campaigns")} data-testid="button-back">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1 text-xs">Back</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold flex items-center gap-1 text-xs sm:text-sm truncate">
            <PhoneOutgoing className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            New Outbound Campaign
          </h1>
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 sm:hidden">
          {currentStep}/6
        </span>
      </div>

      <div className="flex-shrink-0">
        {renderStepIndicator()}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="px-2.5 sm:px-3 py-2 pb-6 sm:pb-3">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
          {currentStep === 6 && renderStep6()}
        </div>
      </div>

      <div className="flex items-center justify-between px-2 sm:px-3 py-2.5 sm:py-1.5 border-t glass-surface gap-2 flex-shrink-0 safe-area-bottom" style={{ minHeight: '52px' }}>
        <Button
          variant="outline"
          size="sm"
          className="h-10 sm:h-8 px-4 sm:px-2.5 text-sm sm:text-xs flex-shrink-0"
          onClick={() => {
            if (currentStep === 1) {
              setLocation("/app/campaigns");
            } else {
              goBack();
            }
          }}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="hidden sm:block flex-1 min-w-0 text-center">
          <span className="text-xs text-muted-foreground truncate">{getContextLine()}</span>
        </div>

        <Button
          size="sm"
          className="h-10 sm:h-8 px-5 sm:px-4 text-sm sm:text-xs flex-shrink-0"
          onClick={currentStep < 6 ? goNext : () => saveMutation.mutate()}
          disabled={currentStep < 6 ? !canProceed(currentStep) : (saveMutation.isPending || !campaignName.trim() || !selectedVoiceId || !selectedPhoneId || selectedContactIds.length === 0)}
          data-testid={currentStep < 6 ? "button-wizard-next" : "button-wizard-save"}
        >
          {currentStep < 6 ? (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          ) : saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-1" />
              Launch
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function OutboundCanvas() {
  return <OutboundWizard />;
}
