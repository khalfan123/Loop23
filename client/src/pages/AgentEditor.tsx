import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Sparkles, GitBranch, CheckCircle2, Mic, Brain, Settings2, Wrench, Loader2, FileText, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import VoiceSearchPicker from "@/components/VoiceSearchPicker";
import VoicePreviewButton from "@/components/VoicePreviewButton";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";
import PromptTemplatesLibrary from "@/components/PromptTemplatesLibrary";
import AgentBehaviorSettings from "@/components/AgentBehaviorSettings";
import { SUPPORTED_LANGUAGES, getLanguageLabel, isProviderSupported } from "@/lib/languages";
import { LanguageOptionLabel } from "@/components/LanguageProviderBadges";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { useToast } from "@/hooks/use-toast";

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
  config: any;
  elevenLabsAgentId: string | null;
  elevenLabsVoiceId: string | null;
  firstMessage: string | null;
  language: string | null;
  llmModel: string | null;
  temperature: number | null;
  knowledgeBaseIds: string[] | null;
  transferEnabled: boolean;
  transferPhoneNumber: string | null;
  transferAgentId: string | null;
  detectLanguageEnabled: boolean;
  endConversationEnabled: boolean;
  appointmentBookingEnabled: boolean;
  flowId: string | null;
  maxDurationSeconds: number | null;
  voiceStability: number | null;
  voiceSimilarityBoost: number | null;
  voiceSpeed: number | null;
  telephonyProvider: string | null;
  openaiVoice: string | null;
  sourceTemplateId: string | null;
  isFromTemplate: boolean;
  tags: string[] | null;
  specialist: string | null;
  avatarUrl: string | null;
}

interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
}

interface KnowledgeBaseItem {
  id: string;
  title: string;
  type: string;
}

const OPENAI_VOICES = [
  { id: "alloy", name: "Alloy", description: "Neutral, balanced" },
  { id: "ash", name: "Ash", description: "Authoritative, firm" },
  { id: "ballad", name: "Ballad", description: "Warm, expressive" },
  { id: "coral", name: "Coral", description: "Persuasive, engaging" },
  { id: "echo", name: "Echo", description: "Deep, resonant" },
  { id: "sage", name: "Sage", description: "Calm, reassuring" },
  { id: "shimmer", name: "Shimmer", description: "Friendly, approachable" },
  { id: "verse", name: "Verse", description: "Articulate, clear" },
];

export default function AgentEditor() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/app/agents/:id/edit");
  const [matchNew] = useRoute("/app/agents/new");
  
  const isEditMode = matchEdit;
  const agentId = paramsEdit?.id;
  
  // Parse query params for type selection (incoming or flow)
  const searchString = useSearch();
  const getInitialType = useCallback(() => {
    const urlParams = new URLSearchParams(searchString);
    return (urlParams.get('type') as 'incoming' | 'flow') || 'incoming';
  }, [searchString]);
  
  const [animationState, setAnimationState] = useState<'idle' | 'success' | 'error'>('idle');
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  
  // Sync type from URL when navigating between types (only for new agents)
  useEffect(() => {
    if (!isEditMode) {
      const newType = getInitialType();
      setFormData(prev => ({ ...prev, type: newType }));
    }
  }, [searchString, isEditMode, getInitialType]);
  
  const [formData, setFormData] = useState({
    type: getInitialType(),
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
    transferEnabled: false,
    transferPhoneNumber: "",
    transferAgentId: "",
    transferType: "phone" as "phone" | "agent",
    detectLanguageEnabled: false,
    endConversationEnabled: false,
    appointmentBookingEnabled: false,
    flowId: "",
    maxDurationSeconds: 600,
    voiceStability: 0.55,
    voiceSimilarityBoost: 0.85,
    voiceSpeed: 1.0,
    telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip",
    openaiVoice: "alloy",
    sipPhoneNumberId: "",
    sourceTemplateId: "" as string,
    isFromTemplate: false,
    tags: [] as string[],
    specialist: "",
    behaviorConfig: {} as Record<string, any>,
    waitingMessages: [] as string[],
  });

  const { data: existingAgent, isLoading: agentLoading } = useQuery<Agent>({
    queryKey: [`/api/agents/${agentId}`],
    enabled: isEditMode && !!agentId,
  });

  const { data: voices = [] } = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const { data: knowledgeBase = [] } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/knowledge-base"],
  });

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

  const { data: availableAgents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: voiceEngineSettings } = useQuery<{ plivo_openai_engine_enabled: boolean; twilio_openai_engine_enabled: boolean }>({
    queryKey: ["/api/settings/voice-engine"],
    staleTime: 60000,
  });

  const isPlivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const isTwilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;

  const { isSipPluginEnabled, sipEnginesAllowed } = usePluginStatus();
  const isElevenLabsSipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("elevenlabs-sip");
  const isOpenAISipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("openai-sip");

  const { data: sipPhoneNumbersResponse } = useQuery<{ success: boolean; data: SipPhoneNumber[] }>({
    queryKey: ["/api/sip/phone-numbers"],
    enabled: isSipPluginEnabled,
  });
  const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];

  const hasAlternateEngines = isPlivoEnabled || isTwilioOpenaiEnabled || isElevenLabsSipAllowed || isOpenAISipAllowed;

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

  useEffect(() => {
    if (existingAgent && isEditMode) {
      setFormData({
        type: existingAgent.type,
        name: existingAgent.name,
        voiceTone: existingAgent.voiceTone || "professional",
        personality: existingAgent.personality || "helpful",
        systemPrompt: existingAgent.systemPrompt || "",
        elevenLabsVoiceId: existingAgent.elevenLabsVoiceId || "",
        language: existingAgent.language || "en",
        llmModel: existingAgent.llmModel || "gpt-4o-mini",
        firstMessage: existingAgent.firstMessage || "Hello! How can I help you today?",
        temperature: existingAgent.temperature ?? 0.5,
        knowledgeBaseIds: existingAgent.knowledgeBaseIds || [],
        transferNumber: "",
        transferKeywords: [],
        transferEnabled: existingAgent.transferEnabled || false,
        transferPhoneNumber: existingAgent.transferPhoneNumber || "",
        transferAgentId: existingAgent.transferAgentId || "",
        transferType: existingAgent.transferAgentId ? "agent" : "phone",
        detectLanguageEnabled: existingAgent.detectLanguageEnabled || false,
        endConversationEnabled: existingAgent.endConversationEnabled || false,
        appointmentBookingEnabled: existingAgent.appointmentBookingEnabled || false,
        flowId: existingAgent.flowId || "",
        maxDurationSeconds: existingAgent.maxDurationSeconds || 600,
        voiceStability: existingAgent.voiceStability ?? 0.55,
        voiceSimilarityBoost: existingAgent.voiceSimilarityBoost ?? 0.85,
        voiceSpeed: existingAgent.voiceSpeed ?? 1.0,
        telephonyProvider: (existingAgent.telephonyProvider as any) || "twilio",
        openaiVoice: existingAgent.openaiVoice || "alloy",
        sipPhoneNumberId: "",
        sourceTemplateId: existingAgent.sourceTemplateId || "",
        isFromTemplate: existingAgent.isFromTemplate || false,
        tags: existingAgent.tags || [],
        specialist: existingAgent.specialist || "",
        behaviorConfig: (existingAgent as any).behaviorConfig || {},
        waitingMessages: (existingAgent as any).waitingMessages || [],
      });
    }
  }, [existingAgent, isEditMode]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return res.json();
    },
    onSuccess: () => {
      setAnimationState('success');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        setLocation("/app/agents");
      }, 1500);
      toast({ title: t('agents.toast.created') });
    },
    onError: (error: any) => {
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
      setAnimationState('success');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        setLocation("/app/agents");
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
      setAnimationState('error');
      setTimeout(() => setAnimationState('idle'), 600);
      toast({
        title: t('agents.toast.updateFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name) {
      toast({
        title: t('agents.toast.missingFields'),
        description: t('agents.toast.pleaseEnterName'),
        variant: "destructive",
      });
      return;
    }

    if (formData.type === 'incoming') {
      const isOpenAIVoice = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";
      const hasValidVoice = isOpenAIVoice ? !!formData.openaiVoice : !!formData.elevenLabsVoiceId;
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
      if (formData.transferEnabled) {
        if (formData.transferType === "agent" && !formData.transferAgentId) {
          toast({
            title: t('agents.toast.missingFields'),
            description: "Please select an agent to transfer calls to.",
            variant: "destructive",
          });
          return;
        }
        if (formData.transferType !== "agent" && !formData.transferPhoneNumber.trim()) {
          toast({
            title: t('agents.toast.missingTransferPhone'),
            description: t('agents.toast.transferPhoneRequired'),
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (formData.type === 'flow') {
      if (!formData.flowId) {
        toast({
          title: t('agents.toast.missingFields'),
          description: t('agents.toast.pleaseSelectFlow'),
          variant: "destructive",
        });
        return;
      }
      const isOpenAIVoice = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";
      const hasValidVoice = isOpenAIVoice ? !!formData.openaiVoice : !!formData.elevenLabsVoiceId;
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

  const handleUpdate = () => {
    if (!agentId) return;
    
    if (formData.type === 'incoming' && formData.transferEnabled) {
      if (formData.transferType === "agent" && !formData.transferAgentId) {
        toast({
          title: t('agents.toast.missingFields'),
          description: "Please select an agent to transfer calls to.",
          variant: "destructive",
        });
        return;
      }
      if (formData.transferType !== "agent" && !formData.transferPhoneNumber.trim()) {
        toast({
          title: t('agents.toast.missingTransferPhone'),
          description: t('agents.toast.transferPhoneRequired'),
          variant: "destructive",
        });
        return;
      }
    }
    
    updateMutation.mutate({ id: agentId, data: formData });
  };

  const isOpenAIVoice = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {animationState === 'success' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 fade-in duration-300">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-[var(--glass-shadow-lg)]">
              <CheckCircle2 className="h-10 w-10 text-white animate-in zoom-in-75 duration-300 delay-150" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground tracking-tight">
                {isEditMode ? t('agents.create.agentUpdated') : t('agents.create.agentCreated')}
              </p>
              <p className="text-sm text-muted-foreground">{t('agents.create.readyToUse')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setLocation("/app/agents")}
          data-testid="button-back-to-agents"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? t('agents.create.editTitle') : t('agents.create.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('agents.create.dialogDescription')}
          </p>
        </div>
      </div>

      <Card className={`p-6 glass-card-heavy ${animationState === 'error' ? 'animate-shake' : ''}`}>
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('agents.create.typeRequired')} <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                  formData.type === 'incoming' 
                    ? 'glass-card bg-emerald-500/10 dark:bg-emerald-500/15 border-2 border-emerald-500/40 shadow-[var(--glass-shadow)]' 
                    : 'glass-surface border-2 border-transparent hover:border-white/30 dark:hover:border-white/10'
                } ${isEditMode ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => !isEditMode && setFormData({ ...formData, type: 'incoming' })}
                data-testid="card-type-incoming"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.type === 'incoming' 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold tracking-tight ${formData.type === 'incoming' ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{t('agents.create.incomingAgent')}</h4>
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
                className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                  formData.type === 'flow' 
                    ? 'glass-card bg-violet-500/10 dark:bg-violet-500/15 border-2 border-violet-500/40 shadow-[var(--glass-shadow)]' 
                    : 'glass-surface border-2 border-transparent hover:border-white/30 dark:hover:border-white/10'
                } ${isEditMode ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => !isEditMode && setFormData({ ...formData, type: 'flow' })}
                data-testid="card-type-flow"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.type === 'flow' 
                      ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' 
                      : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold tracking-tight ${formData.type === 'flow' ? 'text-violet-700 dark:text-violet-300' : ''}`}>{t('agents.create.flowAgent')}</h4>
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

          {formData.type === 'incoming' && (
            <>
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

              {hasAlternateEngines && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label>{t('agents.create.telephonyProvider')}</Label>
                    <InfoTooltip content={t('agents.create.telephonyProviderTooltip')} />
                  </div>
                  <Select
                    value={formData.telephonyProvider}
                    onValueChange={(value: "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip") => 
                      setFormData({ ...formData, telephonyProvider: value })
                    }
                  >
                    <SelectTrigger data-testid="select-telephony-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">{t('agents.providers.twilio')}</SelectItem>
                      {isPlivoEnabled && <SelectItem value="plivo">{t('agents.providers.plivo')}</SelectItem>}
                      {isTwilioOpenaiEnabled && <SelectItem value="twilio_openai">{t('agents.providers.twilioOpenai')}</SelectItem>}
                      {isElevenLabsSipAllowed && <SelectItem value="elevenlabs-sip">{t('agents.providers.elevenLabsSip')}</SelectItem>}
                      {isOpenAISipAllowed && <SelectItem value="openai-sip">{t('agents.providers.openaiSip')}</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center">
                  <Label>{t('agents.create.voiceRequired')} <span className="text-destructive">*</span></Label>
                  <InfoTooltip content={t('agents.create.voiceTooltip')} />
                </div>
                {isOpenAIVoice ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={formData.openaiVoice}
                      onValueChange={(value) => setFormData({ ...formData, openaiVoice: value })}
                    >
                      <SelectTrigger data-testid="select-openai-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} - {voice.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <OpenAIVoicePreviewButton voiceId={formData.openaiVoice} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <VoiceSearchPicker
                        value={formData.elevenLabsVoiceId}
                        onChange={(voiceId) => setFormData({ ...formData, elevenLabsVoiceId: voiceId })}
                      />
                    </div>
                    {formData.elevenLabsVoiceId && (
                      <VoicePreviewButton voiceId={formData.elevenLabsVoiceId} />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300">{t('agents.create.aiConfiguration')}</Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label htmlFor="system-prompt">{t('agents.create.systemPromptRequired')} <span className="text-destructive">*</span></Label>
                    <InfoTooltip content={t('agents.create.systemPromptTooltip')} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateLibrary(true)}
                    className="gap-1 text-xs"
                    data-testid="button-use-template"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('agents.create.useTemplate')}
                  </Button>
                </div>
                <Textarea
                  id="system-prompt"
                  placeholder={t('agents.create.systemPromptPlaceholder')}
                  rows={6}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  data-testid="textarea-system-prompt"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="first-message">{t('agents.create.firstMessage')}</Label>
                  <InfoTooltip content={t('agents.create.firstMessageTooltip')} />
                </div>
                <Input
                  id="first-message"
                  placeholder={t('agents.create.firstMessagePlaceholder')}
                  value={formData.firstMessage}
                  onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
                  data-testid="input-first-message"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="language">{t('agents.create.language')}</Label>
                    <InfoTooltip content={t('agents.create.languageTooltip')} />
                  </div>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData({ ...formData, language: value })}
                  >
                    <SelectTrigger id="language" data-testid="select-language">
                      <SelectValue>
                        {getLanguageLabel(formData.language)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          <LanguageOptionLabel label={lang.label} providers={lang.providers} compact />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="llm-model">{t('agents.create.llmModel')}</Label>
                    <InfoTooltip content={t('agents.create.llmModelTooltip')} />
                  </div>
                  <Select
                    value={formData.llmModel}
                    onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                  >
                    <SelectTrigger id="llm-model" data-testid="select-llm-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLLMModels.map((model) => (
                        <SelectItem key={model.id} value={model.modelId}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label>{t('agents.create.temperature')}</Label>
                    <InfoTooltip content={t('agents.create.temperatureTooltip')} />
                  </div>
                  <span className="text-sm text-muted-foreground">{formData.temperature.toFixed(2)}</span>
                </div>
                <Slider
                  value={[formData.temperature]}
                  onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
                  min={0}
                  max={1}
                  step={0.1}
                  data-testid="slider-temperature"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <Label className="text-sm font-semibold text-orange-700 dark:text-orange-300">{t('agents.systemTools.title')}</Label>
              </div>

              <div className="space-y-4 pl-2">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer" data-testid="label-enable-call-transfer">
                    <Checkbox
                      checked={formData.transferEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, transferEnabled: checked as boolean })}
                      data-testid="checkbox-enable-call-transfer"
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
                    <div className="ml-7 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-normal">Transfer Type <span className="text-destructive">*</span></Label>
                        <Select
                          value={formData.transferType}
                          onValueChange={(value: "phone" | "agent") => setFormData({ ...formData, transferType: value, ...(value === "phone" ? { transferAgentId: "" } : { transferPhoneNumber: "" }) })}
                        >
                          <SelectTrigger data-testid="select-transfer-type">
                            <SelectValue placeholder="Select transfer type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone" data-testid="select-item-transfer-phone">Phone Number</SelectItem>
                            <SelectItem value="agent" data-testid="select-item-transfer-agent">AI Agent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.transferType === "phone" && (
                        <div className="space-y-2">
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

                      {formData.transferType === "agent" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-normal">
                            Transfer to Agent <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.transferAgentId}
                            onValueChange={(value) => setFormData({ ...formData, transferAgentId: value })}
                          >
                            <SelectTrigger data-testid="select-transfer-agent">
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableAgents
                                .filter((a) => a.id !== agentId)
                                .map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id} data-testid={`select-item-agent-${agent.id}`}>
                                    {agent.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Select another AI agent to transfer calls to.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
              </div>
            </>
          )}

          {formData.type === 'flow' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label>{t('agents.create.selectFlow')} <span className="text-destructive">*</span></Label>
                  <InfoTooltip content={t('agents.create.selectFlowTooltip')} />
                </div>
                <Select
                  value={formData.flowId}
                  onValueChange={(value) => setFormData({ ...formData, flowId: value })}
                  disabled={isEditMode}
                >
                  <SelectTrigger data-testid="select-flow">
                    <SelectValue placeholder={t('agents.create.selectFlowPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {flows.map((flow) => (
                      <SelectItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {hasAlternateEngines && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label>{t('agents.create.telephonyProvider')}</Label>
                    <InfoTooltip content={t('agents.create.telephonyProviderTooltip')} />
                  </div>
                  <Select
                    value={formData.telephonyProvider}
                    onValueChange={(value: "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip") => 
                      setFormData({ ...formData, telephonyProvider: value })
                    }
                  >
                    <SelectTrigger data-testid="select-telephony-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">{t('agents.providers.twilio')}</SelectItem>
                      {isPlivoEnabled && <SelectItem value="plivo">{t('agents.providers.plivo')}</SelectItem>}
                      {isTwilioOpenaiEnabled && <SelectItem value="twilio_openai">{t('agents.providers.twilioOpenai')}</SelectItem>}
                      {isElevenLabsSipAllowed && <SelectItem value="elevenlabs-sip">{t('agents.providers.elevenLabsSip')}</SelectItem>}
                      {isOpenAISipAllowed && <SelectItem value="openai-sip">{t('agents.providers.openaiSip')}</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center">
                  <Label>{t('agents.create.voiceRequired')} <span className="text-destructive">*</span></Label>
                  <InfoTooltip content={t('agents.create.voiceTooltip')} />
                </div>
                {isOpenAIVoice ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={formData.openaiVoice}
                      onValueChange={(value) => setFormData({ ...formData, openaiVoice: value })}
                    >
                      <SelectTrigger data-testid="select-openai-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} - {voice.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <OpenAIVoicePreviewButton voiceId={formData.openaiVoice} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <VoiceSearchPicker
                        value={formData.elevenLabsVoiceId}
                        onChange={(voiceId) => setFormData({ ...formData, elevenLabsVoiceId: voiceId })}
                      />
                    </div>
                    {formData.elevenLabsVoiceId && (
                      <VoicePreviewButton voiceId={formData.elevenLabsVoiceId} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="my-2" />

          <AgentBehaviorSettings
            behaviorConfig={formData.behaviorConfig}
            waitingMessages={formData.waitingMessages}
            onBehaviorConfigChange={(config) => setFormData({ ...formData, behaviorConfig: config })}
            onWaitingMessagesChange={(messages) => setFormData({ ...formData, waitingMessages: messages })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-6 mt-6 border-t border-white/20 dark:border-white/[0.06]">
          <Button
            variant="outline"
            onClick={() => setLocation("/app/agents")}
            data-testid="button-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={isEditMode ? handleUpdate : handleCreate}
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-save-agent"
          >
            {createMutation.isPending || updateMutation.isPending
              ? t('common.saving')
              : isEditMode
              ? t('agents.create.updateAgent')
              : t('agents.create.createAgent')}
          </Button>
        </div>
      </Card>

      {showTemplateLibrary && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xl flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full max-h-[80vh] overflow-auto p-6 glass-card-heavy">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('agents.create.selectTemplate')}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowTemplateLibrary(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <PromptTemplatesLibrary
              mode="select"
              onSelectTemplate={(template) => {
                setFormData({
                  ...formData,
                  systemPrompt: template.systemPrompt,
                  sourceTemplateId: template.id || "",
                  isFromTemplate: template.isSystemTemplate || false,
                  tags: template.tags || [],
                });
                setShowTemplateLibrary(false);
              }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
