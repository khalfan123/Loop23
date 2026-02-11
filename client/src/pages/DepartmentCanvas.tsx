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
  voiceTone: string | null;
  category: string | null;
}

interface LanguageAgent {
  id: string;
  language: string;
  agentId: string | null;
  agentName: string | null;
  systemPrompt: string | null;
  voiceId: string | null;
  voiceTone: string | null;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
];

const VOICE_PREVIEWS: Record<string, string> = {
  alloy: "https://cdn.openai.com/API/docs/audio/alloy.wav",
  echo: "https://cdn.openai.com/API/docs/audio/echo.wav",
  shimmer: "https://cdn.openai.com/API/docs/audio/shimmer.wav",
  ash: "https://cdn.openai.com/API/docs/audio/ash.wav",
  ballad: "https://cdn.openai.com/API/docs/audio/ballad.wav",
  coral: "https://cdn.openai.com/API/docs/audio/coral.wav",
  sage: "https://cdn.openai.com/API/docs/audio/sage.wav",
  verse: "https://cdn.openai.com/API/docs/audio/verse.wav",
  nova: "https://cdn.openai.com/API/docs/audio/nova.wav",
};

const isElevenLabsVoice = (voiceId: string) => voiceId.startsWith("el_");

const OPENAI_VOICES = [
  { id: "alloy", name: "Alloy (OpenAI)", gender: "neutral", style: "balanced", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "echo", name: "Echo (OpenAI)", gender: "male", style: "warm", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "shimmer", name: "Shimmer (OpenAI)", gender: "female", style: "friendly", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "ash", name: "Ash (OpenAI)", gender: "male", style: "professional", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "coral", name: "Coral (OpenAI)", gender: "female", style: "warm", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "sage", name: "Sage (OpenAI)", gender: "neutral", style: "calm", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "verse", name: "Verse (OpenAI)", gender: "male", style: "expressive", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
  { id: "nova", name: "Nova (OpenAI)", gender: "female", style: "warm", languages: ["en", "fr", "it", "zh", "hi", "ar"] },
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

const ALL_IVR_VOICES = [...OPENAI_VOICES, ...ELEVENLABS_VOICES];

const getVoicesForLanguage = (languageCode: string) => {
  return ALL_IVR_VOICES.filter(voice => voice.languages.includes(languageCode));
};

const getDefaultVoiceForLanguage = (langCode: string) => {
  const voices = getVoicesForLanguage(langCode);
  const elevenLabsVoice = voices.find(v => v.id.startsWith("el_"));
  if (elevenLabsVoice) return elevenLabsVoice.id;
  return voices[0]?.id || "nova";
};

const DEFAULT_GREETINGS: Record<string, string> = {
  en: "Thank you for calling. How may I assist you today?",
  fr: "Merci d'avoir appelé. Comment puis-je vous aider aujourd'hui?",
  it: "Grazie per aver chiamato. Come posso aiutarla oggi?",
  zh: "感谢您的来电。今天我能为您做些什么？",
  hi: "कॉल करने के लिए धन्यवाद। आज मैं आपकी कैसे मदद कर सकता हूं?",
  ar: "شكرا على اتصالك. كيف يمكنني مساعدتك اليوم؟",
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
  fr: { prefix: "Pour le", pressKey: "appuyez sur", separator: ", " },
  it: { prefix: "Per", pressKey: "premere", separator: ", " },
  zh: { prefix: "如需", pressKey: "请按", separator: "，" },
  hi: { prefix: "के लिए", pressKey: "दबाएं", separator: ", " },
  ar: { prefix: "لقسم", pressKey: "اضغط", separator: "، " },
};

const DEPT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: { Sales: "Sales", Support: "Customer Support", Scheduling: "Scheduling" },
  fr: { Sales: "service commercial", Support: "service client", Scheduling: "prise de rendez-vous" },
  it: { Sales: "reparto vendite", Support: "assistenza clienti", Scheduling: "prenotazioni" },
  zh: { Sales: "销售部门", Support: "客户支持", Scheduling: "预约服务" },
  hi: { Sales: "बिक्री विभाग", Support: "ग्राहक सहायता", Scheduling: "अपॉइंटमेंट शेड्यूलिंग" },
  ar: { Sales: "المبيعات", Support: "خدمة العملاء", Scheduling: "المواعيد" },
};

const translateDeptName = (name: string, langCode: string): string => {
  const translations = DEPT_NAME_TRANSLATIONS[langCode];
  if (!translations) return name;
  return translations[name] || name;
};

const generateDeptGreeting = (deptNames: string[], langCode: string): string => {
  const template = DEPT_MENU_TEMPLATES[langCode] || DEPT_MENU_TEMPLATES.en;
  if (deptNames.length === 0) return DEFAULT_GREETINGS[langCode] || DEFAULT_GREETINGS.en;
  
  const menuItems = deptNames.map((name, idx) => {
    const translatedName = translateDeptName(name, langCode);
    if (langCode === "ar") {
      return `${template.prefix} ${translatedName} ${template.pressKey} ${idx + 1}`;
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
  type: "sales" | "support" | "scheduling" | "custom";
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
    name: "Sales",
    description: "Handle sales calls and demos",
    icon: ShoppingCart,
    color: "bg-green-500",
    defaultPrompt: "You are a professional sales representative. Help qualify leads, answer product questions, and schedule demos when appropriate.",
  },
  {
    type: "support" as const,
    name: "Support",
    description: "Customer support and issues",
    icon: Headphones,
    color: "bg-blue-500",
    defaultPrompt: "You are a helpful customer support agent. Assist customers with their issues, answer FAQs, and escalate complex problems when needed.",
  },
  {
    type: "scheduling" as const,
    name: "Scheduling",
    description: "Book appointments",
    icon: Calendar,
    color: "bg-purple-500",
    defaultPrompt: "You are an appointment scheduling assistant. Help callers book, reschedule, or cancel appointments efficiently.",
  },
];

const WIZARD_STEPS = [
  { id: 1, title: "Phone Numbers", icon: Phone },
  { id: 2, title: "Departments", icon: Building2 },
  { id: 3, title: "IVR Router", icon: GitBranch },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-6" data-testid="step-indicator">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
                data-testid={`step-circle-${step.id}`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div
                className={`w-16 md:w-24 h-0.5 mx-2 mb-5 ${
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
        <h2 className="text-xl font-semibold" data-testid="text-step1-title">Select Phone Numbers</h2>
        <p className="text-sm text-muted-foreground mt-1">
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
}: {
  dept: CanvasDepartment;
  agents: Agent[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CanvasDepartment>) => void;
  onDelete: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("auto");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    custom: Building2,
  };
  const Icon = icons[dept.type] || Building2;

  const deptTypeToDefaultCategory: Record<string, string> = {
    sales: "sales",
    support: "support",
    scheduling: "appointment",
    custom: "all",
  };

  const AGENT_CATEGORIES = [
    { value: "all", label: "All Categories" },
    { value: "sales", label: "Sales" },
    { value: "support", label: "Support" },
    { value: "appointment", label: "Appointment" },
    { value: "survey", label: "Survey" },
    { value: "general", label: "General" },
  ];

  const effectiveCategory = categoryFilter === "auto"
    ? (deptTypeToDefaultCategory[dept.type] || "all")
    : categoryFilter;

  const getAgentsForLanguage = (langCode: string) => {
    return agents.filter((agent) => {
      const agentLang = (agent.language || "en").toLowerCase();
      const agentCategory = (agent.category || "general").toLowerCase();
      const langMatch = agentLang === langCode.toLowerCase();
      const categoryMatch = effectiveCategory === "all" || agentCategory === effectiveCategory;
      return langMatch && categoryMatch;
    });
  };

  const addLanguageAgent = () => {
    const usedLangs = languageAgents.map((la) => la.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;

    const newLangAgent: LanguageAgent = {
      id: `la-${Date.now()}`,
      language: availableLang.code,
      agentId: null,
      agentName: null,
      systemPrompt: null,
      voiceId: null,
      voiceTone: null,
    };

    onUpdate({ languageAgents: [...languageAgents, newLangAgent] });
    setActiveTabIdx(languageAgents.length);
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

  const handleSelectAgent = (langAgentId: string, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
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

  const handlePlayVoice = async (voiceId: string) => {
    if (!audioRef.current) return;

    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    if (isElevenLabsVoice(voiceId)) {
      setPlayingVoiceId(voiceId);
      return;
    }

    const previewUrl = VOICE_PREVIEWS[voiceId];
    if (!previewUrl) return;

    audioRef.current.src = previewUrl;
    audioRef.current.play();
    setPlayingVoiceId(voiceId);
    audioRef.current.onended = () => setPlayingVoiceId(null);
    audioRef.current.onerror = () => setPlayingVoiceId(null);
  };

  const activeLangAgent = languageAgents[activeTabIdx];
  const availableAgentsForActive = activeLangAgent ? getAgentsForLanguage(activeLangAgent.language) : [];

  return (
    <Card data-testid={`card-dept-${dept.id}`}>
      <div
        className="flex items-center justify-between gap-3 p-4 cursor-pointer"
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
        <CardContent className="px-4 pb-4 pt-0 space-y-4 border-t">
          <div className="pt-4">
            <Label>Department Name</Label>
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
              <Button
                variant="outline"
                size="sm"
                onClick={addLanguageAgent}
                disabled={languageAgents.length >= SUPPORTED_LANGUAGES.length}
                data-testid="button-add-language"
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
                    data-testid={`badge-lang-${la.language}`}
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
            <div className="p-4 space-y-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Agent Name</Label>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">Category:</Label>
                    <Select
                      value={categoryFilter}
                      onValueChange={(val) => setCategoryFilter(val)}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs" data-testid="select-category-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          Auto ({deptTypeToDefaultCategory[dept.type] || "all"})
                        </SelectItem>
                        {AGENT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {availableAgentsForActive.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1.5">
                    No {effectiveCategory !== "all" ? effectiveCategory + " " : ""}agents configured for {SUPPORTED_LANGUAGES.find((l) => l.code === activeLangAgent.language)?.label}
                  </p>
                ) : (
                  <Select
                    value={activeLangAgent.agentId || ""}
                    onValueChange={(val) => handleSelectAgent(activeLangAgent.id, val)}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-agent-name">
                      <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgentsForActive.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <span>{agent.name}</span>
                            <span className="text-xs text-muted-foreground">({agent.category || "general"})</span>
                          </div>
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
                  data-testid="input-agent-prompt"
                />
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
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">OpenAI Voices</div>
                          {getVoicesForLanguage(activeLangAgent.language)
                            .filter(v => !v.id.startsWith("el_"))
                            .map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} - {voice.gender}, {voice.style}
                              </SelectItem>
                            ))}
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">ElevenLabs Voices</div>
                          {getVoicesForLanguage(activeLangAgent.language)
                            .filter(v => v.id.startsWith("el_"))
                            .map((voice) => (
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

              <div className="grid grid-cols-2 gap-3">
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
            <Label className="text-sm font-medium">Agent Features</Label>
            <div className="space-y-3 mt-3">
              <div className="p-3 space-y-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PhoneForwarded className="h-4 w-4 text-blue-500" />
                    <div>
                      <Label className="text-sm">Enable Call Transfer</Label>
                      <p className="text-xs text-muted-foreground">Transfer to human operators</p>
                    </div>
                  </div>
                  <Switch
                    checked={dept.enableTransfer}
                    onCheckedChange={(val) => onUpdate({ enableTransfer: val })}
                    data-testid="switch-dept-transfer"
                  />
                </div>
                {dept.enableTransfer && (
                  <div className="space-y-2 pl-6 border-l-2 border-blue-200">
                    <div>
                      <Label className="text-xs">Transfer Number</Label>
                      <Input
                        value={dept.transferNumber || ""}
                        onChange={(e) => onUpdate({ transferNumber: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        className="mt-1"
                        data-testid="input-transfer-number"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Transfer Message</Label>
                      <Input
                        value={dept.transferMessage || ""}
                        onChange={(e) => onUpdate({ transferMessage: e.target.value })}
                        placeholder="Please hold while I transfer you..."
                        className="mt-1"
                        data-testid="input-transfer-message"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-green-500" />
                    <div>
                      <Label className="text-sm">Enable Language Detection</Label>
                      <p className="text-xs text-muted-foreground">Auto-detect caller's language (99 languages)</p>
                    </div>
                  </div>
                  <Switch
                    checked={dept.enableLanguageDetection}
                    onCheckedChange={(val) => onUpdate({ enableLanguageDetection: val })}
                    data-testid="switch-lang-detection"
                  />
                </div>
                {dept.enableLanguageDetection && (
                  <div className="pl-6 border-l-2 border-green-200">
                    <p className="text-xs text-muted-foreground">
                      AI will automatically detect the caller's language and respond accordingly.
                      Supports 99 languages including English, Spanish, French, German, Chinese, Japanese, Arabic, Hindi, and more.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PhoneOff className="h-4 w-4 text-orange-500" />
                    <div>
                      <Label className="text-sm">Enable End Conversation</Label>
                      <p className="text-xs text-muted-foreground">Intelligently end calls when appropriate</p>
                    </div>
                  </div>
                  <Switch
                    checked={dept.enableEndConversation}
                    onCheckedChange={(val) => onUpdate({ enableEndConversation: val })}
                    data-testid="switch-end-conversation"
                  />
                </div>
                {dept.enableEndConversation && (
                  <div className="pl-6 border-l-2 border-orange-200">
                    <Label className="text-xs">End Conversation Triggers</Label>
                    <Textarea
                      value={(dept.endConversationPhrases || ["goodbye", "thank you for calling", "have a nice day"]).join("\n")}
                      onChange={(e) => onUpdate({
                        endConversationPhrases: e.target.value.split("\n").filter(p => p.trim())
                      })}
                      placeholder={"goodbye\nthank you\nhave a nice day"}
                      rows={3}
                      className="mt-1 text-xs"
                      data-testid="input-end-phrases"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">One phrase per line</p>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-purple-500" />
                    <div>
                      <Label className="text-sm">Enable Appointment Booking</Label>
                      <p className="text-xs text-muted-foreground">Book appointments during calls</p>
                    </div>
                  </div>
                  <Switch
                    checked={dept.enableAppointmentBooking}
                    onCheckedChange={(val) => onUpdate({ enableAppointmentBooking: val })}
                    data-testid="switch-appointment"
                  />
                </div>
                {dept.enableAppointmentBooking && (
                  <div className="space-y-2 pl-6 border-l-2 border-purple-200">
                    <div>
                      <Label className="text-xs">Calendar/Booking URL</Label>
                      <Input
                        value={dept.calendarUrl || ""}
                        onChange={(e) => onUpdate({ calendarUrl: e.target.value })}
                        placeholder="https://calendly.com/your-calendar"
                        className="mt-1"
                        data-testid="input-calendar-url"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Booking Instructions</Label>
                      <Textarea
                        value={dept.bookingInstructions || ""}
                        onChange={(e) => onUpdate({ bookingInstructions: e.target.value })}
                        placeholder="Collect name, email, preferred date/time, and reason for appointment..."
                        rows={2}
                        className="mt-1 text-xs"
                        data-testid="input-booking-instructions"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-red-500" />
                    <div>
                      <Label className="text-sm">Enable Call Recording</Label>
                      <p className="text-xs text-muted-foreground">Record for quality and training</p>
                    </div>
                  </div>
                  <Switch
                    checked={dept.enableRecording}
                    onCheckedChange={(val) => onUpdate({ enableRecording: val })}
                    data-testid="switch-dept-recording"
                  />
                </div>
                {dept.enableRecording && (
                  <div className="pl-6 border-l-2 border-red-200">
                    <p className="text-xs text-muted-foreground">
                      Calls will be recorded and stored securely. A disclosure message will be played at the start of each call.
                    </p>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      Recording disclosure enabled
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              data-testid="button-delete-dept"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Department
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
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addDepartment = (template: typeof departmentTemplates[0] | { type: "custom"; name: string }) => {
    const defaultPrompt = template.type !== "custom" ? (template as any).defaultPrompt : "";
    const newDeptId = `dept-${Date.now()}`;
    const newDept: CanvasDepartment = {
      id: newDeptId,
      type: template.type as any,
      name: template.name,
      description: template.type === "custom" ? "Custom department" : (template as any).description || "",
      languageAgents: [{
        id: `la-${Date.now()}`,
        language: "en",
        agentId: null,
        agentName: null,
        systemPrompt: defaultPrompt,
        voiceId: null,
        voiceTone: null,
      }],
      enableTransfer: true,
      enableRecording: true,
      enableLanguageDetection: true,
      enableEndConversation: true,
      endConversationPhrases: ["goodbye", "thank you for calling", "have a nice day"],
      enableAppointmentBooking: true,
    };

    setCanvasDepartments((prev) => [...prev, newDept]);
    setExpandedDeptIds((prev) => {
      const next = new Set(Array.from(prev));
      next.add(newDeptId);
      return next;
    });

    toast({
      title: "Department Added",
      description: `${template.name} department created`,
    });
  };

  const updateDepartment = (deptId: string, updates: Partial<CanvasDepartment>) => {
    setCanvasDepartments((prev) =>
      prev.map((dept) => (dept.id === deptId ? { ...dept, ...updates } : dept))
    );
  };

  const deleteDepartment = (deptId: string) => {
    setCanvasDepartments((prev) => prev.filter((d) => d.id !== deptId));
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      next.delete(deptId);
      return next;
    });
    toast({
      title: "Department Removed",
      description: "Department has been deleted",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-step2-title">Configure Departments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add departments and assign AI agents for each language
        </p>
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
          Quick Add Templates
        </Label>
        <div className="flex flex-wrap gap-2">
          {departmentTemplates.map((template) => (
            <Button
              key={template.type}
              variant="outline"
              size="sm"
              onClick={() => addDepartment(template)}
              data-testid={`button-add-dept-${template.type}`}
            >
              <template.icon className="h-3.5 w-3.5 mr-1.5" />
              {template.name}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Input
            placeholder="Custom department name..."
            value={customDeptName}
            onChange={(e) => setCustomDeptName(e.target.value)}
            className="text-sm"
            data-testid="input-custom-dept"
          />
          <Button
            variant="outline"
            size="sm"
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
            Add
          </Button>
        </div>
      </div>

      {canvasDepartments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No departments added yet</p>
          <p className="text-xs mt-1">Use the templates above or add a custom department</p>
        </div>
      ) : (
        <div className="space-y-3">
          {canvasDepartments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              agents={agents}
              isExpanded={expandedDeptIds.has(dept.id)}
              onToggleExpand={() => toggleExpand(dept.id)}
              onUpdate={(updates) => updateDepartment(dept.id, updates)}
              onDelete={() => deleteDepartment(dept.id)}
              toast={toast}
            />
          ))}
        </div>
      )}
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

  const deptNames = canvasDepartments.map(d => d.name || "Department");
  const deptNamesKey = deptNames.join("||");

  useEffect(() => {
    if (canvasDepartments.length === 0) return;
    const updatedOptions = languageOptions.map((opt) => {
      if (customizedDeptGreetings.current.has(opt.id)) return opt;
      return {
        ...opt,
        greeting: generateDeptGreeting(deptNames, opt.language),
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
    const allDeptNames = canvasDepartments.map(d => d.name || "Department");

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
            customizedDeptGreetings.current.delete(id);
            if (canvasDepartments.length > 0) {
              updated.greeting = generateDeptGreeting(deptNames, updates.language);
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

    if (text) {
      try {
        setPlayingVoiceId(voiceId);
        const response = await apiRequest("POST", "/api/departments/voice-preview", { voiceId, text });

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
      return;
    }

    const previewUrl = VOICE_PREVIEWS[voiceId];
    if (!previewUrl) {
      toast({ title: "Preview not available", description: "No preview available for this voice", variant: "destructive" });
      return;
    }

    audioRef.current.src = previewUrl;
    audioRef.current.play();
    setPlayingVoiceId(voiceId);
    audioRef.current.onended = () => setPlayingVoiceId(null);
    audioRef.current.onerror = () => setPlayingVoiceId(null);
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
        <h2 className="text-xl font-semibold" data-testid="text-step3-title">IVR Router Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">
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
                  <div key={opt.id} className="p-4 border rounded-lg space-y-3">
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
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">OpenAI Voices</div>
                                {getVoicesForLanguage(opt.language)
                                  .filter(v => v.id.startsWith("el_") === false)
                                  .map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                      {voice.name} - {voice.gender}, {voice.style}
                                    </SelectItem>
                                  ))}
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">ElevenLabs Voices</div>
                                {getVoicesForLanguage(opt.language)
                                  .filter(v => v.id.startsWith("el_"))
                                  .map((voice) => (
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
                        <Label className="text-xs text-muted-foreground">Department Menu Greeting</Label>
                        {customizedDeptGreetings.current.has(opt.id) && canvasDepartments.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              customizedDeptGreetings.current.delete(opt.id);
                              updateLanguageOption(opt.id, {
                                greeting: generateDeptGreeting(deptNames, opt.language),
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
                          Auto-generated from departments. Edit to customize.
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
            <div>
              <Label>Default Greeting Message</Label>
              <Textarea
                value={languageOptions[0]?.greeting || DEFAULT_GREETINGS.en}
                onChange={(e) => {
                  if (languageOptions.length === 0) {
                    setLanguageOptions([{
                      id: "default",
                      language: "en",
                      voiceId: "nova",
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
            <span className="text-muted-foreground">Departments</span>
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

export default function DepartmentCanvas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [canvasDepartments, setCanvasDepartments] = useState<CanvasDepartment[]>([]);
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "nova", greeting: DEFAULT_GREETINGS.en },
  ]);
  const [languageSelectionGreetingText, setLanguageSelectionGreetingText] = useState('');
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
        const deptResponse = await apiRequest("POST", "/api/departments", {
          name: dept.name,
          description: dept.description,
          icon: dept.type,
          color: dept.type === "sales" ? "#22c55e" : dept.type === "support" ? "#3b82f6" : dept.type === "scheduling" ? "#a855f7" : "#6b7280",
          isActive: true,
        });
        const deptResult = await deptResponse.json();
        canvasToDbIdMap.set(dept.id, deptResult.id);

        const langAgents = dept.languageAgents || [];
        for (let i = 0; i < langAgents.length; i++) {
          const la = langAgents[i];
          if (la.agentId) {
            await apiRequest("POST", `/api/departments/${deptResult.id}/agents`, {
              agentId: la.agentId,
              language: la.language || "en",
              isPrimary: i === 0,
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
          await apiRequest("POST", "/api/departments/ivr", {
            phoneNumberId: phone.id,
            name: "Auto Distribution",
            isActive: ivrEnabled,
            greetingMessage,
            menuOptions,
            languageOptions: multiLangEnabled ? languageOptions : undefined,
          });
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({
        title: "Configuration Saved",
        description: "All departments and routing have been created successfully.",
      });
      setLocation("/app/departments");
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
        title: "No Departments",
        description: "Please add at least one department.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="min-h-[80vh]">
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/app/departments")}
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
              isGreetingCustomized={isGreetingCustomized}
              companyDisplayName={companyDisplayName}
              canvasDepartments={canvasDepartments}
              selectedPhoneIds={selectedPhoneIds}
              toast={toast}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-8 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            data-testid="button-previous"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Previous
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
              Save & Deploy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
