import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import IncomingCallCanvas from "@/pages/IncomingCallCanvas";
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
  fr: { prefix: "Pour", pressKey: "appuyez sur", separator: ", " },
  it: { prefix: "Per", pressKey: "premere", separator: ", " },
  zh: { prefix: "如需", pressKey: "请按", separator: "，" },
  hi: { prefix: "के लिए", pressKey: "दबाएं", separator: ", " },
  ar: { prefix: "لـ", pressKey: "اضغط", separator: "، " },
};

const DEPT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  Sales: {
    en: "Sales", fr: "Ventes", it: "Vendite", zh: "销售", hi: "बिक्री", ar: "المبيعات"
  },
  Support: {
    en: "Support", fr: "Assistance", it: "Supporto", zh: "客服", hi: "सहायता", ar: "الدعم"
  },
  Scheduling: {
    en: "Scheduling", fr: "Planification", it: "Programmazione", zh: "预约", hi: "शेड्यूलिंग", ar: "الجدولة"
  },
  Billing: {
    en: "Billing", fr: "Facturation", it: "Fatturazione", zh: "账单", hi: "बिलिंग", ar: "الفواتير"
  },
  "Technical Support": {
    en: "Technical Support", fr: "Support Technique", it: "Supporto Tecnico", zh: "技术支持", hi: "तकनीकी सहायता", ar: "الدعم الفني"
  },
  "Customer Service": {
    en: "Customer Service", fr: "Service Client", it: "Servizio Clienti", zh: "客户服务", hi: "ग्राहक सेवा", ar: "خدمة العملاء"
  },
  Appointments: {
    en: "Appointments", fr: "Rendez-vous", it: "Appuntamenti", zh: "预约", hi: "अपॉइंटमेंट", ar: "المواعيد"
  },
  General: {
    en: "General", fr: "Général", it: "Generale", zh: "通用", hi: "सामान्य", ar: "عام"
  },
  Marketing: {
    en: "Marketing", fr: "Marketing", it: "Marketing", zh: "市场营销", hi: "मार्केटिंग", ar: "التسويق"
  },
  "Human Resources": {
    en: "Human Resources", fr: "Ressources Humaines", it: "Risorse Umane", zh: "人力资源", hi: "मानव संसाधन", ar: "الموارد البشرية"
  },
};

const translateDeptName = (name: string, langCode: string): string => {
  const translations = DEPT_NAME_TRANSLATIONS[name];
  if (translations && translations[langCode]) {
    return translations[langCode];
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

export default function DepartmentManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [activeTab, setActiveTab] = useState<"org-map" | "departments" | "incoming-connections">("org-map");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showIvrSettingsDialog, setShowIvrSettingsDialog] = useState(false);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    description: "",
    icon: "building-2",
    color: "#3b82f6",
  });
  
  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string; language: string; systemPrompt: string; voiceTone: string; voiceId: string }>({
    agentId: "",
    language: "en",
    systemPrompt: "",
    voiceTone: "",
    voiceId: "",
  });
  
  const [selectedPhoneForIvr, setSelectedPhoneForIvr] = useState<string>("");
  const [ivrName, setIvrName] = useState<string>("Auto Distribution");
  const [editingIvrName, setEditingIvrName] = useState<string | null>(null);
  const [editIvrNameValue, setEditIvrNameValue] = useState<string>("");
  
  const [ivrConfigOpen, setIvrConfigOpen] = useState(false);
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "nova", greeting: DEFAULT_GREETINGS.en }
  ]);
  const ivrAudioRef = useRef<HTMLAudioElement | null>(null);
  const [ivrPlayingVoiceId, setIvrPlayingVoiceId] = useState<string | null>(null);
  const [languageSelectionGreetingText, setLanguageSelectionGreetingText] = useState('');
  const isGreetingCustomized = useRef(false);
  
  const [languageAgents, setLanguageAgents] = useState<LanguageAgentConfig[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
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

  const { data: userProfile } = useQuery<{ company?: string; name?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    departments: Department[];
    totalDepartments: number;
    activeIvrCount: number;
    ivrConfigurations: IvrConfiguration[];
  }>({
    queryKey: ["/api/departments/stats/overview"],
  });

  const { data: phoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: departmentAgents, refetch: refetchDepartmentAgents } = useQuery<DepartmentAgent[]>({
    queryKey: ["/api/departments", selectedDepartment?.id, "agents"],
    enabled: !!selectedDepartment,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: typeof newDepartment) => {
      return apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setShowCreateDialog(false);
      setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
      toast({ title: "Department created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create department", variant: "destructive" });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      return apiRequest("PATCH", `/api/departments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setShowCreateDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Department updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update department", variant: "destructive" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setShowDeleteDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete department", variant: "destructive" });
    },
  });

  const deleteAllDepartmentsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/departments/all/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setShowDeleteAllDialog(false);
      toast({ title: "All departments deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete departments", variant: "destructive" });
    },
  });

  const addAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId, language, systemPrompt, voiceTone }: { departmentId: string; agentId: string; language: string; systemPrompt?: string; voiceTone?: string }) => {
      return apiRequest("POST", `/api/departments/${departmentId}/agents`, { agentId, language, systemPrompt, voiceTone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      refetchDepartmentAgents();
      setShowAddAgentDialog(false);
      setSelectedAgent({ agentId: "", language: "en", systemPrompt: "", voiceTone: "", voiceId: "" });
      toast({ title: "Agent added to department" });
    },
    onError: () => {
      toast({ title: "Failed to add agent", variant: "destructive" });
    },
  });

  const removeAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId }: { departmentId: string; agentId: string }) => {
      return apiRequest("DELETE", `/api/departments/${departmentId}/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      refetchDepartmentAgents();
      toast({ title: "Agent removed from department" });
    },
    onError: () => {
      toast({ title: "Failed to remove agent", variant: "destructive" });
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
      return apiRequest("POST", "/api/departments/ivr", {
        phoneNumberId: data.phoneNumberId,
        name: data.name,
        isActive: true,
        menuOptions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
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
      return apiRequest("PATCH", `/api/departments/ivr/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setEditingIvrName(null);
      setEditIvrNameValue("");
      toast({ title: "IVR configuration updated" });
    },
    onError: () => {
      toast({ title: "Failed to update IVR configuration", variant: "destructive" });
    },
  });

  const saveIvrConfigMutation = useMutation({
    mutationFn: async () => {
      const activeIvr = ivrConfigurations.find(i => i.isActive);
      if (!activeIvr) return;
      
      const greetingMessage = multiLangEnabled && languageOptions.length > 0
        ? languageSelectionGreetingText || generateDefaultLanguageSelectionGreeting()
        : languageOptions[0]?.greeting || DEFAULT_GREETINGS.en;
      
      return apiRequest("PATCH", `/api/departments/ivr/${activeIvr.id}`, {
        isActive: ivrEnabled,
        greetingMessage,
        languageOptions: multiLangEnabled ? languageOptions : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments/stats/overview"] });
      setIvrConfigOpen(false);
      toast({ title: "IVR configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save IVR configuration", variant: "destructive" });
    },
  });

  const generateFlowMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      const response = await apiRequest("POST", `/api/departments/${departmentId}/generate-flow`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
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
      setLocation(`/app/flows/${dept.flowId}`);
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
    const voices = getVoicesForLanguage(langCode);
    const elevenLabsVoice = voices.find(v => v.id.startsWith("el_"));
    if (elevenLabsVoice) return elevenLabsVoice.id;
    return voices[0]?.id || "nova";
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

  const handleIvrVoicePreview = async (voiceId: string, greetingText: string) => {
    if (!ivrAudioRef.current) return;
    
    if (ivrPlayingVoiceId === voiceId) {
      ivrAudioRef.current.pause();
      ivrAudioRef.current.currentTime = 0;
      setIvrPlayingVoiceId(null);
      return;
    }
    
    try {
      setIvrPlayingVoiceId(voiceId);
      const response = await apiRequest("POST", "/api/departments/voice-preview", { voiceId, text: greetingText });
      
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
      ivrAudioRef.current.play();
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
            variant: "destructive" 
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
      }
      if ((activeIvr as any).greetingMessage) {
        setLanguageSelectionGreetingText((activeIvr as any).greetingMessage);
        isGreetingCustomized.current = true;
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

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title="VIEWS">
        <SubPanelItem
          icon={<Network className="w-4 h-4" />}
          label="Org Map"
          isActive={activeTab === 'org-map'}
          onClick={() => setActiveTab('org-map')}
        />
        <SubPanelItem
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Departments"
          isActive={activeTab === 'departments'}
          badge={departments.length}
          onClick={() => setActiveTab('departments')}
        />
        <SubPanelItem
          icon={<PhoneIncoming className="w-4 h-4" />}
          label="Incoming Connections"
          isActive={activeTab === 'incoming-connections'}
          onClick={() => setActiveTab('incoming-connections')}
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
      subPanelHeader={<span className="font-medium text-sm">Department Management</span>}
    >
      <div className="flex flex-col h-[calc(100vh-120px)]" data-testid="department-management-page">
        {activeTab === 'org-map' && (
          <div className="space-y-6 p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-foreground" />
                <span className="font-medium">Call Center Organization</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteAllDialog(true)}
                  disabled={departments.length === 0}
                  data-testid="button-delete-all"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setLocation("/app/departments/canvas")}
                  data-testid="button-open-canvas"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Design Canvas
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedDepartment(null);
                    setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                    setShowCreateDialog(true);
                  }}
                  data-testid="button-setup-new"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Setup New Call Center
                </Button>
              </div>
            </div>
          <Card data-testid="call-center-org-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                <div>
                  <CardTitle className="text-lg">Call Center Organization</CardTitle>
                  <p className="text-sm text-muted-foreground">Visual map showing how calls flow through your departments</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowIvrSettingsDialog(true)}
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-4">
                {activePhoneNumber && (
                  <>
                    <div className="relative">
                      <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl flex items-center gap-3 shadow-lg">
                        <Phone className="h-5 w-5" />
                        <div>
                          <div className="font-semibold">{activePhoneNumber.phoneNumber}</div>
                          <div className="text-xs text-emerald-100">Inbound Number</div>
                        </div>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rotate-45" />
                    </div>
                    <div className="w-px h-6 bg-gradient-to-b from-emerald-500 to-blue-500" />
                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-4 py-2">
                      <PhoneIncoming className="h-4 w-4 mr-2" />
                      Caller Dials
                    </Badge>
                    <div className="w-px h-6 bg-gradient-to-b from-blue-500 to-amber-500" />
                    
                    {multiLangEnabled && languageOptions.length > 1 ? (
                      <Card className="border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 min-w-[300px]">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-amber-700 dark:text-amber-300">Language Selection</span>
                        </div>
                        <div className="text-sm text-amber-800 dark:text-amber-200 bg-white dark:bg-gray-800 rounded p-2 mb-2 italic">
                          <div className="flex items-center gap-1 mb-1">
                            <Volume2 className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="text-xs font-medium text-amber-600 not-italic">Greeting</span>
                          </div>
                          "{languageSelectionGreeting}"
                        </div>
                        <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-2">Then each option spoken in its native voice</p>
                        <div className="space-y-1 mb-3">
                          {languageOptions.map((opt, idx) => {
                            const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label;
                            const nativePrompt = LANGUAGE_SELECTION_PROMPTS[opt.language] || `For ${opt.language}`;
                            return (
                              <div key={opt.id} className="text-sm text-amber-800 dark:text-amber-200 bg-white dark:bg-gray-800 rounded p-2 flex items-center gap-2">
                                <span className="font-mono text-amber-600 font-semibold shrink-0">{idx + 1}</span>
                                <span className="italic flex-1">"{nativePrompt}, {idx + 1}"</span>
                                <Badge variant="outline" className="text-xs border-amber-400 shrink-0">
                                  <Volume2 className="h-3 w-3 mr-1" />
                                  {langLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    ) : (
                      <Card className="border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 min-w-[280px]">
                        <div className="flex items-center gap-2 mb-2">
                          <GitBranch className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-amber-700 dark:text-amber-300">IVR Menu</span>
                        </div>
                        <div className="text-sm text-amber-800 dark:text-amber-200 bg-white dark:bg-gray-800 rounded p-2 italic">
                          "{languageOptions[0]?.greeting || DEFAULT_GREETINGS.en}"
                        </div>
                      </Card>
                    )}
                    <div className="w-px h-6 bg-gradient-to-b from-amber-500 to-blue-500" />
                    
                    {multiLangEnabled && languageOptions.length > 1 && (
                      <>
                        <Card className="border-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 min-w-[300px]">
                          <div className="flex items-center gap-2 mb-3">
                            <GitBranch className="h-5 w-5 text-blue-600" />
                            <span className="font-semibold text-blue-700 dark:text-blue-300">Department Selection</span>
                          </div>
                          <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mb-2">Menu plays in the caller's selected language</p>
                          <div className="space-y-1 mb-2">
                            {departments.slice(0, 4).map((dept, idx) => (
                              <div key={dept.id} className="text-sm text-blue-800 dark:text-blue-200 bg-white dark:bg-gray-800 rounded p-2 flex items-center gap-2">
                                <span className="font-mono text-blue-600 font-semibold shrink-0">{idx + 1}</span>
                                <span className="flex-1">{dept.name}</span>
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                              </div>
                            ))}
                            {departments.length > 4 && (
                              <div className="text-xs text-blue-600 text-center">+{departments.length - 4} more</div>
                            )}
                          </div>
                        </Card>
                        <div className="w-px h-6 bg-gradient-to-b from-blue-500 to-purple-500" />
                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-4 py-2">
                          <Mic className="h-4 w-4 mr-2" />
                          Connected to AI Agent
                        </Badge>
                        <div className="w-px h-6 bg-gradient-to-b from-purple-500 to-border" />
                      </>
                    )}
                  </>
                )}
                
                {(unassignedPhones.length > 0 || !phoneNumbers || phoneNumbers.length === 0) && (
                  <Card 
                    className="w-64 border-dashed border-orange-300 cursor-pointer hover-elevate transition-all"
                    onClick={() => setShowIvrSettingsDialog(true)}
                    data-testid="unassigned-numbers-panel"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-orange-500" />
                          <CardTitle className="text-sm">Unassigned</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          {unassignedPhones.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 pt-0">
                      {unassignedPhones.length > 0 ? (
                        <>
                          {unassignedPhones.slice(0, 3).map((phone) => (
                            <div 
                              key={phone.id} 
                              className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors"
                              data-testid={`phone-item-${phone.id}`}
                            >
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-mono truncate">{phone.phoneNumber}</span>
                            </div>
                          ))}
                          {unassignedPhones.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              +{unassignedPhones.length - 3} more
                            </p>
                          )}
                          <p className="text-xs text-blue-500 text-center pt-2">Click to assign</p>
                        </>
                      ) : (
                        <Link href="/app/phone-numbers">
                          <Button variant="outline" size="sm" className="w-full text-xs" data-testid="button-buy-number">
                            <Plus className="h-3 w-3 mr-1" />
                            Buy Number
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                <div className="h-6 w-px bg-border" />
                
                <Card className="w-64" data-testid="ivr-panel">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GitBranch className="h-4 w-4 shrink-0" />
                        {editingIvrName && ivrConfigurations.length > 0 ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editIvrNameValue}
                              onChange={(e) => setEditIvrNameValue(e.target.value)}
                              className="h-6 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editIvrNameValue.trim()) {
                                  updateIvrMutation.mutate({ id: editingIvrName, name: editIvrNameValue });
                                } else if (e.key === "Escape") {
                                  setEditingIvrName(null);
                                  setEditIvrNameValue("");
                                }
                              }}
                              data-testid="input-edit-ivr-name"
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => {
                                if (editIvrNameValue.trim()) {
                                  updateIvrMutation.mutate({ id: editingIvrName, name: editIvrNameValue });
                                }
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <CardTitle 
                            className="text-sm cursor-pointer hover:text-primary truncate"
                            onClick={() => {
                              const activeIvr = ivrConfigurations.find(i => i.isActive);
                              if (activeIvr) {
                                setEditingIvrName(activeIvr.id);
                                setEditIvrNameValue(activeIvr.name || "Auto Distribution");
                              }
                            }}
                            data-testid="ivr-name-editable"
                          >
                            {ivrConfigurations.find(i => i.isActive)?.name || "Auto Distribution"}
                          </CardTitle>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {ivrConfigurations.filter(i => i.isActive).length} Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {activePhoneNumber && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{activePhoneNumber.phoneNumber}</span>
                        <Badge className="bg-green-500 text-xs">On</Badge>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {departments.slice(0, 2).map((dept, idx) => (
                        <Badge 
                          key={dept.id} 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: dept.color }}
                          data-testid={`dept-badge-${dept.id}`}
                        >
                          {dept.name}
                        </Badge>
                      ))}
                      {departments.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{departments.length - 2}</Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs mt-2"
                      onClick={() => {
                        const activeIvr = ivrConfigurations.find(i => i.isActive);
                        if (activeIvr) {
                          setIvrEnabled(activeIvr.isActive);
                          const savedLangOptions = activeIvr.languageOptions as LanguageOption[] | null;
                          if (savedLangOptions && savedLangOptions.length > 0) {
                            setMultiLangEnabled(savedLangOptions.length > 1);
                            setLanguageOptions(savedLangOptions);
                          } else {
                            setMultiLangEnabled(false);
                            setLanguageOptions([{
                              id: "default",
                              language: "en",
                              voiceId: "nova",
                              greeting: activeIvr.greetingMessage || DEFAULT_GREETINGS.en,
                            }]);
                          }
                        }
                        setIvrConfigOpen(true);
                      }}
                      data-testid="button-configure-ivr"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Configure IVR
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 inline mr-1" />
                Departments & AI Agents
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept, idx) => (
                  <DepartmentCard
                    key={dept.id}
                    department={dept}
                    index={idx + 1}
                    isExpanded={expandedDepartments.has(dept.id)}
                    onToggleExpand={() => toggleDepartmentExpanded(dept.id)}
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
                  />
                ))}
                
                <Card 
                  className="border-dashed hover-elevate cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
                  onClick={() => {
                    setSelectedDepartment(null);
                    setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                    setShowCreateDialog(true);
                  }}
                  data-testid="add-department-card"
                >
                  <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">Add Department</span>
                </Card>
              </div>
            </CardContent>
          </Card>
          
          {multiLangEnabled && languageOptions.length > 1 && departments.length > 0 && (
            <Card data-testid="auto-greetings-table">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Auto-Generated Department Greetings</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Greetings are automatically translated when you add a language
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Language</th>
                          <th className="px-4 py-3 text-left font-medium">Generated Greeting</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {languageOptions.map((opt) => {
                          const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label || opt.language;
                          return (
                            <tr key={opt.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{langLabel}</Badge>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-muted-foreground italic">"{opt.greeting}"</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activePhoneNumber && departments.length > 0 && (
            <Card data-testid="call-flow-preview">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Call Flow Preview</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Complete caller journey through your IVR system
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-600 font-semibold text-sm">1</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">Caller dials {activePhoneNumber.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">Call connects to your IVR system</p>
                    </div>
                  </div>
                  
                  {multiLangEnabled && languageOptions.length > 1 && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 font-semibold text-sm">2</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium">Language Selection Greeting & Options</p>
                        <div className="bg-muted/50 rounded p-2 mt-2 mb-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Volume2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Greeting plays first</span>
                          </div>
                          <p className="text-sm text-muted-foreground italic">
                            "{languageSelectionGreeting}"
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 mb-1">Then each option is spoken in its native voice</p>
                        <div className="space-y-1 mt-1">
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
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-semibold text-sm">{multiLangEnabled && languageOptions.length > 1 ? "3" : "2"}</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">Department Selection Plays</p>
                      {multiLangEnabled && languageOptions.length > 1 ? (
                        <>
                          <p className="text-xs text-muted-foreground mt-0.5">Department menu plays in the caller's selected language</p>
                          <div className="space-y-2 mt-2">
                            {languageOptions.map((opt) => {
                              const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label;
                              return (
                                <div key={opt.id} className="bg-muted/50 rounded p-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">{langLabel}</Badge>
                                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <div className="text-sm text-muted-foreground italic">"{opt.greeting}"</div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2 mt-1 italic">
                          "{languageOptions[0]?.greeting || generateDeptGreeting(departments.map(d => d.name), "en")}"
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {departments.map((dept, idx) => (
                          <Badge 
                            key={dept.id} 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: dept.color, color: dept.color }}
                          >
                            Press {idx + 1}: {dept.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-600 font-semibold text-sm">{multiLangEnabled && languageOptions.length > 1 ? "4" : "3"}</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">Connected to AI Agent</p>
                      <p className="text-sm text-muted-foreground">
                        Caller is connected to the department's AI agent in their selected language
                      </p>
                      {multiLangEnabled && languageOptions.length > 1 && departments.length > 0 && (
                        <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              AI Agents Created (Sample Preview)
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {departments.length * languageOptions.length} total
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {departments.slice(0, 2).flatMap(dept => 
                              languageOptions.slice(0, 2).map(opt => (
                                <Badge 
                                  key={`${dept.id}-${opt.language}`} 
                                  variant="outline" 
                                  className="text-xs justify-start"
                                >
                                  <Mic className="h-3 w-3 mr-1" />
                                  {dept.name} ({SUPPORTED_LANGUAGES.find(l => l.code === opt.language)?.label})
                                </Badge>
                              ))
                            )}
                            {(departments.length * languageOptions.length) > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(departments.length * languageOptions.length) - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-foreground" />
                <span className="font-medium">Departments</span>
              </div>
              <Button 
                onClick={() => {
                  setSelectedDepartment(null);
                  setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                  setShowCreateDialog(true);
                }}
                data-testid="button-add-department"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept, idx) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  index={idx + 1}
                  isExpanded={expandedDepartments.has(dept.id)}
                  onToggleExpand={() => toggleDepartmentExpanded(dept.id)}
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
                />
              ))}
              
              <Card 
                className="border-dashed hover-elevate cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
                onClick={() => {
                  setSelectedDepartment(null);
                  setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                  setShowCreateDialog(true);
                }}
                data-testid="add-department-card-tab"
              >
                <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">Add Department</span>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'incoming-connections' && (
          <div className="h-[calc(100vh-200px)]">
            <IncomingCallCanvas embedded={true} />
          </div>
        )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-department">
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment ? "Edit Department" : "Create New Department"}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartment 
                ? "Update your department settings" 
                : "Add a new department to your AI call center"}
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
                data-testid="input-department-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDepartment.description}
                onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                placeholder="What does this department handle?"
                data-testid="input-department-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select 
                  value={newDepartment.icon} 
                  onValueChange={(v) => setNewDepartment({ ...newDepartment, icon: v })}
                >
                  <SelectTrigger data-testid="select-icon">
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
                  <SelectTrigger data-testid="select-color">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOrUpdate}
              disabled={!newDepartment.name || createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              data-testid="button-save"
            >
              {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedDepartment ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAgentDialog} onOpenChange={setShowAddAgentDialog}>
        <DialogContent data-testid="dialog-add-agent">
          <DialogHeader>
            <DialogTitle>Add Agent to {selectedDepartment?.name}</DialogTitle>
            <DialogDescription>
              Assign an AI agent to handle calls for this department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select 
                value={selectedAgent.language} 
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, language: v, agentId: "" })}
              >
                <SelectTrigger data-testid="select-language">
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
                    data-testid={`agent-option-${agent.id}`}
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
                    const voice = OPENAI_VOICES.find(voice => voice.id === v);
                    setSelectedAgent({ 
                      ...selectedAgent, 
                      voiceId: v,
                      voiceTone: voice?.style || ""
                    });
                  }}
                >
                  <SelectTrigger className="flex-1" data-testid="select-voice">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_VOICES.map((voice) => (
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
                    onClick={() => handlePlayVoice(selectedAgent.voiceId)}
                    data-testid="button-preview-agent-voice"
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
              <Label>Voice Tone</Label>
              <Select
                value={selectedAgent.voiceTone}
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, voiceTone: v })}
              >
                <SelectTrigger data-testid="select-voice-tone">
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
                    const voice = OPENAI_VOICES.find(v => v.id === selectedAgent.voiceId);
                    const voiceStyle = voice?.style || "professional";
                    const autoPrompt = `You are a ${voiceStyle} AI assistant for the ${selectedDepartment?.name || "department"}. You speak ${lang} fluently and help callers with their inquiries. Be helpful, clear, and efficient in your responses. Always maintain a ${voiceStyle} tone throughout the conversation.`;
                    setSelectedAgent({ ...selectedAgent, systemPrompt: autoPrompt });
                  }}
                  data-testid="button-auto-prompt"
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
                data-testid="textarea-system-prompt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAgentDialog(false)} data-testid="button-cancel-agent">
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
                  });
                }
              }}
              disabled={!selectedAgent.agentId || addAgentMutation.isPending}
              data-testid="button-add-agent"
            >
              {addAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-department">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDepartment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDepartment && deleteDepartmentMutation.mutate(selectedDepartment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDepartmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent data-testid="dialog-delete-all">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Departments</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {departments.length} departments and their IVR configurations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllDepartmentsMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-all"
            >
              {deleteAllDepartmentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showIvrSettingsDialog} onOpenChange={setShowIvrSettingsDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-ivr-settings">
          <DialogHeader>
            <DialogTitle>Assign Phone Number</DialogTitle>
            <DialogDescription>
              Assign a phone number to your call center departments
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Phone Number</Label>
              <Select 
                value={selectedPhoneForIvr} 
                onValueChange={setSelectedPhoneForIvr}
              >
                <SelectTrigger data-testid="select-phone-for-ivr">
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
                data-testid="input-ivr-name"
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
            <Button variant="outline" onClick={() => setShowIvrSettingsDialog(false)} data-testid="button-cancel-ivr">
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
              data-testid="button-assign-phone"
            >
              {createIvrMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showConfigSheet} onOpenChange={setShowConfigSheet}>
        <SheetContent className="w-[450px] sm:w-[550px]" data-testid="sheet-department-config">
          <SheetHeader>
            <SheetTitle>Department Configuration</SheetTitle>
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
                    data-testid="input-config-dept-name"
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
                  <Card className="p-4 space-y-4">
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
                      {availableAgentsForActive.length === 0 ? (
                        <p className="text-sm text-muted-foreground mt-1.5">
                          No agents configured for {SUPPORTED_LANGUAGES.find((l) => l.code === activeLangAgent.language)?.label}
                        </p>
                      ) : (
                        <Select
                          value={activeLangAgent.agentId || ""}
                          onValueChange={(val) => handleSelectAgentForLang(activeLangAgent.id, val)}
                        >
                          <SelectTrigger className="mt-1.5" data-testid="select-agent-name">
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
                            {OPENAI_VOICES.map((voice) => (
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
                          data-testid="switch-dept-transfer"
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
                              data-testid="input-transfer-number"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Transfer Message</Label>
                            <Input
                              value={deptFeatures.transferMessage}
                              onChange={(e) => setDeptFeatures({ ...deptFeatures, transferMessage: e.target.value })}
                              placeholder="Please hold while I transfer you..."
                              className="mt-1"
                              data-testid="input-transfer-message"
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
                          data-testid="switch-lang-detection"
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
                          data-testid="switch-end-conversation"
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
                          data-testid="switch-appointment"
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
                          data-testid="switch-dept-recording"
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
                    data-testid="button-save-config"
                  >
                    {updateDepartmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfigSheet(false)}
                    data-testid="button-cancel-config"
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
        <SheetContent className="w-[450px] sm:w-[550px]" data-testid="sheet-ivr-config">
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
                  data-testid="switch-ivr-enabled"
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
                              setLanguageSelectionGreetingText(generateDefaultLanguageSelectionGreeting());
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
                          This greeting plays when callers first connect. Replace "Company Name" with your business name.
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
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
                          <Card key={opt.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
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
                            
                            <div className="space-y-3">
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
                                    onClick={() => handleIvrVoicePreview(opt.voiceId, opt.greeting)}
                                    data-testid={`button-preview-voice-${idx}`}
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
                                      data-testid={`dept-select-${idx}-${deptIdx}`}
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
                                  data-testid={`textarea-greeting-${idx}`}
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
                        data-testid="textarea-default-greeting"
                      />
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
      </div>
    </ThreeColumnLayout>
  );
}

interface DepartmentCardProps {
  department: Department;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFlow: () => void;
  onAddAgent: () => void;
}

function DepartmentCard({
  department,
  index,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onFlow,
  onAddAgent,
}: DepartmentCardProps) {
  const IconComponent = departmentIcons.find(i => i.value === department.icon)?.icon || Building2;

  return (
    <Card 
      className="relative overflow-visible"
      style={{ borderTopColor: department.color, borderTopWidth: '3px' }}
      data-testid={`department-card-${department.id}`}
    >
      <Badge 
        className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs"
        style={{ backgroundColor: department.color }}
        data-testid={`dept-index-${department.id}`}
      >
        #{index}
      </Badge>
      
      <CardHeader className="pb-2 gap-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center" 
              style={{ backgroundColor: `${department.color}20` }}
            >
              <IconComponent className="h-4 w-4" style={{ color: department.color }} />
            </div>
            <div>
              <CardTitle className="text-base">{department.name}</CardTitle>
              {department.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{department.description}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs" data-testid={`badge-ivr-active-${department.id}`}>
            <Power className="h-3 w-3 mr-1" />
            IVR {department.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid={`badge-ai-voice-${department.id}`}>
            <Mic className="h-3 w-3 mr-1" />
            AI Voice
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onFlow} className="flex-1" data-testid={`button-flow-${department.id}`}>
            <GitBranch className="h-4 w-4 mr-1" />
            Flow
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1" data-testid={`button-edit-${department.id}`}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive" data-testid={`button-delete-${department.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        <div 
          className="flex items-center gap-1 cursor-pointer hover-elevate rounded p-1 -mx-1" 
          onClick={onToggleExpand}
          data-testid={`toggle-expand-${department.id}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {department.agentCount || 0} Agents • {(department.languages || []).length || 1} Languages
          </span>
        </div>
        
        {isExpanded && (
          <div className="space-y-2 pt-2 border-t" data-testid={`agent-list-${department.id}`}>
            {(department.assignedAgents || []).length > 0 ? (
              (department.assignedAgents || []).map((agent: { id: string; agentId: string; agentName: string; language: string }) => (
                <div key={agent.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="capitalize">{languages.find(l => l.value === agent.language)?.label || agent.language}</span>
                  <span className="text-muted-foreground">- {agent.agentName}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No agents assigned</div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-primary" 
              onClick={onAddAgent}
              data-testid={`button-add-agent-${department.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Agent
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
