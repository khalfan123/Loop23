import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Send,
  Eye,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Phone,
  Layers,
  Megaphone,
  Zap,
  Clock,
  FileText,
  Shield,
  Filter,
  Workflow,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  description: string | null;
  method: string;
  secret: string;
  events: string[];
  campaignIds: string[] | null;
  authType: string | null;
  authCredentials: Record<string, any> | null;
  headers: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WebhookLog {
  id: number;
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  httpStatus: number | null;
  responseBody: string | null;
  responseTime: number | null;
  attemptNumber: number;
  maxAttempts: number;
  success: boolean;
  error: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

type WizardStep = "trigger" | "destination" | "review";

interface FormState {
  name: string;
  url: string;
  description: string;
  events: string[];
  filterByCampaign: boolean;
  selectedCampaigns: string[];
  authType: "none" | "basic" | "bearer" | "custom";
  authUsername: string;
  authPassword: string;
  authToken: string;
  authHeaders: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  description: "",
  events: [],
  filterByCampaign: false,
  selectedCampaigns: [],
  authType: "none",
  authUsername: "",
  authPassword: "",
  authToken: "",
  authHeaders: "{}",
};

export default function MyAutomationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [view, setView] = useState<"list" | "create">("list");
  const [step, setStep] = useState<WizardStep>("trigger");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState("");

  // Auto-open create wizard when arriving with ?action=create
  useEffect(() => {
    if (typeof window === "undefined") return;
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "create") setView("create");
  }, [location]);

  const { data: webhooks = [], isLoading } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });
  const { data: logs = [], isLoading: logsLoading } = useQuery<WebhookLog[]>({
    queryKey: ["/api/webhooks", selectedWebhook?.id, "logs"],
    enabled: !!selectedWebhook?.id && logsOpen,
  });

  const eventGroups = useMemo(
    () => [
      {
        name: t("webhooks.eventGroups.callEvents", "Outbound Call Events"),
        icon: Phone,
        events: [
          { value: "call.started", label: t("webhooks.events.callStarted") },
          { value: "call.ringing", label: t("webhooks.events.callRinging") },
          { value: "call.answered", label: t("webhooks.events.callAnswered") },
          { value: "call.completed", label: t("webhooks.events.callCompleted") },
          { value: "call.failed", label: t("webhooks.events.callFailed") },
          { value: "call.transferred", label: t("webhooks.events.callTransferred") },
          { value: "call.no_answer", label: t("webhooks.events.callNoAnswer") },
          { value: "call.busy", label: t("webhooks.events.callBusy") },
          { value: "call.voicemail", label: t("webhooks.events.callVoicemail") },
        ],
      },
      {
        name: t("webhooks.eventGroups.inboundCallEvents", "Inbound Call Events"),
        icon: Phone,
        events: [
          { value: "inbound_call.received", label: t("webhooks.events.inboundCallReceived") },
          { value: "inbound_call.answered", label: t("webhooks.events.inboundCallAnswered") },
          { value: "inbound_call.completed", label: t("webhooks.events.inboundCallCompleted") },
          { value: "inbound_call.missed", label: t("webhooks.events.inboundCallMissed") },
        ],
      },
      {
        name: t("webhooks.eventGroups.ivrEvents", "IVR (Phone Menu)"),
        icon: Layers,
        events: [
          { value: "ivr.started", label: t("webhooks.events.ivrStarted") },
          { value: "ivr.language_selected", label: t("webhooks.events.ivrLanguageSelected") },
          { value: "ivr.option_selected", label: t("webhooks.events.ivrOptionSelected") },
        ],
      },
      {
        name: t("webhooks.eventGroups.campaignEvents", "Campaign Events"),
        icon: Megaphone,
        events: [
          { value: "campaign.started", label: t("webhooks.events.campaignStarted") },
          { value: "campaign.paused", label: t("webhooks.events.campaignPaused") },
          { value: "campaign.resumed", label: t("webhooks.events.campaignResumed") },
          { value: "campaign.completed", label: t("webhooks.events.campaignCompleted") },
          { value: "campaign.failed", label: t("webhooks.events.campaignFailed") },
          { value: "campaign.cancelled", label: t("webhooks.events.campaignCancelled") },
        ],
      },
      {
        name: t("webhooks.eventGroups.flowEvents", "Flow Events"),
        icon: Zap,
        events: [
          { value: "flow.started", label: t("webhooks.events.flowStarted") },
          { value: "flow.completed", label: t("webhooks.events.flowCompleted") },
          { value: "flow.failed", label: t("webhooks.events.flowFailed") },
        ],
      },
      {
        name: t("webhooks.eventGroups.appointmentEvents", "Appointment Events"),
        icon: Clock,
        events: [
          { value: "appointment.booked", label: t("webhooks.events.appointmentBooked") },
          { value: "appointment.confirmed", label: t("webhooks.events.appointmentConfirmed") },
          { value: "appointment.cancelled", label: t("webhooks.events.appointmentCancelled") },
          { value: "appointment.rescheduled", label: t("webhooks.events.appointmentRescheduled") },
          { value: "appointment.completed", label: t("webhooks.events.appointmentCompleted") },
          { value: "appointment.no_show", label: t("webhooks.events.appointmentNoShow") },
        ],
      },
      {
        name: t("webhooks.eventGroups.formEvents", "Form Events"),
        icon: FileText,
        events: [
          { value: "form.submitted", label: t("webhooks.events.formSubmitted") },
          { value: "form.lead_created", label: t("webhooks.events.formLeadCreated") },
          { value: "lead.captured", label: t("webhooks.events.leadCaptured") },
        ],
      },
    ],
    [t],
  );

  const filteredEventGroups = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return eventGroups;
    return eventGroups
      .map((g) => ({
        ...g,
        events: g.events.filter(
          (e) =>
            e.value.toLowerCase().includes(q) ||
            e.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.events.length > 0);
  }, [eventGroups, eventSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      let authCredentials: Record<string, any> | null = null;
      let authType: string | null = null;
      if (form.authType === "basic") {
        authType = "basic";
        authCredentials = {
          username: form.authUsername,
          password: form.authPassword,
        };
      } else if (form.authType === "bearer") {
        authType = "bearer";
        authCredentials = { token: form.authToken };
      } else if (form.authType === "custom") {
        authType = "custom";
        try {
          authCredentials = JSON.parse(form.authHeaders);
        } catch {
          throw new Error(
            t(
              "webhooks.errors.invalidJson",
              "Invalid JSON format for custom headers",
            ),
          );
        }
      }
      const payload: Record<string, unknown> = {
        name: form.name,
        url: form.url,
        description: form.description || null,
        events: form.events,
        campaignIds:
          form.filterByCampaign && form.selectedCampaigns.length > 0
            ? form.selectedCampaigns
            : null,
      };
      if (authType) {
        payload.authType = authType;
        payload.authCredentials = authCredentials;
      }
      const res = await apiRequest("POST", "/api/webhooks", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/limits"] });
      toast({ title: t("webhooks.toast.created", "Automation created") });
      handleCloseCreate();
    },
    onError: (err: any) => {
      toast({
        title: t("webhooks.toast.createFailed", "Failed to create"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/webhooks/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: t("webhooks.toast.deleted", "Automation deleted") });
    },
    onError: (err: any) => {
      toast({
        title: t("webhooks.toast.deleteFailed", "Failed to delete"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/webhooks/${id}/test`, {});
      return res.json();
    },
    onSuccess: (_, id) => {
      toast({ title: t("webhooks.toast.testSent", "Test sent") });
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks", id, "logs"] });
    },
    onError: (err: any) => {
      toast({
        title: t("webhooks.toast.testFailed", "Test failed"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("POST", `/api/webhooks/logs/${logId}/retry`, {});
    },
    onSuccess: () => {
      toast({ title: t("webhooks.toast.retryInitiated", "Retry initiated") });
      if (selectedWebhook) {
        queryClient.invalidateQueries({
          queryKey: ["/api/webhooks", selectedWebhook.id, "logs"],
        });
      }
    },
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(webhooks, 10);

  const handleCloseCreate = () => {
    setView("list");
    setStep("trigger");
    setForm(EMPTY_FORM);
    setEventSearch("");
    if (typeof window !== "undefined" && window.location.search.includes("action=")) {
      navigate("/app/settings/automation/mine");
    }
  };

  const toggleEvent = (ev: string) => {
    setForm((p) => ({
      ...p,
      events: p.events.includes(ev)
        ? p.events.filter((e) => e !== ev)
        : [...p.events, ev],
    }));
  };

  const stepValid = (s: WizardStep) => {
    if (s === "trigger") return form.events.length > 0;
    if (s === "destination") return !!form.name && !!form.url;
    return form.events.length > 0 && !!form.name && !!form.url;
  };

  const goNext = () => {
    if (step === "trigger" && stepValid("trigger")) setStep("destination");
    else if (step === "destination" && stepValid("destination")) setStep("review");
  };
  const goBack = () => {
    if (step === "destination") setStep("trigger");
    else if (step === "review") setStep("destination");
  };

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        {t("webhooks.loading", "Loading automations…")}
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto space-y-6">
      {view === "list" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {t("automation.mine.title", "My automations")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "automation.mine.subtitle",
                  "Custom webhooks that listen for AI call-center events and forward them to your stack.",
                )}
              </p>
            </div>
            <Button
              onClick={() => setView("create")}
              data-testid="button-create-automation"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t("automation.mine.create", "Create automation")}
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <Card className="rounded-xl border-dashed">
              <CardContent className="py-12 flex flex-col items-center text-center gap-3">
                <Workflow className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h3 className="text-base font-semibold">
                    {t(
                      "automation.mine.empty.title",
                      "No custom automations yet",
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    {t(
                      "automation.mine.empty.subtitle",
                      "Browse the marketplace for one-click templates, or build a custom webhook in 3 steps.",
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate("/app/settings/automation/marketplace")
                    }
                    data-testid="button-empty-marketplace"
                  >
                    {t("automation.mine.empty.marketplace", "Browse marketplace")}
                  </Button>
                  <Button
                    onClick={() => setView("create")}
                    data-testid="button-empty-create"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t("automation.mine.empty.create", "Create custom")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3">
                {paginatedItems.map((wh) => (
                  <Card
                    key={wh.id}
                    className="rounded-xl border-border/40 bg-card/50"
                    data-testid={`card-webhook-${wh.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Workflow className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h3 className="font-semibold truncate" data-testid={`text-webhook-name-${wh.id}`}>
                              {wh.name}
                            </h3>
                            <Badge variant={wh.isActive ? "default" : "secondary"}>
                              {wh.isActive
                                ? t("common.active", "Active")
                                : t("common.inactive", "Inactive")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 break-all">
                            {wh.url}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {wh.events.slice(0, 4).map((ev) => (
                              <Badge
                                key={ev}
                                variant="outline"
                                className="text-[10px] font-mono"
                              >
                                {ev}
                              </Badge>
                            ))}
                            {wh.events.length > 4 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{wh.events.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testMutation.mutate(wh.id)}
                            disabled={testMutation.isPending}
                            data-testid={`button-test-${wh.id}`}
                          >
                            <Send className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">
                              {t("webhooks.actions.test", "Test")}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWebhook(wh);
                              setLogsOpen(true);
                            }}
                            data-testid={`button-logs-${wh.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">
                              {t("webhooks.actions.logs", "Logs")}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(wh.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${wh.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </>
          )}
        </>
      )}

      {view === "create" && (
        <CreateWizard
          step={step}
          form={form}
          eventGroups={filteredEventGroups}
          eventSearch={eventSearch}
          campaigns={campaigns}
          onEventSearchChange={setEventSearch}
          setForm={setForm}
          toggleEvent={toggleEvent}
          stepValid={stepValid}
          onNext={goNext}
          onBack={goBack}
          onClose={handleCloseCreate}
          onSubmit={() => createMutation.mutate()}
          submitting={createMutation.isPending}
        />
      )}

      <LogsDialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        webhook={selectedWebhook}
        logs={logs}
        loading={logsLoading}
        onRetry={(id) => retryMutation.mutate(id)}
      />
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────

function CreateWizard({
  step,
  form,
  eventGroups,
  eventSearch,
  campaigns,
  onEventSearchChange,
  setForm,
  toggleEvent,
  stepValid,
  onNext,
  onBack,
  onClose,
  onSubmit,
  submitting,
}: {
  step: WizardStep;
  form: FormState;
  eventGroups: Array<{
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    events: Array<{ value: string; label: string }>;
  }>;
  eventSearch: string;
  campaigns: Campaign[];
  onEventSearchChange: (s: string) => void;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  toggleEvent: (ev: string) => void;
  stepValid: (s: WizardStep) => boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const steps: WizardStep[] = ["trigger", "destination", "review"];
  const stepLabels: Record<WizardStep, string> = {
    trigger: t("automation.wizard.steps.trigger", "Trigger"),
    destination: t("automation.wizard.steps.destination", "Destination"),
    review: t("automation.wizard.steps.review", "Review"),
  };
  const idx = steps.indexOf(step);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-wizard-close">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t("common.back", "Back")}
        </Button>
        <h2 className="text-lg font-semibold">
          {t("automation.wizard.title", "New automation")}
        </h2>
        <div className="w-16" />
      </div>

      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium",
                i < idx
                  ? "bg-emerald-500 text-white"
                  : i === idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < idx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === idx ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {stepLabels[s]}
            </span>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      <Card className="rounded-xl border-border/50">
        <CardContent className="p-6">
          {step === "trigger" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {t("automation.wizard.trigger.title", "Pick trigger events")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "automation.wizard.trigger.subtitle",
                    "Choose which AI call-center events should fire this automation.",
                  )}
                </p>
              </div>

              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={eventSearch}
                  onChange={(e) => onEventSearchChange(e.target.value)}
                  placeholder={t(
                    "automation.wizard.trigger.search",
                    "Search events…",
                  )}
                  className="pl-9"
                  data-testid="input-event-search"
                />
              </div>

              {form.events.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t("webhooks.labels.eventsSelected", {
                    count: form.events.length,
                    defaultValue: "{{count}} event(s) selected",
                  })}
                </div>
              )}

              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {eventGroups.map((g) => {
                  const Icon = g.icon;
                  return (
                    <div key={g.name} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Icon className="h-3.5 w-3.5" />
                        {g.name}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {g.events.map((e) => {
                          const checked = form.events.includes(e.value);
                          return (
                            <button
                              key={e.value}
                              type="button"
                              onClick={() => toggleEvent(e.value)}
                              data-testid={`event-${e.value}`}
                              className={cn(
                                "flex items-start gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                                checked
                                  ? "border-primary bg-primary/5"
                                  : "border-border/50 hover:bg-muted/40",
                              )}
                            >
                              <Checkbox checked={checked} className="mt-0.5" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{e.label}</div>
                                <div className="text-[11px] text-muted-foreground font-mono truncate">
                                  {e.value}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "destination" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {t(
                    "automation.wizard.destination.title",
                    "Where should events go?",
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "automation.wizard.destination.subtitle",
                    "Give your automation a name, an HTTPS endpoint, and optional auth.",
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-name">
                  {t("webhooks.labels.webhookName", "Automation name")} *
                </Label>
                <Input
                  id="auto-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t(
                    "webhooks.placeholders.webhookName",
                    "My CRM Integration",
                  )}
                  data-testid="input-webhook-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-url">
                  {t("webhooks.labels.endpointUrl", "Endpoint URL")} *
                </Label>
                <Input
                  id="auto-url"
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder={t(
                    "webhooks.placeholders.endpointUrl",
                    "https://api.example.com/webhooks",
                  )}
                  data-testid="input-webhook-url"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  {t("webhooks.labels.campaignFilter", "Campaign filter")}
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {t("common.optional", "Optional")}
                  </Badge>
                </Label>
                <div className="rounded-lg border border-border/50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t(
                        "webhooks.labels.filterBySpecific",
                        "Filter by specific campaigns",
                      )}
                    </span>
                    <Switch
                      checked={form.filterByCampaign}
                      onCheckedChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          filterByCampaign: v,
                          selectedCampaigns: v ? p.selectedCampaigns : [],
                        }))
                      }
                      data-testid="switch-filter-campaign"
                    />
                  </div>
                  {form.filterByCampaign && campaigns.length > 0 && (
                    <div className="grid gap-1.5 max-h-32 overflow-y-auto">
                      {campaigns.map((c) => {
                        const checked = form.selectedCampaigns.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm",
                              checked ? "border-primary bg-primary/5" : "border-border/40",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                setForm((p) => ({
                                  ...p,
                                  selectedCampaigns: checked
                                    ? p.selectedCampaigns.filter((id) => id !== c.id)
                                    : [...p.selectedCampaigns, c.id],
                                }))
                              }
                            />
                            <span className="flex-1 truncate">{c.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {c.status}
                            </Badge>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  {t("webhooks.labels.authentication", "Authentication")}
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {t("common.optional", "Optional")}
                  </Badge>
                </Label>
                <Select
                  value={form.authType}
                  onValueChange={(v: any) =>
                    setForm((p) => ({ ...p, authType: v }))
                  }
                >
                  <SelectTrigger data-testid="select-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("webhooks.auth.none", "None")}
                    </SelectItem>
                    <SelectItem value="basic">
                      {t("webhooks.auth.basic", "Basic Auth")}
                    </SelectItem>
                    <SelectItem value="bearer">
                      {t("webhooks.auth.bearer", "Bearer Token")}
                    </SelectItem>
                    <SelectItem value="custom">
                      {t("webhooks.auth.custom", "Custom Headers")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {form.authType === "basic" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input
                      placeholder={t("webhooks.labels.username", "Username")}
                      value={form.authUsername}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, authUsername: e.target.value }))
                      }
                      data-testid="input-auth-username"
                    />
                    <Input
                      type="password"
                      placeholder={t("webhooks.labels.password", "Password")}
                      value={form.authPassword}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, authPassword: e.target.value }))
                      }
                      data-testid="input-auth-password"
                    />
                  </div>
                )}
                {form.authType === "bearer" && (
                  <Input
                    type="password"
                    placeholder={t(
                      "webhooks.placeholders.bearerToken",
                      "your-secret-token",
                    )}
                    value={form.authToken}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, authToken: e.target.value }))
                    }
                    data-testid="input-auth-token"
                    className="mt-2"
                  />
                )}
                {form.authType === "custom" && (
                  <Textarea
                    placeholder={t(
                      "webhooks.placeholders.customHeaders",
                      '{"X-API-Key": "your-key"}',
                    )}
                    value={form.authHeaders}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, authHeaders: e.target.value }))
                    }
                    rows={3}
                    data-testid="input-auth-headers"
                    className="mt-2 font-mono text-xs"
                  />
                )}
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {t("automation.wizard.review.title", "Review & create")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "automation.wizard.review.subtitle",
                    "Double-check your trigger and destination, then create the automation.",
                  )}
                </p>
              </div>

              <ReviewRow
                label={t("automation.wizard.review.name", "Name")}
                value={form.name}
              />
              <ReviewRow
                label={t("automation.wizard.review.url", "Endpoint")}
                value={form.url}
                mono
              />
              <ReviewRow
                label={t("automation.wizard.review.events", "Trigger events")}
                value={
                  <div className="flex flex-wrap gap-1">
                    {form.events.map((ev) => (
                      <Badge
                        key={ev}
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {ev}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <ReviewRow
                label={t("automation.wizard.review.auth", "Authentication")}
                value={
                  form.authType === "none"
                    ? t("webhooks.auth.none", "None")
                    : form.authType
                }
              />
              <ReviewRow
                label={t("automation.wizard.review.campaigns", "Campaigns")}
                value={
                  form.filterByCampaign && form.selectedCampaigns.length > 0
                    ? t("webhooks.labels.filteringByCampaigns", {
                        count: form.selectedCampaigns.length,
                        defaultValue: "Filtering by {{count}} campaigns",
                      })
                    : t("webhooks.labels.receivingFromAll", "All campaigns")
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={step === "trigger"}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t("common.back", "Back")}
        </Button>
        {step !== "review" ? (
          <Button
            size="sm"
            onClick={onNext}
            disabled={!stepValid(step)}
            data-testid="button-wizard-next"
          >
            {t("common.next", "Next")}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!stepValid("review") || submitting}
            data-testid="button-wizard-submit"
          >
            {submitting
              ? t("common.creating", "Creating…")
              : t("automation.wizard.submit", "Create automation")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-border/30 last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className={cn("sm:col-span-2 text-sm break-words", mono && "font-mono text-xs")}>
        {value || "—"}
      </div>
    </div>
  );
}

// ─── Logs dialog ────────────────────────────────────────────────────

function LogsDialog({
  open,
  onClose,
  webhook,
  logs,
  loading,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  webhook: Webhook | null;
  logs: WebhookLog[];
  loading: boolean;
  onRetry: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("webhooks.logs.title", "Automation delivery logs")}
          </DialogTitle>
          <DialogDescription>
            {webhook?.name} — {webhook?.url}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="recent">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="recent">
              {t("webhooks.logs.recentDeliveries", "Recent")}
            </TabsTrigger>
            <TabsTrigger value="failed">
              {t("webhooks.logs.failedDeliveries", "Failed")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recent" className="mt-3">
            <ScrollArea className="h-80">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t("webhooks.logs.loading", "Loading…")}
                </p>
              ) : logs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t("webhooks.logs.noLogs", "No deliveries yet")}
                </p>
              ) : (
                <div className="space-y-2 pr-3">
                  {logs.map((l) => (
                    <LogItem key={l.id} log={l} onRetry={onRetry} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="failed" className="mt-3">
            <ScrollArea className="h-80">
              {logs.filter((l) => !l.success).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t("webhooks.logs.noFailed", "No failed deliveries")}
                </p>
              ) : (
                <div className="space-y-2 pr-3">
                  {logs.filter((l) => !l.success).map((l) => (
                    <LogItem key={l.id} log={l} onRetry={onRetry} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LogItem({
  log,
  onRetry,
}: {
  log: WebhookLog;
  onRetry: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        log.success
          ? "border-border/40"
          : "border-rose-500/30 bg-rose-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {log.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-500" />
          )}
          <span className="text-sm font-medium font-mono">{log.event}</span>
          <Badge variant="outline" className="text-[10px]">
            {t("webhooks.logs.attempt", "Attempt")} {log.attemptNumber}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {log.responseTime ? `${log.responseTime}ms` : "—"} ·{" "}
          {format(new Date(log.createdAt), "MMM d, HH:mm")}
        </div>
      </div>
      {log.error && (
        <p className="mt-2 text-xs text-rose-500 bg-rose-500/10 rounded p-2">
          {log.error}
        </p>
      )}
      {!log.success && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          onClick={() => onRetry(log.id)}
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          {t("webhooks.actions.retry", "Retry")}
        </Button>
      )}
    </div>
  );
}
