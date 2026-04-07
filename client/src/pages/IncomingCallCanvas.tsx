import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Bot,
  FileText,
  Database,
  Save,
  Loader2,
  Globe,
  Sparkles,
  Check,
  CheckCircle2,
  Circle,
  List,
  Search,
  Plus,
  Trash2,
  Link as LinkIcon,
  AudioWaveform,
  Volume2,
  Square,
  Wand2,
} from "lucide-react";
import { AuthStorage } from "@/lib/auth-storage";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
  country?: string | null;
  status?: string;
  isUnavailable?: boolean;
  unavailableReason?: string | null;
  isConflicted?: boolean;
  conflictReason?: string | null;
}

interface ExistingConnection {
  id: string;
  agentId: string;
  phoneNumberId: string;
  agent?: { id: string; name: string; language?: string } | null;
  phoneNumber?: { id: string; phoneNumber: string } | null;
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

interface ElevenLabsVoiceItem {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  systemPrompt: string;
  firstMessage: string | null;
  suggestedVoiceTone: string | null;
  isSystemTemplate: boolean;
}

interface KnowledgeBase {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  fileUrl?: string | null;
  content?: string | null;
}

const getLanguageLabel = (code: string) => {
  const labels: Record<string, string> = {
    en: "English", ar: "Arabic", fr: "French", hi: "Hindi",
    it: "Italian", zh: "Chinese", es: "Spanish", de: "German",
    pt: "Portuguese", ja: "Japanese", ko: "Korean", ru: "Russian",
    nl: "Dutch", tr: "Turkish", pl: "Polish", sv: "Swedish",
  };
  return labels[code] || code.toUpperCase();
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    agent_preset: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    sales: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    support: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    appointment: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    survey: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    general: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  return colors[category] || colors.general;
};

const STEPS = [
  { id: 1, label: "Phone Numbers", icon: Phone },
  { id: 2, label: "Voice & Agent", icon: AudioWaveform },
  { id: 3, label: "Prompt", icon: FileText },
  { id: 4, label: "Knowledge Base", icon: Database },
  { id: 5, label: "Review & Save", icon: Check },
];

function IncomingCallWizard({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [wizardMode, setWizardMode] = useState<"list" | "create">(embedded ? "list" : "create");
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [promptSearch, setPromptSearch] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [useCaseFilter, setUseCaseFilter] = useState<string>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'Female' | 'Male'>('all');
  const [voiceSearch, setVoiceSearch] = useState<string>("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const [agentName, setAgentName] = useState<string>("");
  const [suggestingAgentName, setSuggestingAgentName] = useState(false);
  const [agentNameSuggestions, setAgentNameSuggestions] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        if (previewAudio.src.startsWith('blob:')) URL.revokeObjectURL(previewAudio.src);
      }
    };
  }, [previewAudio]);

  useEffect(() => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      if (previewAudio.src.startsWith('blob:')) URL.revokeObjectURL(previewAudio.src);
      setPreviewingVoiceId(null);
      setPreviewAudio(null);
    }
  }, [currentStep]);

  const { data: incomingData, isLoading: incomingLoading } = useQuery<{
    connections: ExistingConnection[];
    allConnections: ExistingConnection[];
    availablePhoneNumbers: (PhoneNumber & { isConflicted?: boolean; conflictReason?: string | null })[];
    incomingAgents: Agent[];
    stats: { totalConnections: number; elevenLabsConnections: number; availableNumbers: number; totalAgents: number };
  }>({
    queryKey: ["/api/incoming-connections"],
  });

  const { data: promptTemplates = [], isLoading: templatesLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  const { data: knowledgeBases = [], isLoading: kbLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const { data: elevenLabsVoices = [], isLoading: elVoicesLoading } = useQuery<ElevenLabsVoiceItem[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const existingConnections = incomingData?.connections || [];
  const phoneNumbers = incomingData?.availablePhoneNumbers || [];
  const agents = incomingData?.incomingAgents || [];

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !p.isUnavailable);
  }, [phoneNumbers]);

  const unavailablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => p.isUnavailable);
  }, [phoneNumbers]);

  const INBOUND_CATEGORIES = ['support', 'appointment', 'general', 'survey', 'agent_preset', 'inbound', 'customer_service', 'receptionist', 'faq'];

  const useCaseCategories = useMemo(() => {
    const cats = new Set<string>();
    promptTemplates.forEach((t) => {
      if (t.category && INBOUND_CATEGORIES.includes(t.category.toLowerCase())) {
        cats.add(t.category);
      }
    });
    return Array.from(cats).sort();
  }, [promptTemplates]);

  const filteredTemplates = useMemo(() => {
    let result = promptTemplates.filter((t) =>
      INBOUND_CATEGORIES.includes(t.category?.toLowerCase() || '') ||
      t.name.toLowerCase().includes('inbound') ||
      t.name.toLowerCase().includes('support') ||
      t.name.toLowerCase().includes('receptionist') ||
      t.name.toLowerCase().includes('helpdesk') ||
      !t.category
    );
    
    // If no inbound templates found, show all templates
    if (result.length === 0) {
      result = promptTemplates;
    }
    
    if (useCaseFilter !== "all") {
      result = result.filter((t) => t.category === useCaseFilter);
    }
    if (promptSearch.trim()) {
      const q = promptSearch.trim().toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    return result;
  }, [promptTemplates, useCaseFilter, promptSearch]);

  const selectedTemplate = useMemo(() => {
    return promptTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [promptTemplates, selectedTemplateId]);

  const selectedPhones = useMemo(() => {
    return availablePhones.filter((p) => selectedPhoneIds.includes(p.id));
  }, [availablePhones, selectedPhoneIds]);

  const selectedKBs = useMemo(() => {
    return knowledgeBases.filter((kb) => selectedKBIds.includes(kb.id));
  }, [knowledgeBases, selectedKBIds]);

  const togglePhone = (phoneId: string) => {
    setSelectedPhoneIds((prev) =>
      prev.includes(phoneId) ? prev.filter((id) => id !== phoneId) : [...prev, phoneId]
    );
  };

  const selectAllPhones = () => {
    setSelectedPhoneIds(availablePhones.map((p) => p.id));
  };

  const clearPhones = () => {
    setSelectedPhoneIds([]);
  };

  const toggleKB = (kbId: string) => {
    setSelectedKBIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]
    );
  };

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

  const applyTemplate = (template: PromptTemplate) => {
    setSelectedTemplateId(template.id);
    setCustomPrompt(template.systemPrompt);
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
      audio.play().catch(() => {});
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
        body: JSON.stringify({ voiceId, text: "Hello! Thank you for calling. How can I help you today?" }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPreviewingVoiceId(null); setPreviewAudio(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewingVoiceId(null); setPreviewAudio(null); URL.revokeObjectURL(url); toast({ title: "Preview Failed", variant: "destructive" }); };
      audio.play().catch(() => {});
      setPreviewAudio(audio);
    } catch {
      toast({ title: "Preview Failed", description: "Could not play voice preview", variant: "destructive" });
      setPreviewingVoiceId(null);
    } finally {
      setVoicePreviewLoading(false);
    }
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return selectedPhoneIds.length > 0;
      case 2: return selectedVoiceId !== null && agentName.trim().length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (canProceed(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVoiceId || !agentName.trim()) throw new Error("Voice and agent name are required");
      if (selectedPhoneIds.length === 0) throw new Error("No phone numbers selected");

      const agentPayload: Record<string, any> = {
        name: agentName.trim(),
        type: 'incoming',
        elevenLabsVoiceId: selectedVoiceId,
        voiceProvider: 'elevenlabs',
        systemPrompt: customPrompt || (selectedKBIds.length > 0
          ? `You are ${agentName.trim()}, an AI phone assistant. You must answer all questions strictly based on the knowledge base provided to you. Learn the company name, details, services, and all relevant information from the knowledge base. When a caller asks a question, find the answer from your knowledge base and respond accurately and professionally. If the answer is not in your knowledge base, politely let the caller know you don't have that information and offer to transfer them to a human agent. Never make up information that is not in your knowledge base.`
          : `You are ${agentName.trim()}, a helpful AI phone assistant. Answer calls professionally and assist callers with their inquiries.`),
      };
      if (selectedKBIds.length > 0) {
        agentPayload.knowledgeBaseIds = selectedKBIds;
        agentPayload.knowledgeBaseOnly = true;
      }

      const agentRes = await apiRequest("POST", "/api/agents", agentPayload);
      const newAgent = await agentRes.json();
      const newAgentId = newAgent.id;

      const createdConnectionIds: string[] = [];
      try {
        for (const phoneId of selectedPhoneIds) {
          const connRes = await apiRequest("POST", "/api/incoming-connections", {
            agentId: newAgentId,
            phoneNumberId: phoneId,
          });
          const conn = await connRes.json();
          if (conn?.id) createdConnectionIds.push(conn.id);
        }
      } catch (connError) {
        for (const connId of createdConnectionIds) {
          try { await apiRequest("DELETE", `/api/incoming-connections/${connId}`); } catch {}
        }
        try { await apiRequest("DELETE", `/api/agents/${newAgentId}`); } catch {}
        throw connError;
      }

      return newAgentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Connection Created",
        description: `${selectedPhoneIds.length} phone number(s) connected to ${agentName.trim()} successfully.`,
      });
      if (!embedded) {
        setLocation("/app/incoming-connections/list");
      } else {
        setCurrentStep(1);
        setSelectedPhoneIds([]);
        setSelectedAgentId(null);
        setSelectedTemplateId(null);
        setCustomPrompt("");
        setSelectedKBIds([]);
        setSelectedVoiceId(null);
        setSelectedVoiceName("");
        setAgentName("");
        setAgentNameSuggestions([]);
        setWizardMode("list");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to create incoming connection",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest("DELETE", `/api/incoming-connections/${connectionId}`);
      return connectionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setDeleteConnectionId(null);
      toast({
        title: "Connection Deleted",
        description: "The incoming connection has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete incoming connection",
        variant: "destructive",
      });
    },
  });

  const startNewConnection = () => {
    setCurrentStep(1);
    setSelectedPhoneIds([]);
    setSelectedAgentId(null);
    setAgentSearch("");
    setPromptSearch("");
    setLanguageFilter("all");
    setUseCaseFilter("all");
    setSelectedTemplateId(null);
    setCustomPrompt("");
    setSelectedKBIds([]);
    setSelectedVoiceId(null);
    setSelectedVoiceName("");
    setVoiceGenderFilter('all');
    setVoiceSearch("");
    setAgentName("");
    setAgentNameSuggestions([]);
    setWizardMode("create");
  };

  const renderConnectionsList = () => (
    <div className="space-y-4 p-4" data-testid="connections-list-view">
      <div className="flex items-center justify-between gap-2 flex-wrap glass-surface rounded-xl p-4">
        <div>
          <h2 className="text-lg font-semibold">Assign AI Agent</h2>
          <p className="text-sm text-muted-foreground">
            Manage phone numbers connected to AI agents for incoming calls
          </p>
        </div>
        <Button onClick={startNewConnection} data-testid="button-new-connection">
          <Plus className="h-4 w-4 mr-2" />
          New Connection
        </Button>
      </div>

      {incomingLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : existingConnections.length === 0 ? (
        <div className="text-center py-12">
          <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-1">No AI Agents Assigned</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect phone numbers to AI agents so they can handle incoming calls.
          </p>
          <Button onClick={startNewConnection} data-testid="button-new-connection-empty">
            <Plus className="h-4 w-4 mr-2" />
            Create First Connection
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {existingConnections.map((conn) => {
            const connAgent = (conn as any).agent;
            const connPhone = (conn as any).phoneNumber;
            return (
              <Card key={conn.id} className="glass-card" data-testid={`card-connection-${conn.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {connPhone?.phoneNumber || "Unknown Number"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {connPhone?.friendlyName || ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-100 dark:bg-blue-900/30">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {connAgent?.name || "Unknown Agent"}
                      </div>
                      {connAgent?.language && (
                        <Badge variant="outline" className="text-[10px]">
                          {getLanguageLabel(connAgent.language)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConnectionId(conn.id)}
                    data-testid={`button-delete-connection-${conn.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 py-4 px-4 glass-surface" data-testid="wizard-step-indicator">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const StepIcon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (isCompleted) setCurrentStep(step.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : isCompleted
                  ? "bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-pointer"
                  : "bg-muted/60 text-muted-foreground"
              }`}
              disabled={!isCompleted && !isActive}
              data-testid={`button-step-${step.id}`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isActive ? (
                <StepIcon className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.id}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-6 h-px ${isCompleted ? "bg-green-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4" data-testid="wizard-step-1">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Select Phone Numbers</h2>
        <p className="text-sm text-muted-foreground">Choose which phone numbers will receive incoming calls</p>
      </div>

      {incomingLoading ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="text-center py-8">
          <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No phone numbers available. Purchase phone numbers first.</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          {availablePhones.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">{selectedPhoneIds.length} of {availablePhones.length} available selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllPhones} data-testid="button-select-all-phones">
                  Select All
                </Button>
                {selectedPhoneIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearPhones} data-testid="button-clear-phones">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {availablePhones.map((phone) => {
              const isSelected = selectedPhoneIds.includes(phone.id);
              return (
                <Card
                  key={phone.id}
                  className={`glass-card cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  onClick={() => togglePhone(phone.id)}
                  data-testid={`card-phone-${phone.id}`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-md ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-green-100 dark:bg-green-900/30"
                    }`}>
                      {isSelected ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{phone.provider}</span>
                        {phone.friendlyName && <span>{phone.friendlyName}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {unavailablePhones.map((phone) => (
              <Card key={phone.id} className="glass-card opacity-50 cursor-not-allowed" data-testid={`card-phone-unavailable-${phone.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate text-muted-foreground">{phone.phoneNumber}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {phone.unavailableReason || "Unavailable"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4" data-testid="wizard-step-2">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Voice & Agent</h2>
        <p className="text-sm text-muted-foreground">Select an ElevenLabs voice and name your AI agent for incoming calls</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-3">
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
        </div>

        {elVoicesLoading ? (
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
              const isSelected = selectedVoiceId === voice.voice_id;
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
        )}

        {selectedVoiceId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium">Selected: {selectedVoiceName}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
              ElevenLabs
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
                    const elVoice = elevenLabsVoices.find(v => v.voice_id === selectedVoiceId);
                    const voiceGender = elVoice?.labels?.gender || '';
                    const res = await apiRequest("POST", "/api/campaigns/suggest-agent-name", {
                      useCase: 'Incoming Call Handler',
                      useCaseDescription: 'Handle incoming phone calls professionally',
                      voiceName: selectedVoiceName,
                      voiceGender,
                      campaignName: '',
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
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4" data-testid="wizard-step-3">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Inbound Prompt</h2>
        <p className="text-sm text-muted-foreground">Pick an inbound use-case template below and edit it to match your business, or write your own prompt</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <Label className="font-medium">Inbound Use-Case Templates</Label>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-9"
              data-testid="input-prompt-search"
            />
          </div>

          {useCaseCategories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground">Category:</Label>
              <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-usecase-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {useCaseCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {templatesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {promptSearch.trim() ? "No templates match your search" : "No inbound templates available — write your own prompt below"}
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="grid gap-2 sm:grid-cols-2 pr-3">
                {filteredTemplates.map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  return (
                    <Card
                      key={template.id}
                      className={`glass-card cursor-pointer transition-colors ${
                        isSelected ? "border-purple-500 bg-purple-500/5" : "hover-elevate"
                      }`}
                      onClick={() => applyTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className={`flex items-center justify-center h-7 w-7 rounded flex-shrink-0 ${
                            isSelected ? "bg-purple-500 text-white" : "bg-purple-100 dark:bg-purple-900/30"
                          }`}>
                            {isSelected ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5 text-purple-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <Badge variant="outline" className={`text-[10px] mt-1 ${getCategoryColor(template.category)}`}>
                              {template.category.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-medium">{selectedTemplate ? "Edit Prompt" : "Custom Prompt"}</Label>
            {selectedTemplate && (
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300">
                Based on: {selectedTemplate.name}
              </Badge>
            )}
          </div>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Select a template above to start, then edit it here to match your business — or write your own prompt from scratch..."
            className="min-h-[150px] text-sm"
            data-testid="textarea-custom-prompt"
          />
          {selectedTemplate && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Edit the prompt above to tailor it to your company and use case.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTemplateId(null);
                  setCustomPrompt("");
                }}
                data-testid="button-clear-template"
              >
                Clear Template
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4" data-testid="wizard-step-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">Select knowledge bases to give the agent access to your information</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {kbLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="text-center py-8">
            <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No knowledge bases available. You can skip this step.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">{selectedKBIds.length} of {knowledgeBases.length} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedKBIds(knowledgeBases.map((kb) => kb.id))}
                  data-testid="button-select-all-kbs"
                >
                  Select All
                </Button>
                {selectedKBIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedKBIds([])} data-testid="button-clear-kbs">
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {knowledgeBases.map((kb) => {
                const isSelected = selectedKBIds.includes(kb.id);
                return (
                  <Card
                    key={kb.id}
                    className={`glass-card cursor-pointer transition-colors ${
                      isSelected ? "border-amber-500 bg-amber-500/5" : "hover-elevate"
                    }`}
                    onClick={() => toggleKB(kb.id)}
                    data-testid={`card-kb-${kb.id}`}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-md ${
                        isSelected ? "bg-amber-500 text-white" : "bg-amber-100 dark:bg-amber-900/30"
                      }`}>
                        {isSelected ? <Check className="h-4 w-4" /> : <Database className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{kb.title}</div>
                        <div className="text-xs text-muted-foreground">{kb.type}</div>
                        {kb.url && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{kb.url}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6" data-testid="wizard-step-5">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Review & Save</h2>
        <p className="text-sm text-muted-foreground">Review your configuration before creating the connection</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Phone Numbers ({selectedPhones.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedPhones.map((phone) => (
                  <Badge key={phone.id} variant="outline" className="border-green-300 text-green-700 dark:text-green-400">
                    {phone.phoneNumber}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <AudioWaveform className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Voice & Agent</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">{agentName || "Unnamed Agent"}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedVoiceName && (
                      <span className="text-xs text-muted-foreground">{selectedVoiceName}</span>
                    )}
                    <Badge variant="outline" className="text-[10px]">ElevenLabs</Badge>
                  </div>
                </div>
              </div>
            </div>

            {(customPrompt || selectedTemplate) && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Prompt Configuration</span>
                </div>
                {selectedTemplate && (
                  <Badge variant="outline" className={`mb-2 ${getCategoryColor(selectedTemplate.category)}`}>
                    {selectedTemplate.name}
                  </Badge>
                )}
                {customPrompt && (
                  <div className="bg-muted rounded-md p-3 text-sm max-h-[120px] overflow-y-auto">
                    {customPrompt.slice(0, 300)}{customPrompt.length > 300 ? "..." : ""}
                  </div>
                )}
              </div>
            )}

            {selectedKBs.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-sm">Knowledge Bases ({selectedKBs.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedKBs.map((kb) => (
                    <Badge key={kb.id} variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                      <Database className="h-3 w-3 mr-1" />
                      {kb.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          This will create a new AI agent named <span className="font-medium text-foreground">{agentName || "Unnamed"}</span> with the <span className="font-medium text-foreground">{selectedVoiceName}</span> ElevenLabs voice, and link {selectedPhoneIds.length} phone number(s) to it.
          {customPrompt ? " A custom prompt will be applied." : ""}
          {selectedKBIds.length > 0 ? ` ${selectedKBIds.length} knowledge base(s) will be attached.` : ""}
        </div>
      </div>
    </div>
  );

  if (wizardMode === "list" && embedded) {
    return (
      <div className="h-full flex flex-col">
        <ScrollArea className="flex-1">
          {renderConnectionsList()}
        </ScrollArea>

        <AlertDialog open={!!deleteConnectionId} onOpenChange={(open) => { if (!open) setDeleteConnectionId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect the phone number from the AI agent. The phone number will become available for new connections. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConnectionId && deleteMutation.mutate(deleteConnectionId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col`}>
      {!embedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 glass-panel gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/app/incoming-connections/list")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="font-semibold">New Incoming Connection</h1>
              <p className="text-xs text-muted-foreground">Set up incoming call routing step by step</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/app/incoming-connections/list")} data-testid="button-list-view">
            <List className="h-4 w-4 mr-1" />
            List View
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center px-4 py-2 border-b border-border/30 glass-surface gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWizardMode("list")} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Connections
          </Button>
        </div>
      )}

      {renderStepIndicator()}

      <ScrollArea className="flex-1">
        <div className="px-4 pb-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 glass-panel gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              if (embedded) {
                setWizardMode("list");
              } else {
                setLocation("/app/incoming-connections/list");
              }
            } else {
              goBack();
            }
          }}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {currentStep === 1 ? (embedded ? "Back to Connections" : "Back to List") : "Back"}
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          {currentStep < 5 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed(currentStep)}
              data-testid="button-wizard-next"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !selectedVoiceId || !agentName.trim() || selectedPhoneIds.length === 0}
              data-testid="button-wizard-save"
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

export default function IncomingCallCanvas({ embedded = false }: { embedded?: boolean } = {}) {
  return <IncomingCallWizard embedded={embedded} />;
}
