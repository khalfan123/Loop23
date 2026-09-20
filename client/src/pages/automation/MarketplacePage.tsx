import { Component, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plug,
  X,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  LayoutGrid,
  Zap,
  Users,
  Mail,
  MessageSquare,
  Headphones,
  Calendar,
  ShoppingCart,
  BarChart3,
  Workflow,
  Database,
  Building2,
  Filter as FilterIcon,
  Settings2,
  Trash2,
  Plus,
} from "lucide-react";
import type { IntegrationApp, UserIntegration } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  CALL_CENTER_STARTER_PACK,
  type StarterTemplate,
} from "@/data/automation-starter-pack";
import { getDestinationPreset } from "@/data/destination-presets";
import type {
  GenericAuthType,
  GenericHttpAction,
  RecipeFilter,
} from "@/data/destination-types";

type ConciergeTemplate = {
  id: string;
  industry: string;
  useCase: string;
  title: string;
  summary: string;
  prompt: string;
  triggerEvent: "call.completed" | "lead.captured" | "appointment.booked" | "campaign.completed";
  destination: "zendesk" | "slack" | "hubspot";
  installCount: number;
  verified: boolean;
};

type BrowseMode = "templates" | "apps";

const CATEGORY_CONFIG: Array<{
  value: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "all", label: "All", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { value: "crm", label: "CRM", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "marketing", label: "Marketing", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "communication", label: "Communication", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { value: "support", label: "Support", icon: <Headphones className="w-3.5 h-3.5" /> },
  { value: "calendar", label: "Calendar", icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: "ecommerce", label: "E-Commerce", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { value: "analytics", label: "Analytics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { value: "automation", label: "Automation", icon: <Workflow className="w-3.5 h-3.5" /> },
  { value: "data_storage", label: "Data & Storage", icon: <Database className="w-3.5 h-3.5" /> },
  { value: "hr_recruiting", label: "HR & Recruiting", icon: <Building2 className="w-3.5 h-3.5" /> },
];

const TRIGGER_OPTIONS = [
  "all",
  "call.completed",
  "lead.captured",
  "appointment.booked",
  "campaign.completed",
] as const;
const DESTINATION_OPTIONS = [
  "all",
  "zendesk",
  "slack",
  "hubspot",
] as const;

const SUPPORTED_DESTINATION_SLUGS = ["zendesk", "slack", "hubspot"] as const;
type SupportedDestinationSlug = (typeof SUPPORTED_DESTINATION_SLUGS)[number];

// Canonical platform webhook events kept in sync with
// server/constants/platform-webhook-events.ts. Used by the wizard's Trigger
// step to let the user override the template's default trigger.
const PLATFORM_WEBHOOK_EVENTS = [
  "campaign.started",
  "campaign.paused",
  "campaign.resumed",
  "campaign.completed",
  "campaign.failed",
  "campaign.cancelled",
  "call.started",
  "call.ringing",
  "call.answered",
  "call.completed",
  "call.failed",
  "call.transferred",
  "call.no_answer",
  "call.busy",
  "call.voicemail",
  "inbound_call.received",
  "inbound_call.answered",
  "inbound_call.completed",
  "inbound_call.missed",
  "ivr.started",
  "ivr.language_selected",
  "ivr.option_selected",
  "flow.started",
  "flow.completed",
  "flow.failed",
  "appointment.booked",
  "appointment.confirmed",
  "appointment.cancelled",
  "appointment.rescheduled",
  "appointment.completed",
  "appointment.no_show",
  "form.submitted",
  "form.lead_created",
  "lead.captured",
] as const;

type WizardStep = "trigger" | "destination" | "filter" | "actions" | "deploy";

interface WizardState {
  triggerEvent: string;
  destinationSlug: string | null;
  destinationApp: IntegrationApp | null;
  mode: "native" | "generic" | null;
  filter: RecipeFilter;
  /** Generic mode: full HTTP action config. Native mode: ignored. */
  action: GenericHttpAction;
  /** Free-form credential inputs (key → value). */
  credentials: Record<string, string>;
}

const fallbackCreatedAt = new Date(0);

const fallbackDestinationApp = (
  slug: string,
  name: string,
  category: string,
  description: string,
  isPopular = false,
): IntegrationApp => ({
  id: `fallback-${slug}`,
  name,
  slug,
  description,
  category,
  logoUrl: null,
  n8nNodeType: "n8n-nodes-base.httpRequest",
  isPopular,
  isActive: true,
  createdAt: fallbackCreatedAt,
});

const FALLBACK_DESTINATION_APPS: IntegrationApp[] = [
  fallbackDestinationApp("hubspot", "HubSpot", "crm", "Sync contacts and call notes to HubSpot.", true),
  fallbackDestinationApp("salesforce", "Salesforce", "crm", "Create leads and activities from AI call events.", true),
  fallbackDestinationApp("pipedrive", "Pipedrive", "crm", "Create people and deals from qualified calls."),
  fallbackDestinationApp("zoho", "Zoho CRM", "crm", "Push leads and call outcomes to Zoho CRM."),
  fallbackDestinationApp("dynamics365", "Microsoft Dynamics 365", "crm", "Sync call activities to Dynamics 365."),
  fallbackDestinationApp("close-crm", "Close CRM", "crm", "Auto-log calls and update lead status."),
  fallbackDestinationApp("odoo", "Odoo CRM", "crm", "Create leads and log call activities in Odoo CRM."),
  fallbackDestinationApp("slack", "Slack", "communication", "Post real-time call summaries to channels.", true),
  fallbackDestinationApp("microsoft-teams", "Microsoft Teams", "communication", "Notify teams with call summaries."),
  fallbackDestinationApp("telegram", "Telegram", "communication", "Send bot notifications for call events."),
  fallbackDestinationApp("whatsapp", "WhatsApp Business", "communication", "Send WhatsApp follow-ups."),
  fallbackDestinationApp("discord", "Discord", "communication", "Post campaign and call updates."),
  fallbackDestinationApp("zendesk", "Zendesk", "support", "Create support tickets from unresolved calls.", true),
  fallbackDestinationApp("freshdesk", "Freshdesk", "support", "Generate tickets with call context."),
  fallbackDestinationApp("intercom", "Intercom", "support", "Create conversations and update contacts."),
  fallbackDestinationApp("helpscout", "Help Scout", "support", "Push summaries to support mailboxes."),
  fallbackDestinationApp("front", "Front", "support", "Route call follow-ups to shared inboxes."),
  fallbackDestinationApp("google-calendar", "Google Calendar", "calendar", "Create follow-up meetings.", true),
  fallbackDestinationApp("calendly", "Calendly", "calendar", "Schedule appointments from qualified calls."),
  fallbackDestinationApp("cal-com", "Cal.com", "calendar", "Book meetings through Cal.com."),
  fallbackDestinationApp("microsoft-outlook", "Outlook Calendar", "calendar", "Create Outlook follow-up meetings."),
  fallbackDestinationApp("stripe", "Stripe", "ecommerce", "Send payment or subscription follow-up actions."),
  fallbackDestinationApp("shopify", "Shopify", "ecommerce", "Look up and annotate customer orders."),
  fallbackDestinationApp("woocommerce", "WooCommerce", "ecommerce", "Sync order-related call events."),
  fallbackDestinationApp("google-analytics", "Google Analytics", "analytics", "Track call conversions as events."),
  fallbackDestinationApp("mixpanel", "Mixpanel", "analytics", "Send conversion and funnel events."),
  fallbackDestinationApp("segment", "Segment", "analytics", "Route call event data downstream."),
  fallbackDestinationApp("zapier", "Zapier", "automation", "Trigger Zaps from AI call events.", true),
  fallbackDestinationApp("make", "Make", "automation", "Trigger Make scenarios from webhooks."),
  fallbackDestinationApp("n8n", "n8n", "automation", "Forward events to another n8n workflow."),
  fallbackDestinationApp("google-sheets", "Google Sheets", "data_storage", "Append call rows to Sheets.", true),
  fallbackDestinationApp("airtable", "Airtable", "data_storage", "Sync call records into Airtable."),
  fallbackDestinationApp("notion", "Notion", "data_storage", "Create database pages for call notes."),
  fallbackDestinationApp("supabase", "Supabase", "data_storage", "Store call payloads in Supabase."),
  fallbackDestinationApp("firebase", "Firebase", "data_storage", "Sync events to Firestore."),
  fallbackDestinationApp("aws-s3", "AWS S3", "data_storage", "Archive call recordings and payloads."),
  fallbackDestinationApp("monday-com", "Monday.com", "data_storage", "Create board items from call outcomes."),
  fallbackDestinationApp("mailchimp", "Mailchimp", "marketing", "Add captured leads to audiences."),
  fallbackDestinationApp("activecampaign", "ActiveCampaign", "marketing", "Trigger automations and tag contacts."),
  fallbackDestinationApp("sendgrid", "SendGrid", "marketing", "Send transactional follow-up emails."),
  fallbackDestinationApp("brevo", "Brevo", "marketing", "Sync leads for email and SMS nurture."),
  fallbackDestinationApp("bamboohr", "BambooHR", "hr_recruiting", "Sync AI screening call notes."),
  fallbackDestinationApp("greenhouse", "Greenhouse", "hr_recruiting", "Log recruiter call outcomes."),
  fallbackDestinationApp("lever", "Lever", "hr_recruiting", "Push candidate screening notes."),
];

type CredentialField = {
  id: string;
  label: string;
  secret?: boolean;
};

const CREDENTIAL_FIELDS_BY_DESTINATION: Record<
  SupportedDestinationSlug,
  CredentialField[]
> = {
  zendesk: [
    { id: "zendeskSubdomain", label: "Zendesk subdomain" },
    { id: "zendeskEmail", label: "Zendesk agent email" },
    { id: "zendeskApiToken", label: "Zendesk API token", secret: true },
  ],
  slack: [
    { id: "slackBotToken", label: "Slack bot token", secret: true },
    { id: "slackChannel", label: "Slack channel" },
  ],
  hubspot: [
    { id: "hubspotToken", label: "HubSpot private app token", secret: true },
  ],
};

function isSupportedDestinationSlug(
  slug: string,
): slug is SupportedDestinationSlug {
  return (SUPPORTED_DESTINATION_SLUGS as readonly string[]).includes(slug);
}

function resolveProvisionDestination(
  destination: string,
  requiredApps: string[],
): SupportedDestinationSlug | null {
  if (isSupportedDestinationSlug(destination)) return destination;
  const lowerApps = requiredApps.map((app) => app.toLowerCase());
  return (
    SUPPORTED_DESTINATION_SLUGS.find((slug) =>
      lowerApps.some((app) => app.includes(slug)),
    ) || null
  );
}

function buildRecipeForDestination(
  template: ConciergeTemplate | StarterTemplate,
  destinationSlug: SupportedDestinationSlug,
): any {
  const credentialFields = CREDENTIAL_FIELDS_BY_DESTINATION[destinationSlug];
  return buildWizardRecipe({
    name: template.title,
    triggerEvent: template.triggerEvent,
    destinationSlug,
    mode: "native",
    mapping: {
      summary: template.summary,
      prompt: template.prompt,
      templateId: template.id,
    },
    filter: emptyFilter(),
    action: emptyAction(),
    credentialFields: credentialFields.map((f) => ({
      id: f.id,
      prompt: f.label,
      inputType: "text",
      secret: !!f.secret,
    })),
  });
}

function emptyFilter(): RecipeFilter {
  return { campaignIds: [], condition: null };
}

function emptyAction(): GenericHttpAction {
  return {
    url: "",
    method: "POST",
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: "",
    auth: { type: "none" },
  };
}

function actionFromPreset(slug: string): GenericHttpAction {
  const preset = getDestinationPreset(slug);
  if (!preset) return emptyAction();
  return {
    url: preset.url,
    method: preset.method,
    headers: preset.headers ? [...preset.headers] : [],
    bodyTemplate: preset.bodyTemplate || "",
    auth: { type: preset.authType },
  };
}

function credentialFieldsForDestination(
  slug: string | null,
  mode: "native" | "generic" | null,
): Array<{ id: string; label: string; secret?: boolean; placeholder?: string }> {
  if (!slug) return [];
  if (mode === "native" && isSupportedDestinationSlug(slug)) {
    return CREDENTIAL_FIELDS_BY_DESTINATION[slug];
  }
  const preset = getDestinationPreset(slug);
  if (preset) return preset.credentialFields;
  // Generic destination without a preset: we still need the auth fields based
  // on the chosen auth type. The wizard renders these dynamically via
  // GenericAuthFields (see Step 4).
  return [];
}

function buildWizardRecipe(args: {
  name: string;
  triggerEvent: string;
  destinationSlug: string;
  mode: "native" | "generic";
  mapping?: Record<string, any>;
  filter: RecipeFilter;
  action: GenericHttpAction;
  credentialFields: Array<{
    id: string;
    prompt: string;
    inputType?: string;
    secret?: boolean;
  }>;
}): any {
  return {
    version: 1,
    name: args.name,
    triggerEvent: args.triggerEvent,
    destination: { slug: args.destinationSlug },
    mode: args.mode,
    intent: "platform_event_to_external_action",
    mapping: args.mapping || {},
    filter: args.filter,
    action: args.mode === "generic" ? args.action : undefined,
    credentialsRequired: args.credentialFields,
    // Frontend convenience field. The backend ignores unknown recipe fields.
    requiredCredentials: args.credentialFields.map((f) => f.id),
  };
}

type IndexedTemplate = ConciergeTemplate & {
  searchText: string;
};

function indexTemplate(template: ConciergeTemplate): IndexedTemplate {
  return {
    ...template,
    searchText: [
      template.title,
      template.summary,
      template.industry,
      template.useCase,
      template.triggerEvent,
      template.destination,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function generateTemplates(): ConciergeTemplate[] {
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
  ];
  const actionByDestination: Record<ConciergeTemplate["destination"], string[]> = {
    zendesk: ["create a ticket", "create a ticket with summary + transcript link", "tag the ticket with intent"],
    slack: ["post a summary to #support", "post an alert to #sales", "post call outcomes + next steps"],
    hubspot: ["upsert contact", "create a deal and attach notes", "log a call engagement with summary"],
  };
  const summaryByDestination: Record<ConciergeTemplate["destination"], string> = {
    zendesk: "Auto-create a Zendesk ticket with the call summary so support never loses context.",
    slack: "Drop the call outcome into Slack so the right humans see it within seconds.",
    hubspot: "Sync contacts and log every call as a HubSpot engagement automatically.",
  };

  const rows: ConciergeTemplate[] = [];
  for (const industry of industries) {
    for (const useCase of useCases) {
      for (const trigger of triggers) {
        for (const dest of destinations) {
          const variants = actionByDestination[dest.slug];
          for (let i = 0; i < variants.length; i++) {
            const action = variants[i];
            const id = `${industry}-${useCase}-${trigger.event}-${dest.slug}-${i}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");
            // Synthetic but stable install count.
            const installCount = 50 + (id.length * 17 + i * 31) % 1450;
            rows.push({
              id,
              industry,
              useCase,
              title: `${useCase}: ${trigger.event} → Destination`,
              summary: summaryByDestination[dest.slug],
              prompt: `Industry: ${industry}. Use case: ${useCase}. When ${trigger.event} happens in our platform, ${action} in ${dest.label}.`,
              triggerEvent: trigger.event,
              destination: dest.slug,
              installCount,
              verified: i === 0,
            });
          }
        }
      }
    }
  }
  return rows.slice(0, 500);
}

const ALL_TEMPLATES: IndexedTemplate[] = generateTemplates().map(indexTemplate);

export default function MarketplacePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/app/settings/automation/marketplace/:templateId");
  const [, appRouteParams] = useRoute(
    "/app/settings/automation/marketplace/apps/:slug",
  );
  const [browseMode, setBrowseMode] = useState<BrowseMode>("apps");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [industry, setIndustry] = useState<string>("all");
  const [useCase, setUseCase] = useState<string>("all");
  const [trigger, setTrigger] = useState<(typeof TRIGGER_OPTIONS)[number]>("all");
  const [destination, setDestination] =
    useState<(typeof DESTINATION_OPTIONS)[number]>("all");
  const [appCategory, setAppCategory] = useState<string>("all");
  const [limit, setLimit] = useState(48);
  const [previewTemplate, setPreviewTemplate] = useState<
    ConciergeTemplate | StarterTemplate | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K focuses the marketplace search; Esc clears it while focused.
  // Disabled on the per-app detail page (no search bar there).
  useEffect(() => {
    if (appRouteParams?.slug) return;
    const onKey = (e: KeyboardEvent) => {
      const isFocus = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isFocus) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearch("");
        setLimit(48);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appRouteParams?.slug]);

  // Sync preview drawer with route + ?template= query string
  useEffect(() => {
    const qs = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("template")
      : null;
    const id = params?.templateId || qs;
    if (!id) return;
    const fromStarter = CALL_CENTER_STARTER_PACK.find((t) => t.id === id);
    const fromCatalog = ALL_TEMPLATES.find((t) => t.id === id);
    if (fromStarter || fromCatalog) {
      setPreviewTemplate(fromStarter || fromCatalog || null);
    }
  }, [params?.templateId]);

  const { data: appsRaw = [] } = useQuery<IntegrationApp[]>({
    queryKey: ["/api/integrations/apps"],
  });
  // Always have a populated destination catalog: prefer the live API data,
  // but fall back to a static catalog so the wizard's Destination step is
  // never empty (e.g. before the query resolves, or when /api/integrations/apps
  // returns 404 in local dev).
  // Union the live API apps with the fallback catalog so well-known slugs
  // (hubspot, slack, zendesk, …) are always resolvable on the detail page,
  // even if the live API returns a partial list or omits a familiar app.
  const apps = useMemo(() => {
    if (appsRaw.length === 0) return FALLBACK_DESTINATION_APPS;
    const known = new Set(appsRaw.map((a) => a.slug.toLowerCase()));
    const merged: IntegrationApp[] = [...appsRaw];
    for (const fb of FALLBACK_DESTINATION_APPS) {
      if (!known.has(fb.slug.toLowerCase())) merged.push(fb);
    }
    return merged;
  }, [appsRaw]);
  const { data: connected = [] } = useQuery<
    Array<{ integration: UserIntegration; app: IntegrationApp }>
  >({
    queryKey: ["/api/integrations/connected"],
  });

  // Resolve the inner-page app slug from the wouter route. Fall back to
  // parsing window.location so we still match if a parent route or basepath
  // ever rewrites the path the inner useRoute sees.
  const selectedAppSlug = useMemo(() => {
    if (appRouteParams?.slug) return appRouteParams.slug;
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(
      /\/app\/settings\/automation\/marketplace\/apps\/([^/?#]+)/,
    );
    return m ? decodeURIComponent(m[1]) : null;
  }, [appRouteParams?.slug]);

  // Resolve the selected app from the catalog. If nothing matches (e.g. the
  // slug is unknown), synthesize a minimal IntegrationApp so the detail page
  // can still render the hero + use case sections instead of looking empty.
  const selectedApp = useMemo<IntegrationApp | null>(() => {
    if (!selectedAppSlug) return null;
    const slugLower = selectedAppSlug.toLowerCase();
    const found = apps.find((a) => a.slug.toLowerCase() === slugLower);
    if (found) return found;
    const prettyName = selectedAppSlug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return fallbackDestinationApp(
      selectedAppSlug,
      prettyName,
      "other",
      `Send AI call events to ${prettyName}.`,
    );
  }, [apps, selectedAppSlug]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const t of ALL_TEMPLATES) set.add(t.industry);
    return ["all", ...Array.from(set).sort()];
  }, []);

  const useCases = useMemo(() => {
    const set = new Set<string>();
    for (const t of ALL_TEMPLATES) {
      if (industry !== "all" && t.industry !== industry) continue;
      set.add(t.useCase);
    }
    return ["all", ...Array.from(set).sort()];
  }, [industry]);

  const filteredTemplates = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return ALL_TEMPLATES.filter((tpl) => {
      if (industry !== "all" && tpl.industry !== industry) return false;
      if (useCase !== "all" && tpl.useCase !== useCase) return false;
      if (trigger !== "all" && tpl.triggerEvent !== trigger) return false;
      if (destination !== "all" && tpl.destination !== destination) return false;
      if (!q) return true;
      return tpl.searchText.includes(q);
    });
  }, [deferredSearch, industry, useCase, trigger, destination]);

  const visibleTemplates = useMemo(
    () => filteredTemplates.slice(0, limit),
    [filteredTemplates, limit],
  );

  const featured = useMemo(() => {
    return [...ALL_TEMPLATES]
      .filter((t) => t.verified)
      .sort((a, b) => b.installCount - a.installCount)
      .slice(0, 12);
  }, []);

  const filteredApps = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return apps.filter((app) => {
      if (appCategory !== "all" && app.category !== appCategory) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        (app.description || "").toLowerCase().includes(q)
      );
    });
  }, [apps, appCategory, deferredSearch]);

  const connectedSlugs = useMemo(
    () => new Set(connected.map((c) => c.app.slug)),
    [connected],
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = [];
    if (industry !== "all")
      chips.push({ label: industry, clear: () => setIndustry("all") });
    if (useCase !== "all")
      chips.push({ label: useCase, clear: () => setUseCase("all") });
    if (trigger !== "all")
      chips.push({ label: trigger, clear: () => setTrigger("all") });
    if (destination !== "all")
      chips.push({
        label: destination,
        clear: () => setDestination("all"),
      });
    return chips;
  }, [industry, useCase, trigger, destination]);

  const resetFilters = useCallback(() => {
    setIndustry("all");
    setUseCase("all");
    setTrigger("all");
    setDestination("all");
    setSearch("");
    setLimit(48);
  }, []);

  const requestTemplatePrompt = useCallback(() => {
    const parts: string[] = [];
    if (industry !== "all") parts.push(`Industry: ${industry}`);
    if (useCase !== "all") parts.push(`Use case: ${useCase}`);
    if (trigger !== "all") parts.push(`Trigger: ${trigger}`);
    if (destination !== "all") parts.push(`Destination: ${destination}`);
    return parts.length
      ? `I need a template that does: ${parts.join(", ")}. ${
          search ? `Notes: ${search}.` : ""
        }`
      : "I'd like a custom workflow. Here's what I want to automate: ";
  }, [industry, useCase, trigger, destination, search]);

  const previewAutomationTemplate = useCallback(
    (template: ConciergeTemplate | StarterTemplate) => {
      setPreviewTemplate(template);
    },
    [],
  );

  const openAppDetail = useCallback(
    (app: IntegrationApp) => {
      navigate(`/app/settings/automation/marketplace/apps/${app.slug}`);
    },
    [navigate],
  );

  if (selectedAppSlug) {
    return (
      <div className="px-6 py-6">
        <MarketplaceDetailErrorBoundary
          slug={selectedAppSlug}
          onBack={() => navigate("/app/settings/automation/marketplace")}
        >
          <MarketplaceAppDetail
            app={selectedApp}
            slug={selectedAppSlug}
            isConnected={selectedApp ? connectedSlugs.has(selectedApp.slug) : false}
            onBack={() => navigate("/app/settings/automation/marketplace")}
            onPreviewTemplate={previewAutomationTemplate}
          />
        </MarketplaceDetailErrorBoundary>
        <TemplatePreviewDrawer
          template={previewTemplate}
          apps={apps}
          onClose={() => setPreviewTemplate(null)}
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="group relative flex-1 min-w-[280px] max-w-2xl">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-focus-within:bg-primary group-focus-within:text-primary-foreground">
              <Search className="h-3.5 w-3.5" />
            </div>
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(48);
              }}
              placeholder={t(
                "marketplace.searchPlaceholder",
                "Search templates and apps…",
              )}
              className="h-11 pl-12 pr-24 rounded-xl border-border/60 bg-white shadow-sm transition-all placeholder:text-muted-foreground/70 hover:border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:shadow-md dark:bg-background"
              data-testid="input-marketplace-search"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setLimit(48);
                }}
                aria-label={t("marketplace.clearSearch", "Clear search")}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                data-testid="button-marketplace-search-clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex"
              >
                <kbd className="font-sans">⌘</kbd>
                <kbd className="font-sans">K</kbd>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5 ml-auto">
            <Button
              size="sm"
              variant={browseMode === "templates" ? "default" : "ghost"}
              className="h-8 px-3"
              onClick={() => setBrowseMode("templates")}
              data-testid="toggle-mode-templates"
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              {t("marketplace.modes.templates", "Templates")}
            </Button>
            <Button
              size="sm"
              variant={browseMode === "apps" ? "default" : "ghost"}
              className="h-8 px-3"
              onClick={() => setBrowseMode("apps")}
              data-testid="toggle-mode-apps"
            >
              <Plug className="h-3.5 w-3.5 mr-1.5" />
              {t("marketplace.modes.apps", "Apps")}
              <span className="ml-2 text-[11px] text-muted-foreground">
                {apps.length}
              </span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {browseMode === "templates" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Select
                value={industry}
                onValueChange={(v) => {
                  setIndustry(v);
                  setUseCase("all");
                  setLimit(48);
                }}
              >
                <SelectTrigger
                  className="h-10 w-[160px] bg-white dark:bg-background"
                  data-testid="filter-industry-select"
                >
                  <SelectValue
                    placeholder={t("marketplace.filters.industry", "Industry")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind === "all"
                        ? t("marketplace.filters.industryAll", "All industries")
                        : ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={useCase}
                onValueChange={(v) => {
                  setUseCase(v);
                  setLimit(48);
                }}
                disabled={industry === "all"}
              >
                <SelectTrigger
                  className="h-10 w-[160px] bg-white dark:bg-background"
                  data-testid="filter-usecase-select"
                >
                  <SelectValue
                    placeholder={t("marketplace.filters.useCase", "Use case")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {useCases.map((uc) => (
                    <SelectItem key={uc} value={uc}>
                      {uc === "all"
                        ? t("marketplace.filters.useCaseAll", "All use cases")
                        : uc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={trigger}
                onValueChange={(v) => {
                  setTrigger(v as (typeof TRIGGER_OPTIONS)[number]);
                  setLimit(48);
                }}
              >
                <SelectTrigger
                  className="h-10 w-[170px] bg-white dark:bg-background"
                  data-testid="filter-trigger-select"
                >
                  <SelectValue
                    placeholder={t(
                      "marketplace.filters.trigger",
                      "Trigger event",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((tr) => (
                    <SelectItem key={tr} value={tr}>
                      {tr === "all"
                        ? t("marketplace.filters.triggerAll", "All triggers")
                        : tr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={destination}
                onValueChange={(v) => {
                  setDestination(v as (typeof DESTINATION_OPTIONS)[number]);
                  setLimit(48);
                }}
              >
                <SelectTrigger
                  className="h-10 w-[160px] bg-white dark:bg-background"
                  data-testid="filter-destination-select"
                >
                  <SelectValue
                    placeholder={t(
                      "marketplace.filters.destination",
                      "Destination",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === "all"
                        ? t(
                            "marketplace.filters.destinationAll",
                            "All destinations",
                          )
                        : d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilterChips.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10"
                  onClick={resetFilters}
                  data-testid="button-reset-filters"
                >
                  {t("marketplace.filters.reset", "Reset")}
                </Button>
              )}
            </div>
          ) : (
            <Select
              value={appCategory}
              onValueChange={(v) => setAppCategory(v)}
            >
              <SelectTrigger
                className="h-10 w-[200px] bg-white dark:bg-background"
                data-testid="filter-app-category-select"
              >
                <SelectValue
                  placeholder={t("marketplace.filters.category", "Category")}
                />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_CONFIG.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-1.5">
                      {cat.icon}
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-6 min-w-0">
        {browseMode === "templates" && (
          <>
              {activeFilterChips.length === 0 && search === "" && (
                <FeaturedRow
                  templates={featured}
                  onPreview={previewAutomationTemplate}
                />
              )}

              {activeFilterChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("marketplace.filters.activeLabel", "Filters:")}
                  </span>
                  {activeFilterChips.map((chip, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1 py-0.5"
                    >
                      {chip.label}
                      <button
                        onClick={chip.clear}
                        className="rounded-full hover:bg-muted p-0.5"
                        data-testid={`chip-clear-${chip.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={resetFilters}
                  >
                    {t("marketplace.filters.clearAll", "Clear all")}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {t("marketplace.allTemplates", "All templates")}{" "}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({filteredTemplates.length})
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t("marketplace.showingTemplates", "Showing {{visible}} of {{total}} templates", {
                      visible: visibleTemplates.length,
                      total: filteredTemplates.length,
                    })}
                  </p>
                </div>
              </div>

              {filteredTemplates.length === 0 ? (
                <EmptyState prompt={requestTemplatePrompt()} />
              ) : (
                <>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {visibleTemplates.map((tpl) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        onPreview={previewAutomationTemplate}
                      />
                    ))}
                  </div>
                  {filteredTemplates.length > limit && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setLimit((n) => Math.min(n + 72, filteredTemplates.length))
                      }
                      data-testid="button-marketplace-load-more"
                    >
                      {t("marketplace.loadMore", "Load more")} (
                      {Math.min(limit + 72, filteredTemplates.length)}/
                      {filteredTemplates.length})
                    </Button>
                  )}
                </>
              )}
            </>
          )}

        {browseMode === "apps" && (
          <>
            {search.trim() === "" && appCategory === "all" ? (
              <AppsSectionedOverview
                apps={apps}
                connectedSlugs={connectedSlugs}
                onOpenApp={openAppDetail}
                onViewAllCategory={(cat) => setAppCategory(cat)}
              />
            ) : (
              <>
                <h2 className="text-sm font-semibold">
                  {t("marketplace.allApps", "All apps")}{" "}
                  <span className="text-muted-foreground font-normal ml-1">
                    ({filteredApps.length})
                  </span>
                </h2>
                {filteredApps.length === 0 ? (
                  <Card className="rounded-xl border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      {t("marketplace.noApps", "No apps match your filter.")}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {filteredApps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        isConnected={connectedSlugs.has(app.slug)}
                        onOpen={openAppDetail}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <TemplatePreviewDrawer
        template={previewTemplate}
        apps={apps}
        onClose={() => {
          setPreviewTemplate(null);
          if (params?.templateId) {
            navigate("/app/settings/automation/marketplace");
          }
        }}
      />
    </div>
  );
}

function mapAppToDestination(
  slug: string,
): "zendesk" | "slack" | "hubspot" | null {
  if (slug === "zendesk") return "zendesk";
  if (slug === "slack") return "slack";
  if (slug === "hubspot") return "hubspot";
  return null;
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChipButton({
  active,
  disabled,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 hover:border-border bg-background hover:bg-muted/40 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FeaturedRow({
  templates,
  onPreview,
}: {
  templates: ConciergeTemplate[];
  onPreview: (t: ConciergeTemplate | StarterTemplate) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card/70 to-card/30 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">
              {t("marketplace.featured", "Featured this week")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "marketplace.featuredHint",
                "High-performing starter workflows ready to customize.",
              )}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {templates.length} {t("marketplace.templatesCount", "templates")}
        </Badge>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {templates.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onPreview={onPreview}
            highlight
          />
        ))}
      </div>
    </section>
  );
}

const TemplateCard = memo(function TemplateCard({
  template,
  onPreview,
  highlight,
}: {
  template: ConciergeTemplate;
  onPreview: (template: ConciergeTemplate) => void;
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => onPreview(template)}
      data-testid={`template-card-${template.id}`}
      className={cn(
        "group min-h-[168px] rounded-xl border p-3 text-left transition-all flex flex-col gap-2.5 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        highlight
          ? "border-primary/35 bg-background/80 hover:border-primary/60"
          : "border-border/50 bg-card/70 hover:border-primary/35",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate rounded bg-muted/70 px-1.5 py-0.5 font-mono">
            {template.triggerEvent}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
            {t("marketplace.destinationPlaceholder", "Destination")}
          </span>
        </div>
        {template.verified && (
          <div className="flex shrink-0 items-center gap-1 text-[10px] text-primary">
            <ShieldCheck className="h-3 w-3" />
            {t("marketplace.verified", "Verified")}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">
          {template.title}
        </h3>
        <p
          className={cn(
            "text-xs text-muted-foreground mt-1.5",
            highlight ? "line-clamp-1" : "line-clamp-2",
          )}
        >
          {template.summary}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/40">
        <span className="min-w-0 truncate">
          <Badge variant="secondary" className="text-[10px] mr-1.5 max-w-[110px] truncate align-middle font-normal">
            {template.industry}
          </Badge>
          <span className="align-middle">{template.useCase}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {template.installCount.toLocaleString()}{" "}
          {t("marketplace.installs", "installs")}
        </span>
      </div>
    </button>
  );
});

const AppCard = memo(function AppCard({
  app,
  isConnected,
  onOpen,
}: {
  app: IntegrationApp;
  isConnected: boolean;
  onOpen: (app: IntegrationApp) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card
      className="rounded-xl border-border/50 bg-card/60 hover:border-border/80 hover:shadow-md cursor-pointer transition-all"
      data-testid={`app-card-${app.slug}`}
      onClick={() => onOpen(app)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(app);
        }
      }}
    >
      <CardContent className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <ProviderLogo
            slug={app.slug}
            logoUrl={app.logoUrl}
            name={app.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">{app.name}</h3>
              {app.isPopular && (
                <Badge variant="secondary" className="text-[10px]">
                  {t("marketplace.popular", "Popular")}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground capitalize">
              {(app.category || "other").replace("_", " ")}
            </div>
          </div>
        </div>
        {app.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {app.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
          {isConnected ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {t("marketplace.connected", "Connected")}
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {t("marketplace.notConnected", "Not connected")}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            {t("marketplace.viewUseCases", "View use cases")}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

function EmptyState({ prompt }: { prompt: string }) {
  const { t } = useTranslation();
  return (
    <Card className="rounded-xl border-dashed">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">
            {t("marketplace.empty.title", "No templates match those filters")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {t(
              "marketplace.empty.subtitle",
              "Tell our AI Concierge what you're trying to build and it'll generate a workflow for you.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const ev = new CustomEvent("open-concierge-with-prompt", {
              detail: { prompt },
            });
            window.dispatchEvent(ev);
          }}
          data-testid="button-request-template"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {t("marketplace.empty.cta", "Request a custom template")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Apps overview: section rows like the screenshot ────────────────────

function AppsSectionedOverview({
  apps,
  connectedSlugs,
  onOpenApp,
  onViewAllCategory,
}: {
  apps: IntegrationApp[];
  connectedSlugs: Set<string>;
  onOpenApp: (app: IntegrationApp) => void;
  onViewAllCategory: (category: string) => void;
}) {
  const { t } = useTranslation();

  const featured = useMemo(
    () => apps.filter((a) => a.isPopular).slice(0, 12),
    [apps],
  );
  // "Popular" mirrors Featured but ordered by name for stable variety.
  const popular = useMemo(
    () =>
      [...apps]
        .filter((a) => a.isPopular)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 12),
    [apps],
  );

  const categorySections = useMemo(() => {
    return CATEGORY_CONFIG.filter((cat) => cat.value !== "all").map((cat) => ({
      ...cat,
      apps: apps.filter((a) => a.category === cat.value),
    }));
  }, [apps]);

  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <AppSectionRow
          title={t("marketplace.sections.featured", "Featured")}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          apps={featured}
          connectedSlugs={connectedSlugs}
          onOpenApp={onOpenApp}
        />
      )}
      {popular.length > 0 && (
        <AppSectionRow
          title={t("marketplace.sections.popular", "Popular")}
          icon={<Zap className="w-3.5 h-3.5" />}
          apps={popular}
          connectedSlugs={connectedSlugs}
          onOpenApp={onOpenApp}
        />
      )}
      {categorySections.map((cat) =>
        cat.apps.length === 0 ? null : (
          <AppSectionRow
            key={cat.value}
            title={cat.label}
            icon={cat.icon}
            apps={cat.apps}
            connectedSlugs={connectedSlugs}
            onOpenApp={onOpenApp}
            onViewAll={() => onViewAllCategory(cat.value)}
          />
        ),
      )}
    </div>
  );
}

function AppSectionRow({
  title,
  icon,
  apps,
  connectedSlugs,
  onOpenApp,
  onViewAll,
}: {
  title: string;
  icon?: React.ReactNode;
  apps: IntegrationApp[];
  connectedSlugs: Set<string>;
  onOpenApp: (app: IntegrationApp) => void;
  onViewAll?: () => void;
}) {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = useCallback((delta: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  return (
    <section data-testid={`apps-section-${title.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {icon}
            </span>
          )}
          {title}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-360)}
            aria-label={t("marketplace.scrollLeft", "Scroll left")}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-testid={`section-scroll-left-${title.toLowerCase()}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(360)}
            aria-label={t("marketplace.scrollRight", "Scroll right")}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-testid={`section-scroll-right-${title.toLowerCase()}`}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid={`section-view-all-${title.toLowerCase()}`}
            >
              {t("marketplace.sections.viewAll", "View all")}
            </button>
          )}
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-none scroll-smooth"
      >
        {apps.map((app) => (
          <div
            key={app.id}
            className="snap-start shrink-0 w-[300px] sm:w-[320px]"
          >
            <AppCard
              app={app}
              isConnected={connectedSlugs.has(app.slug)}
              onOpen={onOpenApp}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── App detail page: hero + use case grid ────────────────────────────

interface MarketplaceDetailErrorBoundaryProps {
  slug: string;
  onBack: () => void;
  children: ReactNode;
}

interface MarketplaceDetailErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

class MarketplaceDetailErrorBoundary extends Component<
  MarketplaceDetailErrorBoundaryProps,
  MarketplaceDetailErrorBoundaryState
> {
  state: MarketplaceDetailErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): MarketplaceDetailErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error("[MarketplaceAppDetail] render crashed", { slug: this.props.slug, error, info });
  }

  componentDidUpdate(prevProps: MarketplaceDetailErrorBoundaryProps) {
    if (prevProps.slug !== this.props.slug && this.state.error) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Marketplace detail crashed
          </div>
          <h2 className="text-lg font-semibold mt-1">
            Could not render the page for "{this.props.slug}".
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The error below is the actual render failure. Share it with support so we can patch it.
          </p>
        </div>
        <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-3 text-xs text-destructive">
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
          {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ""}
        </pre>
        <button
          type="button"
          onClick={this.props.onBack}
          className="inline-flex items-center rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          Back to marketplace
        </button>
      </div>
    );
  }
}

function normalizeAppKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function generateUseCasesForApp(app: IntegrationApp): ConciergeTemplate[] {
  const triggers: Array<{
    event: ConciergeTemplate["triggerEvent"];
    label: string;
  }> = [
    { event: "call.completed", label: "Call completed" },
    { event: "lead.captured", label: "Lead captured" },
    { event: "appointment.booked", label: "Appointment booked" },
    { event: "campaign.completed", label: "Campaign completed" },
  ];

  const actionByCategory: Record<string, string[]> = {
    crm: [
      `upsert the contact in ${app.name} and log the call as an engagement`,
      `create a new deal in ${app.name} and attach the call notes`,
      `update the contact's stage in ${app.name} based on intent`,
    ],
    marketing: [
      `add the contact to a ${app.name} audience and tag the source`,
      `trigger a ${app.name} follow-up email with the call summary`,
      `enroll the contact in a ${app.name} nurture journey`,
    ],
    communication: [
      `post the call summary to ${app.name}`,
      `notify the on-call team in ${app.name} with the next step`,
      `send a templated ${app.name} message back to the caller`,
    ],
    support: [
      `open a ${app.name} ticket with the call transcript and summary`,
      `update the existing ${app.name} ticket and tag the intent`,
      `route urgent issues into the high-priority ${app.name} queue`,
    ],
    calendar: [
      `book a follow-up meeting on ${app.name}`,
      `send a ${app.name} reschedule link for missed appointments`,
      `block a calendar hold in ${app.name} for the prospect`,
    ],
    ecommerce: [
      `look up the customer's recent order in ${app.name} and annotate the call`,
      `tag the customer in ${app.name} based on the call outcome`,
      `trigger a refund / credit follow-up in ${app.name}`,
    ],
    analytics: [
      `send a conversion event to ${app.name} with call attributes`,
      `track the call as a funnel step in ${app.name}`,
      `pipe call outcomes into ${app.name} dashboards`,
    ],
    automation: [
      `forward the event into a ${app.name} workflow`,
      `kick off a ${app.name} scenario with the full call payload`,
      `chain a ${app.name} workflow for downstream actions`,
    ],
    data_storage: [
      `append a row to ${app.name} with the call payload`,
      `create a record in ${app.name} for the call outcome`,
      `archive the call summary in ${app.name}`,
    ],
    hr_recruiting: [
      `log the screening call to ${app.name}`,
      `move the candidate stage in ${app.name}`,
      `attach the AI summary to the candidate in ${app.name}`,
    ],
  };

  const fallbackActions = [
    `send the call event to ${app.name}`,
    `update ${app.name} with the latest call outcome`,
    `log the call payload into ${app.name}`,
  ];

  const summary = app.description?.trim()
    ? app.description.trim()
    : `Connect your AI call center events to ${app.name} so nothing falls through the cracks.`;

  const variants =
    actionByCategory[app.category || ""] || fallbackActions;

  const out: ConciergeTemplate[] = [];
  for (const trigger of triggers) {
    for (let i = 0; i < variants.length; i++) {
      const action = variants[i];
      const id = `usecase-${app.slug}-${trigger.event}-${i}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const installCount = 40 + (id.length * 11 + i * 23) % 980;
      out.push({
        id,
        industry: "Any",
        useCase: trigger.label,
        title: `${trigger.label} → ${app.name}`,
        summary,
        prompt: `When ${trigger.event} happens in our AI call center, ${action}.`,
        triggerEvent: trigger.event,
        destination: app.slug as ConciergeTemplate["destination"],
        installCount,
        verified: i === 0,
      });
    }
  }
  return out;
}

function MarketplaceAppDetail({
  app,
  slug,
  isConnected,
  onBack,
  onPreviewTemplate,
}: {
  app: IntegrationApp | null;
  slug: string;
  isConnected: boolean;
  onBack: () => void;
  onPreviewTemplate: (template: ConciergeTemplate | StarterTemplate) => void;
}) {
  const { t } = useTranslation();

  // Defensive synthesis: even if the parent failed to resolve an app for this
  // slug, we still render a complete detail page so the route is never blank.
  const effectiveApp = useMemo<IntegrationApp>(() => {
    if (app) return app;
    const prettyName = (slug || "this app")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return fallbackDestinationApp(
      slug || "unknown",
      prettyName,
      "other",
      `Send AI call events to ${prettyName}.`,
    );
  }, [app, slug]);

  const useCases = useMemo(() => {
    const appKey = normalizeAppKey(effectiveApp.name);
    const slugKey = normalizeAppKey(effectiveApp.slug);
    const starters = CALL_CENTER_STARTER_PACK.filter((tpl) => {
      const requiredMatch = tpl.requiredApps.some((r) => {
        const k = normalizeAppKey(r);
        return k === appKey || k === slugKey;
      });
      const destMatch = normalizeAppKey(tpl.destination) === slugKey;
      return requiredMatch || destMatch;
    });
    const mapped = mapAppToDestination(effectiveApp.slug);
    const catalog = mapped
      ? ALL_TEMPLATES.filter((tpl) => tpl.destination === mapped).slice(0, 60)
      : [];
    const generated = generateUseCasesForApp(effectiveApp);
    return { starters, catalog, generated };
  }, [effectiveApp]);

  const totalUseCases =
    useCases.starters.length +
    useCases.catalog.length +
    useCases.generated.length;

  const conciergePrompt = `I want to automate ${effectiveApp.name} for my AI call center. Suggest a workflow.`;

  return (
    <div className="space-y-6" data-testid="marketplace-app-detail">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
        data-testid="button-app-detail-back"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
        {t("marketplace.appDetail.back", "Back to marketplace")}
      </Button>

      <Card className="rounded-2xl border-border/60 bg-gradient-to-br from-primary/5 via-card/70 to-card/30 shadow-sm">
        <CardContent className="p-6 flex flex-col sm:flex-row gap-5">
          <ProviderLogo
            slug={effectiveApp.slug}
            logoUrl={effectiveApp.logoUrl}
            name={effectiveApp.name}
            size="md"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-xl font-semibold tracking-tight"
                data-testid="app-detail-name"
              >
                {effectiveApp.name}
              </h1>
              {effectiveApp.isPopular && (
                <Badge variant="secondary" className="text-[10px]">
                  {t("marketplace.popular", "Popular")}
                </Badge>
              )}
              {isConnected && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {t("marketplace.connected", "Connected")}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {(effectiveApp.category || "other").replace("_", " ")}
            </div>
            {effectiveApp.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">
                {effectiveApp.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t("marketplace.appDetail.useCases", "Use cases")}{" "}
            <span
              className="text-muted-foreground font-normal ml-1"
              data-testid="app-detail-use-case-count"
            >
              ({totalUseCases})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "marketplace.appDetail.useCasesHint",
              "Pre-built automations you can install with {{name}}.",
              { name: effectiveApp.name },
            )}
          </p>
        </div>

        {totalUseCases === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-10 flex flex-col items-center text-center gap-3">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-semibold">
                  {t(
                    "marketplace.appDetail.empty.title",
                    "No ready-made use cases for {{name}} yet",
                    { name: effectiveApp.name },
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  {t(
                    "marketplace.appDetail.empty.subtitle",
                    "Tell our AI Concierge what you want to automate and it'll generate a workflow for {{name}}.",
                    { name: effectiveApp.name },
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ev = new CustomEvent("open-concierge-with-prompt", {
                    detail: { prompt: conciergePrompt },
                  });
                  window.dispatchEvent(ev);
                }}
                data-testid="button-app-detail-request"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {t("marketplace.appDetail.empty.cta", "Request a workflow")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6" data-testid="app-detail-use-case-grids">
            {useCases.starters.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {useCases.starters.map((tpl) => (
                  <StarterUseCaseCard
                    key={tpl.id}
                    template={tpl}
                    onPreview={onPreviewTemplate}
                  />
                ))}
              </div>
            )}
            {useCases.generated.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {useCases.generated.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    onPreview={onPreviewTemplate}
                  />
                ))}
              </div>
            )}
            {useCases.catalog.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {useCases.catalog.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    onPreview={onPreviewTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const StarterUseCaseCard = memo(function StarterUseCaseCard({
  template,
  onPreview,
}: {
  template: StarterTemplate;
  onPreview: (template: StarterTemplate) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => onPreview(template)}
      data-testid={`use-case-card-${template.id}`}
      className="group min-h-[168px] rounded-xl border border-border/50 bg-card/70 p-3 text-left transition-all flex flex-col gap-2.5 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate rounded bg-muted/70 px-1.5 py-0.5 font-mono">
            {template.triggerEvent}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary capitalize">
            {template.destination.replace(/_/g, " ")}
          </span>
        </div>
        {template.verified && (
          <div className="flex shrink-0 items-center gap-1 text-[10px] text-primary">
            <ShieldCheck className="h-3 w-3" />
            {t("marketplace.verified", "Verified")}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">
          {template.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
          {template.summary}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/40">
        <span className="capitalize">{template.outcome}</span>
        <span className="shrink-0 tabular-nums">
          {template.installCount.toLocaleString()}{" "}
          {t("marketplace.installs", "installs")}
        </span>
      </div>
    </button>
  );
});

// ─── Wizard drawer (Trigger → Destination → Filter → Actions → Deploy) ──

interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

const WIZARD_STEPS: Array<{ id: WizardStep; labelKey: string; fallback: string }> = [
  { id: "trigger", labelKey: "marketplace.wizard.steps.trigger", fallback: "Trigger" },
  { id: "destination", labelKey: "marketplace.wizard.steps.destination", fallback: "Destination" },
  { id: "filter", labelKey: "marketplace.wizard.steps.filter", fallback: "Filter" },
  { id: "actions", labelKey: "marketplace.wizard.steps.actions", fallback: "Actions" },
  { id: "deploy", labelKey: "marketplace.wizard.steps.deploy", fallback: "Deploy" },
];

function defaultWizardState(
  template: ConciergeTemplate | StarterTemplate | null,
  apps: IntegrationApp[],
): WizardState {
  if (!template) {
    return {
      triggerEvent: "",
      destinationSlug: null,
      destinationApp: null,
      mode: null,
      filter: emptyFilter(),
      action: emptyAction(),
      credentials: {},
    };
  }
  const isStarter = "outcome" in template;
  const triggerEvent = isStarter
    ? (template as StarterTemplate).triggerEvent
    : (template as ConciergeTemplate).triggerEvent;
  const rawDestination = isStarter
    ? (template as StarterTemplate).destination
    : (template as ConciergeTemplate).destination;
  const requiredApps = isStarter ? (template as StarterTemplate).requiredApps : [];
  // First try resolving a native deploy slug (zendesk/slack/hubspot) from the
  // template's destination or required apps. If none, fall back to looking up
  // the raw slug in the apps catalog so the wizard can pre-select a generic
  // destination card.
  const native = resolveProvisionDestination(rawDestination, requiredApps);
  if (native) {
    const app = apps.find((a) => a.slug === native) || null;
    return {
      triggerEvent,
      destinationSlug: native,
      destinationApp: app,
      mode: "native",
      filter: emptyFilter(),
      action: emptyAction(),
      credentials: {},
    };
  }
  const directApp = apps.find((a) => a.slug === rawDestination) || null;
  if (directApp) {
    return {
      triggerEvent,
      destinationSlug: directApp.slug,
      destinationApp: directApp,
      mode: "generic",
      filter: emptyFilter(),
      action: actionFromPreset(directApp.slug),
      credentials: {},
    };
  }
  return {
    triggerEvent,
    destinationSlug: null,
    destinationApp: null,
    mode: null,
    filter: emptyFilter(),
    action: emptyAction(),
    credentials: {},
  };
}

function buildRecipeFromWizard(
  template: ConciergeTemplate | StarterTemplate,
  state: WizardState,
): any | null {
  if (!state.destinationSlug || !state.mode) return null;
  const credentialFields = credentialFieldsForDestination(
    state.destinationSlug,
    state.mode,
  );
  const fields =
    credentialFields.length > 0
      ? credentialFields.map((f) => ({
          id: f.id,
          prompt: f.label,
          inputType: "text",
          secret: !!f.secret,
        }))
      : authCredentialFields(state.action.auth.type).map((f) => ({
          id: f.id,
          prompt: f.label,
          inputType: "text",
          secret: !!f.secret,
        }));
  return buildWizardRecipe({
    name: template.title,
    triggerEvent: state.triggerEvent,
    destinationSlug: state.destinationSlug,
    mode: state.mode,
    mapping: {
      summary: "summary" in template ? template.summary : undefined,
      prompt: "prompt" in template ? template.prompt : undefined,
      templateId: template.id,
    },
    filter: state.filter,
    action: state.action,
    credentialFields: fields,
  });
}

function authCredentialFields(
  authType: GenericAuthType,
): Array<{ id: string; label: string; secret?: boolean }> {
  switch (authType) {
    case "bearer":
      return [{ id: "bearerToken", label: "Bearer token", secret: true }];
    case "basic":
      return [
        { id: "basicUsername", label: "Username" },
        { id: "basicPassword", label: "Password", secret: true },
      ];
    case "header":
      return [
        { id: "authHeaderValue", label: "Header value", secret: true },
      ];
    case "none":
    default:
      return [];
  }
}

function isWizardStepValid(state: WizardState, step: WizardStep): boolean {
  switch (step) {
    case "trigger":
      return !!state.triggerEvent;
    case "destination":
      return !!state.destinationSlug && !!state.mode;
    case "filter":
      // Filter is always optional.
      return true;
    case "actions": {
      if (!state.destinationSlug || !state.mode) return false;
      const fields = credentialFieldsForDestination(
        state.destinationSlug,
        state.mode,
      );
      const allFields =
        fields.length > 0 ? fields : authCredentialFields(state.action.auth.type);
      const credsOk = allFields.every(
        (f) => (state.credentials[f.id] || "").trim() !== "",
      );
      if (state.mode === "generic") {
        const urlOk = state.action.url.trim().length > 0;
        return credsOk && urlOk;
      }
      return credsOk;
    }
    case "deploy":
      return true;
  }
}

function TemplatePreviewDrawer({
  template,
  apps,
  onClose,
}: {
  template: ConciergeTemplate | StarterTemplate | null;
  apps: IntegrationApp[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("trigger");
  const [wizard, setWizard] = useState<WizardState>(() =>
    defaultWizardState(template, apps),
  );
  const [deployResult, setDeployResult] = useState<any>(null);

  const isStarter = template != null && "outcome" in template;

  const { data: campaigns = [] } = useQuery<CampaignOption[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!template,
  });

  useEffect(() => {
    if (template) {
      setStep("trigger");
      setWizard(defaultWizardState(template, apps));
      setDeployResult(null);
    }
    // Reset only on template change. Reacting to apps.length would clobber
    // the user's progress as the apps query resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  // When apps finish loading (or a previously empty cache fills), backfill
  // the destinationApp pointer if the wizard already has a slug picked but
  // no app object resolved yet.
  useEffect(() => {
    if (!template) return;
    if (!wizard.destinationSlug || wizard.destinationApp || apps.length === 0) return;
    const found = apps.find((a) => a.slug === wizard.destinationSlug);
    if (found) {
      setWizard((prev) => ({ ...prev, destinationApp: found }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, wizard.destinationSlug, wizard.destinationApp, template?.id]);

  // If the template is known and the apps cache loads after the wizard
  // mounted, try once to pre-fill the destination from the template.
  useEffect(() => {
    if (!template) return;
    if (wizard.destinationSlug || apps.length === 0) return;
    const fresh = defaultWizardState(template, apps);
    if (fresh.destinationSlug) {
      setWizard((prev) => ({
        ...prev,
        destinationSlug: fresh.destinationSlug,
        destinationApp: fresh.destinationApp,
        mode: fresh.mode,
        action: fresh.action,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, template?.id]);

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template selected.");
      const recipe = buildRecipeFromWizard(template, wizard);
      if (!recipe) throw new Error("Recipe is incomplete.");
      // Backwards-compat: native zendesk recipes still need destination.subdomain.
      const recipeForProvision =
        recipe.destination?.slug === "zendesk"
          ? {
              ...recipe,
              destination: {
                ...recipe.destination,
                subdomain:
                  wizard.credentials.zendeskSubdomain ||
                  recipe.destination.subdomain,
              },
            }
          : recipe;
      const res = await apiRequest(
        "POST",
        "/api/integrations/concierge/provision",
        { recipe: recipeForProvision, inputs: wizard.credentials },
      );
      return await res.json();
    },
    onSuccess: (data) => {
      setDeployResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setStep("deploy");
      toast({
        title: t("marketplace.deploy.success", "Automation deployed"),
      });
    },
    onError: (err: any) => {
      toast({
        title: t("marketplace.deploy.failed", "Deploy failed"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const open = template != null;
  const currentStepIdx = WIZARD_STEPS.findIndex((s) => s.id === step);
  const goNext = useCallback(() => {
    if (!isWizardStepValid(wizard, step)) return;
    const next = WIZARD_STEPS[currentStepIdx + 1];
    if (!next) return;
    if (next.id === "deploy") {
      provisionMutation.mutate();
      return;
    }
    setStep(next.id);
  }, [wizard, step, currentStepIdx, provisionMutation]);
  const goBack = useCallback(() => {
    const prev = WIZARD_STEPS[currentStepIdx - 1];
    if (prev) setStep(prev.id);
  }, [currentStepIdx]);

  const updateWizard = useCallback(
    (patch: Partial<WizardState>) =>
      setWizard((prev) => ({ ...prev, ...patch })),
    [],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col"
        data-testid="drawer-template-preview"
      >
        {template && (
          <>
            <SheetHeader className="px-6 py-4 border-b border-border/40">
              <SheetTitle className="text-base flex items-center gap-2">
                {isStarter && (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {t("marketplace.starterPack", "Starter pack")}
                  </Badge>
                )}
                <span className="truncate">{template.title}</span>
              </SheetTitle>
              <SheetDescription className="sr-only">
                {t(
                  "marketplace.wizard.drawerDescription",
                  "Configure the trigger, destination, filters and action for this automation, then deploy.",
                )}
              </SheetDescription>
              <Stepper step={step} />
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-5">
                <FlowDiagram
                  trigger={wizard.triggerEvent}
                  destinationLabel={
                    wizard.destinationApp?.name ||
                    wizard.destinationSlug ||
                    "—"
                  }
                  hasFilter={
                    wizard.filter.campaignIds.length > 0 ||
                    !!wizard.filter.condition
                  }
                  activeStep={step}
                />

                {step === "trigger" && (
                  <TriggerStep
                    triggerEvent={wizard.triggerEvent}
                    onChange={(value) => updateWizard({ triggerEvent: value })}
                  />
                )}

                {step === "destination" && (
                  <DestinationStep
                    apps={apps}
                    selectedSlug={wizard.destinationSlug}
                    onSelect={(app) => {
                      const isNative = isSupportedDestinationSlug(app.slug);
                      const mode: "native" | "generic" = isNative
                        ? "native"
                        : "generic";
                      updateWizard({
                        destinationSlug: app.slug,
                        destinationApp: app,
                        mode,
                        action: isNative ? emptyAction() : actionFromPreset(app.slug),
                        credentials: {},
                      });
                    }}
                  />
                )}

                {step === "filter" && (
                  <FilterStep
                    filter={wizard.filter}
                    campaigns={campaigns}
                    triggerEvent={wizard.triggerEvent}
                    onChange={(filter) => updateWizard({ filter })}
                  />
                )}

                {step === "actions" && (
                  <ActionsStep
                    template={template}
                    wizard={wizard}
                    onActionChange={(action) => updateWizard({ action })}
                    onCredentialsChange={(credentials) =>
                      updateWizard({ credentials })
                    }
                  />
                )}

                {step === "deploy" && deployResult && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">
                        {t(
                          "marketplace.deploy.deployed",
                          "Workflow deployed",
                        )}
                      </span>
                    </div>
                    {deployResult?.n8n?.webhookUrl && (
                      <code className="text-[11px] break-all block bg-background rounded p-2">
                        {deployResult.n8n.webhookUrl}
                      </code>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="px-6 py-4 border-t border-border/40 bg-card/40 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                disabled={currentStepIdx === 0 || step === "deploy"}
                data-testid="button-wizard-back"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                {t("marketplace.wizard.back", "Back")}
              </Button>
              {step !== "deploy" ? (
                <Button
                  size="sm"
                  onClick={goNext}
                  disabled={
                    !isWizardStepValid(wizard, step) ||
                    provisionMutation.isPending
                  }
                  data-testid="button-wizard-next"
                >
                  {provisionMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  )}
                  {step === "actions"
                    ? t("marketplace.wizard.deploy", "Deploy")
                    : t("marketplace.wizard.next", "Next")}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onClose} data-testid="button-wizard-done">
                  {t("common.done", "Done")}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stepper({ step }: { step: WizardStep }) {
  const { t } = useTranslation();
  const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-1.5 text-[11px] mt-1 flex-wrap">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium",
              i < idx
                ? "bg-emerald-500 text-white"
                : i === idx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i < idx ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </div>
          <span
            className={cn(
              i === idx ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {t(s.labelKey, s.fallback)}
          </span>
          {i < WIZARD_STEPS.length - 1 && (
            <span className="mx-1 text-muted-foreground">›</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FlowDiagram({
  trigger,
  destinationLabel,
  hasFilter,
  activeStep,
}: {
  trigger: string;
  destinationLabel: string;
  hasFilter: boolean;
  activeStep: WizardStep;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <Node
          label={t("marketplace.wizard.steps.trigger", "Trigger")}
          detail={trigger || "—"}
          icon={<Zap className="h-3.5 w-3.5" />}
          active={activeStep === "trigger"}
        />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <Node
          label={t("marketplace.wizard.steps.destination", "Destination")}
          detail={destinationLabel}
          icon={<Plug className="h-3.5 w-3.5" />}
          active={activeStep === "destination"}
        />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <Node
          label={t("marketplace.wizard.steps.filter", "Filter")}
          detail={
            hasFilter
              ? t("marketplace.wizard.flow.filterApplied", "Rules set")
              : t("marketplace.wizard.flow.filterOptional", "Optional")
          }
          icon={<FilterIcon className="h-3.5 w-3.5" />}
          dim={!hasFilter && activeStep !== "filter"}
          active={activeStep === "filter"}
        />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <Node
          label={t("marketplace.wizard.steps.actions", "Actions")}
          detail={t("marketplace.wizard.flow.send", "Send event")}
          icon={<Workflow className="h-3.5 w-3.5" />}
          active={activeStep === "actions"}
        />
      </div>
    </div>
  );
}

function Node({
  label,
  detail,
  icon,
  dim,
  active,
}: {
  label: string;
  detail: string;
  icon: React.ReactNode;
  dim?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-lg border p-2.5 text-center",
        active
          ? "border-primary bg-primary/5"
          : dim
            ? "border-dashed border-border/50 bg-background/30"
            : "border-border/60 bg-background/80",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider",
          dim && !active ? "text-muted-foreground/70" : "text-primary",
        )}
      >
        {icon}
        {label}
      </div>
      <div className="text-[11px] font-mono mt-1 truncate">{detail}</div>
    </div>
  );
}

// ─── Step 1: Trigger ──────────────────────────────────────────────────

function TriggerStep({
  triggerEvent,
  onChange,
}: {
  triggerEvent: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" data-testid="wizard-step-trigger">
      <div>
        <h3 className="text-sm font-semibold mb-1">
          {t("marketplace.wizard.trigger.title", "When this happens…")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "marketplace.wizard.trigger.subtitle",
            "Pick the platform event that should fire this automation.",
          )}
        </p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {t("marketplace.wizard.trigger.event", "Trigger event")}
        </label>
        <Select value={triggerEvent} onValueChange={onChange}>
          <SelectTrigger data-testid="select-trigger-event">
            <SelectValue placeholder={t("marketplace.wizard.trigger.placeholder", "Select an event…")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {PLATFORM_WEBHOOK_EVENTS.map((ev) => (
              <SelectItem key={ev} value={ev} data-testid={`select-trigger-event-${ev}`}>
                {ev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          {t("marketplace.preview.payload", "Sample event payload")}
        </h4>
        <pre className="rounded-md bg-muted/40 p-3 text-[11px] font-mono overflow-x-auto">
{`{
  "event": "${triggerEvent || "—"}",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "callId": "call_abc123",
    "fromNumber": "+15551234567",
    "duration": 142,
    "transcriptSummary": "Caller asked about pricing tiers"
  }
}`}
        </pre>
      </div>
    </div>
  );
}

// ─── Step 2: Destination ──────────────────────────────────────────────

function DestinationStep({
  apps,
  selectedSlug,
  onSelect,
}: {
  apps: IntegrationApp[];
  selectedSlug: string | null;
  onSelect: (app: IntegrationApp) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = apps.filter((app) => {
      if (activeCategory !== "all" && app.category !== activeCategory) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        (app.description || "").toLowerCase().includes(q) ||
        (app.slug || "").toLowerCase().includes(q)
      );
    });
    // Popular first, then alphabetical.
    return [...filtered].sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [apps, deferredQuery, activeCategory]);

  return (
    <div className="space-y-4" data-testid="wizard-step-destination">
      <div>
        <h3 className="text-sm font-semibold mb-1">
          {t("marketplace.wizard.destination.title", "Where should it go?")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "marketplace.wizard.destination.subtitle",
            "Pick a destination from {{count}} apps. Zendesk, Slack and HubSpot deploy with a single click; the rest use a generic HTTP/webhook adapter you'll configure on the next step.",
            { count: apps.length },
          )}
        </p>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("marketplace.wizard.destination.search", "Search apps…")}
          className="pl-9 h-9"
          data-testid="input-wizard-destination-search"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_CONFIG.map((cat) => (
          <ChipButton
            key={cat.value}
            active={activeCategory === cat.value}
            onClick={() => setActiveCategory(cat.value)}
            testId={`wizard-cat-${cat.value}`}
          >
            <span className="flex items-center gap-1.5">
              {cat.icon}
              {cat.label}
            </span>
          </ChipButton>
        ))}
      </div>
      {apps.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("marketplace.wizard.destination.loading", "Loading destinations…")}
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("marketplace.wizard.destination.empty", "No apps match.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visible.map((app) => {
            const selected = selectedSlug === app.slug;
            const isNative = isSupportedDestinationSlug(app.slug);
            const hasPreset = !!getDestinationPreset(app.slug);
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => onSelect(app)}
                data-testid={`button-pick-destination-${app.slug}`}
                className={cn(
                  "group relative rounded-xl border p-3 text-left transition-all",
                  selected
                    ? "border-primary bg-background shadow-sm ring-2 ring-primary/15"
                    : "border-border/60 bg-background/70 hover:border-primary/50 hover:bg-background",
                )}
              >
                <div className="flex items-center gap-3">
                  <ProviderLogo
                    slug={app.slug}
                    logoUrl={app.logoUrl}
                    name={app.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {app.name}
                      </div>
                      {app.isPopular && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("marketplace.popular", "Popular")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground capitalize truncate">
                      {(app.category || "other").replace("_", " ")} ·{" "}
                      {isNative
                        ? t("marketplace.wizard.destination.oneClick", "One-click")
                        : hasPreset
                          ? t("marketplace.wizard.destination.preset", "Preset")
                          : t("marketplace.wizard.destination.custom", "Custom")}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "ml-auto flex h-5 w-5 items-center justify-center rounded-full border shrink-0",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-muted/40 text-transparent group-hover:text-muted-foreground",
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Filter ───────────────────────────────────────────────────

type FilterCondition = NonNullable<RecipeFilter["condition"]>;
type FilterOp = FilterCondition["op"];

const FILTER_OPERATORS: ReadonlyArray<{ value: FilterOp; label: string }> = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
];

function FilterStep({
  filter,
  campaigns,
  triggerEvent,
  onChange,
}: {
  filter: RecipeFilter;
  campaigns: CampaignOption[];
  triggerEvent: string;
  onChange: (filter: RecipeFilter) => void;
}) {
  const { t } = useTranslation();
  const conditionEnabled = !!filter.condition;
  const condition = filter.condition || { field: "data.duration", op: "greater_than" as const, value: "60" };
  return (
    <div className="space-y-5" data-testid="wizard-step-filter">
      <div>
        <h3 className="text-sm font-semibold mb-1">
          {t("marketplace.wizard.filter.title", "Run only when… (optional)")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "marketplace.wizard.filter.subtitle",
            "Limit which {{event}} events fire this automation. Leave both rules empty to run for every event.",
            { event: triggerEvent || "events" },
          )}
        </p>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("marketplace.wizard.filter.campaigns", "Run for these campaigns")}
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {t(
            "marketplace.wizard.filter.campaignsHint",
            "Empty = all campaigns.",
          )}
        </p>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("marketplace.wizard.filter.noCampaigns", "No campaigns yet.")}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-md border border-border/40 p-2">
            {campaigns.map((c) => {
              const checked = filter.campaignIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                  data-testid={`wizard-campaign-${c.id}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = v
                        ? [...filter.campaignIds, c.id]
                        : filter.campaignIds.filter((id) => id !== c.id);
                      onChange({ ...filter, campaignIds: next });
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto capitalize">
                    {c.status}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("marketplace.wizard.filter.condition", "Payload condition")}
          </h4>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={conditionEnabled}
              onCheckedChange={(v) =>
                onChange({
                  ...filter,
                  condition: v ? condition : null,
                })
              }
              data-testid="checkbox-wizard-condition"
            />
            {t("marketplace.wizard.filter.conditionEnable", "Add a rule")}
          </label>
        </div>
        {conditionEnabled && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <Input
              value={condition.field}
              onChange={(e) =>
                onChange({
                  ...filter,
                  condition: { ...condition, field: e.target.value },
                })
              }
              placeholder="data.duration"
              data-testid="input-condition-field"
            />
            <Select
              value={condition.op}
              onValueChange={(v) =>
                onChange({
                  ...filter,
                  condition: { ...condition, op: v as typeof condition.op },
                })
              }
            >
              <SelectTrigger className="w-44" data-testid="select-condition-op">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value as string}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={condition.value}
              onChange={(e) =>
                onChange({
                  ...filter,
                  condition: { ...condition, value: e.target.value },
                })
              }
              placeholder="60"
              data-testid="input-condition-value"
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Step 4: Actions ──────────────────────────────────────────────────

function ActionsStep({
  template,
  wizard,
  onActionChange,
  onCredentialsChange,
}: {
  template: ConciergeTemplate | StarterTemplate;
  wizard: WizardState;
  onActionChange: (action: GenericHttpAction) => void;
  onCredentialsChange: (credentials: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  if (!wizard.destinationSlug || !wizard.mode) {
    return (
      <Card className="rounded-xl border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t(
            "marketplace.wizard.actions.pickDestinationFirst",
            "Pick a destination first.",
          )}
        </CardContent>
      </Card>
    );
  }
  const summary = "summary" in template ? template.summary : "";
  const presetSummary = wizard.mode === "generic"
    ? getDestinationPreset(wizard.destinationSlug)?.actionSummary
    : null;
  const actionSummary = presetSummary || summary || "";
  const credentialFields = credentialFieldsForDestination(
    wizard.destinationSlug,
    wizard.mode,
  );

  return (
    <div className="space-y-5" data-testid="wizard-step-actions">
      <div>
        <h3 className="text-sm font-semibold mb-1">
          {t("marketplace.wizard.actions.title", "Configure the action")}
        </h3>
        {actionSummary && (
          <p className="text-xs text-muted-foreground">{actionSummary}</p>
        )}
      </div>

      {wizard.mode === "native" ? (
        <CredentialsForm
          fields={credentialFields}
          inputs={wizard.credentials}
          onChange={(k, v) =>
            onCredentialsChange({ ...wizard.credentials, [k]: v })
          }
        />
      ) : (
        <GenericHttpActionForm
          action={wizard.action}
          credentials={wizard.credentials}
          presetCredentialFields={credentialFields}
          triggerEvent={wizard.triggerEvent}
          onActionChange={onActionChange}
          onCredentialsChange={onCredentialsChange}
        />
      )}
    </div>
  );
}

function CredentialsForm({
  fields,
  inputs,
  onChange,
}: {
  fields: Array<{ id: string; label: string; secret?: boolean; placeholder?: string }>;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const list =
    fields.length > 0 ? fields : [{ id: "apiKey", label: "API key", secret: true }];
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {t("marketplace.preview.credentials", "Credentials")}
      </h4>
      <div className="space-y-2">
        {list.map((field) => (
          <div key={field.id}>
            <label className="text-xs text-muted-foreground block mb-1">
              {field.label}
            </label>
            <Input
              type={field.secret ? "password" : "text"}
              value={inputs[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || field.label}
              data-testid={`input-cred-${field.id}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericHttpActionForm({
  action,
  credentials,
  presetCredentialFields,
  triggerEvent,
  onActionChange,
  onCredentialsChange,
}: {
  action: GenericHttpAction;
  credentials: Record<string, string>;
  presetCredentialFields: Array<{ id: string; label: string; secret?: boolean; placeholder?: string }>;
  triggerEvent: string;
  onActionChange: (action: GenericHttpAction) => void;
  onCredentialsChange: (credentials: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const setCred = (k: string, v: string) =>
    onCredentialsChange({ ...credentials, [k]: v });
  const authFields = authCredentialFields(action.auth.type);
  const allCredentialFields =
    presetCredentialFields.length > 0 ? presetCredentialFields : authFields;

  const sample = useMemo(() => {
    const fakePayload = {
      event: triggerEvent || "call.completed",
      timestamp: "2026-01-15T10:30:00Z",
      data: {
        callId: "call_abc123",
        fromNumber: "+15551234567",
        duration: 142,
        transcriptSummary: "Caller asked about pricing tiers",
        contact: { name: "Acme Corp", firstName: "Acme", lastName: "Corp" },
      },
    };
    const interpolate = (input: string) =>
      input
        .replace(/\{\{trigger\.([^}]+)\}\}/g, (_, path) => {
          const parts = String(path).split(".");
          let cursor: any = fakePayload;
          for (const p of parts) cursor = cursor?.[p];
          return String(cursor ?? "");
        })
        .replace(/\{\{cred\.([^}]+)\}\}/g, (_, key) =>
          String(credentials[key] ?? `{{cred.${key}}}`),
        );
    return {
      url: interpolate(action.url),
      body: interpolate(action.bodyTemplate || ""),
    };
  }, [action.url, action.bodyTemplate, credentials, triggerEvent]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            {t("marketplace.wizard.actions.method", "Method")}
          </label>
          <Select
            value={action.method}
            onValueChange={(v) =>
              onActionChange({ ...action, method: v as GenericHttpAction["method"] })
            }
          >
            <SelectTrigger data-testid="select-action-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            {t("marketplace.wizard.actions.url", "URL")}
          </label>
          <Input
            value={action.url}
            onChange={(e) => onActionChange({ ...action, url: e.target.value })}
            placeholder="https://api.example.com/v1/leads"
            data-testid="input-action-url"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {t("marketplace.wizard.actions.authType", "Authentication")}
        </label>
        <Select
          value={action.auth.type}
          onValueChange={(v) =>
            onActionChange({ ...action, auth: { type: v as GenericAuthType } })
          }
        >
          <SelectTrigger data-testid="select-action-auth">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("marketplace.wizard.actions.authNone", "None")}</SelectItem>
            <SelectItem value="bearer">{t("marketplace.wizard.actions.authBearer", "Bearer token")}</SelectItem>
            <SelectItem value="basic">{t("marketplace.wizard.actions.authBasic", "Basic auth")}</SelectItem>
            <SelectItem value="header">{t("marketplace.wizard.actions.authHeader", "Custom header")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {allCredentialFields.length > 0 && (
        <CredentialsForm
          fields={allCredentialFields}
          inputs={credentials}
          onChange={setCred}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("marketplace.wizard.actions.headers", "Custom headers")}
          </h4>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() =>
              onActionChange({
                ...action,
                headers: [...action.headers, { name: "", value: "" }],
              })
            }
            data-testid="button-action-add-header"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("marketplace.wizard.actions.addHeader", "Add header")}
          </Button>
        </div>
        {action.headers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("marketplace.wizard.actions.noHeaders", "No custom headers.")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {action.headers.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <Input
                  value={h.name}
                  onChange={(e) => {
                    const next = [...action.headers];
                    next[i] = { ...next[i], name: e.target.value };
                    onActionChange({ ...action, headers: next });
                  }}
                  placeholder="Header"
                  data-testid={`input-header-name-${i}`}
                />
                <Input
                  value={h.value}
                  onChange={(e) => {
                    const next = [...action.headers];
                    next[i] = { ...next[i], value: e.target.value };
                    onActionChange({ ...action, headers: next });
                  }}
                  placeholder="value"
                  data-testid={`input-header-value-${i}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => {
                    const next = action.headers.filter((_, j) => j !== i);
                    onActionChange({ ...action, headers: next });
                  }}
                  data-testid={`button-header-remove-${i}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {t("marketplace.wizard.actions.body", "Body template (JSON)")}
        </label>
        <Textarea
          value={action.bodyTemplate}
          onChange={(e) =>
            onActionChange({ ...action, bodyTemplate: e.target.value })
          }
          rows={6}
          className="font-mono text-[11px]"
          placeholder='{"event":"{{trigger.event}}"}'
          data-testid="textarea-action-body"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {t(
            "marketplace.wizard.actions.bodyHint",
            "Use {{trigger.<field>}} to inject payload values and {{cred.<id>}} for credentials.",
          )}
        </p>
      </div>

      <div className="rounded-md border border-border/40 bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-3 w-3" />
          {t("marketplace.wizard.actions.preview", "Sample request")}
        </div>
        <code className="block text-[11px] break-all">
          {action.method} {sample.url || "—"}
        </code>
        {sample.body && (
          <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
            {sample.body}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Provider logo (generic for all 40+ apps) ────────────────────────

interface BrandMark {
  bg: string;
  fg: string;
  initials: string;
}

const BRAND_INITIALS: Record<string, BrandMark> = {
  // CRM
  zendesk: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "Z" },
  slack: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "S" },
  hubspot: { bg: "bg-orange-500/10", fg: "text-orange-700", initials: "H" },
  salesforce: { bg: "bg-sky-500/10", fg: "text-sky-700", initials: "SF" },
  pipedrive: { bg: "bg-zinc-500/10", fg: "text-zinc-700", initials: "P" },
  zoho: { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "Z" },
  freshsales: { bg: "bg-teal-500/10", fg: "text-teal-700", initials: "FS" },
  dynamics365: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "D365" },
  "close-crm": { bg: "bg-amber-500/10", fg: "text-amber-700", initials: "C" },
  "copper-crm": { bg: "bg-orange-500/10", fg: "text-orange-700", initials: "C" },
  gohighlevel: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "GHL" },
  keap: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "K" },
  sugarcrm: { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "SC" },
  bitrix24: { bg: "bg-cyan-500/10", fg: "text-cyan-700", initials: "B24" },
  insightly: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "I" },
  odoo: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "O" },
  // Marketing
  mailchimp: { bg: "bg-yellow-500/10", fg: "text-yellow-700", initials: "M" },
  activecampaign: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "AC" },
  sendgrid: { bg: "bg-sky-500/10", fg: "text-sky-700", initials: "SG" },
  brevo: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "B" },
  convertkit: { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "CK" },
  // Communication
  "microsoft-teams": { bg: "bg-indigo-500/10", fg: "text-indigo-700", initials: "T" },
  telegram: { bg: "bg-sky-500/10", fg: "text-sky-700", initials: "T" },
  whatsapp: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "W" },
  discord: { bg: "bg-indigo-500/10", fg: "text-indigo-700", initials: "D" },
  // Support
  freshdesk: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "F" },
  intercom: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "I" },
  helpscout: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "HS" },
  front: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "F" },
  // Calendar
  "google-calendar": { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "GC" },
  calendly: { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "C" },
  "cal-com": { bg: "bg-zinc-500/10", fg: "text-zinc-700", initials: "Cal" },
  "microsoft-outlook": { bg: "bg-blue-500/10", fg: "text-blue-700", initials: "O" },
  "acuity-scheduling": { bg: "bg-orange-500/10", fg: "text-orange-700", initials: "A" },
  // E-commerce
  stripe: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "S" },
  shopify: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "S" },
  woocommerce: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "Woo" },
  // Analytics
  "google-analytics": { bg: "bg-amber-500/10", fg: "text-amber-700", initials: "GA" },
  mixpanel: { bg: "bg-violet-500/10", fg: "text-violet-700", initials: "MP" },
  segment: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "Seg" },
  // Automation
  zapier: { bg: "bg-orange-500/10", fg: "text-orange-700", initials: "Z" },
  make: { bg: "bg-fuchsia-500/10", fg: "text-fuchsia-700", initials: "M" },
  n8n: { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "n8n" },
  // Data & Storage
  "google-sheets": { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "GS" },
  airtable: { bg: "bg-amber-500/10", fg: "text-amber-700", initials: "A" },
  notion: { bg: "bg-stone-500/10", fg: "text-stone-700", initials: "N" },
  supabase: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "Sup" },
  firebase: { bg: "bg-amber-500/10", fg: "text-amber-700", initials: "FB" },
  "aws-s3": { bg: "bg-orange-500/10", fg: "text-orange-700", initials: "S3" },
  "monday-com": { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "M" },
  // HR & Recruiting
  bamboohr: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "B" },
  greenhouse: { bg: "bg-emerald-500/10", fg: "text-emerald-700", initials: "G" },
  lever: { bg: "bg-rose-500/10", fg: "text-rose-700", initials: "L" },
};

function brandFor(slug: string): BrandMark {
  if (BRAND_INITIALS[slug]) return BRAND_INITIALS[slug];
  const initial = slug ? slug.charAt(0).toUpperCase() : "?";
  return { bg: "bg-muted/60", fg: "text-foreground", initials: initial };
}

function ProviderLogo({
  slug,
  logoUrl,
  name,
  size = "md",
}: {
  slug: string;
  logoUrl?: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const brand = brandFor(slug);
  const dims =
    size === "sm" ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl";
  const inner = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-border/50 text-xs font-bold shadow-sm",
        dims,
        logoUrl ? "bg-card" : brand.bg,
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={cn("object-contain", inner)}
          loading="lazy"
        />
      ) : (
        <ProviderLogoFallback slug={slug} brand={brand} size={size} />
      )}
    </span>
  );
}

function ProviderLogoFallback({
  slug,
  brand,
  size = "md",
}: {
  slug: string;
  brand: BrandMark;
  size?: "sm" | "md";
}) {
  const svgClass = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  if (slug === "zendesk") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path
          fill="#03363D"
          d="M4 7h14L4 24V7Zm14 18H4l14-17v17Zm3 0c0-4.3 3.5-7.8 7.8-7.8V25H21Zm7.8-18V15A7.8 7.8 0 0 1 21 7h7.8Z"
        />
      </svg>
    );
  }
  if (slug === "slack") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path fill="#36C5F0" d="M10.4 4a3.2 3.2 0 1 0 0 6.4h3.2V7.2A3.2 3.2 0 0 0 10.4 4Z" />
        <path fill="#36C5F0" d="M4 13.6a3.2 3.2 0 0 0 3.2 3.2h3.2v-6.4H7.2A3.2 3.2 0 0 0 4 13.6Z" />
        <path fill="#2EB67D" d="M13.6 28a3.2 3.2 0 0 0 3.2-3.2v-3.2h-6.4v3.2a3.2 3.2 0 0 0 3.2 3.2Z" />
        <path fill="#2EB67D" d="M4 18.4a3.2 3.2 0 1 0 6.4 0v-3.2H7.2A3.2 3.2 0 0 0 4 18.4Z" />
        <path fill="#ECB22E" d="M28 18.4a3.2 3.2 0 1 0-6.4 0v3.2h3.2a3.2 3.2 0 0 0 3.2-3.2Z" />
        <path fill="#ECB22E" d="M18.4 28a3.2 3.2 0 0 0 3.2-3.2v-3.2h-6.4v3.2a3.2 3.2 0 0 0 3.2 3.2Z" />
        <path fill="#E01E5A" d="M18.4 4a3.2 3.2 0 0 0-3.2 3.2v3.2h6.4V7.2A3.2 3.2 0 0 0 18.4 4Z" />
        <path fill="#E01E5A" d="M28 13.6a3.2 3.2 0 0 0-3.2-3.2h-3.2v6.4h3.2a3.2 3.2 0 0 0 3.2-3.2Z" />
      </svg>
    );
  }
  if (slug === "hubspot") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path
          fill="#FF5C35"
          d="M21.6 10.7V7.8a2.4 2.4 0 1 0-2.1 0v2.9a7.2 7.2 0 0 0-3.4 1.5L8.7 6.5a2.7 2.7 0 1 0-1.4 1.8l7.2 5.6a7.2 7.2 0 1 0 7.1-3.2Zm-1 11.6a4.4 4.4 0 1 1 0-8.8 4.4 4.4 0 0 1 0 8.8Z"
        />
      </svg>
    );
  }
  if (slug === "salesforce") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path
          fill="#00A1E0"
          d="M11 9a6 6 0 0 1 11-1 5 5 0 0 1 6 8 4.5 4.5 0 0 1-3.5 7H7a5 5 0 0 1-1-9.9A6 6 0 0 1 11 9Z"
        />
      </svg>
    );
  }
  if (slug === "notion") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="5" y="5" width="22" height="22" rx="3" fill="#fff" stroke="#000" strokeWidth="1.5" />
        <path fill="#000" d="M11 10h2.4l5.6 8V10h2v12h-2.4l-5.6-8v8h-2V10Z" />
      </svg>
    );
  }
  if (slug === "odoo") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="4" y="4" width="24" height="24" rx="5" fill="#714B67" />
        <circle cx="16" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
    );
  }
  if (slug === "airtable") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path fill="#FFB13B" d="M4 11.5 16 6l12 5.5-12 4.5L4 11.5Z" />
        <path fill="#F82B60" d="M4 13.5v8l11 4v-8l-11-4Z" />
        <path fill="#3D5BBE" d="M28 13.5v8l-11 4v-8l11-4Z" />
      </svg>
    );
  }
  if (slug === "google-sheets") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path fill="#0F9D58" d="M19 4H8a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V11l-7-7Z" />
        <path fill="#fff" d="M11 16h10v2H11v-2Zm0 4h10v2H11v-2Zm0-8h6v2h-6v-2Z" />
      </svg>
    );
  }
  if (slug === "google-calendar") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="2" fill="#4285F4" />
        <rect x="9" y="11" width="14" height="12" rx="1" fill="#fff" />
        <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4285F4">
          15
        </text>
      </svg>
    );
  }
  if (slug === "microsoft-teams") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="4" y="9" width="14" height="14" rx="2" fill="#5059C9" />
        <text x="11" y="20" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
          T
        </text>
        <circle cx="23" cy="11" r="3" fill="#7B83EB" />
      </svg>
    );
  }
  if (slug === "discord") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <path
          fill="#5865F2"
          d="M25 9a18 18 0 0 0-5-1.5l-.3.5a16 16 0 0 0-5.4 0L14 7.5A18 18 0 0 0 9 9c-3 4.5-3.8 8.9-3.4 13.2A18 18 0 0 0 11 25l.8-1.2a13 13 0 0 1-2-1l.3-.3a13 13 0 0 0 11.8 0l.3.3-2 1L21 25a18 18 0 0 0 5.4-2.8c.5-5-.7-9.4-3.4-13.2Zm-9 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
        />
      </svg>
    );
  }
  if (slug === "telegram") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#0088CC" />
        <path
          fill="#fff"
          d="M22.5 11 20 22a1 1 0 0 1-1.6.6l-3-2.4-1.5 1.4a.7.7 0 0 1-1.2-.5l.3-3.7 6.6-6c.3-.2-.1-.6-.4-.5L11 15l-3.6-1.1a.7.7 0 0 1 0-1.3l14-5.4a.7.7 0 0 1 1 .8Z"
        />
      </svg>
    );
  }
  if (slug === "intercom") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#1F8DED" />
        <rect x="9" y="11" width="2" height="8" rx="1" fill="#fff" />
        <rect x="13" y="9" width="2" height="12" rx="1" fill="#fff" />
        <rect x="17" y="9" width="2" height="12" rx="1" fill="#fff" />
        <rect x="21" y="11" width="2" height="8" rx="1" fill="#fff" />
      </svg>
    );
  }
  if (slug === "stripe") {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#635BFF" />
        <text x="16" y="22" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          S
        </text>
      </svg>
    );
  }
  return (
    <span className={cn("text-xs font-bold leading-none", brand.fg)}>
      {brand.initials}
    </span>
  );
}
