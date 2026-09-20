import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  GitBranch,
  HelpCircle,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Play,
  Plus,
  Search,
  Save,
  Sparkles,
  Square,
  StopCircle,
  Store,
  Volume2,
  Webhook,
  Zap,
  ArrowUp,
  AlertCircle,
  AlertTriangle,
  CircleCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IntegrationApp, UserIntegration } from "@shared/schema";
import {
  BuilderTemplatePicker,
  type BuilderTemplateChoice,
  type BuilderToolChoice,
} from "@/components/automation/BuilderTemplatePicker";
import { BuilderNodeProperties } from "@/components/automation/BuilderNodeProperties";
import {
  IntegrationConnectDialog,
  appRequiresUserConnection,
} from "@/components/IntegrationConnectDialog";
import { CopilotChatMessage } from "@/components/automation/CopilotChatMessage";
import {
  CopilotLibraryPanel,
  CopilotLibraryTabBar,
  type CopilotLibraryTab,
} from "@/components/automation/CopilotLibraryTabs";

type BuilderStep = {
  id: string;
  order: number;
  type: "trigger" | "action";
  appId: string | null;
  actionId: string | null;
  label: string;
  config: Record<string, unknown>;
};

type BuilderAutomation = {
  name: string;
  status: "draft" | "published";
  steps: BuilderStep[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type CatalogResponse = {
  apps: Array<{ id: string; name: string; category: string; isPopular?: boolean }>;
  triggers: Array<{ id: string; name: string }>;
  builtins: Array<{ id: string; name: string; category: string }>;
};

type DryRunStepResult = {
  id: string;
  order: number;
  type: "trigger" | "action";
  label: string;
  status: "ok" | "warn" | "error" | "skipped";
  detail: string;
};

type DryRunResult = {
  ok: boolean;
  name?: string;
  dryRun?: boolean;
  summary?: string;
  chatMessage?: string;
  error?: string;
  steps: DryRunStepResult[];
  samplePayload?: Record<string, unknown> | null;
};

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const flowNodeTypeIcons = {
  message: MessageSquare,
  question: HelpCircle,
  condition: GitBranch,
  appointment: Calendar,
  form: FileText,
  webhook: Webhook,
  transfer: Phone,
  delay: Clock,
  end: StopCircle,
  play_audio: Volume2,
} as const;

const flowNodeTypeLabels: Record<string, string> = {
  message: "Message",
  question: "Question",
  play_audio: "Play Audio",
  condition: "Condition",
  appointment: "Appointment",
  form: "Form",
  webhook: "Webhook",
  transfer: "Transfer",
  delay: "Delay",
  end: "End Call",
};

const flowNodePaletteSections = [
  { label: "Basic", types: ["message", "question", "play_audio"] },
  { label: "Logic", types: ["condition"] },
  { label: "Integration", types: ["appointment", "form", "webhook"] },
  { label: "Control", types: ["transfer", "delay", "end"] },
];

function FlowNodeTypePicker({
  onSelect,
}: {
  onSelect: (nodeType: string) => void;
}) {
  return (
    <div className="py-1">
      {flowNodePaletteSections.map((section) => (
        <div key={section.label} className="px-2 py-1">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.types.map((nodeType) => {
              const Icon = flowNodeTypeIcons[nodeType as keyof typeof flowNodeTypeIcons];
              const label = flowNodeTypeLabels[nodeType] || nodeType;
              return (
                <button
                  key={nodeType}
                  type="button"
                  onClick={() => onSelect(nodeType)}
                  className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/70 transition-colors"
                  data-testid={`flow-node-pick-${nodeType}`}
                >
                  <span className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-foreground/80" />
                  </span>
                  <span className="text-[13px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsertStepPopover({
  insertIndex,
  onInsert,
  children,
}: {
  insertIndex: number;
  onInsert: (index: number, nodeType: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-56 p-0 flex flex-col max-h-[min(360px,70vh)] overflow-hidden"
        align="center"
        side="right"
        sideOffset={8}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="px-3 pt-2.5 pb-1 border-b border-border/60 shrink-0">
          <p className="text-xs font-semibold">Add step</p>
          <p className="text-[10px] text-muted-foreground">Choose a flow node type</p>
        </div>
        <div
          className="overflow-y-auto overscroll-contain min-h-0 flex-1"
          data-testid="add-step-scroll"
        >
          <FlowNodeTypePicker
            onSelect={(nodeType) => {
              onInsert(insertIndex, nodeType);
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function emptyDraft(): BuilderAutomation {
  return {
    name: "Untitled automation",
    status: "draft",
    steps: [
      {
        id: "step-trigger",
        order: 0,
        type: "trigger",
        appId: "loop9",
        actionId: null,
        label: "Select the event that starts your Zap",
        config: {},
      },
      {
        id: "step-action-1",
        order: 1,
        type: "action",
        appId: null,
        actionId: null,
        label: "Select the event for your Zap to run",
        config: {},
      },
    ],
  };
}

export default function AutomationBuilderPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [copilotMode, setCopilotMode] = useState<"ask" | "build">("build");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [automation, setAutomation] = useState<BuilderAutomation>(emptyDraft);
  const [working, setWorking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DryRunResult | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [pickerStepId, setPickerStepId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerNav, setTemplatePickerNav] = useState<
    "home" | "templates" | "apps"
  >("home");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [savedChatId, setSavedChatId] = useState<string | null>(null);
  const [savingChat, setSavingChat] = useState(false);
  const [libraryTab, setLibraryTab] = useState<CopilotLibraryTab | null>(null);
  const [connectApp, setConnectApp] = useState<IntegrationApp | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const { data: catalog } = useQuery<CatalogResponse>({
    queryKey: ["/api/integrations/copilot/catalog"],
  });

  const { data: savedChatsData, refetch: refetchSavedChats, isFetching: loadingChats } =
    useQuery<{
      chats: Array<{ id: string; title: string; updatedAt: string; createdAt: string }>;
    }>({
      queryKey: ["/api/integrations/copilot/chats"],
      enabled: copilotOpen && libraryTab === "chats",
    });
  const savedChats = savedChatsData?.chats || [];
  const {
    data: savedAutomationsData,
    refetch: refetchSavedAutomations,
    isFetching: loadingAutomations,
  } = useQuery<{
    automations: Array<{
      id: string;
      chatId: string;
      name: string;
      status: "draft" | "published";
      stepCount: number;
      updatedAt: string;
      source: "saved_chat";
    }>;
  }>({
    queryKey: ["/api/integrations/copilot/automations"],
    enabled: copilotOpen && libraryTab === "automations",
  });
  const savedAutomations = savedAutomationsData?.automations || [];
  const { data: integrationApps = [], isLoading: integrationAppsLoading } = useQuery<
    Array<IntegrationApp & { requiresOAuth?: boolean; authType?: string }>
  >({
    queryKey: ["/api/integrations/apps"],
  });

  const { data: connectedIntegrations = [] } = useQuery<
    Array<{ integration: UserIntegration; app: IntegrationApp }>
  >({
    queryKey: ["/api/integrations/connected"],
  });

  const appsBySlug = useMemo(() => {
    const map = new Map<string, IntegrationApp & { requiresOAuth?: boolean; authType?: string }>();
    for (const app of integrationApps) map.set(app.slug, app);
    return map;
  }, [integrationApps]);

  const connectedSlugs = useMemo(
    () => new Set(connectedIntegrations.map((c) => c.app.slug)),
    [connectedIntegrations],
  );

  const marketplaceAppsForPicker = useMemo(() => {
    return [...integrationApps]
      .filter((a) => a.isActive !== false)
      .sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [integrationApps]);

  const { data: me } = useQuery<{ company?: string | null; name?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: callCenterScope } = useQuery<{
    departments: Array<{
      id: string;
      name: string;
      source?: "ops" | "deprock";
      agents: Array<{ id: string; name: string; language: string }>;
    }>;
    voices?: Array<{ id: string; name: string }>;
    gaps?: Array<{ module: string; message: string; nextStep: string }>;
    companyName?: string;
  }>({
    queryKey: ["/api/integrations/copilot/call-center"],
  });

  const callCenterAgents = useMemo(() => {
    const list: Array<{ id: string; name: string; departmentName: string }> = [];
    for (const dept of callCenterScope?.departments || []) {
      for (const agent of dept.agents) {
        if (!list.some((a) => a.id === agent.id)) {
          list.push({
            id: agent.id,
            name: agent.name,
            departmentName: dept.name,
          });
        }
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [callCenterScope]);

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: string;
    summary: string;
    confirmToken?: string;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/integrations/copilot/session", {});
        const data = await res.json();
        if (cancelled) return;
        setSessionId(data.sessionId);
        setMessages(data.messages || []);
        if (data.automation) setAutomation(data.automation);
      } catch {
        const company = me?.company?.trim() || "your company";
        setMessages([
          {
            role: "assistant",
            content: [
              `Hi — I'm **Copilot**, your personal automation assistant for **${company}**.`,
              "",
              "Describe what should happen after a call — I'll scaffold the flow and tell you exactly how to finish each step.",
              "",
              "### Try an example",
              "",
              `- *“When a ${company} inbound call ends, send the summary to Slack for supervisors.”*`,
              `- *“If a caller asks for a callback, create a follow-up task in our CRM.”*`,
              `- *“When our AI agent books an appointment, notify the front desk.”*`,
              "",
              "> **Next best action:** Stay in **Build**, paste an example above, and send it.",
            ].join("\n"),
          },
        ]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.company]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, working]);

  const applyChatResponse = useCallback(
    (data: {
      sessionId?: string;
      automation?: BuilderAutomation;
      reply?: string;
      chatId?: string;
      pendingConfirmation?: { type: string; summary: string; confirmToken?: string } | null;
    }) => {
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.chatId) setSavedChatId(data.chatId);
      if (data.pendingConfirmation) {
        setPendingConfirmation(data.pendingConfirmation);
      } else {
        setPendingConfirmation(null);
      }
      if (copilotMode === "build" && data.automation) {
        setAutomation(data.automation);
        const focus =
          data.automation.steps?.find(
            (s: BuilderStep) =>
              s.type === "action" &&
              (s.config?.nodeType === "webhook" || s.appId === "webhooks" || !s.actionId),
          ) || data.automation.steps?.[1];
        if (focus?.id) setSelectedStepId(focus.id);
      } else if (data.automation) {
        setAutomation(data.automation);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Done." },
      ]);
    },
    [copilotMode],
  );

  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || working) return;
    setInput("");
    setWorking(true);
    abortRef.current = false;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const res = await apiRequest("POST", "/api/integrations/copilot/chat", {
        sessionId,
        message: text,
        automation,
        mode: copilotMode,
        chatId: savedChatId || undefined,
      });
      const data = await res.json();
      if (abortRef.current) return;
      applyChatResponse(data);
    } catch (err: any) {
      if (!abortRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: err?.message || "Copilot request failed. Try again.",
          },
        ]);
      }
    } finally {
      setWorking(false);
    }
  }, [input, working, sessionId, automation, copilotMode, savedChatId, applyChatResponse]);

  const respondToConfirmation = useCallback(
    async (confirm: boolean) => {
      if (working) return;
      setWorking(true);
      abortRef.current = false;
      const text = confirm ? "confirm" : "cancel";
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      try {
        const res = await apiRequest("POST", "/api/integrations/copilot/chat", {
          sessionId,
          message: text,
          confirm,
          confirmToken: confirm ? pendingConfirmation?.confirmToken : undefined,
          automation,
          mode: copilotMode,
          chatId: savedChatId || undefined,
        });
        const data = await res.json();
        if (abortRef.current) return;
        applyChatResponse(data);
      } catch (err: any) {
        if (!abortRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: err?.message || "Confirmation failed. Try again.",
            },
          ]);
        }
      } finally {
        setWorking(false);
      }
    },
    [
      working,
      sessionId,
      automation,
      copilotMode,
      savedChatId,
      pendingConfirmation,
      applyChatResponse,
    ],
  );

  const requestPublish = useCallback(async () => {
    if (publishing || working) return;
    setPublishing(true);
    try {
      const confirm =
        pendingConfirmation?.type === "publish" && !!pendingConfirmation.confirmToken;
      const res = await apiRequest("POST", "/api/integrations/copilot/publish", {
        sessionId,
        automation,
        chatId: savedChatId || undefined,
        confirm,
        confirmToken: confirm ? pendingConfirmation?.confirmToken : undefined,
      });
      const data = await res.json();
      if (data.needsConfirmation) {
        setPendingConfirmation(data.pendingConfirmation || { type: "publish", summary: "" });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: [
              "### Confirm publish",
              "",
              data.message || "Confirm to publish this automation for your call center.",
              "",
              data.pendingConfirmation?.summary || "",
              "",
              "Click **Yes, confirm** or **Publish** again. Typing yes alone is not enough.",
              "",
              "> **Next best action:** Confirm publish, or keep editing.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ]);
        return;
      }
      if (data.ok && data.automation) {
        setAutomation(data.automation);
        if (data.chatId) setSavedChatId(data.chatId);
        setPendingConfirmation(null);
        void refetchSavedAutomations();
        void refetchSavedChats();
        toast({
          title: "Published",
          description: data.message || "Automation is published (not draft).",
        });
      }
    } catch (err: any) {
      toast({
        title: "Publish failed",
        description: err?.message || "Could not publish",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  }, [
    publishing,
    working,
    sessionId,
    automation,
    savedChatId,
    pendingConfirmation,
    toast,
    refetchSavedAutomations,
    refetchSavedChats,
  ]);

  const stopWorking = () => {
    abortRef.current = true;
    setWorking(false);
  };

  const runTest = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/copilot/test", {
        automation,
        sessionId,
      });
      const data = (await res.json()) as DryRunResult;
      setTestResult(data);
      setTestOpen(true);
      const errors = (data.steps || []).filter((s) => s.status === "error").length;
      toast({
        title: data.ok ? "Dry-run passed" : "Dry-run found issues",
        description: data.summary || data.error || `${errors} step(s) need attention`,
        variant: data.ok ? "default" : "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.chatMessage ||
            (data.ok
              ? `### Test passed — **${data.name || automation.name}**\n\n${data.summary || "Dry-run completed."}\n\n> **Next best action:** Save this chat (optional), then publish when your team is ready.`
              : `### Test found issues — **${data.name || automation.name}**\n\n${data.summary || data.error || "Fix the highlighted steps and try again."}\n\n> **Next best action:** Click the failing step in the test dialog → fix it in **Node Properties** → **Test** again.`),
        },
      ]);
      const firstError = (data.steps || []).find((s) => s.status === "error");
      if (firstError) setSelectedStepId(firstError.id);
    } catch (err: any) {
      toast({
        title: "Test failed",
        description: err?.message || "Could not run dry-run",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }, [testing, automation, sessionId, toast]);

  const saveChat = useCallback(async () => {
    if (savingChat) return;
    if (messages.length === 0) {
      toast({
        title: "Nothing to save yet",
        description: "Start a conversation first, then save it.",
      });
      return;
    }
    setSavingChat(true);
    try {
      const res = await apiRequest("POST", "/api/integrations/copilot/chats", {
        id: savedChatId || undefined,
        messages,
        automation,
      });
      const data = await res.json();
      if (data.chat?.id) setSavedChatId(data.chat.id);
      void refetchSavedChats();
      toast({
        title: data.updated ? "Chat updated" : "Chat saved",
        description: "Saved to your account only — no one else can see it.",
      });
    } catch (err: any) {
      toast({
        title: "Could not save chat",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setSavingChat(false);
    }
  }, [savingChat, messages, automation, savedChatId, toast, refetchSavedChats]);

  const loadSavedChat = useCallback(
    async (id: string) => {
      try {
        const res = await apiRequest("GET", `/api/integrations/copilot/chats/${id}`);
        const data = await res.json();
        const chat = data.chat;
        if (!chat) throw new Error("Chat not found");

        const messages = Array.isArray(chat.messages) ? chat.messages : [];
        const automationPayload =
          chat.automation && typeof chat.automation === "object"
            ? (chat.automation as BuilderAutomation)
            : emptyDraft();

        const sessionRes = await apiRequest("POST", "/api/integrations/copilot/session", {
          messages,
          automation: automationPayload,
        });
        const sessionData = await sessionRes.json();

        setSavedChatId(chat.id);
        setSessionId(sessionData.sessionId || null);
        setMessages(Array.isArray(sessionData.messages) ? sessionData.messages : messages);
        if (sessionData.automation) {
          setAutomation(sessionData.automation as BuilderAutomation);
        } else {
          setAutomation(automationPayload);
        }
        setSelectedStepId(null);
        setLibraryTab(null);
        toast({
          title: "Chat opened",
          description: chat.title || "Loaded from your saved chats",
        });
      } catch (err: any) {
        toast({
          title: "Could not open chat",
          description: err?.message || "Try again",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const loadSavedAutomation = useCallback(
    async (id: string) => {
      try {
        const res = await apiRequest("GET", `/api/integrations/copilot/automations/${id}`);
        const data = await res.json();
        if (!data.automation) throw new Error("Automation not found");

        const automationPayload = data.automation as BuilderAutomation;
        const messages = Array.isArray(data.messages) ? data.messages : [];

        const sessionRes = await apiRequest("POST", "/api/integrations/copilot/session", {
          messages,
          automation: automationPayload,
        });
        const sessionData = await sessionRes.json();

        if (data.chatId) setSavedChatId(data.chatId);
        setSessionId(sessionData.sessionId || null);
        setMessages(Array.isArray(sessionData.messages) ? sessionData.messages : messages);
        setAutomation(
          sessionData.automation
            ? (sessionData.automation as BuilderAutomation)
            : automationPayload,
        );
        setSelectedStepId(null);
        setLibraryTab(null);
        toast({
          title: "Automation loaded",
          description:
            data.name ||
            automationPayload.name ||
            (data.restoredFromInvalid
              ? "Loaded a partial draft — some steps may need review."
              : "Opened in the builder"),
        });
      } catch (err: any) {
        toast({
          title: "Could not open automation",
          description: err?.message || "Try again",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const resetAfterDeletedItem = useCallback(async () => {
    setSavedChatId(null);
    setSelectedStepId(null);
    setAutomation(emptyDraft());
    try {
      const res = await apiRequest("POST", "/api/integrations/copilot/session", {});
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages(data.messages || []);
      if (data.automation) setAutomation(data.automation);
    } catch {
      setMessages([
        {
          role: "assistant",
          content: "New chat started. Tell me what you want to build.",
        },
      ]);
    }
  }, []);

  const deleteSavedItem = useCallback(
    async (id: string, kind: "chat" | "automation") => {
      try {
        await apiRequest("DELETE", `/api/integrations/copilot/chats/${id}`);
        if (savedChatId === id) await resetAfterDeletedItem();
        void refetchSavedChats();
        void refetchSavedAutomations();
        toast({ title: kind === "automation" ? "Automation deleted" : "Chat deleted" });
      } catch (err: any) {
        toast({
          title: "Could not delete",
          description: err?.message || "Try again",
          variant: "destructive",
        });
      }
    },
    [savedChatId, refetchSavedChats, refetchSavedAutomations, resetAfterDeletedItem, toast],
  );

  const deleteSavedChat = useCallback(
    (id: string) => deleteSavedItem(id, "chat"),
    [deleteSavedItem],
  );

  const deleteSavedAutomation = useCallback(
    (id: string) => deleteSavedItem(id, "automation"),
    [deleteSavedItem],
  );

  const publishSavedAutomation = useCallback(
    async (id: string) => {
      try {
        const res = await apiRequest("POST", `/api/integrations/copilot/automations/${id}/publish`, {});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Publish failed");
        if (savedChatId === id && data.automation) {
          setAutomation(data.automation as BuilderAutomation);
        }
        void refetchSavedAutomations();
        toast({
          title: "Published",
          description: data.message || "Status changed to Published.",
        });
      } catch (err: any) {
        toast({
          title: "Could not publish",
          description: err?.message || "Try again",
          variant: "destructive",
        });
      }
    },
    [savedChatId, refetchSavedAutomations, toast],
  );

  const startNewChat = useCallback(async () => {
    setSavedChatId(null);
    setSelectedStepId(null);
    setAutomation(emptyDraft());
    try {
      const res = await apiRequest("POST", "/api/integrations/copilot/session", {});
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages(data.messages || []);
      if (data.automation) setAutomation(data.automation);
    } catch {
      setMessages([
        {
          role: "assistant",
          content: "New chat started. Tell me what you want to build.",
        },
      ]);
    }
    setLibraryTab(null);
  }, []);

  const updateStep = (stepId: string, patch: Partial<BuilderStep>) => {
    setAutomation((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    }));
  };

  const updateStepConfig = (stepId: string, patch: Record<string, unknown>) => {
    setAutomation((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, config: { ...s.config, ...patch } } : s,
      ),
    }));
  };

  const deleteStep = (stepId: string) => {
    setAutomation((prev) => {
      if (prev.steps.length <= 1) return prev;
      const steps = prev.steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i }));
      return { ...prev, steps };
    });
    setSelectedStepId((cur) => (cur === stepId ? null : cur));
  };

  const selectedStep =
    automation.steps.find((s) => s.id === selectedStepId) || null;
  const selectedStepIndex = selectedStep
    ? automation.steps.findIndex((s) => s.id === selectedStep.id)
    : -1;

  const insertFlowNodeAfter = (index: number, nodeType: string) => {
    const label = flowNodeTypeLabels[nodeType] || nodeType;
    const id = newId("step");
    setAutomation((prev) => {
      const steps = [...prev.steps];
      const step: BuilderStep = {
        id,
        order: index + 1,
        type: "action",
        appId: null,
        actionId: null,
        label,
        config: { nodeType },
      };
      steps.splice(index + 1, 0, step);
      return { ...prev, steps: steps.map((s, i) => ({ ...s, order: i })) };
    });
    setSelectedStepId(id);
  };

  const pickerStep = automation.steps.find((s) => s.id === pickerStepId) || null;

  const promptConnectIfNeeded = useCallback(
    (appId: string) => {
      if (!appRequiresUserConnection(appId, appsBySlug)) return;
      if (connectedSlugs.has(appId)) return;
      const app = appsBySlug.get(appId);
      if (app) setConnectApp(app);
    },
    [appsBySlug, connectedSlugs],
  );

  const selectedStepConnectionStatus = useMemo(() => {
    if (!selectedStep?.appId || selectedStep.type !== "action") return null;
    if (!appRequiresUserConnection(selectedStep.appId, appsBySlug)) return null;
    return connectedSlugs.has(selectedStep.appId) ? "connected" : "disconnected";
  }, [selectedStep, appsBySlug, connectedSlugs]);

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (pickerStep?.type === "trigger") {
      const triggers = catalog?.triggers || [];
      return triggers
        .filter((t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q))
        .map((t) => ({
          id: t.id,
          name: t.name,
          kind: "trigger" as const,
        }));
    }
    const filtered = marketplaceAppsForPicker.filter(
      (a) =>
        !q ||
        a.slug.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    );
    return filtered.map((a) => ({
      id: a.slug,
      name: a.name,
      kind: "app" as const,
      logoUrl: a.logoUrl,
    }));
  }, [catalog, pickerQuery, pickerStep?.type, marketplaceAppsForPicker]);

  const applyPickerSelection = (item: {
    id: string;
    name: string;
    kind: "trigger" | "app";
  }) => {
    if (!pickerStep) return;
    if (pickerStep.type === "trigger") {
      updateStep(pickerStep.id, {
        appId: "loop9",
        actionId: item.id,
        label: item.name,
      });
    } else {
      updateStep(pickerStep.id, {
        appId: item.id,
        actionId: "send",
        label: `Send to ${item.name}`,
      });
      promptConnectIfNeeded(item.id);
    }
    setPickerStepId(null);
    setPickerQuery("");
  };

  const applyTemplate = (tpl: BuilderTemplateChoice) => {
    setAutomation({
      name: tpl.title,
      status: "draft",
      steps: [
        {
          id: "step-trigger",
          order: 0,
          type: "trigger",
          appId: "loop9",
          actionId: tpl.triggerEvent,
          label: tpl.triggerEvent,
          config: { templateId: tpl.id, prompt: tpl.prompt },
        },
        {
          id: "step-action-1",
          order: 1,
          type: "action",
          appId: tpl.destinationSlug,
          actionId: "send",
          label: `Send to ${tpl.destinationLabel}`,
          config: { templateId: tpl.id },
        },
      ],
    });
    setTemplatePickerOpen(false);
    promptConnectIfNeeded(tpl.destinationSlug);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Loaded template **${tpl.title}**. Review the steps on the canvas, then ask me to refine or publish.`,
      },
    ]);
  };

  const applyTool = (tool: BuilderToolChoice) => {
    let focusId: string | null = null;
    setAutomation((prev) => {
      const steps = [...prev.steps];
      const actionIdx = steps.findIndex((s) => s.type === "action");
      const insertAt = actionIdx >= 0 ? actionIdx + 1 : steps.length;

      if (tool.nodeType) {
        const id = newId("step");
        focusId = id;
        const step: BuilderStep = {
          id,
          order: insertAt,
          type: "action",
          appId: tool.appId || null,
          actionId: tool.appId ? "send" : null,
          label: tool.name,
          config: { nodeType: tool.nodeType, toolId: tool.id, kind: tool.kind },
        };
        steps.splice(insertAt, 0, step);
        return { ...prev, steps: steps.map((s, i) => ({ ...s, order: i })) };
      }

      if (tool.appId && actionIdx >= 0) {
        focusId = steps[actionIdx].id;
        steps[actionIdx] = {
          ...steps[actionIdx],
          appId: tool.appId,
          actionId: "send",
          label: tool.name,
          config: { ...steps[actionIdx].config, toolId: tool.id, kind: tool.kind },
        };
        return { ...prev, steps };
      }

      if (actionIdx >= 0) {
        focusId = steps[actionIdx].id;
        steps[actionIdx] = {
          ...steps[actionIdx],
          label: tool.name,
          config: { ...steps[actionIdx].config, toolId: tool.id, kind: tool.kind },
        };
      }
      return { ...prev, steps };
    });
    if (focusId) setSelectedStepId(focusId);
    if (tool.appId) promptConnectIfNeeded(tool.appId);
    setTemplatePickerOpen(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Added **${tool.name}** to the canvas. Configure it on the step card, or ask Copilot to refine.`,
      },
    ]);
  };

  return (
    <div
      className="h-[calc(100vh-var(--l9-topbar-height))] min-h-[560px] flex bg-[#f4f5f7] dark:bg-zinc-950"
      data-testid="automation-builder-page"
    >
      {/* Copilot panel — primary chat surface (templates + marketplace in composer) */}
      <aside
        className={cn(
          "shrink-0 border-r border-border/60 bg-white dark:bg-zinc-900 flex flex-col transition-[width] duration-200",
          copilotOpen ? "w-[min(440px,42vw)]" : "w-0 overflow-hidden border-0",
        )}
      >
        <div className="h-12 px-3 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Copilot</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={savedChatId ? "Update saved chat" : "Save chat"}
              onClick={() => void saveChat()}
              disabled={savingChat}
              data-testid="button-save-copilot-chat"
            >
              {savingChat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCopilotOpen(false)}
              data-testid="button-collapse-copilot"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CopilotLibraryTabBar activeTab={libraryTab} onTabChange={setLibraryTab} />

        {libraryTab ? (
          <CopilotLibraryPanel
            activeTab={libraryTab}
            savedChats={savedChats}
            savedAutomations={savedAutomations}
            activeChatId={savedChatId}
            loadingChats={loadingChats}
            loadingAutomations={loadingAutomations}
            onLoadChat={(id) => void loadSavedChat(id)}
            onDeleteChat={(id) => void deleteSavedChat(id)}
            onNewChat={() => void startNewChat()}
            onLoadAutomation={(id) => void loadSavedAutomation(id)}
            onDeleteAutomation={(id) => void deleteSavedAutomation(id)}
            onPublishAutomation={(id) => void publishSavedAutomation(id)}
          />
        ) : (
          <ScrollArea className="flex-1 min-h-0 px-3 py-3">
            <div className="space-y-4">
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1;
                return (
                  <CopilotChatMessage
                    key={`${m.role}-${i}`}
                    role={m.role}
                    content={m.content}
                    muted={i === 0 && m.role === "assistant"}
                    pendingConfirmation={!!pendingConfirmation && isLastAssistant}
                    confirming={working}
                    onConfirm={
                      pendingConfirmation && isLastAssistant
                        ? () => void respondToConfirmation(true)
                        : undefined
                    }
                    onCancel={
                      pendingConfirmation && isLastAssistant
                        ? () => void respondToConfirmation(false)
                        : undefined
                    }
                  />
                );
              })}
              {working && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="font-medium">
                    {copilotMode === "build" ? "Building on canvas…" : "Thinking…"}
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="p-3 border-t border-border/50 space-y-2">
          <div className="flex items-center gap-1.5 px-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setTemplatePickerNav("templates");
                setTemplatePickerOpen(true);
              }}
              data-testid="button-choose-template"
              className="inline-flex items-center gap-1.5 h-7 rounded-full border border-border/70 bg-muted/40 hover:bg-muted/70 px-2.5 text-[12px] font-medium text-foreground transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              Choose from template
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplatePickerNav("apps");
                setTemplatePickerOpen(true);
              }}
              data-testid="button-choose-marketplace"
              className="inline-flex items-center gap-1.5 h-7 rounded-full border border-border/70 bg-muted/40 hover:bg-muted/70 px-2.5 text-[12px] font-medium text-foreground transition-colors"
            >
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              Marketplace
            </button>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background p-2 shadow-sm focus-within:border-border focus-within:ring-1 focus-within:ring-border/60">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              placeholder={
                copilotMode === "ask"
                  ? t("automation.builder.askPlaceholder", "Ask Copilot anything…")
                  : t("automation.builder.chatPlaceholder", "Describe what to build…")
              }
              className="border-0 shadow-none focus-visible:ring-0 h-9 px-2"
              data-testid="input-copilot-chat"
            />
            <div className="flex items-center justify-between gap-2 pt-1 px-0.5">
              <div className="flex items-center gap-0.5 min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-testid="button-copilot-mode"
                      className="inline-flex items-center gap-1 h-7 rounded-md px-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    >
                      {copilotMode === "ask" ? (
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{copilotMode === "ask" ? "Ask" : "Build"}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 p-1" sideOffset={6}>
                    <DropdownMenuItem
                      onClick={() => setCopilotMode("build")}
                      data-testid="menu-copilot-build"
                      className="flex items-start gap-2.5 rounded-md px-2 py-2 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">Build</span>
                          {copilotMode === "build" && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug block mt-0.5">
                          Scaffold and edit steps on the canvas
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCopilotMode("ask")}
                      data-testid="menu-copilot-ask"
                      className="flex items-start gap-2.5 rounded-md px-2 py-2 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">Ask</span>
                          {copilotMode === "ask" && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug block mt-0.5">
                          Q&A only — won’t change the canvas
                        </span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled title="Voice (soon)">
                  <Mic className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                {working ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 rounded-full px-2.5"
                    onClick={stopWorking}
                    data-testid="button-copilot-stop"
                  >
                    <Square className="h-3 w-3 mr-1 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => void sendChat()}
                    disabled={!input.trim()}
                    data-testid="button-copilot-send"
                    title={copilotMode === "ask" ? "Ask" : "Build"}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center px-2">
            Copilot is AI and can make mistakes. Please double-check responses.
          </p>
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 min-w-0 flex">
        <div className="flex-1 min-w-0 flex flex-col relative">
        <div className="h-12 px-4 flex items-center gap-2 border-b border-border/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
          {!copilotOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCopilotOpen(true)}
              data-testid="button-expand-copilot"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <Input
            value={automation.name}
            onChange={(e) => setAutomation((p) => ({ ...p, name: e.target.value }))}
            className="h-8 max-w-xs border-0 bg-transparent shadow-none font-semibold focus-visible:ring-1"
            data-testid="input-automation-name"
          />
          <Badge
            variant={automation.status === "published" ? "default" : "secondary"}
            className={
              automation.status === "published"
                ? "text-[10px] uppercase tracking-wide bg-emerald-600 text-white hover:bg-emerald-600"
                : "text-[10px] uppercase tracking-wide"
            }
            data-testid="badge-automation-status"
          >
            {automation.status === "published" ? "Published" : "Draft"}
          </Badge>
          <span
            className="hidden sm:inline text-[11px] text-muted-foreground truncate max-w-[260px]"
            title="Scoped to your workspace: Ops, Deprock, voices, and knowledge base"
            data-testid="label-call-center-scope"
          >
            {callCenterScope?.departments?.length
              ? `Your call center · ${callCenterScope.departments.length} dept${callCenterScope.departments.length === 1 ? "" : "s"} · ${callCenterAgents.length} agent${callCenterAgents.length === 1 ? "" : "s"}${callCenterScope.voices?.length ? ` · ${callCenterScope.voices.length} voice${callCenterScope.voices.length === 1 ? "" : "s"}` : ""}`
              : "Your call center · add departments to unlock transfers"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runTest()}
              disabled={testing}
              data-testid="button-test-run"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              Test
            </Button>
            <Button
              size="sm"
              onClick={() => void requestPublish()}
              disabled={publishing || working}
              data-testid="button-publish"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Publish
            </Button>
          </div>
        </div>

        {working && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white dark:bg-zinc-900 shadow-md px-3 py-1.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {copilotMode === "build" ? "Building flow…" : "Reasoning…"}
              <button
                type="button"
                className="text-destructive font-medium ml-1"
                onClick={stopWorking}
              >
                Stop
              </button>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex-1 overflow-auto transition-opacity",
            working && copilotMode === "build" && "opacity-90",
          )}
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
          onClick={() => setSelectedStepId(null)}
        >
          <div className="max-w-xl mx-auto py-10 px-4">
            {automation.steps.map((step, index) => {
              const flowNodeType =
                typeof step.config?.nodeType === "string" ? step.config.nodeType : null;
              const configured = !!step.actionId || !!flowNodeType;
              const app = step.appId && step.appId !== "loop9" ? appsBySlug.get(step.appId) : null;
              const FlowIcon =
                flowNodeType && flowNodeType in flowNodeTypeIcons
                  ? flowNodeTypeIcons[flowNodeType as keyof typeof flowNodeTypeIcons]
                  : null;
              const selected = selectedStepId === step.id;
              return (
                <div key={step.id}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStepId(step.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedStepId(step.id);
                      if (!flowNodeType) setPickerStepId(step.id);
                    }}
                    data-testid={`canvas-step-${step.id}`}
                    className={cn(
                      "w-full text-left rounded-xl border-2 bg-white dark:bg-zinc-900 px-4 py-4 transition-shadow hover:shadow-md",
                      selected
                        ? "border-primary shadow-md ring-2 ring-primary/20"
                        : configured
                          ? "border-border/70 border-solid"
                          : "border-dashed border-border/80",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          step.type === "trigger"
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            : "bg-violet-500/10 text-violet-700 dark:text-violet-300",
                        )}
                      >
                        {step.type === "trigger" ? "Trigger" : "Action"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-foreground flex items-center gap-2">
                          {step.type === "trigger" ? (
                            <Zap className="h-4 w-4 text-sky-600 shrink-0" />
                          ) : FlowIcon ? (
                            <FlowIcon className="h-4 w-4 text-violet-600 shrink-0" />
                          ) : (
                            <Bot className="h-4 w-4 text-violet-600 shrink-0" />
                          )}
                          <span className="truncate">
                            {index + 1}. {step.label}
                          </span>
                        </div>
                        {configured && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {step.type === "trigger"
                              ? `Loop9 · ${step.actionId}`
                              : flowNodeType
                                ? `Flow · ${flowNodeTypeLabels[flowNodeType] || flowNodeType}`
                                : `${app?.name || step.appId} · ${step.actionId}`}
                          </p>
                        )}
                      </div>
                      {configured && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                    </div>
                  </button>

                  <div className="flex flex-col items-center py-1" onClick={(e) => e.stopPropagation()}>
                    <div className="w-px h-4 bg-border" />
                    <InsertStepPopover insertIndex={index} onInsert={insertFlowNodeAfter}>
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40"
                        data-testid={`button-insert-step-${index}`}
                        title="Add step"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </InsertStepPopover>
                    {index < automation.steps.length - 1 && (
                      <div className="w-px h-4 bg-border" />
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-center pt-1" onClick={(e) => e.stopPropagation()}>
              <InsertStepPopover
                insertIndex={automation.steps.length - 1}
                onInsert={insertFlowNodeAfter}
              >
                <button
                  type="button"
                  className="h-8 w-8 rounded-full border bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground"
                  data-testid="button-add-step-end"
                  title="Add step"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </InsertStepPopover>
            </div>

            {!automation.steps.some((s) => s.actionId) && (
              <div className="mt-8 text-center px-4">
                <p className="text-sm text-muted-foreground">
                  Use Copilot,{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => {
                      setCopilotOpen(true);
                      setTemplatePickerNav("templates");
                      setTemplatePickerOpen(true);
                    }}
                    data-testid="button-choose-template-empty"
                  >
                    Choose from template
                  </button>
                  , or{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => {
                      setCopilotOpen(true);
                      setTemplatePickerNav("apps");
                      setTemplatePickerOpen(true);
                    }}
                    data-testid="button-choose-marketplace-empty"
                  >
                    Marketplace
                  </button>{" "}
                  in chat to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        {!copilotOpen && (
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="absolute bottom-5 right-5 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
            data-testid="button-floating-copilot"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        )}
        </div>

        {selectedStep && (
          <BuilderNodeProperties
            step={selectedStep}
            stepIndex={Math.max(0, selectedStepIndex)}
            triggers={catalog?.triggers || []}
            apps={marketplaceAppsForPicker.map((a) => ({ id: a.slug, name: a.name }))}
            appConnectionStatus={selectedStepConnectionStatus}
            onConnectApp={
              selectedStep?.appId &&
              selectedStepConnectionStatus === "disconnected"
                ? () => promptConnectIfNeeded(selectedStep.appId!)
                : undefined
            }
            icon={
              selectedStep.type === "trigger"
                ? Zap
                : (() => {
                    const nt =
                      typeof selectedStep.config?.nodeType === "string"
                        ? selectedStep.config.nodeType
                        : null;
                    return nt && nt in flowNodeTypeIcons
                      ? flowNodeTypeIcons[nt as keyof typeof flowNodeTypeIcons]
                      : Bot;
                  })()
            }
            nodeTypeLabel={
              typeof selectedStep.config?.nodeType === "string"
                ? flowNodeTypeLabels[selectedStep.config.nodeType] ||
                  selectedStep.config.nodeType
                : null
            }
            canDelete={
              selectedStep.type !== "trigger" && automation.steps.length > 2
            }
            onClose={() => setSelectedStepId(null)}
            onDelete={() => deleteStep(selectedStep.id)}
            onChangeLabel={(label) => updateStep(selectedStep.id, { label })}
            onChangeTrigger={(triggerId) =>
              updateStep(selectedStep.id, {
                appId: "loop9",
                actionId: triggerId,
                label: triggerId,
              })
            }
            onChangeApp={(appId, appName) => {
              updateStep(selectedStep.id, {
                appId,
                actionId: "send",
                label: `Send to ${appName}`,
              });
              promptConnectIfNeeded(appId);
            }}
            onChangeConfig={(patch) => updateStepConfig(selectedStep.id, patch)}
            onOpenPicker={() => setPickerStepId(selectedStep.id)}
          />
        )}
      </div>

      <BuilderTemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        initialNav={templatePickerNav}
        onSelectTemplate={applyTemplate}
        onSelectTool={applyTool}
        onSelectApp={(app) => {
          setAutomation((prev) => {
            const steps = [...prev.steps];
            const actionIdx = steps.findIndex((s) => s.type === "action");
            if (actionIdx >= 0) {
              steps[actionIdx] = {
                ...steps[actionIdx],
                appId: app.id,
                actionId: "send",
                label: `Send to ${app.name}`,
              };
            }
            const name =
              prev.name === "Untitled Zap" || prev.name === "Untitled automation"
                ? `${app.name} automation`
                : prev.name;
            return { ...prev, steps, name };
          });
          setTemplatePickerOpen(false);
          promptConnectIfNeeded(app.id);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Set the action to **${app.name}**. Pick a trigger on the first step, then refine with Copilot.`,
            },
          ]);
        }}
      />

      <Dialog open={!!pickerStepId} onOpenChange={(o) => !o && setPickerStepId(null)}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base">
              {pickerStep?.type === "trigger" ? "Select trigger" : "Select app"}
            </DialogTitle>
            <DialogDescription>
              {pickerStep?.type === "trigger"
                ? "Choose a trigger event for this step."
                : `Browse all ${marketplaceAppsForPicker.length} marketplace apps.`}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={
                  pickerStep?.type === "trigger"
                    ? "Search trigger events…"
                    : `Search ${marketplaceAppsForPicker.length} apps…`
                }
                className="pl-9 h-10"
                data-testid="input-step-picker-search"
                autoFocus
              />
            </div>
          </div>
          <ScrollArea className="max-h-[360px] px-3 pb-4">
            <div className="space-y-0.5">
              {pickerStep?.type !== "trigger" && integrationAppsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Loading marketplace apps…
                </p>
              ) : (
                pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyPickerSelection(item)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/70"
                    data-testid={`picker-item-${item.id}`}
                  >
                    {"logoUrl" in item && item.logoUrl ? (
                      <span className="h-8 w-8 rounded-md bg-white dark:bg-zinc-800 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={item.logoUrl} alt="" className="h-5 w-5 object-contain" />
                      </span>
                    ) : (
                      <span className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold uppercase shrink-0">
                        {item.name.slice(0, 2)}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {pickerStep?.type !== "trigger" && connectedSlugs.has(item.id) && (
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      >
                        Connected
                      </Badge>
                    )}
                  </button>
                ))
              )}
              {!integrationAppsLoading && pickerItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">No matches.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <IntegrationConnectDialog
        app={connectApp}
        open={!!connectApp}
        onOpenChange={(open) => {
          if (!open) setConnectApp(null);
        }}
      />

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-test-results">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.ok ? (
                <CircleCheck className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              Test results
            </DialogTitle>
            <DialogDescription>
              {testResult?.summary ||
                testResult?.error ||
                "Walks your steps with sample data and probes webhook URLs live."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {(testResult?.steps || []).map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setSelectedStepId(step.id);
                  setTestOpen(false);
                }}
                className="w-full text-left rounded-lg border border-border/60 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                data-testid={`test-step-${step.id}`}
              >
                <div className="flex items-start gap-2">
                  {step.status === "ok" ? (
                    <CircleCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : step.status === "warn" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">
                      {step.order + 1}. {step.label}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{step.detail}</p>
                  </div>
                </div>
              </button>
            ))}
            {testResult?.samplePayload && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Sample payload</p>
                <pre className="text-[11px] bg-muted/60 rounded-md p-3 overflow-x-auto max-h-40">
                  {JSON.stringify(testResult.samplePayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setTestOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => void runTest()}
              disabled={testing}
              data-testid="button-retest"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Run again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
