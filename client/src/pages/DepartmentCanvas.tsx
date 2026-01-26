import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Building2,
  Headphones,
  ShoppingCart,
  Calendar,
  Settings,
  Plus,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  Loader2,
  GitBranch,
  Mic,
  Globe,
  Check,
  Volume2,
  Square,
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

const OPENAI_VOICE_PREVIEWS: Record<string, string> = {
  alloy: "https://cdn.openai.com/API/docs/audio/alloy.wav",
  echo: "https://cdn.openai.com/API/docs/audio/echo.wav",
  shimmer: "https://cdn.openai.com/API/docs/audio/shimmer.wav",
  ash: "https://cdn.openai.com/API/docs/audio/ash.wav",
  ballad: "https://cdn.openai.com/API/docs/audio/ballad.wav",
  coral: "https://cdn.openai.com/API/docs/audio/coral.wav",
  sage: "https://cdn.openai.com/API/docs/audio/sage.wav",
  verse: "https://cdn.openai.com/API/docs/audio/verse.wav",
};

const OPENAI_VOICES = [
  { id: "alloy", name: "Alloy (OpenAI)", gender: "neutral", style: "balanced" },
  { id: "echo", name: "Echo (OpenAI)", gender: "male", style: "warm" },
  { id: "shimmer", name: "Shimmer (OpenAI)", gender: "female", style: "friendly" },
  { id: "ash", name: "Ash (OpenAI)", gender: "male", style: "professional" },
  { id: "coral", name: "Coral (OpenAI)", gender: "female", style: "warm" },
  { id: "sage", name: "Sage (OpenAI)", gender: "neutral", style: "calm" },
  { id: "verse", name: "Verse (OpenAI)", gender: "male", style: "expressive" },
  { id: "nova", name: "Nova (OpenAI)", gender: "female", style: "warm" },
];

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

interface LanguageOption {
  id: string;
  language: string;
  voiceId: string;
  greeting: string;
}

interface CanvasPhoneNode {
  id: string;
  phoneNumber: PhoneNumber;
}

interface CanvasDepartment {
  id: string;
  type: "sales" | "support" | "scheduling" | "custom";
  name: string;
  description: string;
  languageAgents?: LanguageAgent[];
  enableTransfer?: boolean;
  enableRecording?: boolean;
  enableLanguageDetection?: boolean;
  enableEndConversation?: boolean;
  enableAppointmentBooking?: boolean;
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

interface DepartmentConfigPanelProps {
  selectedNode: Node;
  agents: Agent[];
  updateDepartmentConfig: (nodeId: string, config: Partial<CanvasDepartment>) => void;
  deleteNode: (nodeId: string) => void;
}

function DepartmentConfigPanel({ selectedNode, agents, updateDepartmentConfig, deleteNode }: DepartmentConfigPanelProps) {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const nodeData = selectedNode.data as unknown as CanvasDepartment;
  const languageAgents = nodeData.languageAgents || [];
  
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  const getAgentsForLanguage = (langCode: string) => {
    return agents.filter((agent) => {
      const agentLang = (agent.language || "en").toLowerCase();
      return agentLang === langCode.toLowerCase();
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
    
    updateDepartmentConfig(selectedNode.id, {
      languageAgents: [...languageAgents, newLangAgent],
    });
    setActiveTabIdx(languageAgents.length);
  };
  
  const removeLanguageAgent = (id: string) => {
    const newList = languageAgents.filter((la) => la.id !== id);
    updateDepartmentConfig(selectedNode.id, { languageAgents: newList });
    if (activeTabIdx >= newList.length) {
      setActiveTabIdx(Math.max(0, newList.length - 1));
    }
  };
  
  const updateLanguageAgent = (id: string, updates: Partial<LanguageAgent>) => {
    const newList = languageAgents.map((la) => 
      la.id === id ? { ...la, ...updates } : la
    );
    updateDepartmentConfig(selectedNode.id, { languageAgents: newList });
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
  
  const handlePlayVoice = (voiceId: string) => {
    const previewUrl = OPENAI_VOICE_PREVIEWS[voiceId];
    if (!previewUrl || !audioRef.current) return;
    
    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
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
  
  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label>Department Name</Label>
        <Input
          value={nodeData.name || ""}
          onChange={(e) => updateDepartmentConfig(selectedNode.id, { name: e.target.value })}
          className="mt-1.5"
          data-testid="input-dept-name"
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
                onValueChange={(val) => handleSelectAgent(activeLangAgent.id, val)}
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
              {activeLangAgent.voiceId && OPENAI_VOICE_PREVIEWS[activeLangAgent.voiceId] && (
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
        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable Call Transfer</Label>
              <p className="text-xs text-muted-foreground">Agent can transfer calls to human operators when requested</p>
            </div>
            <Switch
              checked={nodeData.enableTransfer}
              onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableTransfer: val })}
              data-testid="switch-dept-transfer"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable Language Detection</Label>
              <p className="text-xs text-muted-foreground">Automatically detect and respond in caller's language (99 languages)</p>
            </div>
            <Switch
              checked={nodeData.enableLanguageDetection}
              onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableLanguageDetection: val })}
              data-testid="switch-lang-detection"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable End Conversation</Label>
              <p className="text-xs text-muted-foreground">Let agent intelligently end conversation when appropriate</p>
            </div>
            <Switch
              checked={nodeData.enableEndConversation}
              onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableEndConversation: val })}
              data-testid="switch-end-conversation"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable Appointment Booking</Label>
              <p className="text-xs text-muted-foreground">Let agent book appointments during calls</p>
            </div>
            <Switch
              checked={nodeData.enableAppointmentBooking}
              onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableAppointmentBooking: val })}
              data-testid="switch-appointment"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable Call Recording</Label>
              <p className="text-xs text-muted-foreground">Record conversations for quality and training</p>
            </div>
            <Switch
              checked={nodeData.enableRecording}
              onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableRecording: val })}
              data-testid="switch-dept-recording"
            />
          </div>
        </div>
      </div>
      
      <div className="pt-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => deleteNode(selectedNode.id)}
          data-testid="button-delete-dept"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove Department
        </Button>
      </div>
    </div>
  );
}

interface IVRConfigPanelProps {
  ivrEnabled: boolean;
  setIvrEnabled: (val: boolean) => void;
  multiLangEnabled: boolean;
  setMultiLangEnabled: (val: boolean) => void;
  languageOptions: LanguageOption[];
  setLanguageOptions: (opts: LanguageOption[]) => void;
}

function IVRConfigPanel({
  ivrEnabled,
  setIvrEnabled,
  multiLangEnabled,
  setMultiLangEnabled,
  languageOptions,
  setLanguageOptions,
}: IVRConfigPanelProps) {
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
  
  const languageSelectionGreeting = useMemo(() => {
    if (languageOptions.length === 0) return "No languages configured";
    return languageOptions
      .map((opt, idx) => `${LANGUAGE_SELECTION_PROMPTS[opt.language] || "For " + opt.language}, press ${idx + 1}.`)
      .join(" ");
  }, [languageOptions]);
  
  const addLanguageOption = () => {
    const usedLangs = languageOptions.map((o) => o.language);
    const availableLang = SUPPORTED_LANGUAGES.find((l) => !usedLangs.includes(l.code));
    if (!availableLang) return;
    
    const newOption: LanguageOption = {
      id: `lang-${Date.now()}`,
      language: availableLang.code,
      voiceId: "nova",
      greeting: DEFAULT_GREETINGS[availableLang.code] || DEFAULT_GREETINGS.en,
    };
    setLanguageOptions([...languageOptions, newOption]);
  };
  
  const updateLanguageOption = (id: string, updates: Partial<LanguageOption>) => {
    setLanguageOptions(
      languageOptions.map((opt) => {
        if (opt.id === id) {
          const updated = { ...opt, ...updates };
          if (updates.language && updates.language !== opt.language) {
            updated.greeting = DEFAULT_GREETINGS[updates.language] || DEFAULT_GREETINGS.en;
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
  
  const handlePlayVoice = (voiceId: string) => {
    const previewUrl = OPENAI_VOICE_PREVIEWS[voiceId];
    if (!previewUrl || !audioRef.current) return;
    
    if (playingVoiceId === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }
    
    audioRef.current.src = previewUrl;
    audioRef.current.play();
    setPlayingVoiceId(voiceId);
    audioRef.current.onended = () => setPlayingVoiceId(null);
    audioRef.current.onerror = () => setPlayingVoiceId(null);
  };
  
  return (
    <div className="mt-6 space-y-5">
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
                <div className="flex items-center justify-between">
                  <Label>Language Selection Greeting</Label>
                  <Badge variant="secondary" className="text-xs">Auto-generated</Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-sm border">
                  {languageSelectionGreeting}
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
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPENAI_VOICES.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} - {voice.gender}, {voice.style}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePlayVoice(opt.voiceId)}
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
                        <Label className="text-xs text-muted-foreground">Greeting Message</Label>
                        <Textarea
                          value={opt.greeting}
                          onChange={(e) => updateLanguageOption(opt.id, { greeting: e.target.value })}
                          rows={2}
                          className="mt-1"
                          data-testid={`input-greeting-${idx}`}
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
                data-testid="input-ivr-greeting"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const PhoneNodeComponent = ({ data }: { data: any }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-green-400 rounded-lg p-3 min-w-[160px] shadow-md">
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Phone className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <div className="font-medium text-sm">{data.phoneNumber}</div>
          <div className="text-xs text-muted-foreground">{data.provider}</div>
        </div>
      </div>
    </div>
  );
};

const IVRNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={`bg-amber-50 dark:bg-amber-900/20 border-2 ${selected ? 'border-amber-600' : 'border-amber-400'} rounded-xl p-4 min-w-[200px] shadow-lg`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center justify-center gap-3">
        <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-lg">
          <GitBranch className="h-6 w-6 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="text-center">
          <div className="font-semibold text-lg">IVR Router</div>
          <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-700 border-green-300">
            Active
          </Badge>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-center">
        {data.inputCount || 0} phone lines connected
      </div>
    </div>
  );
};

const DepartmentNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  const icons: Record<string, any> = {
    sales: ShoppingCart,
    support: Headphones,
    scheduling: Calendar,
    custom: Building2,
  };
  const colors: Record<string, string> = {
    sales: "bg-green-100 dark:bg-green-900/30 text-green-600 border-green-400",
    support: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-blue-400",
    scheduling: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 border-purple-400",
    custom: "bg-gray-100 dark:bg-gray-800 text-gray-600 border-gray-400",
  };
  const Icon = icons[data.type] || Building2;
  const colorClass = colors[data.type] || colors.custom;
  const languageAgents = data.languageAgents || [];

  return (
    <div className={`bg-white dark:bg-gray-800 border-2 ${selected ? 'border-primary' : colorClass.split(' ').pop()} rounded-lg p-3 min-w-[200px] max-w-[240px] shadow-md`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
          <Icon className={`h-5 w-5 ${colorClass.split(' ')[2]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{data.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {data.description}
          </div>
        </div>
      </div>
      
      {languageAgents.length > 0 && (
        <div className="mt-3 pt-2 border-t border-dashed space-y-1.5">
          {languageAgents.slice(0, 3).map((la: any) => (
            <div key={la.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                {la.language.toUpperCase()}
              </Badge>
              <div className="flex items-center gap-1 text-muted-foreground truncate">
                <Mic className="h-3 w-3 shrink-0" />
                <span className="truncate">{la.agentName || "No agent"}</span>
              </div>
            </div>
          ))}
          {languageAgents.length > 3 && (
            <div className="text-[10px] text-muted-foreground">
              +{languageAgents.length - 3} more languages
            </div>
          )}
        </div>
      )}
      
      {languageAgents.length === 0 && (
        <div className="mt-2 text-xs text-muted-foreground italic">
          No agents configured
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  phone: PhoneNodeComponent,
  ivr: IVRNodeComponent,
  department: DepartmentNodeComponent,
};

function DepartmentCanvasContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  
  // Derive selectedNode from nodes to always get the latest data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const [customDeptName, setCustomDeptName] = useState("");
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { id: "default", language: "en", voiceId: "nova", greeting: DEFAULT_GREETINGS.en }
  ]);
  const [saving, setSaving] = useState(false);

  const [canvasPhones, setCanvasPhones] = useState<string[]>([]);
  const [canvasDepartments, setCanvasDepartments] = useState<CanvasDepartment[]>([]);

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: knowledgeBases = [] } = useQuery<any[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !canvasPhones.includes(p.id));
  }, [phoneNumbers, canvasPhones]);

  useEffect(() => {
    const ivrNode: Node = {
      id: "ivr-main",
      type: "ivr",
      position: { x: 350, y: 200 },
      data: { inputCount: 0 },
    };
    setNodes([ivrNode]);
  }, []);

  const phoneNodeCount = useMemo(() => {
    return nodes.filter((n) => n.type === "phone").length;
  }, [nodes]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "ivr-main" && (node.data as any).inputCount !== phoneNodeCount) {
          return { ...node, data: { ...node.data, inputCount: phoneNodeCount } };
        }
        return node;
      })
    );
  }, [phoneNodeCount, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#f59e0b", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "ivr" || node.type === "department") {
      setSelectedNodeId(node.id);
      setConfigPanelOpen(true);
    }
  }, []);

  const addPhoneToCanvas = (phone: PhoneNumber) => {
    const phoneCount = nodes.filter((n) => n.type === "phone").length;
    const xOffset = 200 + phoneCount * 200;
    const newNode: Node = {
      id: `phone-${phone.id}`,
      type: "phone",
      position: { x: xOffset, y: 50 },
      data: {
        phoneNumber: phone.phoneNumber,
        friendlyName: phone.friendlyName,
        provider: phone.provider,
        phoneId: phone.id,
      },
    };

    const newEdge: Edge = {
      id: `edge-phone-${phone.id}-ivr`,
      source: `phone-${phone.id}`,
      target: "ivr-main",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#22c55e", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setCanvasPhones((prev) => [...prev, phone.id]);
  };

  const addDepartmentToCanvas = (template: typeof departmentTemplates[0] | { type: "custom"; name: string }) => {
    const deptCount = nodes.filter((n) => n.type === "department").length;
    const dialKey = String(deptCount + 1);

    const defaultPrompt = template.type !== "custom" ? (template as any).defaultPrompt : "";
    const newDept: CanvasDepartment = {
      id: `dept-${Date.now()}`,
      type: template.type,
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
      enableRecording: false,
      enableLanguageDetection: false,
    };

    const xOffset = 100 + deptCount * 260;
    const newNode: Node = {
      id: newDept.id,
      type: "department",
      position: { x: xOffset, y: 380 },
      data: {
        ...newDept,
        dialKey,
      },
    };

    const newEdge: Edge = {
      id: `edge-ivr-${newDept.id}`,
      source: "ivr-main",
      target: newDept.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#f59e0b", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      label: `Press ${dialKey}`,
      labelStyle: { fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#fef3c7", fillOpacity: 0.95 },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setCanvasDepartments((prev) => [...prev, newDept]);
  };

  const updateDepartmentConfig = (nodeId: string, updates: Partial<CanvasDepartment>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    );
    setCanvasDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id === nodeId) {
          return { ...dept, ...updates };
        }
        return dept;
      })
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));

    if (nodeId.startsWith("phone-")) {
      const phoneId = nodeId.replace("phone-", "");
      setCanvasPhones((prev) => prev.filter((id) => id !== phoneId));
    } else if (nodeId.startsWith("dept-")) {
      setCanvasDepartments((prev) => prev.filter((d) => d.id !== nodeId));
    }

    setConfigPanelOpen(false);
    setSelectedNodeId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const departmentNodes = nodes.filter((n) => n.type === "department");
      const phoneNodes = nodes.filter((n) => n.type === "phone");

      const canvasToDbIdMap = new Map<string, string>();

      for (const deptNode of departmentNodes) {
        const deptData = deptNode.data as unknown as CanvasDepartment & { dialKey: string };

        const deptResponse = await apiRequest("POST", "/api/departments", {
          name: deptData.name,
          description: deptData.description,
          icon: deptData.type,
          color: deptData.type === "sales" ? "#22c55e" : deptData.type === "support" ? "#3b82f6" : deptData.type === "scheduling" ? "#a855f7" : "#6b7280",
          isActive: true,
        });
        const deptResult = await deptResponse.json();

        canvasToDbIdMap.set(deptNode.id, deptResult.id);

        const langAgents = deptData.languageAgents || [];
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

      if (phoneNodes.length > 0 && departmentNodes.length > 0) {
        const menuOptions = departmentNodes.map((node, idx) => ({
          key: String(idx + 1),
          label: (node.data as any).name,
          departmentId: canvasToDbIdMap.get(node.id) || node.id,
        }));

        const greetingMessage = multiLangEnabled && languageOptions.length > 0
          ? languageOptions.map((opt, idx) => `${LANGUAGE_SELECTION_PROMPTS[opt.language] || "For " + opt.language}, press ${idx + 1}.`).join(" ")
          : languageOptions[0]?.greeting || DEFAULT_GREETINGS.en;
        
        await apiRequest("POST", "/api/departments/ivr", {
          phoneNumberId: (phoneNodes[0].data as any).phoneId,
          name: "Auto Distribution",
          isActive: ivrEnabled,
          greetingMessage,
          menuOptions,
          languageOptions: multiLangEnabled ? languageOptions : undefined,
        });
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Canvas Saved",
        description: "All departments and routing have been created successfully.",
      });
      setLocation("/app/departments");
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save canvas configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const deptCount = nodes.filter((n) => n.type === "department").length;
    if (deptCount === 0) {
      toast({
        title: "No Departments",
        description: "Please add at least one department to the canvas.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const phoneCount = nodes.filter((n) => n.type === "phone").length;
  const deptCount = nodes.filter((n) => n.type === "department").length;
  const connectionCount = edges.length;

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/app/departments")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold">Department Canvas</h1>
            <p className="text-xs text-muted-foreground">Design your call flow visually</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomOut()} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round((reactFlowInstance?.getZoom() || 1) * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomIn()} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save & Deploy
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Phone className="h-3.5 w-3.5" />
                  Available Phone Numbers
                </div>
                {availablePhones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No available numbers</p>
                ) : (
                  <div className="space-y-2">
                    {availablePhones.map((phone) => (
                      <Card
                        key={phone.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => addPhoneToCanvas(phone)}
                        data-testid={`card-phone-${phone.id}`}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                            <Phone className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                            <div className="text-xs text-muted-foreground">{phone.provider}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => setLocation("/app/phone-numbers")}
                  data-testid="button-buy-numbers"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Buy More Numbers
                </Button>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Building2 className="h-3.5 w-3.5" />
                  Add Department
                </div>
                <div className="space-y-2">
                  {departmentTemplates.map((template) => (
                    <Card
                      key={template.type}
                      className="cursor-pointer hover-elevate"
                      onClick={() => addDepartmentToCanvas(template)}
                      data-testid={`card-dept-${template.type}`}
                    >
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className={`p-1.5 rounded ${template.color} bg-opacity-20`}>
                          <template.icon className={`h-3.5 w-3.5 text-${template.color.replace('bg-', '').replace('-500', '-600')}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="pt-2">
                    <Input
                      placeholder="Custom department name..."
                      value={customDeptName}
                      onChange={(e) => setCustomDeptName(e.target.value)}
                      className="text-sm"
                      data-testid="input-custom-dept"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground"
                      onClick={() => {
                        if (customDeptName.trim()) {
                          addDepartmentToCanvas({ type: "custom", name: customDeptName.trim() });
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
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Canvas Stats
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone Numbers</span>
                    <span className="font-medium">{phoneCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Departments</span>
                    <span className="font-medium">{deptCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span className="font-medium">{connectionCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div ref={reactFlowWrapper} className="flex-1 bg-gray-50 dark:bg-gray-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.type === "phone") return "#22c55e";
                if (n.type === "ivr") return "#f59e0b";
                return "#6b7280";
              }}
              nodeColor={(n) => {
                if (n.type === "phone") return "#dcfce7";
                if (n.type === "ivr") return "#fef3c7";
                return "#f3f4f6";
              }}
            />
          </ReactFlow>
        </div>
      </div>

      <Sheet open={configPanelOpen} onOpenChange={setConfigPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>
              {selectedNode?.type === "ivr" ? "IVR Configuration" : "Department Configuration"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 pb-6">
            {selectedNode?.type === "ivr" && (
              <IVRConfigPanel
                ivrEnabled={ivrEnabled}
                setIvrEnabled={setIvrEnabled}
                multiLangEnabled={multiLangEnabled}
                setMultiLangEnabled={setMultiLangEnabled}
                languageOptions={languageOptions}
                setLanguageOptions={setLanguageOptions}
              />
            )}

            {selectedNode?.type === "department" && (
              <DepartmentConfigPanel
                selectedNode={selectedNode}
                agents={agents}
                updateDepartmentConfig={updateDepartmentConfig}
                deleteNode={deleteNode}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DepartmentCanvas() {
  return (
    <ReactFlowProvider>
      <DepartmentCanvasContent />
    </ReactFlowProvider>
  );
}
