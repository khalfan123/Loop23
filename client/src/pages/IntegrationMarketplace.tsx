import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, Zap, ArrowRight, CheckCircle2, AlertCircle, Loader2,
  LayoutGrid, Star, Globe, Plug, Filter,
  Phone, Brain, Mic, Mail, MessageSquare, Headphones,
  Calendar, ShoppingCart, BarChart3, Workflow, Database, Users,
  ChevronLeft, ChevronRight
} from "lucide-react";
import {
  SiSalesforce, SiHubspot, SiGooglesheets, SiSlack,
  SiMailchimp, SiAirtable, SiTwilio, SiOpenai,
  SiZapier, SiStripe, SiShopify, SiNotion,
  SiFirebase, SiDiscord, SiTelegram, SiWhatsapp,
  SiZendesk, SiIntercom
} from "react-icons/si";
import type { IntegrationApp, UserIntegration } from "@shared/schema";

const CATEGORY_CONFIG: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All Integrations", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "crm", label: "CRM", icon: <Users className="w-4 h-4" /> },
  { value: "telephony", label: "Telephony & VoIP", icon: <Phone className="w-4 h-4" /> },
  { value: "ai_llm", label: "AI & LLM", icon: <Brain className="w-4 h-4" /> },
  { value: "voice_speech", label: "Voice & Speech", icon: <Mic className="w-4 h-4" /> },
  { value: "marketing", label: "Marketing & Email", icon: <Mail className="w-4 h-4" /> },
  { value: "communication", label: "Communication", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "support", label: "Customer Support", icon: <Headphones className="w-4 h-4" /> },
  { value: "calendar", label: "Scheduling", icon: <Calendar className="w-4 h-4" /> },
  { value: "ecommerce", label: "E-Commerce & Payments", icon: <ShoppingCart className="w-4 h-4" /> },
  { value: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "automation", label: "Automation", icon: <Workflow className="w-4 h-4" /> },
  { value: "data_storage", label: "Data & Storage", icon: <Database className="w-4 h-4" /> },
  { value: "hr_recruiting", label: "HR & Recruiting", icon: <Users className="w-4 h-4" /> },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "not_connected", label: "Not Connected" },
];

const LOGO_MAP: Record<string, React.ReactNode> = {
  salesforce: <SiSalesforce className="w-6 h-6 text-[#00A1E0]" />,
  hubspot: <SiHubspot className="w-6 h-6 text-[#FF7A59]" />,
  zoho: <Plug className="w-6 h-6 text-[#C8202B]" />,
  pipedrive: <Plug className="w-6 h-6 text-[#25292C]" />,
  freshsales: <Plug className="w-6 h-6 text-[#25C16F]" />,
  "close-crm": <Plug className="w-6 h-6 text-[#1A1A2E]" />,
  "copper-crm": <Plug className="w-6 h-6 text-[#F7B731]" />,
  "gohighlevel": <Plug className="w-6 h-6 text-[#4285F4]" />,
  keap: <Plug className="w-6 h-6 text-[#2CBA2C]" />,
  sugarcrm: <Plug className="w-6 h-6 text-[#E61E2A]" />,
  bitrix24: <Plug className="w-6 h-6 text-[#2FC7F7]" />,
  insightly: <Plug className="w-6 h-6 text-[#2E86C1]" />,
  dynamics365: <Plug className="w-6 h-6 text-[#002050]" />,
  twilio: <SiTwilio className="w-6 h-6 text-[#F22F46]" />,
  plivo: <Plug className="w-6 h-6 text-[#57BB63]" />,
  vonage: <Plug className="w-6 h-6 text-[#6B1FAA]" />,
  bandwidth: <Plug className="w-6 h-6 text-[#079CEE]" />,
  telnyx: <Plug className="w-6 h-6 text-[#00C08B]" />,
  "amazon-connect": <Plug className="w-6 h-6 text-[#FF9900]" />,
  openai: <SiOpenai className="w-6 h-6 text-[#412991]" />,
  anthropic: <Plug className="w-6 h-6 text-[#D4A574]" />,
  "google-gemini": <Plug className="w-6 h-6 text-[#4285F4]" />,
  mistral: <Plug className="w-6 h-6 text-[#F54E42]" />,
  groq: <Plug className="w-6 h-6 text-[#F55036]" />,
  cohere: <Plug className="w-6 h-6 text-[#39594D]" />,
  perplexity: <Plug className="w-6 h-6 text-[#20808D]" />,
  elevenlabs: <Plug className="w-6 h-6 text-[#000000]" />,
  deepgram: <Plug className="w-6 h-6 text-[#13EF93]" />,
  "google-cloud-tts": <Plug className="w-6 h-6 text-[#4285F4]" />,
  "amazon-polly": <Plug className="w-6 h-6 text-[#FF9900]" />,
  "azure-speech": <Plug className="w-6 h-6 text-[#0078D4]" />,
  playht: <Plug className="w-6 h-6 text-[#5C2D91]" />,
  murf: <Plug className="w-6 h-6 text-[#6C63FF]" />,
  mailchimp: <SiMailchimp className="w-6 h-6 text-[#FFE01B]" />,
  activecampaign: <Plug className="w-6 h-6 text-[#356AE6]" />,
  sendgrid: <Plug className="w-6 h-6 text-[#1A82E2]" />,
  brevo: <Plug className="w-6 h-6 text-[#0B996E]" />,
  convertkit: <Plug className="w-6 h-6 text-[#FB6970]" />,
  slack: <SiSlack className="w-6 h-6 text-[#4A154B]" />,
  "microsoft-teams": <Plug className="w-6 h-6 text-[#6264A7]" />,
  telegram: <SiTelegram className="w-6 h-6 text-[#0088CC]" />,
  whatsapp: <SiWhatsapp className="w-6 h-6 text-[#25D366]" />,
  discord: <SiDiscord className="w-6 h-6 text-[#5865F2]" />,
  zendesk: <SiZendesk className="w-6 h-6 text-[#03363D]" />,
  freshdesk: <Plug className="w-6 h-6 text-[#25C16F]" />,
  intercom: <SiIntercom className="w-6 h-6 text-[#6AFDEF]" />,
  helpscout: <Plug className="w-6 h-6 text-[#1292EE]" />,
  front: <Plug className="w-6 h-6 text-[#394EFF]" />,
  "google-calendar": <Plug className="w-6 h-6 text-[#4285F4]" />,
  calendly: <Plug className="w-6 h-6 text-[#006BFF]" />,
  "cal-com": <Plug className="w-6 h-6 text-[#292929]" />,
  "microsoft-outlook": <Plug className="w-6 h-6 text-[#0078D4]" />,
  "acuity-scheduling": <Plug className="w-6 h-6 text-[#3C8DD5]" />,
  stripe: <SiStripe className="w-6 h-6 text-[#635BFF]" />,
  shopify: <SiShopify className="w-6 h-6 text-[#7AB55C]" />,
  woocommerce: <Plug className="w-6 h-6 text-[#96588A]" />,
  "google-analytics": <Plug className="w-6 h-6 text-[#E37400]" />,
  mixpanel: <Plug className="w-6 h-6 text-[#7856FF]" />,
  segment: <Plug className="w-6 h-6 text-[#52BD94]" />,
  zapier: <SiZapier className="w-6 h-6 text-[#FF4F00]" />,
  make: <Plug className="w-6 h-6 text-[#6D00CC]" />,
  n8n: <Plug className="w-6 h-6 text-[#EA4B71]" />,
  "google-sheets": <SiGooglesheets className="w-6 h-6 text-[#0F9D58]" />,
  airtable: <SiAirtable className="w-6 h-6 text-[#18BFFF]" />,
  notion: <SiNotion className="w-6 h-6 text-[#000000]" />,
  supabase: <Plug className="w-6 h-6 text-[#3ECF8E]" />,
  firebase: <SiFirebase className="w-6 h-6 text-[#FFCA28]" />,
  "aws-s3": <Plug className="w-6 h-6 text-[#569A31]" />,
  "monday-com": <Plug className="w-6 h-6 text-[#FF3D57]" />,
  bamboohr: <Plug className="w-6 h-6 text-[#73C41D]" />,
  greenhouse: <Plug className="w-6 h-6 text-[#3AB549]" />,
  lever: <Plug className="w-6 h-6 text-[#4C7B68]" />,
};

function getAppIcon(slug: string) {
  return LOGO_MAP[slug] || <Plug className="w-6 h-6 text-muted-foreground" />;
}

function getStatusBadge(status: string | undefined) {
  if (!status) return null;
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-600" data-testid="badge-status-active"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
    case "pending_auth":
      return <Badge variant="secondary" data-testid="badge-status-pending"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pending Auth</Badge>;
    case "error":
      return <Badge variant="destructive" data-testid="badge-status-error"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>;
    case "inactive":
      return <Badge variant="outline" data-testid="badge-status-inactive">Inactive</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getCategoryLabel(category: string | null) {
  const found = CATEGORY_CONFIG.find(c => c.value === category);
  if (found) return found.label;
  switch (category) {
    case "productivity": return "Productivity";
    case "erp": return "ERP";
    default: return category || "Other";
  }
}

interface ConnectedInfo {
  integration: UserIntegration;
  app: IntegrationApp;
}

export default function IntegrationMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [, navigate] = useLocation();

  const { data: apps, isLoading: appsLoading } = useQuery<IntegrationApp[]>({
    queryKey: ["/api/integrations/apps"],
  });

  const { data: connected, isLoading: connectedLoading } = useQuery<ConnectedInfo[]>({
    queryKey: ["/api/integrations/connected"],
  });

  const connectedMap = useMemo(() => {
    const map: Record<string, UserIntegration> = {};
    if (connected) {
      for (const c of connected) {
        map[c.app.id] = c.integration;
      }
    }
    return map;
  }, [connected]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    if (apps) {
      counts.all = apps.length;
      for (const app of apps) {
        const cat = app.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [apps]);

  const connectedAppIds = useMemo(() => {
    const ids = new Set<string | number>();
    if (connected) {
      for (const c of connected) {
        if (c.integration.status === "active") {
          ids.add(c.app.id);
        }
      }
    }
    return ids;
  }, [connected]);

  const filteredApps = useMemo(() => {
    if (!apps) return [];
    return apps.filter((app) => {
      if (categoryFilter !== "all" && app.category !== categoryFilter) return false;
      if (statusFilter === "connected" && !connectedAppIds.has(app.id)) return false;
      if (statusFilter === "not_connected" && connectedAppIds.has(app.id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(q) ||
          (app.description && app.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [apps, categoryFilter, statusFilter, searchQuery, connectedAppIds]);

  const popularApps = useMemo(() => filteredApps.filter((a) => a.isPopular), [filteredApps]);
  const otherApps = useMemo(() => filteredApps.filter((a) => !a.isPopular), [filteredApps]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, IntegrationApp[]> = {};
    for (const app of otherApps) {
      const cat = app.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(app);
    }
    return groups;
  }, [otherApps]);

  const isLoading = appsLoading || connectedLoading;

  return (
    <div className="flex h-full" data-testid="page-integration-marketplace">
      <div
        className={`border-r bg-muted/30 flex flex-col shrink-0 transition-all duration-200 ${
          sidebarCollapsed ? "w-[52px]" : "w-[240px]"
        }`}
        data-testid="sidebar-filter-panel"
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Filters</span>
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-testid="button-toggle-filter-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {!sidebarCollapsed && (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Categories
                </h3>
                <div className="space-y-0.5">
                  {CATEGORY_CONFIG.map((cat) => {
                    const count = categoryCounts[cat.value] || 0;
                    const isActive = categoryFilter === cat.value;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setCategoryFilter(cat.value)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover-elevate active-elevate-2 ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                        data-testid={`filter-category-${cat.value}`}
                      >
                        <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                          {cat.icon}
                        </span>
                        <span className="flex-1 text-left truncate">{cat.label}</span>
                        <span className={`text-xs tabular-nums ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Status
                </h3>
                <div className="space-y-0.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const isActive = statusFilter === opt.value;
                    let count = 0;
                    if (opt.value === "all") count = apps?.length || 0;
                    else if (opt.value === "connected") count = connectedAppIds.size;
                    else if (opt.value === "not_connected") count = (apps?.length || 0) - connectedAppIds.size;

                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover-elevate active-elevate-2 ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                        data-testid={`filter-status-${opt.value}`}
                      >
                        {opt.value === "connected" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {opt.value === "not_connected" && <Plug className="w-4 h-4" />}
                        {opt.value === "all" && <LayoutGrid className="w-4 h-4" />}
                        <span className="flex-1 text-left">{opt.label}</span>
                        <span className={`text-xs tabular-nums ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(categoryFilter !== "all" || statusFilter !== "all") && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear all filters
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-marketplace-title">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your business tools to automate workflows
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 no-default-active-elevate">
                  <Zap className="w-3 h-3" />
                  {connected?.length || 0} Connected
                </Badge>
              </div>
            </div>

            <div className="mt-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-integrations"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-9 w-full mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {popularApps.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold" data-testid="text-popular-heading">Popular Integrations</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {popularApps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        connection={connectedMap[app.id]}
                        onNavigate={() => navigate(`/app/integrations/${app.slug}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {Object.entries(groupedByCategory).map(([category, catApps]) => (
                <section key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <LayoutGrid className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold" data-testid={`text-category-${category}`}>
                      {getCategoryLabel(category)}
                    </h2>
                    <Badge variant="outline" className="no-default-active-elevate">{catApps.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {catApps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        connection={connectedMap[app.id]}
                        onNavigate={() => navigate(`/app/integrations/${app.slug}`)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {filteredApps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Globe className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No integrations found</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {searchQuery
                      ? `No integrations match "${searchQuery}". Try a different search term.`
                      : "No integrations available with the current filters."}
                  </p>
                  {(categoryFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setCategoryFilter("all");
                        setStatusFilter("all");
                      }}
                      data-testid="button-clear-filters-empty"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AppCard({
  app,
  connection,
  onNavigate,
}: {
  app: IntegrationApp;
  connection?: UserIntegration;
  onNavigate: () => void;
}) {
  const isConnected = connection?.status === "active";

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all duration-200"
      onClick={onNavigate}
      data-testid={`card-integration-${app.slug}`}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {getAppIcon(app.slug)}
          </div>
          <div className="flex items-center gap-1.5">
            {app.isPopular && (
              <Badge variant="secondary" className="text-xs no-default-active-elevate">
                <Star className="w-3 h-3 mr-0.5" /> Popular
              </Badge>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm" data-testid={`text-app-name-${app.slug}`}>{app.name}</h3>
          <Badge variant="outline" className="text-xs mt-1 no-default-active-elevate">{getCategoryLabel(app.category)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-app-desc-${app.slug}`}>
          {app.description}
        </p>
        <div className="pt-1">
          {connection ? (
            <div className="flex items-center justify-between gap-2">
              {getStatusBadge(connection.status)}
              <Button variant="ghost" size="sm" data-testid={`button-manage-${app.slug}`}>
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" className="w-full" data-testid={`button-connect-${app.slug}`}>
              <Plug className="w-3 h-3 mr-1.5" /> Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
