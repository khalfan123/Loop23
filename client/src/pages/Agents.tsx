/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Plus, Search, Trash2, Edit, Bot, Upload, Sparkles, GitBranch, CheckCircle2, XCircle, Mic, Brain, Settings2, Wrench, Check, FileText, History, MoreVertical, FolderOpen, ChevronRight, RefreshCw, Phone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthStorage } from "@/lib/auth-storage";
import PromptTemplatesLibrary from "@/components/PromptTemplatesLibrary";
import Voices from "@/pages/Voices";
import PromptTemplates from "@/pages/PromptTemplates";
import AgentVersionHistory from "@/components/AgentVersionHistory";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import VoiceSearchPicker from "@/components/VoiceSearchPicker";
import VoicePreviewButton from "@/components/VoicePreviewButton";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";
import AgentCreationWizard from "@/components/AgentCreationWizard";
import { Wand2 } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguageLabel, isProviderSupported } from "@/lib/languages";
import { LanguageOptionLabel } from "@/components/LanguageProviderBadges";
import { usePluginStatus } from "@/hooks/use-plugin-status";

interface SipPhoneNumber {
  id: string;
  phoneNumber: string;
  label?: string;
  trunkId: string;
  engine: string;
}

interface Agent {
  id: string;
  type: 'incoming' | 'flow';
  name: string;
  voiceTone: string;
  personality: string;
  systemPrompt: string;
  elevenLabsAgentId: string | null;
  elevenLabsVoiceId: string | null;
  agentLink: string | null;
  language: string | null;
  llmModel: string | null;
  firstMessage: string | null;
  temperature: number | null;
  knowledgeBaseIds: string[] | null;
  config: any;
  flowId: string | null;
  maxDurationSeconds: number | null;
  voiceStability: number | null;
  voiceSimilarityBoost: number | null;
  voiceSpeed: number | null;
  transferEnabled: boolean | null;
  transferPhoneNumber: string | null;
  detectLanguageEnabled: boolean | null;
  endConversationEnabled: boolean | null;
  appointmentBookingEnabled: boolean | null;
  telephonyProvider: 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip' | null;
  openaiVoice: string | null;
  sourceTemplateId: string | null;
  isFromTemplate: boolean | null;
  tags: string[] | null;
  specialist: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// OpenAI Realtime API voice options (for Plivo+OpenAI and Twilio+OpenAI engines)
const openaiVoices = [
  { value: "alloy", label: "Alloy", description: "Versatile and balanced" },
  { value: "echo", label: "Echo", description: "Warm and confident" },
  { value: "shimmer", label: "Shimmer", description: "Clear and expressive" },
  { value: "ash", label: "Ash", description: "Soft and gentle" },
  { value: "ballad", label: "Ballad", description: "Melodic and soothing" },
  { value: "coral", label: "Coral", description: "Bright and friendly" },
  { value: "sage", label: "Sage", description: "Calm and wise" },
  { value: "verse", label: "Verse", description: "Poetic and articulate" },
  { value: "cedar", label: "Cedar", description: "Deep and grounded" },
  { value: "marin", label: "Marin", description: "Fresh and lively" },
];

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface KnowledgeBaseItem {
  id: string;
  type: string;
  title: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  elevenLabsDocId: string | null;
  storageSize: number;
  createdAt: string;
}

// LLM cost estimates per minute (in USD)
const MODEL_COSTS: Record<string, { llm: number; name: string; speed: string }> = {
  // ElevenLabs Models
  "glm-45-air-fp8": { llm: 0.0106, name: "GLM-4.5-Air", speed: "Balanced" },
  "qwen3-30b-a3b": { llm: 0.0033, name: "Qwen3-30B-A3B", speed: "Ultra Fast" },
  "gpt-oss-120b": { llm: 0.02, name: "GPT-OSS-120B", speed: "High Quality" },
  
  // Google Models
  "gemini-2.5-flash": { llm: 0.005, name: "Gemini 2.5 Flash", speed: "Very Fast" },
  "gemini-2.5-flash-lite": { llm: 0.003, name: "Gemini 2.5 Flash Lite", speed: "Ultra Fast" },
  "gemini-2.0-flash": { llm: 0.004, name: "Gemini 2.0 Flash", speed: "Very Fast" },
  "gemini-2.0-flash-lite": { llm: 0.002, name: "Gemini 2.0 Flash Lite", speed: "Ultra Fast" },
  
  // OpenAI Models
  "gpt-4o": { llm: 0.02, name: "GPT-4o", speed: "Balanced" },
  "gpt-4o-mini": { llm: 0.006, name: "GPT-4o Mini", speed: "Fast" },
  "gpt-4-turbo": { llm: 0.04, name: "GPT-4 Turbo", speed: "High Quality" },
  "gpt-3.5-turbo": { llm: 0.003, name: "GPT-3.5 Turbo", speed: "Very Fast" },
  
  // Anthropic Models
  "claude-3-5-sonnet": { llm: 0.06, name: "Claude 3.5 Sonnet", speed: "High Quality" },
  "claude-3-haiku": { llm: 0.01, name: "Claude 3 Haiku", speed: "Fast" },
};

const VOICE_COST = 0.10; // $0.10 per minute for voice service

function EstimatedCost({ model }: { model: string }) {
  const { t } = useTranslation();
  const modelInfo = MODEL_COSTS[model];
  
  // Fetch LLM margin from admin settings
  const { data: marginData } = useQuery<{ llm_margin_percentage: number }>({
    queryKey: ["/api/settings/llm-margin"],
  });
  
  if (!modelInfo) return null;
  
  const marginPercentage = marginData?.llm_margin_percentage || 30;
  const baseLlmCost = modelInfo.llm;
  const llmCostWithMargin = baseLlmCost * (1 + marginPercentage / 100);
  const totalCost = VOICE_COST + llmCostWithMargin;
  
  return (
    <div className="mt-2 p-3 bg-secondary/50 rounded-md text-xs">
      <div className="font-medium mb-1">{t('agents.cost.estimatedBreakdown', { margin: marginPercentage })}</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('agents.cost.voiceService')}</span>
          <span>${VOICE_COST.toFixed(3)}/min</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('agents.cost.llm', { model: modelInfo.name })}</span>
          <span>${llmCostWithMargin.toFixed(3)}/min</span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between font-medium">
          <span>{t('agents.cost.totalCost')}</span>
          <span className="text-primary">${totalCost.toFixed(3)}/min</span>
        </div>
        <div className="mt-2 text-muted-foreground">
          {t('agents.cost.speed')} {modelInfo.speed} • {t('agents.cost.minCall')} ${(totalCost * 60).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'agents' | 'templates' | 'voices'>('agents');
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'incoming' | 'flow'>('all');
  const [selectedFolder, setSelectedFolder] = useState<'all' | 'template' | 'transfer'>('all');
  const [engineFilter, setEngineFilter] = useState<'all' | 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [knowledgeUploadOpen, setKnowledgeUploadOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    type: "incoming" as 'incoming' | 'flow',
    name: "",
    voiceTone: "professional",
    personality: "helpful",
    systemPrompt: "",
    elevenLabsVoiceId: "",
    language: "en",
    llmModel: "gpt-4o-mini",
    firstMessage: "Hello! How can I help you today?",
    temperature: 0.5,
    knowledgeBaseIds: [] as string[],
    transferNumber: "",
    transferKeywords: [] as string[],
    // System Tools configuration
    transferEnabled: false,
    transferPhoneNumber: "",
    detectLanguageEnabled: false,
    endConversationEnabled: false,
    appointmentBookingEnabled: false,
    // Flow Agent specific fields
    flowId: "",
    maxDurationSeconds: 600,
    voiceStability: 0.55,
    voiceSimilarityBoost: 0.85,
    voiceSpeed: 1.0,
    // Telephony Provider selection (Twilio/ElevenLabs, Plivo/OpenAI, Twilio/OpenAI, or SIP engines)
    telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip",
    openaiVoice: "alloy",
    // SIP phone number selection (for SIP engines)
    sipPhoneNumberId: "",
    // Template tracking
    sourceTemplateId: "" as string,
    isFromTemplate: false,
    tags: [] as string[],
    specialist: "",
  });
  const [knowledgeData, setKnowledgeData] = useState({
    title: "",
    type: "document",
    content: "",
  });
  
  // Animation state for success/failure feedback
  const [animationState, setAnimationState] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: voices = [] } = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  // Voice lookup helper - only uses account voices
  const getVoiceName = useMemo(() => {
    const voiceMap = new Map(voices.map(v => [v.voice_id, v.name]));
    return (voiceId: string | null): string | null => {
      if (!voiceId) return null;
      return voiceMap.get(voiceId) || null;
    };
  }, [voices]);

  const { data: knowledgeBase = [] } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/knowledge-base"],
  });

  // Fetch available LLM models for current user (filtered by plan tier)
  const { data: availableLLMModels = [] } = useQuery<Array<{
    id: string;
    modelId: string;
    name: string;
    provider: string;
    tier: 'free' | 'pro';
    isActive: boolean;
  }>>({
    queryKey: ["/api/llm-models/available"],
  });

  const { data: flows = [] } = useQuery<Array<{ id: string; name: string; description: string }>>({
    queryKey: ["/api/flow-automation/flows"],
  });

  // Fetch voice engine settings to check if Plivo+OpenAI or Twilio+OpenAI is enabled
  const { data: voiceEngineSettings } = useQuery<{ plivo_openai_engine_enabled: boolean; twilio_openai_engine_enabled: boolean }>({
    queryKey: ["/api/settings/voice-engine"],
    staleTime: 60000,
  });

  const isPlivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const isTwilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;

  // Check if SIP plugin is enabled and which engines are allowed
  const { isSipPluginEnabled, sipEnginesAllowed } = usePluginStatus();
  const isElevenLabsSipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("elevenlabs-sip");
  const isOpenAISipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("openai-sip");

  // Fetch SIP phone numbers when SIP plugin is enabled
  const { data: sipPhoneNumbersResponse } = useQuery<{ success: boolean; data: SipPhoneNumber[] }>({
    queryKey: ["/api/sip/phone-numbers"],
    enabled: isSipPluginEnabled,
  });
  const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];

  const hasAlternateEngines = isPlivoEnabled || isTwilioOpenaiEnabled || isElevenLabsSipAllowed || isOpenAISipAllowed;

  // Fetch OpenAI Realtime models (for Plivo+OpenAI or Twilio+OpenAI engine)
  const { data: openaiModelsData } = useQuery<{
    tier: 'free' | 'pro';
    models: string[];
    description: string;
    allTiers: Record<string, { models: string[]; description: string }>;
  }>({
    queryKey: ["/api/plivo/openai/models"],
    enabled: isPlivoEnabled || isTwilioOpenaiEnabled || formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai",
    staleTime: 60000,
  });

  // OpenAI Realtime models with display info
  const openaiRealtimeModels = useMemo(() => {
    if (!openaiModelsData?.models) return [];
    
    const modelInfo: Record<string, { name: string; tier: 'free' | 'pro'; description: string }> = {
      'gpt-realtime': { name: 'GPT Realtime (GA)', tier: 'pro', description: 'Best quality, production-ready' },
      'gpt-realtime-mini': { name: 'GPT Realtime Mini (GA)', tier: 'free', description: 'Cost-effective, production-ready' },
      'gpt-4o-realtime-preview': { name: 'GPT-4o Realtime (Preview)', tier: 'pro', description: 'Premium preview model' },
      'gpt-4o-mini-realtime-preview': { name: 'GPT-4o Mini Realtime (Preview)', tier: 'free', description: 'Cost-effective preview' },
    };
    
    return openaiModelsData.models.map(modelId => {
      const info = modelInfo[modelId] || { name: modelId, tier: 'free' as const, description: 'OpenAI Realtime model' };
      return {
        id: modelId,
        modelId,
        name: info.name,
        tier: info.tier,
        description: info.description,
      };
    });
  }, [openaiModelsData]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return res.json();
    },
    onSuccess: () => {
      // Trigger success animation
      setAnimationState('success');
      setTimeout(() => {
        setAnimationState('idle');
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        setCreateDialogOpen(false);
        resetForm();
      }, 1500);
      toast({ title: t('agents.toast.created') });
    },
    onError: (error: any) => {
      // Trigger error animation
      setAnimationState('error');
      setTimeout(() => setAnimationState('idle'), 600);
      toast({
        title: t('agents.toast.createFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest("PATCH", `/api/agents/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      // Trigger success animation
      setAnimationState('success');
      setTimeout(() => {
        setAnimationState('idle');
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        setEditingAgent(null);
        resetForm();
      }, 1500);
      
      if (data.warning) {
        toast({ 
          title: t('agents.toast.updated'),
          description: data.warning,
        });
      } else {
        toast({ title: t('agents.toast.updated') });
      }
    },
    onError: (error: any) => {
      // Trigger error animation
      setAnimationState('error');
      setTimeout(() => setAnimationState('idle'), 600);
      toast({
        title: t('agents.toast.updateFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/agents/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setDeletingAgent(null);
      toast({ title: t('agents.toast.deleted') });
    },
    onError: (error: any) => {
      toast({
        title: t('agents.toast.deleteFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const uploadKnowledgeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge-base", knowledgeData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setKnowledgeUploadOpen(false);
      setKnowledgeData({ title: "", type: "document", content: "" });
      toast({ title: t('agents.toast.knowledgeUploaded') });
    },
    onError: (error: any) => {
      toast({
        title: t('agents.toast.knowledgeUploadFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: "incoming" as 'incoming' | 'flow',
      name: "",
      voiceTone: "professional",
      personality: "helpful",
      systemPrompt: "",
      elevenLabsVoiceId: "",
      language: "en",
      llmModel: "gpt-4o-mini",
      firstMessage: "Hello! How can I help you today?",
      temperature: 0.5,
      knowledgeBaseIds: [],
      transferNumber: "",
      transferKeywords: [],
      // System Tools configuration
      transferEnabled: false,
      transferPhoneNumber: "",
      detectLanguageEnabled: false,
      endConversationEnabled: false,
      appointmentBookingEnabled: false,
      flowId: "",
      maxDurationSeconds: 600,
      voiceStability: 0.55,
      voiceSimilarityBoost: 0.85,
      voiceSpeed: 1.0,
      // Telephony Provider selection
      telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip",
      openaiVoice: "alloy",
      sipPhoneNumberId: "",
      // Template tracking
      sourceTemplateId: "",
      isFromTemplate: false,
      tags: [],
      specialist: "",
    });
  };

  const handleCreate = () => {
    if (!formData.name) {
      toast({
        title: t('agents.toast.missingFields'),
        description: t('agents.toast.pleaseEnterName'),
        variant: "destructive",
      });
      return;
    }

    // Incoming Agent validation
    if (formData.type === 'incoming') {
      // Voice validation depends on telephony provider
      const isOpenAIVoice = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";
      const hasValidVoice = isOpenAIVoice
        ? !!formData.openaiVoice 
        : !!formData.elevenLabsVoiceId;
      // Note: SIP phone number selection moved to campaign level
      if (!hasValidVoice) {
        toast({
          title: t('agents.toast.missingFields'),
          description: t('agents.toast.pleaseSelectVoice'),
          variant: "destructive",
        });
        return;
      }
      if (!formData.systemPrompt) {
        toast({
          title: t('agents.toast.missingFields'),
          description: t('agents.toast.systemPromptRequired'),
          variant: "destructive",
        });
        return;
      }
      // Validate call transfer configuration
      if (formData.transferEnabled && !formData.transferPhoneNumber.trim()) {
        toast({
          title: t('agents.toast.missingTransferPhone'),
          description: t('agents.toast.transferPhoneRequired'),
          variant: "destructive",
        });
        return;
      }
    }

    // Flow Agent validation
    if (formData.type === 'flow') {
      if (!formData.flowId) {
        toast({
          title: t('agents.toast.missingFields'),
          description: t('agents.toast.flowRequired'),
          variant: "destructive",
        });
        return;
      }
      // Voice validation depends on telephony provider for flow agents
      const isOpenAIVoiceFlow = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";
      const hasValidVoice = isOpenAIVoiceFlow
        ? !!formData.openaiVoice 
        : !!formData.elevenLabsVoiceId;
      // Note: SIP phone number selection moved to campaign level
      if (!hasValidVoice) {
        toast({
          title: t('agents.toast.missingFields'),
          description: t('agents.toast.pleaseSelectVoice'),
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate(formData);
  };

  const handleEdit = (agent: Agent) => {
    setLocation(`/app/agents/${agent.id}/edit`);
    return;
    // Legacy dialog-based edit (kept for reference)
    setEditingAgent(agent);
    setFormData({
      type: agent.type || "incoming",
      name: agent.name,
      voiceTone: agent.voiceTone || "professional",
      personality: agent.personality || "helpful",
      systemPrompt: agent.systemPrompt || "",
      elevenLabsVoiceId: agent.elevenLabsVoiceId || "",
      language: agent.language || "en",
      llmModel: agent.llmModel || "gpt-4o-mini",
      firstMessage: agent.firstMessage || "Hello! How can I help you today?",
      temperature: agent.temperature ?? 0.5,
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      transferNumber: agent.config?.transferRules?.number || "",
      transferKeywords: agent.config?.transferRules?.keywords || [],
      // System Tools configuration
      transferEnabled: agent.transferEnabled ?? false,
      transferPhoneNumber: agent.transferPhoneNumber || "",
      detectLanguageEnabled: agent.detectLanguageEnabled ?? false,
      endConversationEnabled: agent.endConversationEnabled ?? false,
      appointmentBookingEnabled: agent.appointmentBookingEnabled ?? false,
      flowId: agent.flowId || "",
      maxDurationSeconds: agent.maxDurationSeconds ?? 600,
      voiceStability: agent.voiceStability ?? 0.55,
      voiceSimilarityBoost: agent.voiceSimilarityBoost ?? 0.85,
      voiceSpeed: agent.voiceSpeed ?? 1.0,
      // Telephony Provider selection
      telephonyProvider: (agent.telephonyProvider || "twilio") as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip",
      openaiVoice: agent.openaiVoice || "alloy",
      sipPhoneNumberId: (agent as any).sipPhoneNumberId || "",
      // Template tracking
      sourceTemplateId: agent.sourceTemplateId || "",
      isFromTemplate: agent.isFromTemplate ?? false,
      tags: agent.tags || [],
      specialist: agent.specialist || "",
    });
  };

  const handleUpdate = () => {
    if (!editingAgent) return;
    
    // Validate call transfer configuration for incoming agents
    if (formData.type === 'incoming' && formData.transferEnabled && !formData.transferPhoneNumber.trim()) {
      toast({
        title: t('agents.toast.missingTransferPhone'),
        description: t('agents.toast.transferPhoneRequired'),
        variant: "destructive",
      });
      return;
    }
    
    updateMutation.mutate({ id: editingAgent.id, data: formData });
  };

  const filteredAgents = agents
    .filter((agent) => {
      // Filter by folder
      if (selectedFolder === 'template' && !agent.isFromTemplate) {
        return false;
      }
      if (selectedFolder === 'transfer' && !agent.transferEnabled) {
        return false;
      }
      // Filter by type
      if (typeFilter !== 'all' && agent.type !== typeFilter) {
        return false;
      }
      // Filter by engine/telephony provider
      if (engineFilter !== 'all') {
        const agentProvider = agent.telephonyProvider || 'twilio';
        if (agentProvider !== engineFilter) {
          return false;
        }
      }
      // Filter by search query
      return agent.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  // Pagination for agents grid
  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredAgents, 9);

  const incomingCount = agents.filter(a => a.type === 'incoming').length;
  const flowCount = agents.filter(a => a.type === 'flow').length;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'agents' | 'templates' | 'voices')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="agents" className="flex items-center gap-2" data-testid="tab-agents">
            <Bot className="h-4 w-4" />
            {t('nav.agents')}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <FileText className="h-4 w-4" />
            {t('nav.promptTemplates')}
          </TabsTrigger>
          <TabsTrigger value="voices" className="flex items-center gap-2" data-testid="tab-voices">
            <Mic className="h-4 w-4" />
            {t('nav.voices')}
          </TabsTrigger>
        </TabsList>

        {/* Prompt Templates Tab */}
        <TabsContent value="templates" className="mt-0">
          <PromptTemplates />
        </TabsContent>

        {/* Voices Tab */}
        <TabsContent value="voices" className="mt-0">
          <Voices />
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-0">
      {/* New Sidebar + Table Layout */}
      <div className="flex h-[calc(100vh-180px)] border rounded-lg bg-background overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3">
              {/* Staff AI */}
              <button
                onClick={() => { setSelectedFolder('all'); setTypeFilter('all'); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFolder === 'all' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="folder-all-agents"
              >
                <Bot className="h-4 w-4" />
                Staff AI
              </button>
              
              {/* Folders Section */}
              <div className="mt-4">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <button
                  onClick={() => { setSelectedFolder('template'); setTypeFilter('all'); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolder === 'template' 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  data-testid="folder-template-agents"
                >
                  <FolderOpen className="h-4 w-4" />
                  Template Staff
                </button>
              </div>
              
              {/* Transfer Agents Section */}
              <div className="mt-4">
                <div className="px-3 py-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transfer Staff</span>
                </div>
                <button
                  onClick={() => { setSelectedFolder('transfer'); setTypeFilter('all'); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolder === 'transfer' 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  data-testid="folder-transfer-agents"
                >
                  <RefreshCw className="h-4 w-4" />
                  Transfer Screening Staff
                </button>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">
              {selectedFolder === 'all' ? 'Staff AI' : 
               selectedFolder === 'template' ? 'Template Staff' : 
               'Transfer Screening Staff'}
            </h2>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-agents"
                />
              </div>
              {/* Import Button */}
              <Button variant="outline" data-testid="button-import-agent">
                Import
              </Button>
              {/* Create Agent Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" data-testid="button-create-agent">
                    Create Staff AI
                    <ChevronRight className="h-4 w-4 ml-1 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation('/app/agents/new?type=incoming')}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Single Prompt Staff
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation('/app/agents/new?type=flow')}>
                    <GitBranch className="h-4 w-4 mr-2" />
                    Conversation Flow Staff
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setWizardOpen(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Guided Wizard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table Content */}
          <ScrollArea className="flex-1">
            {agentsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="mt-4 text-muted-foreground">Loading agents...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? t('agents.noAgentsFound') : t('agents.noAgents')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? t('agents.noMatchingSearch') : t('agents.getStarted')}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setLocation('/app/agents/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first agent
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Staff Name</TableHead>
                    <TableHead>Staff Type</TableHead>
                    <TableHead>Voice</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Edited by</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((agent) => {
                    const isOpenAIProvider = agent.telephonyProvider === "plivo" || agent.telephonyProvider === "twilio_openai" || agent.telephonyProvider === "openai-sip";
                    const voiceName = isOpenAIProvider 
                      ? openaiVoices.find(v => v.value === agent.openaiVoice)?.label || 'Alloy'
                      : getVoiceName(agent.elevenLabsVoiceId) || 'Not set';
                    const languageCode = agent.language || 'en';
                    const isIncoming = agent.type === 'incoming';
                    const formattedDate = new Date(agent.createdAt).toLocaleDateString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                    }) + ', ' + new Date(agent.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    });

                    return (
                      <TableRow 
                        key={agent.id} 
                        className="group cursor-pointer"
                        data-testid={`row-agent-${agent.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {agent.avatarUrl ? (
                              <img 
                                src={agent.avatarUrl} 
                                alt={agent.name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-background shadow-sm"
                              />
                            ) : (
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                isIncoming ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                              }`}>
                                {isIncoming ? <Sparkles className="h-5 w-5" /> : <GitBranch className="h-5 w-5" />}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              {agent.specialist && (
                                <div className="text-xs text-muted-foreground">{agent.specialist}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={`font-normal ${
                              isIncoming ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 
                              'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                            }`}
                          >
                            {isIncoming ? 'Single Prompt' : 'Conversation Flow'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-primary/10">
                                {voiceName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{voiceName} ({languageCode})</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{formattedDate}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                data-testid="button-agent-actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(agent)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeletingAgent(agent)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
          
          {/* Pagination */}
          {filteredAgents.length > 0 && (
            <div className="border-t p-4">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                itemsPerPageOptions={[10, 25, 50]}
                data-testid="agents-pagination"
              />
            </div>
          )}
        </div>
      </div>
      <Dialog open={createDialogOpen || !!editingAgent} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingAgent(null);
          resetForm();
        }
      }}>
        <DialogContent className={`max-w-2xl flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden ${animationState === 'error' ? 'animate-shake' : ''}`}>
          {/* Success Animation Overlay */}
          {animationState === 'success' && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 fade-in duration-300">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="h-10 w-10 text-white animate-in zoom-in-75 duration-300 delay-150" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {editingAgent ? t('agents.create.agentUpdated') : t('agents.create.agentCreated')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('agents.create.readyToUse')}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Fixed Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{editingAgent ? t('agents.create.editTitle') : t('agents.create.title')}</DialogTitle>
            <DialogDescription>
              {t('agents.create.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 py-4">
            {/* Agent Type Selector */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('agents.create.typeRequired')} <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    formData.type === 'incoming' 
                      ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-teal-500/20 dark:from-emerald-500/30 dark:via-emerald-400/15 dark:to-teal-500/25 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10' 
                      : 'bg-muted/30 hover:bg-muted/50 border-2 border-transparent hover:border-border'
                  }`}
                  onClick={() => setFormData({ ...formData, type: 'incoming' })}
                  data-testid="card-type-incoming"
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      formData.type === 'incoming' 
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-semibold ${formData.type === 'incoming' ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{t('agents.create.incomingAgent')}</h4>
                        {formData.type === 'incoming' && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('agents.create.incomingDescription')}
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    formData.type === 'flow' 
                      ? 'bg-gradient-to-br from-violet-500/20 via-purple-400/10 to-indigo-500/20 dark:from-violet-500/30 dark:via-purple-400/15 dark:to-indigo-500/25 border-2 border-violet-500/50 shadow-lg shadow-violet-500/10' 
                      : 'bg-muted/30 hover:bg-muted/50 border-2 border-transparent hover:border-border'
                  }`}
                  onClick={() => setFormData({ ...formData, type: 'flow' })}
                  data-testid="card-type-flow"
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      formData.type === 'flow' 
                        ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-semibold ${formData.type === 'flow' ? 'text-violet-700 dark:text-violet-300' : ''}`}>{t('agents.create.flowAgent')}</h4>
                        {formData.type === 'flow' && (
                          <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('agents.create.flowDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Name - Common for both types */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">
                {t('agents.create.nameRequired')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="agent-name"
                placeholder={formData.type === 'incoming' ? t('agents.create.incomingPlaceholder') : t('agents.create.flowPlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-agent-name"
              />
            </div>

            {/* Incoming Agent Specific Fields - Voice & Personality */}
            {formData.type === 'incoming' && (
              <>
                {/* Voice & Personality Section Header */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Mic className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">{t('agents.create.voicePersonality')}</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="voice-tone">{t('agents.create.voiceTone')}</Label>
                      <InfoTooltip content={t('agents.create.voiceToneTooltip')} />
                    </div>
                    <Select
                      value={formData.voiceTone}
                      onValueChange={(value) => setFormData({ ...formData, voiceTone: value })}
                    >
                      <SelectTrigger id="voice-tone" data-testid="select-voice-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">{t('agents.voiceTones.professional')}</SelectItem>
                        <SelectItem value="friendly">{t('agents.voiceTones.friendly')}</SelectItem>
                        <SelectItem value="casual">{t('agents.voiceTones.casual')}</SelectItem>
                        <SelectItem value="formal">{t('agents.voiceTones.formal')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="personality">{t('agents.create.personality')}</Label>
                      <InfoTooltip content={t('agents.create.personalityTooltip')} />
                    </div>
                    <Select
                      value={formData.personality}
                      onValueChange={(value) => setFormData({ ...formData, personality: value })}
                    >
                      <SelectTrigger id="personality" data-testid="select-personality">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="helpful">{t('agents.personalities.helpful')}</SelectItem>
                        <SelectItem value="enthusiastic">{t('agents.personalities.enthusiastic')}</SelectItem>
                        <SelectItem value="empathetic">{t('agents.personalities.empathetic')}</SelectItem>
                        <SelectItem value="direct">{t('agents.personalities.direct')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Flow Agent Specific Fields */}
            {formData.type === 'flow' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="flow-select">
                      {t('agents.create.conversationFlowRequired')} <span className="text-destructive">*</span>
                    </Label>
                    <InfoTooltip content={t('agents.create.conversationFlowTooltip')} />
                  </div>
                  <Select
                    value={formData.flowId}
                    onValueChange={(value) => setFormData({ ...formData, flowId: value })}
                  >
                    <SelectTrigger id="flow-select" data-testid="select-flow">
                      <SelectValue placeholder={t('agents.create.selectFlow')} />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.length === 0 ? (
                        <SelectItem value="no-flows-available" disabled>{t('agents.create.noFlowsAvailable')}</SelectItem>
                      ) : (
                        flows.map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {flows.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('agents.create.createFlowFirst')}
                    </p>
                  )}
                </div>

                {/* Max Conversation Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Label>{t('agents.create.maxConversationDuration')}</Label>
                      <InfoTooltip content={t('agents.create.maxDurationTooltip')} />
                    </div>
                    <span className="text-sm text-muted-foreground">{Math.round(formData.maxDurationSeconds / 60)} min</span>
                  </div>
                  <Slider
                    min={60}
                    max={1800}
                    step={60}
                    value={[formData.maxDurationSeconds]}
                    onValueChange={(value) => setFormData({ ...formData, maxDurationSeconds: value[0] })}
                    data-testid="slider-max-duration"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>1 min</span>
                    <span>30 min</span>
                  </div>
                </div>

                {/* Voice Settings for Flow Agents - Only show for ElevenLabs-based engines */}
                {formData.telephonyProvider !== "plivo" && formData.telephonyProvider !== "twilio_openai" && formData.telephonyProvider !== "openai-sip" && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base">{t('agents.create.voiceFineTuning')}</Label>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Label>{t('agents.create.stability')}</Label>
                          <InfoTooltip content={t('agents.create.stabilityTooltip')} />
                        </div>
                        <span className="text-sm text-muted-foreground">{Math.round(formData.voiceStability * 100)}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[formData.voiceStability]}
                        onValueChange={(value) => setFormData({ ...formData, voiceStability: value[0] })}
                        data-testid="slider-voice-stability"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Label>{t('agents.create.similarityBoost')}</Label>
                          <InfoTooltip content={t('agents.create.similarityBoostTooltip')} />
                        </div>
                        <span className="text-sm text-muted-foreground">{Math.round(formData.voiceSimilarityBoost * 100)}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[formData.voiceSimilarityBoost]}
                        onValueChange={(value) => setFormData({ ...formData, voiceSimilarityBoost: value[0] })}
                        data-testid="slider-voice-similarity"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Label>{t('agents.create.speechSpeed')}</Label>
                          <InfoTooltip content={t('agents.create.speechSpeedTooltip')} />
                        </div>
                        <span className="text-sm text-muted-foreground">{formData.voiceSpeed.toFixed(2)}x</span>
                      </div>
                      <Slider
                        min={0.7}
                        max={1.2}
                        step={0.05}
                        value={[formData.voiceSpeed]}
                        onValueChange={(value) => setFormData({ ...formData, voiceSpeed: value[0] })}
                        data-testid="slider-voice-speed"
                      />
                    </div>
                  </div>
                )}

                {/* System Tools Section for Flow Agents - Only show for ElevenLabs-based engines */}
                {formData.telephonyProvider !== "plivo" && formData.telephonyProvider !== "twilio_openai" && formData.telephonyProvider !== "openai-sip" && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center">
                      <Label className="text-base">{t('agents.create.systemTools')}</Label>
                      <InfoTooltip content={t('agents.create.systemToolsTooltip')} />
                    </div>
                    
                    {/* Language Detection Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer" data-testid="label-flow-enable-language-detection">
                      <Checkbox
                        checked={formData.detectLanguageEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, detectLanguageEnabled: checked as boolean })}
                        data-testid="checkbox-flow-enable-language-detection"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{t('agents.create.enableLanguageDetection')}</span>
                          <InfoTooltip content={t('agents.create.languageDetectionTooltip')} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('agents.create.languageDetectionDescription')}
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Telephony Provider Selection for Flow Agents */}
                {(hasAlternateEngines || formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai") && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Settings2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">Voice Engine</Label>
                    </div>
                    <div className={`grid gap-3 ${isPlivoEnabled && isTwilioOpenaiEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {/* ElevenLabs + Twilio - Purple theme */}
                      <div
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.telephonyProvider === "twilio"
                            ? "border-violet-500 bg-violet-500/10 dark:bg-violet-500/20"
                            : "border-border hover:border-violet-400/50 hover:bg-violet-500/5"
                        }`}
                        onClick={() => setFormData({ 
                          ...formData, 
                          telephonyProvider: "twilio",
                          llmModel: availableLLMModels.length > 0 ? availableLLMModels[0].modelId : "gpt-4o-mini"
                        })}
                        data-testid="flow-provider-twilio"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-violet-700 dark:text-violet-300">ElevenLabs + Twilio</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Premium voice, 30+ languages
                            </p>
                          </div>
                          {formData.telephonyProvider === "twilio" && (
                            <Check className="h-4 w-4 text-violet-600" />
                          )}
                        </div>
                      </div>
                      {/* OpenAI + Twilio - Teal theme */}
                      {(isTwilioOpenaiEnabled || formData.telephonyProvider === "twilio_openai") && (
                        <div
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.telephonyProvider === "twilio_openai"
                              ? "border-teal-500 bg-teal-500/10 dark:bg-teal-500/20"
                              : "border-border hover:border-teal-400/50 hover:bg-teal-500/5"
                          }`}
                          onClick={() => setFormData({ 
                            ...formData, 
                            telephonyProvider: "twilio_openai",
                            llmModel: "gpt-realtime-mini"
                          })}
                          data-testid="flow-provider-twilio-openai"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-teal-700 dark:text-teal-300">OpenAI + Twilio</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Real-time AI, international
                              </p>
                            </div>
                            {formData.telephonyProvider === "twilio_openai" && (
                              <Check className="h-4 w-4 text-teal-600" />
                            )}
                          </div>
                        </div>
                      )}
                      {/* OpenAI + Plivo - Green theme */}
                      {(isPlivoEnabled || formData.telephonyProvider === "plivo") && (
                        <div
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.telephonyProvider === "plivo"
                              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20"
                              : "border-border hover:border-emerald-400/50 hover:bg-emerald-500/5"
                          }`}
                          onClick={() => setFormData({ 
                            ...formData, 
                            telephonyProvider: "plivo",
                            llmModel: "gpt-realtime-mini"
                          })}
                          data-testid="flow-provider-plivo"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-emerald-700 dark:text-emerald-300">OpenAI + Plivo</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Real-time AI, India numbers
                              </p>
                            </div>
                            {formData.telephonyProvider === "plivo" && (
                              <Check className="h-4 w-4 text-emerald-600" />
                            )}
                          </div>
                        </div>
                      )}
                      {/* ElevenLabs SIP - Orange theme */}
                      {(isElevenLabsSipAllowed || formData.telephonyProvider === "elevenlabs-sip") && (
                        <div
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.telephonyProvider === "elevenlabs-sip"
                              ? "border-orange-500 bg-orange-500/10 dark:bg-orange-500/20"
                              : "border-border hover:border-orange-400/50 hover:bg-orange-500/5"
                          }`}
                          onClick={() => setFormData({ 
                            ...formData, 
                            telephonyProvider: "elevenlabs-sip",
                            llmModel: availableLLMModels.length > 0 ? availableLLMModels[0].modelId : "gpt-4o-mini"
                          })}
                          data-testid="flow-provider-elevenlabs-sip"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-orange-700 dark:text-orange-300">ElevenLabs SIP</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600 dark:border-orange-600 dark:text-orange-400">Plugin</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Your own SIP trunk
                              </p>
                            </div>
                            {formData.telephonyProvider === "elevenlabs-sip" && (
                              <Check className="h-4 w-4 text-orange-600" />
                            )}
                          </div>
                        </div>
                      )}
                      {/* OpenAI SIP - Pink theme */}
                      {(isOpenAISipAllowed || formData.telephonyProvider === "openai-sip") && (
                        <div
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.telephonyProvider === "openai-sip"
                              ? "border-pink-500 bg-pink-500/10 dark:bg-pink-500/20"
                              : "border-border hover:border-pink-400/50 hover:bg-pink-500/5"
                          }`}
                          onClick={() => setFormData({ 
                            ...formData, 
                            telephonyProvider: "openai-sip",
                            llmModel: "gpt-realtime-mini"
                          })}
                          data-testid="flow-provider-openai-sip"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-pink-700 dark:text-pink-300">OpenAI SIP</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-pink-300 text-pink-600 dark:border-pink-600 dark:text-pink-400">Plugin</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Your own SIP trunk
                              </p>
                            </div>
                            {formData.telephonyProvider === "openai-sip" && (
                              <Check className="h-4 w-4 text-pink-600" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Note: SIP Phone Number selection is done at campaign level, not agent level */}

                {/* Voice Selection for Flow Agents */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="flow-voice">
                      Voice <span className="text-destructive">*</span>
                    </Label>
                    <InfoTooltip content={t('agents.create.voiceTooltip')} />
                  </div>
                  {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? (
                    <Select
                      value={formData.openaiVoice}
                      onValueChange={(value) => setFormData({ ...formData, openaiVoice: value })}
                    >
                      <SelectTrigger id="flow-voice" data-testid="select-flow-openai-voice">
                        <SelectValue placeholder="Select OpenAI voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {openaiVoices.map((voice) => (
                          <SelectItem key={voice.value} value={voice.value}>
                            <div className="flex flex-col">
                              <span>{voice.label}</span>
                              <span className="text-xs text-muted-foreground">{voice.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <VoiceSearchPicker
                          value={formData.elevenLabsVoiceId}
                          onChange={(voiceId) => setFormData({ ...formData, elevenLabsVoiceId: voiceId })}
                          placeholder={t('agents.create.selectVoicePlaceholder')}
                        />
                      </div>
                      <VoicePreviewButton 
                        voiceId={formData.elevenLabsVoiceId}
                        voiceSettings={{
                          stability: formData.voiceStability ?? 0.5,
                          similarity_boost: formData.voiceSimilarityBoost ?? 0.75,
                          speed: formData.voiceSpeed ?? 1.0,
                        }}
                        onSettingsChange={(settings) => {
                          setFormData({
                            ...formData,
                            voiceStability: settings.stability,
                            voiceSimilarityBoost: settings.similarity_boost,
                            voiceSpeed: settings.speed,
                          });
                        }}
                        compact
                      />
                    </div>
                  )}
                </div>

                {/* Flow Agent Configuration Section */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base">{t('agents.create.agentConfiguration')}</Label>
                  
                  {/* LLM Model for Flow Agents - Show OpenAI models for OpenAI-based engines */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="flow-model">
                        {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI Model" : t('agents.create.llmModelRequired')} <span className="text-destructive">*</span>
                      </Label>
                      <InfoTooltip content={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "Select the OpenAI Realtime model for voice conversations" : t('agents.create.llmModelTooltip')} />
                    </div>
                    {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? (
                      <Select
                        value={formData.llmModel}
                        onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                      >
                        <SelectTrigger id="flow-model" data-testid="select-flow-model">
                          <SelectValue placeholder={openaiRealtimeModels.length === 0 ? "Loading models..." : "Select OpenAI model"} />
                        </SelectTrigger>
                        <SelectContent>
                          {openaiRealtimeModels.length === 0 ? (
                            <SelectItem value="gpt-realtime-mini">
                              GPT Realtime Mini (Default)
                            </SelectItem>
                          ) : (
                            openaiRealtimeModels.map((model) => (
                              <SelectItem key={model.id} value={model.modelId}>
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {model.tier === 'free' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      <Check className="h-3 w-3" />
                                      {t('agents.create.free')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border border-violet-300/50 dark:border-violet-500/30">
                                      <Sparkles className="h-3 w-3" />
                                      {t('agents.create.pro')}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={formData.llmModel}
                        onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                      >
                        <SelectTrigger id="flow-model" data-testid="select-flow-model">
                          <SelectValue placeholder={availableLLMModels.length === 0 ? t('agents.create.noModelsAvailable') : t('agents.create.selectAModel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLLMModels.length === 0 ? (
                            <SelectItem value="no-models" disabled>
                              {t('agents.create.noModelsAvailable')}
                            </SelectItem>
                          ) : (
                            availableLLMModels.map((model) => (
                              <SelectItem key={model.id} value={model.modelId}>
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {model.tier === 'free' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      <Check className="h-3 w-3" />
                                      {t('agents.create.free')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border border-violet-300/50 dark:border-violet-500/30">
                                      <Sparkles className="h-3 w-3" />
                                      {t('agents.create.pro')}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI Realtime models for low-latency voice AI" : t('agents.create.chooseModelFlow')}
                    </p>
                  </div>

                  {/* Temperature for Flow Agents - Extended range for OpenAI */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label>{t('agents.create.temperature')}</Label>
                      <InfoTooltip content={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI temperature (0-2): Higher values make output more random" : t('agents.create.temperatureTooltip')} />
                    </div>
                    <div className="space-y-4">
                      <Slider
                        min={0}
                        max={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? 2 : 1}
                        step={0.1}
                        value={[formData.temperature]}
                        onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
                        data-testid="slider-flow-temperature"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('agents.create.current')}: {formData.temperature.toFixed(1)}</span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={formData.temperature === 0.0 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, temperature: 0.0 })}
                            data-testid="button-flow-temp-deterministic"
                          >
                            {t('agents.create.deterministic')}
                          </Button>
                          <Button
                            type="button"
                            variant={formData.temperature === 0.5 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, temperature: 0.5 })}
                            data-testid="button-flow-temp-creative"
                          >
                            {t('agents.create.creative')}
                          </Button>
                          <Button
                            type="button"
                            variant={formData.temperature === 1.0 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, temperature: 1.0 })}
                            data-testid="button-flow-temp-more-creative"
                          >
                            {t('agents.create.moreCreative')}
                          </Button>
                          {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") && (
                            <Button
                              type="button"
                              variant={formData.temperature === 2.0 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setFormData({ ...formData, temperature: 2.0 })}
                              data-testid="button-flow-temp-very-creative"
                            >
                              Very Creative
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="flow-system-prompt">{t('agents.create.systemPrompt')}</Label>
                      <InfoTooltip content={t('agents.create.systemPromptTooltip')} />
                    </div>
                    <Textarea
                      id="flow-system-prompt"
                      placeholder={t('agents.create.systemPromptPlaceholderFlow')}
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      rows={4}
                      data-testid="input-flow-system-prompt"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('agents.create.systemPromptHint')}
                    </p>
                  </div>

                  {/* First Message */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="flow-first-message">{t('agents.create.firstMessage')}</Label>
                      <InfoTooltip content={t('agents.create.firstMessageTooltip')} />
                    </div>
                    <Textarea
                      id="flow-first-message"
                      placeholder={t('agents.create.firstMessagePlaceholderFlow')}
                      value={formData.firstMessage}
                      onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
                      rows={2}
                      data-testid="input-flow-first-message"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('agents.create.firstMessageHint')}
                    </p>
                  </div>

                  {/* Knowledge Base */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label>{t('agents.create.knowledgeBase')}</Label>
                      <InfoTooltip content={t('agents.create.knowledgeBaseTooltip')} />
                    </div>
                    <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                      {knowledgeBase.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-flow-no-knowledge-base">{t('agents.create.noKnowledgeItems')}</p>
                      ) : (
                        knowledgeBase.map((kb) => (
                          <label
                            key={kb.id}
                            className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md p-2"
                            data-testid={`label-flow-kb-${kb.id}`}
                          >
                            <Checkbox
                              checked={formData.knowledgeBaseIds.includes(kb.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    knowledgeBaseIds: [...formData.knowledgeBaseIds, kb.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    knowledgeBaseIds: formData.knowledgeBaseIds.filter((id) => id !== kb.id),
                                  });
                                }
                              }}
                              data-testid={`checkbox-flow-kb-${kb.id}`}
                            />
                            <span className="text-sm">{kb.title}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {knowledgeBase.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('agents.create.addKnowledgeHint')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Voice & Language Section - Common for both types */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Mic className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{t('agents.create.voiceLanguage')}</Label>
            </div>

            {/* Telephony Provider Selection - Show only for INCOMING agents if alternate engines are enabled */}
            {formData.type === 'incoming' && (hasAlternateEngines || formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai") && (
              <div className="space-y-2">
                <Label>Telephony Provider</Label>
                <div className={`grid gap-3 ${isPlivoEnabled && isTwilioOpenaiEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {/* ElevenLabs + Twilio - Purple theme */}
                  <div
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.telephonyProvider === "twilio"
                        ? "border-violet-500 bg-violet-500/10 dark:bg-violet-500/20"
                        : "border-border hover:border-violet-400/50 hover:bg-violet-500/5"
                    }`}
                    onClick={() => setFormData({ 
                      ...formData, 
                      telephonyProvider: "twilio",
                      llmModel: availableLLMModels.length > 0 ? availableLLMModels[0].modelId : "gpt-4o-mini"
                    })}
                    data-testid="provider-twilio"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-violet-700 dark:text-violet-300">ElevenLabs + Twilio</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Premium voice quality, 30+ languages
                        </p>
                      </div>
                      {formData.telephonyProvider === "twilio" && (
                        <Check className="h-4 w-4 text-violet-600" />
                      )}
                    </div>
                  </div>
                  {/* OpenAI + Twilio - Teal theme */}
                  {(isTwilioOpenaiEnabled || formData.telephonyProvider === "twilio_openai") && (
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.telephonyProvider === "twilio_openai"
                          ? "border-teal-500 bg-teal-500/10 dark:bg-teal-500/20"
                          : "border-border hover:border-teal-400/50 hover:bg-teal-500/5"
                      }`}
                      onClick={() => setFormData({ 
                        ...formData, 
                        telephonyProvider: "twilio_openai",
                        llmModel: "gpt-realtime-mini"
                      })}
                      data-testid="provider-twilio-openai"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-teal-700 dark:text-teal-300">OpenAI + Twilio</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Real-time AI, international
                          </p>
                        </div>
                        {formData.telephonyProvider === "twilio_openai" && (
                          <Check className="h-4 w-4 text-teal-600" />
                        )}
                      </div>
                    </div>
                  )}
                  {/* OpenAI + Plivo - Green theme */}
                  {(isPlivoEnabled || formData.telephonyProvider === "plivo") && (
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.telephonyProvider === "plivo"
                          ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20"
                          : "border-border hover:border-emerald-400/50 hover:bg-emerald-500/5"
                      }`}
                      onClick={() => setFormData({ 
                        ...formData, 
                        telephonyProvider: "plivo",
                        llmModel: "gpt-realtime-mini"
                      })}
                      data-testid="provider-plivo"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">OpenAI + Plivo</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Real-time AI, India numbers
                          </p>
                        </div>
                        {formData.telephonyProvider === "plivo" && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                    </div>
                  )}
                  {/* ElevenLabs SIP - Orange theme */}
                  {(isElevenLabsSipAllowed || formData.telephonyProvider === "elevenlabs-sip") && (
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.telephonyProvider === "elevenlabs-sip"
                          ? "border-orange-500 bg-orange-500/10 dark:bg-orange-500/20"
                          : "border-border hover:border-orange-400/50 hover:bg-orange-500/5"
                      }`}
                      onClick={() => setFormData({ 
                        ...formData, 
                        telephonyProvider: "elevenlabs-sip",
                        llmModel: availableLLMModels.length > 0 ? availableLLMModels[0].modelId : "gpt-4o-mini"
                      })}
                      data-testid="provider-elevenlabs-sip"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-orange-700 dark:text-orange-300">ElevenLabs SIP</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600 dark:border-orange-600 dark:text-orange-400">Plugin</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Your own SIP trunk
                          </p>
                        </div>
                        {formData.telephonyProvider === "elevenlabs-sip" && (
                          <Check className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                    </div>
                  )}
                  {/* OpenAI SIP - Pink theme */}
                  {(isOpenAISipAllowed || formData.telephonyProvider === "openai-sip") && (
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.telephonyProvider === "openai-sip"
                          ? "border-pink-500 bg-pink-500/10 dark:bg-pink-500/20"
                          : "border-border hover:border-pink-400/50 hover:bg-pink-500/5"
                      }`}
                      onClick={() => setFormData({ 
                        ...formData, 
                        telephonyProvider: "openai-sip",
                        llmModel: "gpt-realtime-mini"
                      })}
                      data-testid="provider-openai-sip"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-pink-700 dark:text-pink-300">OpenAI SIP</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-pink-300 text-pink-600 dark:border-pink-600 dark:text-pink-400">Plugin</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Your own SIP trunk
                          </p>
                        </div>
                        {formData.telephonyProvider === "openai-sip" && (
                          <Check className="h-4 w-4 text-pink-600" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Note: SIP Phone Number selection is done at campaign level, not agent level */}

            <div className="grid grid-cols-2 gap-4 overflow-visible">
              <div className="space-y-2 relative z-20">
                <div className="flex items-center">
                  <Label htmlFor="voice">
                    {t('agents.create.voiceRequired')} <span className="text-destructive">*</span>
                  </Label>
                  <InfoTooltip content={t('agents.create.voiceTooltip')} />
                </div>
                {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={formData.openaiVoice}
                        onValueChange={(value) => setFormData({ ...formData, openaiVoice: value })}
                      >
                        <SelectTrigger data-testid="select-openai-voice">
                          <SelectValue placeholder="Select OpenAI voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {openaiVoices.map((voice) => (
                            <SelectItem key={voice.value} value={voice.value}>
                              <div className="flex flex-col">
                                <span>{voice.label}</span>
                                <span className="text-xs text-muted-foreground">{voice.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <OpenAIVoicePreviewButton
                      voiceId={formData.openaiVoice}
                      voiceName={openaiVoices.find(v => v.value === formData.openaiVoice)?.label}
                      speed={formData.voiceSpeed ?? 1.0}
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <VoiceSearchPicker
                        value={formData.elevenLabsVoiceId}
                        onChange={(voiceId) => setFormData({ ...formData, elevenLabsVoiceId: voiceId })}
                        placeholder={t('agents.create.selectVoicePlaceholder')}
                      />
                    </div>
                    <VoicePreviewButton 
                      voiceId={formData.elevenLabsVoiceId}
                      voiceSettings={{
                        stability: formData.voiceStability ?? 0.5,
                        similarity_boost: formData.voiceSimilarityBoost ?? 0.75,
                        speed: formData.voiceSpeed ?? 1.0,
                      }}
                      onSettingsChange={(settings) => {
                        setFormData({
                          ...formData,
                          voiceStability: settings.stability,
                          voiceSimilarityBoost: settings.similarity_boost,
                          voiceSpeed: settings.speed,
                        });
                      }}
                      compact
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="language">
                    {t('agents.create.languageRequired')} <span className="text-destructive">*</span>
                  </Label>
                  <InfoTooltip content={t('agents.create.languageTooltip')} />
                </div>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger id="language" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isElevenLabs = formData.telephonyProvider === "twilio";
                      const isSupported = isElevenLabs 
                        ? isProviderSupported(lang.value, "elevenlabs")
                        : true;
                      return (
                        <SelectItem 
                          key={lang.value} 
                          value={lang.value}
                          disabled={!isSupported}
                          className={!isSupported ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          <LanguageOptionLabel 
                            label={t(`agents.languages.${lang.value}`, { defaultValue: lang.label })} 
                            providers={lang.providers} 
                            compact 
                          />
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Incoming Agent LLM and Prompt Configuration */}
            {formData.type === 'incoming' && (
              <>
                {/* AI Model Section Header */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('agents.create.aiModelBehavior')}</Label>
                </div>

                {/* LLM Model for Incoming Agents - Show OpenAI models for OpenAI-based engines */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="model">
                      {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI Model" : t('agents.create.llmModelRequired')} <span className="text-destructive">*</span>
                    </Label>
                    <InfoTooltip content={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "Select the OpenAI Realtime model for voice conversations" : t('agents.create.llmModelTooltip')} />
                  </div>
                  {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? (
                    <Select
                      value={formData.llmModel}
                      onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                    >
                      <SelectTrigger id="model" data-testid="select-model">
                        <SelectValue placeholder={openaiRealtimeModels.length === 0 ? "Loading models..." : "Select OpenAI model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {openaiRealtimeModels.length === 0 ? (
                          <SelectItem value="gpt-4o-mini-realtime-preview">
                            GPT-4o Mini Realtime (Default)
                          </SelectItem>
                        ) : (
                          openaiRealtimeModels.map((model) => (
                            <SelectItem key={model.id} value={model.modelId}>
                              <div className="flex items-center gap-2">
                                <span>{model.name}</span>
                                {model.tier === 'free' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <Check className="h-3 w-3" />
                                    {t('agents.create.free')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border border-violet-300/50 dark:border-violet-500/30">
                                    <Sparkles className="h-3 w-3" />
                                    {t('agents.create.pro')}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={formData.llmModel}
                      onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                    >
                      <SelectTrigger id="model" data-testid="select-model">
                        <SelectValue placeholder={availableLLMModels.length === 0 ? t('agents.create.noModelsAvailable') : t('agents.create.selectAModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLLMModels.length === 0 ? (
                          <SelectItem value="no-models" disabled>
                            {t('agents.create.noModelsAvailable')}
                          </SelectItem>
                        ) : (
                          availableLLMModels.map((model) => (
                            <SelectItem key={model.id} value={model.modelId}>
                              <div className="flex items-center gap-2">
                                <span>{model.name}</span>
                                {model.tier === 'free' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <Check className="h-3 w-3" />
                                    {t('agents.create.free')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border border-violet-300/50 dark:border-violet-500/30">
                                    <Sparkles className="h-3 w-3" />
                                    {t('agents.create.pro')}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI Realtime models for low-latency voice AI" : t('agents.create.chooseModel')}
                  </p>
                </div>

                {/* Temperature for Incoming Agents - Extended range for OpenAI */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label>{t('agents.create.temperature')}</Label>
                    <InfoTooltip content={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? "OpenAI temperature (0-2): Higher values make output more random" : t('agents.create.temperatureTooltipFull')} />
                  </div>
                  <div className="space-y-4">
                    <Slider
                      min={0}
                      max={(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") ? 2 : 1}
                      step={0.1}
                      value={[formData.temperature]}
                      onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
                      data-testid="slider-temperature"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('agents.create.current')}: {formData.temperature.toFixed(1)}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={formData.temperature === 0.0 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, temperature: 0.0 })}
                          data-testid="button-temp-deterministic"
                        >
                          {t('agents.create.deterministic')}
                        </Button>
                        <Button
                          type="button"
                          variant={formData.temperature === 0.5 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, temperature: 0.5 })}
                          data-testid="button-temp-creative"
                        >
                          {t('agents.create.creative')}
                        </Button>
                        <Button
                          type="button"
                          variant={formData.temperature === 1.0 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, temperature: 1.0 })}
                          data-testid="button-temp-more-creative"
                        >
                          {t('agents.create.moreCreative')}
                        </Button>
                        {(formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip") && (
                          <Button
                            type="button"
                            variant={formData.temperature === 2.0 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, temperature: 2.0 })}
                            data-testid="button-temp-very-creative"
                          >
                            Very Creative
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

            {/* Voice Fine-Tuning Section for Incoming Agents - Only show for ElevenLabs-based engines */}
            {formData.telephonyProvider !== "plivo" && formData.telephonyProvider !== "twilio_openai" && formData.telephonyProvider !== "openai-sip" && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base">{t('agents.create.voiceFineTuning')}</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Label>{t('agents.create.stability')}</Label>
                      <InfoTooltip content={t('agents.create.stabilityTooltip')} />
                    </div>
                    <span className="text-sm text-muted-foreground">{Math.round(formData.voiceStability * 100)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[formData.voiceStability]}
                    onValueChange={(value) => setFormData({ ...formData, voiceStability: value[0] })}
                    data-testid="slider-incoming-voice-stability"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Label>{t('agents.create.similarityBoost')}</Label>
                      <InfoTooltip content={t('agents.create.similarityBoostTooltip')} />
                    </div>
                    <span className="text-sm text-muted-foreground">{Math.round(formData.voiceSimilarityBoost * 100)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[formData.voiceSimilarityBoost]}
                    onValueChange={(value) => setFormData({ ...formData, voiceSimilarityBoost: value[0] })}
                    data-testid="slider-incoming-voice-similarity"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Label>{t('agents.create.speechSpeed')}</Label>
                      <InfoTooltip content={t('agents.create.speechSpeedTooltip')} />
                    </div>
                    <span className="text-sm text-muted-foreground">{formData.voiceSpeed.toFixed(2)}x</span>
                  </div>
                  <Slider
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    value={[formData.voiceSpeed]}
                    onValueChange={(value) => setFormData({ ...formData, voiceSpeed: value[0] })}
                    data-testid="slider-incoming-voice-speed"
                  />
                </div>
              </div>
            )}

            <PromptTemplatesLibrary
              mode="select"
              onSelectTemplate={(template) => {
                setFormData({ 
                  ...formData, 
                  systemPrompt: template.systemPrompt,
                  firstMessage: template.firstMessage || formData.firstMessage,
                  voiceTone: template.suggestedVoiceTone || formData.voiceTone,
                  personality: template.suggestedPersonality || formData.personality,
                  sourceTemplateId: template.id,
                  isFromTemplate: template.isSystemTemplate || false,
                  tags: template.tags || [],
                });
              }}
            />

            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="system-prompt">
                  {t('agents.create.systemPromptRequired')} <span className="text-destructive">*</span>
                </Label>
                <InfoTooltip content={t('agents.create.systemPromptTooltipFull')} />
              </div>
              <Textarea
                id="system-prompt"
                placeholder={t('agents.create.systemPromptPlaceholder')}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                rows={8}
                data-testid="input-system-prompt"
              />
              <p className="text-xs text-muted-foreground">
                {t('agents.create.systemPromptTip')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="first-message">{t('agents.create.firstMessage')}</Label>
                <InfoTooltip content={t('agents.create.firstMessageTooltipFull')} />
              </div>
              <Textarea
                id="first-message"
                placeholder={t('agents.create.firstMessagePlaceholder')}
                value={formData.firstMessage}
                onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
                rows={2}
                data-testid="input-first-message"
              />
              <p className="text-xs text-muted-foreground">
                {t('agents.create.firstMessageTip')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Label>{t('agents.create.knowledgeBase')}</Label>
                <InfoTooltip content={t('agents.create.knowledgeBaseTooltipFull')} />
              </div>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {knowledgeBase.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('agents.create.noKnowledgeItems')}</p>
                ) : (
                  knowledgeBase.map((kb) => (
                    <label
                      key={kb.id}
                      className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md p-2"
                      data-testid={`label-kb-${kb.id}`}
                    >
                      <Checkbox
                        checked={formData.knowledgeBaseIds.includes(kb.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              knowledgeBaseIds: [...formData.knowledgeBaseIds, kb.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              knowledgeBaseIds: formData.knowledgeBaseIds.filter(id => id !== kb.id),
                            });
                          }
                        }}
                        data-testid={`checkbox-kb-${kb.id}`}
                      />
                      <span className="text-sm">{kb.title}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('agents.create.selectKnowledgeHint')}
              </p>
            </div>

            {/* System Tools Section - Only for Incoming Agents */}
            {formData.type === 'incoming' && (
              <div className="space-y-4 pt-4">
                {/* System Tools Section Header */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Wrench className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t('agents.create.systemTools')}</Label>
                    <InfoTooltip content={t('agents.systemTools.description')} />
                  </div>
                </div>
                
                {/* Call Transfer Toggle */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer" data-testid="label-enable-transfer">
                    <Checkbox
                      checked={formData.transferEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, transferEnabled: checked as boolean })}
                      data-testid="checkbox-enable-transfer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{t('agents.systemTools.enableCallTransfer')}</span>
                        <InfoTooltip content={t('agents.systemTools.callTransferTooltip')} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('agents.systemTools.callTransferDescription')}
                      </p>
                    </div>
                  </label>
                  
                  {formData.transferEnabled && (
                    <div className="ml-7 space-y-2">
                      <Label htmlFor="transfer-phone" className="text-sm font-normal">
                        {t('agents.systemTools.transferPhoneNumber')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="transfer-phone"
                        placeholder="+1234567890"
                        value={formData.transferPhoneNumber}
                        onChange={(e) => setFormData({ ...formData, transferPhoneNumber: e.target.value })}
                        data-testid="input-transfer-phone"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('agents.systemTools.transferPhoneHint')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Language Detection Toggle - All engines support this */}
                <label className="flex items-center gap-3 cursor-pointer" data-testid="label-enable-language-detection">
                    <Checkbox
                      checked={formData.detectLanguageEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, detectLanguageEnabled: checked as boolean })}
                      data-testid="checkbox-enable-language-detection"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{t('agents.create.enableLanguageDetection')}</span>
                        <InfoTooltip content={t('agents.systemTools.languageDetectionTooltip')} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('agents.systemTools.languageDetectionDescription')}
                      </p>
                    </div>
                </label>

                {/* End Conversation Toggle - All engines support this */}
                <label className="flex items-center gap-3 cursor-pointer" data-testid="label-enable-end-conversation">
                    <Checkbox
                      checked={formData.endConversationEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, endConversationEnabled: checked as boolean })}
                      data-testid="checkbox-enable-end-conversation"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{t('agents.systemTools.enableEndConversation')}</span>
                        <InfoTooltip content={t('agents.systemTools.endConversationTooltip')} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('agents.systemTools.endConversationDescription')}
                      </p>
                    </div>
                </label>

                {/* Appointment Booking Toggle - All incoming agents (ElevenLabs, Twilio+OpenAI, Plivo+OpenAI) */}
                {formData.type === "incoming" && (
                  <label className="flex items-center gap-3 cursor-pointer" data-testid="label-enable-appointment-booking">
                    <Checkbox
                      checked={formData.appointmentBookingEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, appointmentBookingEnabled: checked as boolean })}
                      data-testid="checkbox-enable-appointment-booking"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{t('agents.systemTools.enableAppointmentBooking')}</span>
                        <InfoTooltip content={t('agents.systemTools.appointmentBookingTooltip')} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('agents.systemTools.appointmentBookingDescription')}
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}
              </>
            )}
          </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingAgent(null);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={editingAgent ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-agent"
            >
              {createMutation.isPending || updateMutation.isPending
                ? t('common.saving')
                : editingAgent
                ? t('agents.create.updateAgent')
                : t('agents.create.createAgent')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAgent} onOpenChange={() => setDeletingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agents.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('agents.delete.description', { name: deletingAgent?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAgent && deleteMutation.mutate(deletingAgent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={knowledgeUploadOpen} onOpenChange={setKnowledgeUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agents.knowledge.uploadTitle')}</DialogTitle>
            <DialogDescription>
              {t('agents.knowledge.uploadDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="knowledge-title">{t('agents.knowledge.titleLabel')} *</Label>
              <Input
                id="knowledge-title"
                placeholder={t('agents.knowledge.titlePlaceholder')}
                value={knowledgeData.title}
                onChange={(e) => setKnowledgeData({ ...knowledgeData, title: e.target.value })}
                data-testid="input-knowledge-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-content">{t('agents.knowledge.contentLabel')} *</Label>
              <Textarea
                id="knowledge-content"
                placeholder={t('agents.knowledge.contentPlaceholder')}
                rows={10}
                value={knowledgeData.content}
                onChange={(e) => setKnowledgeData({ ...knowledgeData, content: e.target.value })}
                data-testid="input-knowledge-content"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKnowledgeUploadOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => uploadKnowledgeMutation.mutate()}
              disabled={!knowledgeData.title || !knowledgeData.content || uploadKnowledgeMutation.isPending}
              data-testid="button-upload-knowledge-submit"
            >
              {uploadKnowledgeMutation.isPending ? t('agents.knowledge.uploading') : t('agents.knowledge.uploadButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guided Agent Creation Wizard */}
      <AgentCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        }}
      />
      </TabsContent>
      </Tabs>
    </div>
  );
}
