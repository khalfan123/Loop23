import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  BookOpen,
  Braces,
  Calendar,
  Code2,
  ExternalLink,
  FileStack,
  Filter,
  GitBranch,
  Home,
  Hourglass,
  Infinity,
  LayoutGrid,
  Mail,
  Package,
  Pin,
  RefreshCw,
  Search,
  Sparkles,
  Split,
  ThumbsUp,
  Webhook,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { IntegrationApp } from "@shared/schema";
import {
  CALL_CENTER_STARTER_PACK,
  OUTCOME_META,
  type StarterTemplate,
} from "@/data/automation-starter-pack";

export type BuilderTemplateChoice = {
  id: string;
  title: string;
  summary: string;
  triggerEvent: string;
  destinationSlug: string;
  destinationLabel: string;
  prompt: string;
  installCount: number;
};

export type BuilderToolChoice = {
  id: string;
  name: string;
  description: string;
  kind: "utility" | "flow" | "function" | "product" | "ai";
  /** Maps to canvas flow node type when applicable */
  nodeType?: string;
  /** Maps to destination app slug when applicable */
  appId?: string;
};

type NavId =
  | "home"
  | "templates"
  | "apps"
  | "ai"
  | "flow"
  | "utilities"
  | "functions"
  | "products";

const NAV: Array<{ id: NavId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "apps", label: "Apps", icon: Package },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "flow", label: "Flow controls", icon: GitBranch },
  { id: "utilities", label: "Utilities", icon: Wrench },
  { id: "functions", label: "Functions", icon: Braces },
  { id: "products", label: "Products", icon: Zap },
  { id: "templates", label: "Templates", icon: LayoutGrid },
];

const DEST_SLUG_MAP: Record<string, string> = {
  twilio: "twilio",
  whatsapp: "whatsapp",
  sendgrid: "sendgrid",
  slack: "slack",
  hubspot: "hubspot",
  salesforce: "salesforce",
  zendesk: "zendesk",
  google_calendar: "google-calendar",
  google_sheets: "google-sheets",
  asana: "asana",
  bamboohr: "bamboohr",
  internal_queue: "webhooks",
  outbound_campaign: "webhooks",
  review_queue: "webhooks",
};

const DEST_LABEL: Record<string, string> = {
  twilio: "Twilio",
  whatsapp: "WhatsApp",
  sendgrid: "SendGrid",
  slack: "Slack",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  zendesk: "Zendesk",
  google_calendar: "Google Calendar",
  google_sheets: "Google Sheets",
  asana: "Asana",
  bamboohr: "BambooHR",
  internal_queue: "Webhooks",
  outbound_campaign: "Webhooks",
  review_queue: "Webhooks",
};

const FLOW_CONTROLS: BuilderToolChoice[] = [
  {
    id: "delay",
    name: "Delay",
    description: "Hold the next step for a set time before continuing.",
    kind: "flow",
    nodeType: "delay",
  },
  {
    id: "filter",
    name: "Filter",
    description: "Continue only when a condition is met.",
    kind: "flow",
    nodeType: "condition",
  },
  {
    id: "human-in-loop",
    name: "Human in the Loop",
    description: "Pause for a manual review or approval during a run.",
    kind: "flow",
    nodeType: "transfer",
  },
  {
    id: "looping",
    name: "Looping",
    description: "Repeat following steps for each item in a list.",
    kind: "flow",
    nodeType: "condition",
  },
  {
    id: "paths",
    name: "Paths",
    description: "Branch into different steps for different rules.",
    kind: "flow",
    nodeType: "condition",
  },
  {
    id: "schedule",
    name: "Schedule",
    description: "Run on a cadence instead of an event trigger.",
    kind: "flow",
    appId: "schedule",
  },
  {
    id: "sub-automation",
    name: "Sub-automation",
    description: "Call a reusable automation from this one.",
    kind: "flow",
    nodeType: "webhook",
  },
];

const UTILITIES: BuilderToolChoice[] = [
  {
    id: "ai-utility",
    name: "AI by Loop9",
    description: "Extract data, summarize calls, or generate content mid-flow.",
    kind: "utility",
    nodeType: "message",
  },
  {
    id: "api",
    name: "API",
    description: "Make authenticated REST API calls from your automation.",
    kind: "utility",
    nodeType: "webhook",
    appId: "webhooks",
  },
  {
    id: "code",
    name: "Code",
    description: "Write custom JavaScript to transform or enrich data.",
    kind: "utility",
    nodeType: "webhook",
    appId: "code",
  },
  {
    id: "digest",
    name: "Digest",
    description: "Condense events into a summary before sending elsewhere.",
    kind: "utility",
    nodeType: "message",
  },
  {
    id: "files",
    name: "Files",
    description: "Import and process files, including text and CSV.",
    kind: "utility",
    nodeType: "form",
  },
  {
    id: "formatter",
    name: "Formatter",
    description: "Transform dates, numbers, and text into the format you need.",
    kind: "utility",
    nodeType: "message",
  },
  {
    id: "email",
    name: "Email",
    description: "Send or receive email as part of your automation.",
    kind: "utility",
    appId: "email",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Catch or send HTTP webhooks to any endpoint.",
    kind: "utility",
    appId: "webhooks",
    nodeType: "webhook",
  },
];

const FUNCTIONS: BuilderToolChoice[] = [
  {
    id: "fn-map",
    name: "Map",
    description: "Map fields from one step’s output to the next.",
    kind: "function",
    nodeType: "message",
  },
  {
    id: "fn-lookup",
    name: "Lookup",
    description: "Look up a record by key before continuing.",
    kind: "function",
    nodeType: "webhook",
  },
  {
    id: "fn-parse",
    name: "Parse",
    description: "Parse JSON, CSV, or free text into structured fields.",
    kind: "function",
    nodeType: "message",
  },
  {
    id: "fn-aggregate",
    name: "Aggregate",
    description: "Count, sum, or group values across events.",
    kind: "function",
    nodeType: "message",
  },
  {
    id: "fn-validate",
    name: "Validate",
    description: "Check required fields and stop or branch on failure.",
    kind: "function",
    nodeType: "condition",
  },
  {
    id: "fn-retry",
    name: "Retry",
    description: "Retry a failed step with backoff.",
    kind: "function",
    nodeType: "delay",
  },
];

const AI_TOOLS: BuilderToolChoice[] = [
  {
    id: "ai-summarize",
    name: "Call summary",
    description: "Generate a concise post-call summary for CRM or Slack.",
    kind: "ai",
    nodeType: "message",
  },
  {
    id: "ai-extract",
    name: "Extract fields",
    description: "Pull structured fields (name, intent, outcome) from transcripts.",
    kind: "ai",
    nodeType: "message",
  },
  {
    id: "ai-classify",
    name: "Classify intent",
    description: "Label the conversation intent for routing and reporting.",
    kind: "ai",
    nodeType: "condition",
  },
];

const PRODUCTS: BuilderToolChoice[] = [
  {
    id: "agents",
    name: "AI Agents",
    description: "Hand off or notify a Loop9 voice agent.",
    kind: "product",
    appId: "webhooks",
  },
  {
    id: "campaigns",
    name: "Campaigns",
    description: "Trigger or update an outbound campaign.",
    kind: "product",
    appId: "webhooks",
  },
  {
    id: "appointments",
    name: "Appointments",
    description: "Book or update appointments from call outcomes.",
    kind: "product",
    nodeType: "appointment",
  },
];

const FLOW_ICONS: Record<string, LucideIcon> = {
  delay: Hourglass,
  filter: Filter,
  "human-in-loop": ThumbsUp,
  looping: Infinity,
  paths: Split,
  schedule: Calendar,
  "sub-automation": Zap,
};

const UTILITY_ICONS: Record<string, LucideIcon> = {
  "ai-utility": Sparkles,
  api: Braces,
  code: Code2,
  digest: FileStack,
  files: FileStack,
  formatter: Wrench,
  email: Mail,
  webhooks: Webhook,
};

const FUNCTION_ICONS: Record<string, LucideIcon> = {
  "fn-map": GitBranch,
  "fn-lookup": Search,
  "fn-parse": Braces,
  "fn-aggregate": LayoutGrid,
  "fn-validate": Filter,
  "fn-retry": RefreshCw,
};

function generateConciergeStyleTemplates(): BuilderTemplateChoice[] {
  const industries = ["Healthcare", "Financial Services", "Insurance", "Home Services", "Retail"];
  const useCases = ["Lead Qualification", "Customer Support", "Receptionists"];
  const triggers = [
    { event: "call.completed", label: "Call completed" },
    { event: "lead.captured", label: "Lead captured" },
    { event: "appointment.booked", label: "Appointment booked" },
  ] as const;
  const destinations = [
    { slug: "zendesk", label: "Zendesk" },
    { slug: "slack", label: "Slack" },
    { slug: "hubspot", label: "HubSpot" },
  ] as const;

  const rows: BuilderTemplateChoice[] = [];
  for (const industry of industries) {
    for (const useCase of useCases) {
      for (const trigger of triggers) {
        for (const dest of destinations) {
          const id = `${industry}-${useCase}-${trigger.event}-${dest.slug}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
          rows.push({
            id,
            title: `${useCase}: ${trigger.label} → ${dest.label}`,
            summary: `When ${trigger.event} happens, sync to ${dest.label}.`,
            triggerEvent: trigger.event,
            destinationSlug: dest.slug,
            destinationLabel: dest.label,
            prompt: `Industry: ${industry}. Use case: ${useCase}. When ${trigger.event} happens, send data to ${dest.label}.`,
            installCount: 80 + ((id.length * 13) % 900),
          });
        }
      }
    }
  }
  return rows;
}

function starterToChoice(t: StarterTemplate): BuilderTemplateChoice {
  return {
    id: t.id,
    title: t.title,
    summary: t.summary,
    triggerEvent: t.triggerEvent,
    destinationSlug: DEST_SLUG_MAP[t.destination] || t.destination.replace(/_/g, "-"),
    destinationLabel: DEST_LABEL[t.destination] || t.destination,
    prompt: t.prompt,
    installCount: t.installCount,
  };
}

const CONCIERGE_TEMPLATES = generateConciergeStyleTemplates();
const STARTER_CHOICES = CALL_CENTER_STARTER_PACK.map(starterToChoice);

export function allBuilderTemplates(): BuilderTemplateChoice[] {
  return [...STARTER_CHOICES, ...CONCIERGE_TEMPLATES];
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: BuilderTemplateChoice) => void;
  onSelectApp?: (app: { id: string; name: string; logoUrl?: string | null }) => void;
  onSelectTool?: (tool: BuilderToolChoice) => void;
};

export function BuilderTemplatePicker({
  open,
  onOpenChange,
  onSelectTemplate,
  onSelectApp,
  onSelectTool,
}: Props) {
  const [nav, setNav] = useState<NavId>("home");
  const [query, setQuery] = useState("");

  const { data: marketplaceApps = [], isLoading: appsLoading } = useQuery<IntegrationApp[]>({
    queryKey: ["/api/integrations/apps"],
    enabled: open,
  });

  const topTemplates = useMemo(() => {
    return [...STARTER_CHOICES]
      .sort((a, b) => b.installCount - a.installCount)
      .slice(0, 10);
  }, []);

  const popularApps = useMemo(() => {
    const popular = marketplaceApps.filter((a) => a.isPopular && a.isActive !== false);
    const pool = popular.length >= 6 ? popular : marketplaceApps;
    return [...pool].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
  }, [marketplaceApps]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = marketplaceApps.filter((a) => a.isActive !== false);
    const sorted = [...pool].sort((a, b) => {
      if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    );
  }, [marketplaceApps, query]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      nav === "ai"
        ? allBuilderTemplates().filter((t) => /ai|summary|coach|intent/i.test(t.title + t.summary))
        : allBuilderTemplates();
    if (!q) {
      return [...pool].sort((a, b) => b.installCount - a.installCount).slice(0, 40);
    }
    return pool
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.triggerEvent.includes(q) ||
          t.destinationLabel.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [nav, query]);

  const filterTools = (tools: BuilderToolChoice[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  };

  const searching = query.trim().length > 0;
  const showHome = nav === "home" && !searching;

  const handleTool = (tool: BuilderToolChoice) => {
    if (onSelectTool) {
      onSelectTool(tool);
      return;
    }
    if (tool.appId && onSelectApp) {
      onSelectApp({ id: tool.appId, name: tool.name });
      return;
    }
    onSelectTemplate({
      id: `tool-${tool.id}`,
      title: tool.name,
      summary: tool.description,
      triggerEvent: "call.completed",
      destinationSlug: tool.appId || "webhooks",
      destinationLabel: tool.name,
      prompt: `When call.completed, use ${tool.name}. ${tool.description}`,
      installCount: 0,
    });
  };

  const listTitle =
    searching
      ? "Search results"
      : nav === "templates"
        ? "All templates"
        : nav === "apps"
          ? "Apps"
          : NAV.find((n) => n.id === nav)?.label || "Browse";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setQuery("");
          setNav("home");
        }
      }}
    >
      <DialogContent
        className="sm:max-w-3xl lg:max-w-4xl p-0 gap-0 overflow-hidden border-border/60 bg-white dark:bg-zinc-900"
        data-testid="builder-template-picker"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Choose from template</DialogTitle>
          <DialogDescription>
            Pick a template, marketplace app, utility, or flow control for your automation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[500px] max-h-[min(78vh,640px)] bg-[#f4f5f7] dark:bg-zinc-950">
          <nav
            className="w-[156px] shrink-0 border-r border-border/50 bg-[#eef0f3] dark:bg-zinc-950/80 p-2 flex flex-col gap-0.5"
            aria-label="Picker categories"
          >
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  data-testid={`builder-picker-nav-${item.id}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-sm border border-border/40"
                      : "text-muted-foreground hover:bg-white/70 dark:hover:bg-white/[0.05] hover:text-foreground border border-transparent",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900">
            <div className="px-4 pt-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      nav === "apps"
                        ? `Search ${marketplaceApps.length || ""} apps…`.replace("  ", " ")
                        : "Search apps, tools, and templates…"
                    }
                    className="pl-9 h-10 rounded-xl bg-[#f4f5f7] dark:bg-zinc-950 border-border/60"
                    data-testid="input-builder-template-search"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNav(nav === "apps" ? "apps" : "templates");
                    setQuery("");
                  }}
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                  data-testid="button-browse-all-templates"
                >
                  Browse all
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {showHome ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Column title="Your top templates">
                      {topTemplates.map((tpl) => (
                        <ToolRow
                          key={tpl.id}
                          name={tpl.title}
                          description={tpl.summary}
                          testId={`builder-template-${tpl.id}`}
                          onClick={() => onSelectTemplate(tpl)}
                          logo={
                            <AppMark
                              name={tpl.destinationLabel}
                              className="bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            />
                          }
                        />
                      ))}
                    </Column>

                    <div className="space-y-6">
                      <Column title="Popular apps">
                        {popularApps.map((app) => (
                          <ToolRow
                            key={app.id}
                            name={app.name}
                            description={app.description || app.category || undefined}
                            testId={`builder-app-${app.slug}`}
                            onClick={() =>
                              onSelectApp?.({
                                id: app.slug,
                                name: app.name,
                                logoUrl: app.logoUrl,
                              })
                            }
                            logo={<AppLogo app={app} />}
                          />
                        ))}
                        {popularApps.length === 0 && !appsLoading && (
                          <p className="text-sm text-muted-foreground px-2 py-4">
                            No marketplace apps yet.
                          </p>
                        )}
                      </Column>
                      <Column title="Utilities">
                        {UTILITIES.slice(0, 4).map((tool) => (
                          <ToolRow
                            key={tool.id}
                            name={tool.name}
                            description={tool.description}
                            testId={`builder-utility-home-${tool.id}`}
                            onClick={() => handleTool(tool)}
                            logo={<ToolMark icon={UTILITY_ICONS[tool.id] || Wrench} />}
                          />
                        ))}
                      </Column>
                    </div>
                  </div>
                ) : searching && nav !== "apps" && nav !== "flow" && nav !== "utilities" && nav !== "functions" && nav !== "ai" && nav !== "products" ? (
                  <Column title={`${listTitle} (${filteredTemplates.length})`}>
                    {filteredTemplates.length === 0 ? (
                      <EmptyState />
                    ) : (
                      filteredTemplates.map((tpl) => {
                        const outcome = CALL_CENTER_STARTER_PACK.find((s) => s.id === tpl.id)?.outcome;
                        return (
                          <ToolRow
                            key={tpl.id}
                            name={tpl.title}
                            description={
                              outcome
                                ? `${OUTCOME_META[outcome].label} · ${tpl.summary}`
                                : tpl.summary
                            }
                            testId={`builder-template-${tpl.id}`}
                            onClick={() => onSelectTemplate(tpl)}
                            logo={
                              <AppMark
                                name={tpl.destinationLabel}
                                className="bg-sky-500/10 text-sky-700 dark:text-sky-300"
                              />
                            }
                          />
                        );
                      })
                    )}
                  </Column>
                ) : nav === "apps" ? (
                  <Column
                    title={
                      searching
                        ? `Apps (${filteredApps.length})`
                        : `All apps (${filteredApps.length})`
                    }
                  >
                    {appsLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        Loading marketplace apps…
                      </p>
                    ) : filteredApps.length === 0 ? (
                      <EmptyState />
                    ) : (
                      filteredApps.map((app) => (
                        <ToolRow
                          key={app.id}
                          name={app.name}
                          description={app.description || app.category || undefined}
                          testId={`builder-app-list-${app.slug}`}
                          onClick={() =>
                            onSelectApp?.({
                              id: app.slug,
                              name: app.name,
                              logoUrl: app.logoUrl,
                            })
                          }
                          logo={<AppLogo app={app} />}
                          trailing={
                            app.isPopular ? (
                              <Pin className="h-3.5 w-3.5 text-muted-foreground/70" />
                            ) : null
                          }
                        />
                      ))
                    )}
                  </Column>
                ) : nav === "flow" ? (
                  <ToolList
                    title={searching ? `Flow controls (${filterTools(FLOW_CONTROLS).length})` : "Flow controls"}
                    tools={filterTools(FLOW_CONTROLS)}
                    icons={FLOW_ICONS}
                    onSelect={handleTool}
                    testPrefix="builder-flow"
                  />
                ) : nav === "utilities" ? (
                  <ToolList
                    title={searching ? `Utilities (${filterTools(UTILITIES).length})` : "Utilities"}
                    tools={filterTools(UTILITIES)}
                    icons={UTILITY_ICONS}
                    onSelect={handleTool}
                    testPrefix="builder-utility"
                  />
                ) : nav === "functions" ? (
                  <ToolList
                    title={searching ? `Functions (${filterTools(FUNCTIONS).length})` : "Functions"}
                    tools={filterTools(FUNCTIONS)}
                    icons={FUNCTION_ICONS}
                    onSelect={handleTool}
                    testPrefix="builder-function"
                  />
                ) : nav === "ai" ? (
                  <div className="space-y-6">
                    <ToolList
                      title="AI tools"
                      tools={filterTools(AI_TOOLS)}
                      icons={{
                        "ai-summarize": Sparkles,
                        "ai-extract": Bot,
                        "ai-classify": Filter,
                      }}
                      onSelect={handleTool}
                      testPrefix="builder-ai"
                    />
                    {filterTools(
                      allBuilderTemplates()
                        .filter((t) => /ai|summary|coach|intent/i.test(t.title + t.summary))
                        .slice(0, 12)
                        .map((t) => ({
                          id: t.id,
                          name: t.title,
                          description: t.summary,
                          kind: "ai" as const,
                        })),
                    ).length > 0 && (
                      <Column title="AI templates">
                        {allBuilderTemplates()
                          .filter((t) => /ai|summary|coach|intent/i.test(t.title + t.summary))
                          .filter((t) => {
                            const q = query.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              t.title.toLowerCase().includes(q) ||
                              t.summary.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 12)
                          .map((tpl) => (
                            <ToolRow
                              key={tpl.id}
                              name={tpl.title}
                              description={tpl.summary}
                              testId={`builder-ai-template-${tpl.id}`}
                              onClick={() => onSelectTemplate(tpl)}
                              logo={
                                <AppMark
                                  name={tpl.destinationLabel}
                                  className="bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                />
                              }
                            />
                          ))}
                      </Column>
                    )}
                  </div>
                ) : nav === "products" ? (
                  <ToolList
                    title="Loop9 products"
                    tools={filterTools(PRODUCTS)}
                    icons={{
                      agents: Bot,
                      campaigns: Zap,
                      appointments: Calendar,
                    }}
                    onSelect={handleTool}
                    testPrefix="builder-product"
                  />
                ) : (
                  <Column title={listTitle}>
                    {filteredTemplates.length === 0 ? (
                      <EmptyState />
                    ) : (
                      filteredTemplates.map((tpl) => (
                        <ToolRow
                          key={tpl.id}
                          name={tpl.title}
                          description={tpl.summary}
                          testId={`builder-template-${tpl.id}`}
                          onClick={() => onSelectTemplate(tpl)}
                          logo={
                            <AppMark
                              name={tpl.destinationLabel}
                              className="bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            />
                          }
                        />
                      ))
                    )}
                  </Column>
                )}

                {(nav === "utilities" || nav === "flow" || nav === "functions") && !searching && (
                  <div className="mt-4 px-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Help docs</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolList({
  title,
  tools,
  icons,
  onSelect,
  testPrefix,
}: {
  title: string;
  tools: BuilderToolChoice[];
  icons: Record<string, LucideIcon>;
  onSelect: (tool: BuilderToolChoice) => void;
  testPrefix: string;
}) {
  if (tools.length === 0) return <EmptyState />;
  return (
    <Column title={title}>
      {tools.map((tool) => (
        <ToolRow
          key={tool.id}
          name={tool.name}
          description={tool.description}
          testId={`${testPrefix}-${tool.id}`}
          onClick={() => onSelect(tool)}
          logo={<ToolMark icon={icons[tool.id] || Wrench} />}
        />
      ))}
    </Column>
  );
}

function EmptyState() {
  return <p className="text-sm text-muted-foreground text-center py-10">No matches.</p>;
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h4 className="text-[12px] font-medium text-muted-foreground mb-2 px-1">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function ToolRow({
  name,
  description,
  logo,
  onClick,
  testId,
  trailing,
}: {
  name: string;
  description?: string;
  logo: ReactNode;
  onClick: () => void;
  testId?: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-[#f4f5f7] dark:hover:bg-white/[0.05]"
    >
      {logo}
      <span className="min-w-0 flex-1">
        <span className="text-[14px] font-semibold text-foreground truncate block">{name}</span>
        {description && (
          <span className="text-[12px] text-muted-foreground line-clamp-1 block mt-0.5">
            {description}
          </span>
        )}
      </span>
      {trailing}
    </button>
  );
}

function ToolMark({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="h-9 w-9 rounded-lg bg-[#f4f5f7] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-border/40">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function AppMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold uppercase border border-border/30",
        className || "bg-[#f4f5f7] dark:bg-zinc-800 text-foreground",
      )}
    >
      {name.slice(0, 2)}
    </span>
  );
}

function AppLogo({ app }: { app: IntegrationApp }) {
  if (app.logoUrl) {
    return (
      <span className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-800 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
        <img src={app.logoUrl} alt="" className="h-6 w-6 object-contain" />
      </span>
    );
  }
  return <AppMark name={app.name} />;
}
