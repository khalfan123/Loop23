import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThreeColumnLayout, SubPanelItem, SubPanelSection } from "@/components/ThreeColumnLayout";
import { cn } from "@/lib/utils";
import { Fragment } from "react";
import {
  Loader2,
  Sparkles,
  Send,
  Workflow,
  Zap,
  Copy,
  ExternalLink,
  Search,
  Plug,
  CheckCircle2,
  ArrowLeft,
  Ticket,
  MessagesSquare,
  Building2,
  ChevronDown,
  LayoutGrid,
  Users,
  Mail,
  MessageSquare,
  Headphones,
  Calendar,
  ShoppingCart,
  BarChart3,
  Database,
  Webhook,
} from "lucide-react";
import type { IntegrationApp, UserIntegration } from "@shared/schema";

type ChatEvent =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; kind?: "text" | "recipe" | "questions" | "status" };

type ConciergeTemplate = {
  id: string;
  industry: string;
  useCase: string;
  title: string;
  prompt: string;
  triggerEvent: "call.completed" | "lead.captured" | "appointment.booked" | "campaign.completed";
  destination: "zendesk" | "slack" | "hubspot" | "google_calendar" | "google_sheets";
};

type ConciergeQuestion = {
  id: string;
  prompt: string;
  inputType: "text" | "select";
  options?: Array<{ id: string; label: string }>;
};

interface IntegrationsConciergeProps {
  embedded?: boolean;
}

export default function IntegrationsConcierge({ embedded = false }: IntegrationsConciergeProps = {}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [appCategory, setAppCategory] = useState<string>("all");

  const [templateSearch, setTemplateSearch] = useState("");
  const [templateIndustry, setTemplateIndustry] = useState<string>("all");
  const [templateUseCase, setTemplateUseCase] = useState<string>("all");
  const [templateTrigger, setTemplateTrigger] = useState<ConciergeTemplate["triggerEvent"] | "all">("all");
  const [templateDestination, setTemplateDestination] = useState<ConciergeTemplate["destination"] | "all">("all");
  const [templateLimit, setTemplateLimit] = useState(30);
  const [selectedTemplate, setSelectedTemplate] = useState<ConciergeTemplate | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateFilterTab, setTemplateFilterTab] = useState<"industry" | "usecase">("industry");

  const [lastIntent, setLastIntent] = useState<string>("");

  const [draft, setDraft] = useState(
    "When a call is completed, create a Zendesk ticket with the call summary."
  );
  const [events, setEvents] = useState<ChatEvent[]>([
    {
      role: "assistant",
      kind: "text",
      content:
        "Tell me what you want to automate. Example: “WordPress orders → Zendesk tickets” or “Shopify refunds → Slack alert”.",
    },
  ]);

  const [recipe, setRecipe] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [deployResult, setDeployResult] = useState<any>(null);

  const [inputs, setInputs] = useState({
    zendeskSubdomain: "",
    zendeskEmail: "",
    zendeskApiToken: "",
    slackBotToken: "",
    slackChannel: "",
    hubspotToken: "",
  });

  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  const templates = useMemo<ConciergeTemplate[]>(() => {
    const industries = [
      "Healthcare",
      "Financial Services",
      "Insurance",
      "Logistics",
      "Home Services",
      "Retail & Consumer",
      "Travel & Hospitality",
      "Debt Collection",
    ];

    const useCases = ["Lead Qualification", "Customer Support", "Receptionists", "Dispatch Service"];

    const triggers: Array<{ event: ConciergeTemplate["triggerEvent"]; label: string }> = [
      { event: "call.completed", label: "Call completed" },
      { event: "lead.captured", label: "Lead captured" },
      { event: "appointment.booked", label: "Appointment booked" },
      { event: "campaign.completed", label: "Campaign completed" },
    ];

    const destinations: Array<{ slug: ConciergeTemplate["destination"]; label: string }> = [
      { slug: "zendesk", label: "Zendesk" },
      { slug: "slack", label: "Slack" },
      { slug: "hubspot", label: "HubSpot" },
      { slug: "google_calendar", label: "Google Calendar" },
      { slug: "google_sheets", label: "Google Sheets" },
    ];

    const actionByDestination: Record<ConciergeTemplate["destination"], string[]> = {
      zendesk: ["create a ticket", "create a ticket with summary + transcript link", "tag the ticket with intent"],
      slack: ["post a summary to #support", "post an alert to #sales", "post call outcomes + next steps"],
      hubspot: ["upsert contact", "create a deal and attach notes", "log a call engagement with summary"],
      google_calendar: ["create an event", "create an event with meeting notes", "create an event and invite attendee"],
      google_sheets: ["append a KPI row", "append a row with lead fields", "append a row with call outcomes"],
    };

    const rows: ConciergeTemplate[] = [];
    for (const industry of industries) {
      for (const useCase of useCases) {
        for (const t of triggers) {
          for (const d of destinations) {
            const variants = actionByDestination[d.slug];
            for (let i = 0; i < variants.length; i++) {
              const action = variants[i];
              const title = `${useCase}: ${t.event} → ${d.label}`;
              const prompt = `Industry: ${industry}. Use case: ${useCase}. When ${t.event} happens in our platform, ${action} in ${d.label}.`;
              rows.push({
                id: `${industry}-${useCase}-${t.event}-${d.slug}-${i}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                industry,
                useCase,
                title,
                prompt,
                triggerEvent: t.event,
                destination: d.slug,
              });
            }
          }
        }
      }
    }

    // rows count: industries(20) * triggers(4) * destinations(5) * variants(3) = 1200+
    // Keep exactly 500 deterministic templates for fast UX.
    return rows.slice(0, 500);
  }, []);

  const useCases = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.useCase);
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const useCasesForIndustry = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (templateIndustry !== "all" && t.industry !== templateIndustry) continue;
      set.add(t.useCase);
    }
    return ["all", ...Array.from(set).sort()];
  }, [templates, templateIndustry]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.industry);
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((t) => {
      if (templateIndustry !== "all" && t.industry !== templateIndustry) return false;
      if (templateUseCase !== "all" && t.useCase !== templateUseCase) return false;
      if (templateTrigger !== "all" && t.triggerEvent !== templateTrigger) return false;
      if (templateDestination !== "all" && t.destination !== templateDestination) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q) ||
        t.industry.toLowerCase().includes(q) ||
        t.useCase.toLowerCase().includes(q)
      );
    });
  }, [templates, templateSearch, templateIndustry, templateUseCase, templateTrigger, templateDestination]);

  const industryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of templates) map[t.industry] = (map[t.industry] || 0) + 1;
    return map;
  }, [templates]);

  const { data: apps = [] } = useQuery<IntegrationApp[]>({ queryKey: ["/api/integrations/apps"] });
  const { data: connected = [] } = useQuery<Array<{ integration: UserIntegration; app: IntegrationApp }>>({
    queryKey: ["/api/integrations/connected"],
  });

  const CATEGORY_CONFIG: Array<{ value: string; label: string; icon: React.ReactNode }> = useMemo(
    () => [
      { value: "all", label: "All Integrations", icon: <LayoutGrid className="w-4 h-4" /> },
      { value: "crm", label: "CRM", icon: <Users className="w-4 h-4" /> },
      { value: "marketing", label: "Marketing", icon: <Mail className="w-4 h-4" /> },
      { value: "communication", label: "Communication", icon: <MessageSquare className="w-4 h-4" /> },
      { value: "support", label: "Support", icon: <Headphones className="w-4 h-4" /> },
      { value: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" /> },
      { value: "ecommerce", label: "E-Commerce", icon: <ShoppingCart className="w-4 h-4" /> },
      { value: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { value: "automation", label: "Automation", icon: <Workflow className="w-4 h-4" /> },
      { value: "data_storage", label: "Data & Storage", icon: <Database className="w-4 h-4" /> },
      { value: "hr_recruiting", label: "HR & Recruiting", icon: <Users className="w-4 h-4" /> },
    ],
    []
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: apps.length };
    for (const app of apps) {
      const cat = app.category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [apps]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/integrations/concierge/chat", { message, context: {} });
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data?.type === "questions") {
        setChatOpen(true);
        setQuestions(data.questions || []);
        setRecipe(null);
        setEvents((prev) => [
          ...prev,
          {
            role: "assistant",
            kind: "questions",
            content: "Quick questions so I can generate the workflow.",
          },
        ]);
      } else if (data?.type === "recipe") {
        setChatOpen(true);
        setRecipe(data.recipe);
        setQuestions([]);
        setQuestionAnswers({});
        setEvents((prev) => [
          ...prev,
          { role: "assistant", kind: "recipe", content: "I’ve prepared a workflow recipe. Review it and deploy." },
        ]);
      } else {
        setEvents((prev) => [...prev, { role: "assistant", kind: "text", content: "I couldn’t parse that response." }]);
      }
    },
    onError: (err: any) => {
      const status = err?.status;
      if (status === 429) {
        toast({ title: "Slow down", description: err.message || "Too many requests. Try again shortly." });
        setEvents((prev) => [
          ...prev,
          { role: "assistant", kind: "text", content: err.message || "Too many requests. Please try again shortly." },
        ]);
        return;
      }
      toast({ title: "Concierge failed", description: err.message || "Failed to chat", variant: "destructive" });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!recipe) throw new Error("No recipe yet. Ask the concierge first.");
      const res = await apiRequest("POST", "/api/integrations/concierge/provision", {
        recipe: {
          ...recipe,
          destination: { ...(recipe.destination || {}), subdomain: inputs.zendeskSubdomain },
        },
        inputs,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setDeployResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setEvents((prev) => [
        ...prev,
        { role: "assistant", kind: "status", content: "Deployed. Your n8n workflow is active." },
        ...(data?.n8n?.webhookUrl
          ? [{ role: "assistant" as const, kind: "status" as const, content: `Webhook: ${data.n8n.webhookUrl}` }]
          : []),
      ]);
      toast({ title: "Deployed", description: "Workflow created and activated in n8n." });
    },
    onError: (err: any) => {
      toast({ title: "Deploy failed", description: err.message || "Failed to deploy workflow", variant: "destructive" });
    },
  });

  const send = async () => {
    const msg = draft.trim();
    if (!msg) return;
    setDeployResult(null);
    setLastIntent(msg);
    setEvents((prev) => [...prev, { role: "user", content: msg }]);
    setDraft("");

    if (msg === "/deploy" || msg.startsWith("/deploy ")) {
      setChatOpen(true);
      setEvents((prev) => [
        ...prev,
        { role: "assistant", kind: "status", content: "Deploying…" },
      ]);
      provisionMutation.mutate();
      return;
    }

    chatMutation.mutate(msg);
  };

  const applyAnswerToInputs = (id: string, value: string) => {
    // Keep questionAnswers for continuing conversation.
    setQuestionAnswers((prev) => ({ ...prev, [id]: value }));

    // If the answer maps to known credential fields, mirror it into the credentials inputs.
    if (
      id === "zendeskSubdomain" ||
      id === "zendeskEmail" ||
      id === "zendeskApiToken" ||
      id === "slackBotToken" ||
      id === "slackChannel" ||
      id === "hubspotToken"
    ) {
      setInputs((prev) => ({ ...prev, [id]: value }));
    }
  };

  const continueFromQuestions = () => {
    const qs = (questions || []) as ConciergeQuestion[];
    const missing = qs.filter((q) => {
      const v = (questionAnswers[q.id] || "").trim();
      return !v;
    });
    if (missing.length > 0) {
      toast({ title: "Missing details", description: "Answer the questions above to continue.", variant: "destructive" });
      return;
    }

    const payload = {
      intent: lastIntent,
      answers: questionAnswers,
    };

    // Ask Bedrock again with intent + answers.
    setEvents((prev) => [
      ...prev,
      { role: "user", content: `Answers: ${JSON.stringify(payload)}` },
    ]);
    chatMutation.mutate(`Answers: ${JSON.stringify(payload)}`);
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  const destinationSlug = recipe?.destination?.slug as string | undefined;
  const destinationIcon =
    destinationSlug === "zendesk" ? <Ticket className="w-4 h-4" /> :
    destinationSlug === "slack" ? <MessagesSquare className="w-4 h-4" /> :
    destinationSlug === "hubspot" ? <Building2 className="w-4 h-4" /> :
    <Plug className="w-4 h-4" />;

  const templatesMarketplace = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      <div className="md:col-span-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            value={templateSearch}
            onChange={(e) => {
              setTemplateSearch(e.target.value);
              setTemplateLimit(30);
            }}
            placeholder="Search templates…"
            className="pl-9"
            data-testid="input-template-search-modal"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={templateFilterTab === "industry" ? "default" : "outline"}
            onClick={() => setTemplateFilterTab("industry")}
            className="h-8"
            data-testid="tab-template-filter-industry"
          >
            Industry
          </Button>
          <Button
            size="sm"
            variant={templateFilterTab === "usecase" ? "default" : "outline"}
            onClick={() => setTemplateFilterTab("usecase")}
            className="h-8"
            disabled={templateIndustry === "all"}
            data-testid="tab-template-filter-usecase"
            title={templateIndustry === "all" ? "Choose an industry first" : undefined}
          >
            Use cases
          </Button>
        </div>

        {templateFilterTab === "industry" ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Industry</div>
            <div className="flex flex-wrap gap-2">
              {industries.map((ind) => (
                <Button
                  key={ind}
                  size="sm"
                  variant={templateIndustry === ind ? "default" : "outline"}
                  onClick={() => {
                    setTemplateIndustry(ind);
                    setTemplateUseCase("all");
                    setTemplateLimit(30);
                    if (ind !== "all") setTemplateFilterTab("usecase");
                  }}
                  className="h-8"
                  data-testid={`chip-template-industry-modal-${ind}`}
                >
                  {ind === "all" ? "All" : ind}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Use cases {templateIndustry !== "all" ? `• ${templateIndustry}` : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              {useCasesForIndustry.map((uc) => (
                <Button
                  key={uc}
                  size="sm"
                  variant={templateUseCase === uc ? "default" : "outline"}
                  onClick={() => {
                    setTemplateUseCase(uc);
                    setTemplateLimit(30);
                  }}
                  className="h-8"
                  data-testid={`chip-template-usecase-modal-${uc}`}
                >
                  {uc === "all" ? "All" : uc}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setTemplateFilterTab("industry")}
              data-testid="button-back-to-industry"
            >
              Back to industry
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Events</div>
          <div className="flex flex-wrap gap-2">
            {(["all", "call.completed", "lead.captured", "appointment.booked", "campaign.completed"] as const).map(
              (ev) => (
                <Button
                  key={ev}
                  size="sm"
                  variant={templateTrigger === ev ? "default" : "outline"}
                  onClick={() => {
                    setTemplateTrigger(ev);
                    setTemplateLimit(30);
                  }}
                  className="h-8"
                  data-testid={`chip-template-trigger-modal-${ev}`}
                >
                  {ev === "all" ? "All" : ev}
                </Button>
              )
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Destinations</div>
          <div className="flex flex-wrap gap-2">
            {(["all", "zendesk", "slack", "hubspot", "google_calendar", "google_sheets"] as const).map((dest) => (
              <Button
                key={dest}
                size="sm"
                variant={templateDestination === dest ? "default" : "outline"}
                onClick={() => {
                  setTemplateDestination(dest);
                  setTemplateLimit(30);
                }}
                className="h-8"
                data-testid={`chip-template-destination-modal-${dest}`}
              >
                {dest === "all" ? "All" : dest}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="md:col-span-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">
            Templates <span className="text-muted-foreground">({filteredTemplates.length})</span>
          </div>
          {selectedTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTemplate(null)}
              data-testid="button-clear-selected-template"
            >
              Clear selection
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredTemplates.slice(0, templateLimit).map((t) => (
            <button
              key={t.id}
              className={[
                "rounded-2xl border p-4 text-left transition-colors hover:bg-muted/20",
                selectedTemplate?.id === t.id ? "border-primary/50 bg-primary/5" : "border-border/70 bg-background",
              ].join(" ")}
              onClick={() => setSelectedTemplate(t)}
              data-testid="card-template"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{t.industry}</Badge>
                    <Badge variant="secondary">{t.useCase}</Badge>
                    <Badge variant="outline">{t.triggerEvent}</Badge>
                    <Badge variant="outline">{t.destination}</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground line-clamp-2">{t.prompt}</div>
            </button>
          ))}
        </div>

        {filteredTemplates.length > templateLimit && (
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setTemplateLimit((n) => Math.min(n + 50, filteredTemplates.length))}
              data-testid="button-template-more-modal"
            >
              Show more ({Math.min(templateLimit + 50, filteredTemplates.length)}/{filteredTemplates.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const leftPanel = (
    <div className="space-y-1">
      <SubPanelSection title="Integrations navigation">
        <SubPanelItem
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Marketplace"
          isActive={false}
          onClick={() => navigate("/app/integrations?tab=marketplace")}
          data-testid="nav-integrations-marketplace"
        />
        <SubPanelItem
          icon={<Sparkles className="w-4 h-4" />}
          label="Developer Concierge"
          isActive={true}
          onClick={() => navigate("/app/integrations/concierge")}
          data-testid="nav-integrations-concierge"
        />
        <SubPanelItem
          icon={<Zap className="w-4 h-4" />}
          label="My integrations"
          isActive={false}
          badge={connected?.length || 0}
          onClick={() => navigate("/app/integrations?tab=connected")}
          data-testid="nav-integrations-connected"
        />
        <SubPanelItem
          icon={<Webhook className="w-4 h-4" />}
          label="API & Webhooks"
          isActive={false}
          onClick={() => navigate("/app/integrations?tab=webhooks")}
          data-testid="nav-integrations-webhooks"
        />
      </SubPanelSection>

      <SubPanelSection title="Categories">
        {CATEGORY_CONFIG.map((cat) => (
          <SubPanelItem
            key={cat.value}
            icon={cat.icon}
            label={cat.label}
            isActive={cat.value !== "all" && appCategory === cat.value}
            badge={categoryCounts[cat.value] || 0}
            onClick={() => setAppCategory(cat.value)}
            data-testid={`filter-category-${cat.value}`}
          />
        ))}
      </SubPanelSection>
    </div>
  );

  const Wrapper: any = embedded ? Fragment : ThreeColumnLayout;
  const wrapperProps: any = embedded
    ? {}
    : { subPanel: leftPanel, subPanelHeader: "Developer Concierge", subPanelWidth: "md" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" data-testid="page-integrations-concierge">
        <div className="xl:col-span-12">
          <Card className={cn(
            "flex flex-col overflow-hidden",
            embedded
              ? "border-0 rounded-none shadow-none h-[calc(100vh-220px)] bg-transparent"
              : "feature-card-border h-[calc(100vh-150px)]"
          )}>
            <div className="px-6 py-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h1 className="text-xl font-semibold">Developer Concierge</h1>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Pick a template → generate → type /deploy.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTemplatesOpen(true)}
                    data-testid="button-open-templates-marketplace"
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Templates marketplace
                  </Button>
                  {chatMutation.isPending && (
                    <Badge variant="secondary" className="gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <Progress
                  value={deployResult ? 100 : recipe ? 66 : selectedTemplate ? 33 : 0}
                  className="h-2"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className={selectedTemplate ? "text-foreground" : undefined}>1) Template</span>
                  <span className={recipe ? "text-foreground" : undefined}>2) Generate</span>
                  <span className={deployResult ? "text-foreground" : undefined}>3) Deploy</span>
                </div>
              </div>
            </div>

            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  {!selectedTemplate && (
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-6">
                      <div className="text-sm font-semibold">Start here</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Use the left panel to select an industry template. You don’t need to read all templates—filter by
                        event and destination.
                      </div>
                    </div>
                  )}

                  {selectedTemplate && (
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Selected template</div>
                          <div className="mt-1 text-sm">{selectedTemplate.title}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{selectedTemplate.industry}</Badge>
                            <Badge variant="outline">{selectedTemplate.triggerEvent}</Badge>
                            <Badge variant="outline">{selectedTemplate.destination}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {selectedTemplate.prompt}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setDraft(selectedTemplate.prompt)}
                            data-testid="button-use-template"
                          >
                            Use template
                          </Button>
                          <Button
                            onClick={() => {
                              setChatOpen(true);
                              setDraft(selectedTemplate.prompt);
                              // send immediately so user doesn't have to read/understand long lists
                              setTimeout(() => send(), 0);
                            }}
                            data-testid="button-ask-from-template"
                          >
                            Generate workflow
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedTemplate && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setTemplatesOpen(true)}
                        data-testid="button-next-open-marketplace"
                      >
                        Next: Choose template
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setChatOpen(true)}
                        data-testid="button-open-chat"
                      >
                        Or: Open chat
                      </Button>
                    </div>
                  )}

                  {selectedTemplate && !recipe && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          setChatOpen(true);
                          setDraft(selectedTemplate.prompt);
                          setTimeout(() => send(), 0);
                        }}
                        data-testid="button-next-generate"
                      >
                        Next: Generate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTemplatesOpen(true)}
                        data-testid="button-change-template"
                      >
                        Change template
                      </Button>
                    </div>
                  )}

                  {recipe && !deployResult && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Next: add credentials → Deploy</Badge>
                      <Button
                        variant="outline"
                        onClick={() => setChatOpen(true)}
                        data-testid="button-show-flow-in-chat"
                      >
                        Show flow in chat
                      </Button>
                    </div>
                  )}

                  <Collapsible open={chatOpen} onOpenChange={setChatOpen}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Customize with AI</div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-toggle-chat">
                          {chatOpen ? "Hide" : "Show"}
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-3">
                      <div className="space-y-3">
                        {events.map((e, idx) => {
                          const isUser = e.role === "user";
                          return (
                            <div key={idx} className={isUser ? "flex justify-end" : "flex justify-start"}>
                              <div className={isUser ? "max-w-[80%]" : "max-w-[80%]"}>
                                <div
                                  className={[
                                    "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm border",
                                    isUser
                                      ? "bg-primary text-primary-foreground border-primary/20"
                                      : "bg-card text-card-foreground border-border",
                                  ].join(" ")}
                                >
                                  {e.content}
                                  {e.kind === "questions" && Array.isArray(questions) && questions.length > 0 && (
                                    <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                                      {(questions as ConciergeQuestion[]).map((q) => (
                                        <div key={q.id} className="space-y-1">
                                          <div className="text-xs font-medium text-muted-foreground">{q.prompt}</div>
                                          {q.inputType === "select" && q.options ? (
                                            <div className="flex flex-wrap gap-2">
                                              {q.options.map((opt) => (
                                                <Button
                                                  key={opt.id}
                                                  size="sm"
                                                  variant={questionAnswers[q.id] === opt.id ? "default" : "outline"}
                                                  onClick={() => applyAnswerToInputs(q.id, opt.id)}
                                                  className="h-8"
                                                  data-testid={`question-${q.id}-option-${opt.id}`}
                                                >
                                                  {opt.label}
                                                </Button>
                                              ))}
                                            </div>
                                          ) : (
                                            <Input
                                              value={questionAnswers[q.id] || ""}
                                              onChange={(ev) => applyAnswerToInputs(q.id, ev.target.value)}
                                              placeholder={q.id}
                                              data-testid={`question-${q.id}-input`}
                                            />
                                          )}
                                        </div>
                                      ))}
                                      <div className="flex gap-2 pt-1">
                                        <Button
                                          onClick={continueFromQuestions}
                                          disabled={chatMutation.isPending}
                                          data-testid="button-continue-after-questions"
                                        >
                                          Continue
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() => setQuestions([])}
                                          data-testid="button-dismiss-questions"
                                        >
                                          Dismiss
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {e.kind === "recipe" && recipe && (
                                    <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="font-medium">{recipe.name || "Proposed workflow"}</div>
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            Trigger{" "}
                                            <span className="font-medium">
                                              {recipe.triggerEvent || "platform.event"}
                                            </span>
                                            {"  "}→{"  "}
                                            Destination{" "}
                                            <span className="font-medium">
                                              {recipe.destination?.slug || "destination"}
                                            </span>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="gap-2">
                                          {destinationIcon}
                                          Preview
                                        </Badge>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </ScrollArea>
            </CardContent>

            <div className="border-t border-border/60 p-4 bg-card">
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={selectedTemplate ? "Optional: tweak the template… (or type /deploy)" : 'Try: "When call is completed, create a Zendesk ticket"'}
                  data-testid="input-concierge-draft"
                />
                <Button onClick={send} disabled={chatMutation.isPending} data-testid="button-concierge-send">
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent
          className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] max-w-6xl h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col"
          data-testid="dialog-templates-marketplace"
        >
          <div className="px-6 py-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
            <DialogHeader>
              <DialogTitle>Templates marketplace</DialogTitle>
              <DialogDescription>
                Filter by industry, use case, event, and destination — then pick a template.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-6">
            {templatesMarketplace}

            {selectedTemplate && (
              <div className="mt-6 rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{selectedTemplate.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedTemplate.industry}</Badge>
                      <Badge variant="secondary">{selectedTemplate.useCase}</Badge>
                      <Badge variant="outline">{selectedTemplate.triggerEvent}</Badge>
                      <Badge variant="outline">{selectedTemplate.destination}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{selectedTemplate.prompt}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 px-6 py-4 bg-background/95 backdrop-blur flex items-center justify-between gap-3 sticky bottom-0">
            <div className="text-sm text-muted-foreground">
              {selectedTemplate ? (
                <span>
                  Selected: <span className="text-foreground font-medium">{selectedTemplate.title}</span>
                </span>
              ) : (
                <span>Select a template to continue.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTemplatesOpen(false)}
                data-testid="button-close-templates-modal"
              >
                Close
              </Button>
              <Button
                variant="secondary"
                disabled={!selectedTemplate}
                onClick={() => {
                  if (!selectedTemplate) return;
                  setDraft(selectedTemplate.prompt);
                  setTemplatesOpen(false);
                }}
                data-testid="button-use-template-modal"
              >
                Use template
              </Button>
              <Button
                disabled={!selectedTemplate}
                onClick={() => {
                  if (!selectedTemplate) return;
                  setChatOpen(true);
                  setDraft(selectedTemplate.prompt);
                  setTemplatesOpen(false);
                }}
                data-testid="button-next-put-in-chat-modal"
              >
                Next: Put in chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}

