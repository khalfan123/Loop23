import { useState, useMemo } from "react";
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
} from "lucide-react";

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
  { id: 2, label: "AI Agent", icon: Bot },
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

  const existingConnections = incomingData?.connections || [];
  const phoneNumbers = incomingData?.availablePhoneNumbers || [];
  const agents = incomingData?.incomingAgents || [];

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !p.isUnavailable);
  }, [phoneNumbers]);

  const unavailablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => p.isUnavailable);
  }, [phoneNumbers]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    agents.forEach((a) => {
      if (a.language) langs.add(a.language);
    });
    return Array.from(langs).sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (languageFilter !== "all") {
      result = result.filter((a) => a.language === languageFilter);
    }
    if (agentSearch.trim()) {
      const q = agentSearch.trim().toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    return result;
  }, [agents, languageFilter, agentSearch]);

  const useCaseCategories = useMemo(() => {
    const cats = new Set<string>();
    promptTemplates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [promptTemplates]);

  const filteredTemplates = useMemo(() => {
    let result = promptTemplates;
    if (useCaseFilter !== "all") {
      result = result.filter((t) => t.category === useCaseFilter);
    }
    if (promptSearch.trim()) {
      const q = promptSearch.trim().toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    return result;
  }, [promptTemplates, useCaseFilter, promptSearch]);

  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

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

  const applyTemplate = (template: PromptTemplate) => {
    setSelectedTemplateId(template.id);
    setCustomPrompt(template.systemPrompt);
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return selectedPhoneIds.length > 0;
      case 2: return selectedAgentId !== null;
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
      if (!selectedAgentId) throw new Error("No agent selected");
      if (selectedPhoneIds.length === 0) throw new Error("No phone numbers selected");

      const agentUpdates: Record<string, any> = {};
      if (customPrompt) {
        agentUpdates.systemPrompt = customPrompt;
      }
      if (selectedKBIds.length > 0) {
        agentUpdates.knowledgeBaseIds = selectedKBIds;
      }
      if (Object.keys(agentUpdates).length > 0) {
        await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, agentUpdates);
      }

      for (const phoneId of selectedPhoneIds) {
        await apiRequest("POST", "/api/incoming-connections", {
          agentId: selectedAgentId,
          phoneNumberId: phoneId,
        });
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Connection Created",
        description: `${selectedPhoneIds.length} phone number(s) connected to ${selectedAgent?.name || "agent"} successfully.`,
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
        <h2 className="text-lg font-semibold">Select AI Agent</h2>
        <p className="text-sm text-muted-foreground">Choose the agent that will handle incoming calls on your selected numbers</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            placeholder="Search agents by name..."
            className="pl-9"
            data-testid="input-agent-search"
          />
        </div>

        {availableLanguages.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Filter by language:</Label>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-language-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>{getLanguageLabel(lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {incomingLoading ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-8">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {agentSearch.trim()
              ? `No agents match "${agentSearch.trim()}"`
              : languageFilter !== "all"
              ? `No agents available for ${getLanguageLabel(languageFilter)}`
              : "No incoming agents available. Create an agent first."}
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto grid gap-2 sm:grid-cols-2">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            return (
              <Card
                key={agent.id}
                className={`glass-card cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover-elevate"
                }`}
                onClick={() => setSelectedAgentId(agent.id)}
                data-testid={`card-agent-${agent.id}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-md flex-shrink-0 ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    {isSelected ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {agent.language && (
                        <Badge variant="outline" className="text-[10px]">
                          {getLanguageLabel(agent.language)}
                        </Badge>
                      )}
                      {agent.voiceName && (
                        <span className="text-xs text-muted-foreground">{agent.voiceName}</span>
                      )}
                    </div>
                    {agent.systemPrompt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.systemPrompt}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4" data-testid="wizard-step-3">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Configure Prompt</h2>
        <p className="text-sm text-muted-foreground">Optionally customize the agent's system prompt using a template or write your own</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <Label className="font-medium">Prompt Templates</Label>
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
              {promptSearch.trim() ? "No templates match your search" : "No prompt templates available"}
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
          <Label className="font-medium">Custom Prompt</Label>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter a custom system prompt for the agent, or select a template above..."
            className="min-h-[120px] text-sm"
            data-testid="textarea-custom-prompt"
          />
          {selectedTemplate && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Using template: <span className="font-medium">{selectedTemplate.name}</span>. You can edit the prompt above.
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
                <Bot className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">AI Agent</span>
              </div>
              {selectedAgent && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{selectedAgent.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAgent.language && (
                        <Badge variant="outline" className="text-[10px]">{getLanguageLabel(selectedAgent.language)}</Badge>
                      )}
                      {selectedAgent.voiceName && (
                        <span className="text-xs text-muted-foreground">{selectedAgent.voiceName}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
          This will create {selectedPhoneIds.length} incoming connection(s) linking your selected phone number(s) to <span className="font-medium text-foreground">{selectedAgent?.name}</span>.
          {customPrompt ? " The agent's prompt will be updated." : ""}
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
              disabled={saveMutation.isPending || !selectedAgentId || selectedPhoneIds.length === 0}
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
