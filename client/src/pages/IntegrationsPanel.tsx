import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Zap, ArrowRight, CheckCircle2, AlertCircle, Loader2,
  LayoutGrid, Star, Globe, Plug, Webhook,
  Phone, Brain, Mic, Mail, MessageSquare, Headphones,
  Calendar, ShoppingCart, BarChart3, Workflow, Database, Users,
  Plus, Trash2, ExternalLink, Copy, CheckCircle, XCircle, Clock,
  Crown, Lock, RefreshCw, Settings, Unplug, Key, Eye, EyeOff
} from "lucide-react";
import {
  SiSalesforce, SiHubspot, SiGooglesheets, SiSlack,
  SiMailchimp, SiAirtable, SiTwilio, SiOpenai,
  SiZapier, SiStripe, SiShopify, SiNotion,
  SiFirebase, SiDiscord, SiTelegram, SiWhatsapp,
  SiZendesk, SiIntercom
} from "react-icons/si";
import type { IntegrationApp, UserIntegration, Campaign } from "@shared/schema";

const CATEGORY_CONFIG: { value: string; labelKey: string; icon: React.ReactNode }[] = [
  { value: "all", labelKey: "integrations.panel.categories.all", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "crm", labelKey: "integrations.panel.categories.crm", icon: <Users className="w-4 h-4" /> },
  { value: "marketing", labelKey: "integrations.panel.categories.marketing", icon: <Mail className="w-4 h-4" /> },
  { value: "communication", labelKey: "integrations.panel.categories.communication", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "support", labelKey: "integrations.panel.categories.support", icon: <Headphones className="w-4 h-4" /> },
  { value: "calendar", labelKey: "integrations.panel.categories.calendar", icon: <Calendar className="w-4 h-4" /> },
  { value: "ecommerce", labelKey: "integrations.panel.categories.ecommerce", icon: <ShoppingCart className="w-4 h-4" /> },
  { value: "analytics", labelKey: "integrations.panel.categories.analytics", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "automation", labelKey: "integrations.panel.categories.automation", icon: <Workflow className="w-4 h-4" /> },
  { value: "data_storage", labelKey: "integrations.panel.categories.dataStorage", icon: <Database className="w-4 h-4" /> },
  { value: "hr_recruiting", labelKey: "integrations.panel.categories.hrRecruiting", icon: <Users className="w-4 h-4" /> },
];

const LOGO_MAP: Record<string, React.ReactNode> = {
  salesforce: <SiSalesforce className="w-6 h-6 text-[#00A1E0]" />,
  hubspot: <SiHubspot className="w-6 h-6 text-[#FF7A59]" />,
  zoho: <Plug className="w-6 h-6 text-[#C8202B]" />,
  pipedrive: <Plug className="w-6 h-6 text-[#25292C]" />,
  freshsales: <Plug className="w-6 h-6 text-[#25C16F]" />,
  "close-crm": <Plug className="w-6 h-6 text-[#1A1A2E]" />,
  "copper-crm": <Plug className="w-6 h-6 text-[#F7B731]" />,
  gohighlevel: <Plug className="w-6 h-6 text-[#4285F4]" />,
  keap: <Plug className="w-6 h-6 text-[#2CBA2C]" />,
  sugarcrm: <Plug className="w-6 h-6 text-[#E61E2A]" />,
  bitrix24: <Plug className="w-6 h-6 text-[#2FC7F7]" />,
  insightly: <Plug className="w-6 h-6 text-[#2E86C1]" />,
  dynamics365: <Plug className="w-6 h-6 text-[#002050]" />,
  twilio: <SiTwilio className="w-6 h-6 text-[#F22F46]" />,
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

interface ConnectedInfo {
  integration: UserIntegration;
  app: IntegrationApp;
}

interface WebhookItem {
  id: string;
  campaignId: string | null;
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  createdAt: string;
  campaign?: { id: string; name: string };
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  callId: string;
  status: "success" | "failed";
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
}

interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  planType: string;
  credits: number;
}

export default function IntegrationsPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [, navigate] = useLocation();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "marketplace" || tab === "connected" || tab === "webhooks") {
        setActiveTab(tab);
      }
    } catch {
      // ignore
    }
  }, []);

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

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t("integrations.panel.sidebar.quickAccess")}>
        <SubPanelItem
          icon={<LayoutGrid className="w-4 h-4" />}
          label={t("integrations.panel.tabs.marketplace")}
          isActive={activeTab === "marketplace"}
          onClick={() => setActiveTab("marketplace")}
          data-testid="link-marketplace-tab"
        />
        <SubPanelItem
          icon={<MessageSquare className="w-4 h-4" />}
          label="Developer Concierge"
          isActive={false}
          onClick={() => navigate("/app/integrations/concierge")}
          data-testid="link-concierge-tab"
        />
        <SubPanelItem
          icon={<Zap className="w-4 h-4" />}
          label={t("integrations.panel.tabs.myIntegrations")}
          isActive={activeTab === "connected"}
          badge={connected?.length || 0}
          onClick={() => setActiveTab("connected")}
          data-testid="link-connected-tab"
        />
        <SubPanelItem
          icon={<Webhook className="w-4 h-4" />}
          label={t("integrations.panel.tabs.apiWebhooks")}
          isActive={activeTab === "webhooks"}
          onClick={() => setActiveTab("webhooks")}
          data-testid="link-webhooks-tab"
        />
      </SubPanelSection>

      <SubPanelSection title={t("integrations.panel.sidebar.categories")}>
        {CATEGORY_CONFIG.map((cat) => (
          <SubPanelItem
            key={cat.value}
            icon={cat.icon}
            label={t(cat.labelKey)}
            isActive={cat.value !== "all" && categoryFilter === cat.value && activeTab === "marketplace"}
            badge={categoryCounts[cat.value] || 0}
            onClick={() => {
              setActiveTab("marketplace");
              setCategoryFilter(cat.value);
            }}
            data-testid={`filter-category-${cat.value}`}
          />
        ))}
      </SubPanelSection>
    </div>
  );

  return (
    <ThreeColumnLayout
      subPanel={subPanelContent}
      subPanelHeader={t("integrations.panel.title")}
      subPanelWidth="md"
    >
      <div className="flex flex-col h-[calc(100vh-120px)]" data-testid="page-integrations-panel">
        <div className="py-4 px-1">
          {activeTab === "marketplace" && (
            <MarketplaceTab
              apps={apps}
              isLoading={appsLoading || connectedLoading}
              connectedMap={connectedMap}
              connectedAppIds={connectedAppIds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              navigate={navigate}
            />
          )}

          {activeTab === "connected" && (
            <MyIntegrationsTab
              connected={connected}
              isLoading={connectedLoading}
              navigate={navigate}
            />
          )}

          {activeTab === "webhooks" && <WebhooksTab />}
        </div>
      </div>
    </ThreeColumnLayout>
  );
}

// Concierge moved to /app/integrations/concierge

function MarketplaceTab({
  apps,
  isLoading,
  connectedMap,
  connectedAppIds,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  navigate,
}: {
  apps: IntegrationApp[] | undefined;
  isLoading: boolean;
  connectedMap: Record<string, UserIntegration>;
  connectedAppIds: Set<string | number>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  navigate: (path: string) => void;
}) {
  const { t } = useTranslation();

  const filteredApps = useMemo(() => {
    if (!apps) return [];
    return apps.filter((app) => {
      if (categoryFilter !== "all" && app.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(q) ||
          (app.description && app.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [apps, categoryFilter, searchQuery]);

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

  function getCategoryLabel(category: string | null) {
    const found = CATEGORY_CONFIG.find((c) => c.value === category);
    if (found) return t(found.labelKey);
    return category || t("integrations.panel.categories.other");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-foreground" />
          <span className="font-medium">
            {categoryFilter === "all" ? t("integrations.panel.categories.all") : getCategoryLabel(categoryFilter)}
          </span>
          {categoryFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setCategoryFilter("all")} data-testid="button-clear-filters">
              {t("integrations.panel.marketplace.clearFilters")}
            </Button>
          )}
        </div>
        <Badge variant="outline" className="gap-1 no-default-active-elevate">
          <Zap className="w-3 h-3" />
          {connectedAppIds.size} {t("integrations.panel.marketplace.connectedCount")}
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("integrations.panel.marketplace.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-integrations"
        />
      </div>

      <div className="bg-white/80 dark:bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/[0.08] overflow-y-auto p-4 space-y-6 max-h-[calc(100vh-320px)]">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <h2 className="text-lg font-semibold" data-testid="text-popular-heading">
                    {t("integrations.panel.marketplace.popular")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {popularApps.map((app) => (
                    <AppCard key={app.id} app={app} connection={connectedMap[app.id]} onNavigate={() => navigate(`/app/integrations/${app.slug}`)} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catApps.map((app) => (
                    <AppCard key={app.id} app={app} connection={connectedMap[app.id]} onNavigate={() => navigate(`/app/integrations/${app.slug}`)} />
                  ))}
                </div>
              </section>
            ))}

            {filteredApps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Globe className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("integrations.panel.marketplace.noResults")}</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {searchQuery
                    ? t("integrations.panel.marketplace.noSearchResults", { query: searchQuery })
                    : t("integrations.panel.marketplace.noFilterResults")}
                </p>
                {categoryFilter !== "all" && (
                  <Button variant="outline" className="mt-4" onClick={() => setCategoryFilter("all")} data-testid="button-clear-filters-empty">
                    {t("integrations.panel.marketplace.clearFilters")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AppCard({ app, connection, onNavigate }: { app: IntegrationApp; connection?: UserIntegration; onNavigate: () => void }) {
  const { t } = useTranslation();

  function getStatusBadge(status: string | undefined) {
    if (!status) return null;
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-active"><CheckCircle2 className="w-3 h-3 mr-1" /> {t("integrations.panel.status.connected")}</Badge>;
      case "pending_auth":
        return <Badge variant="secondary" data-testid="badge-status-pending"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("integrations.panel.status.pendingAuth")}</Badge>;
      case "error":
        return <Badge variant="destructive" data-testid="badge-status-error"><AlertCircle className="w-3 h-3 mr-1" /> {t("integrations.panel.status.error")}</Badge>;
      case "inactive":
        return <Badge variant="outline" data-testid="badge-status-inactive">{t("integrations.panel.status.inactive")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <Card className="hover-elevate cursor-pointer transition-all duration-200" onClick={onNavigate} data-testid={`card-integration-${app.slug}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {getAppIcon(app.slug)}
          </div>
          <div className="flex items-center gap-1.5">
            {app.isPopular && (
              <Badge variant="secondary" className="text-xs no-default-active-elevate">
                <Star className="w-3 h-3 mr-0.5" /> {t("integrations.panel.marketplace.popularBadge")}
              </Badge>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm" data-testid={`text-app-name-${app.slug}`}>{app.name}</h3>
          <Badge variant="outline" className="text-xs mt-1 no-default-active-elevate">
            {CATEGORY_CONFIG.find((c) => c.value === app.category)
              ? t(CATEGORY_CONFIG.find((c) => c.value === app.category)!.labelKey)
              : app.category || t("integrations.panel.categories.other")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-app-desc-${app.slug}`}>
          {app.description}
        </p>
        <div className="pt-1">
          {connection ? (
            <div className="flex items-center justify-between gap-2">
              {getStatusBadge(connection.status)}
              <Button variant="ghost" size="sm" data-testid={`button-manage-${app.slug}`}>
                {t("integrations.panel.marketplace.manage")} <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex">
              <Button variant="default" size="sm" className="flex-1" data-testid={`button-connect-${app.slug}`}>
                <Plug className="w-3 h-3 mr-1.5" /> {t("integrations.panel.marketplace.connect")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MyIntegrationsTab({
  connected,
  isLoading,
  navigate,
}: {
  connected: ConnectedInfo[] | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedInfo | null>(null);

  const resyncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await apiRequest("POST", `/api/integrations/${integrationId}/sync`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({
        title: data.success ? t("integrations.panel.myIntegrations.resyncSuccess") : t("integrations.panel.myIntegrations.resyncFailed"),
        description: data.success ? t("integrations.panel.myIntegrations.resyncSuccessDesc") : t("integrations.panel.myIntegrations.resyncFailedDesc"),
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.panel.myIntegrations.resyncFailed"), description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setDisconnectTarget(null);
      toast({ title: t("integrations.panel.myIntegrations.disconnected"), description: t("integrations.panel.myIntegrations.disconnectedDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.panel.myIntegrations.disconnectFailed"), description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!connected || connected.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Plug className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t("integrations.panel.myIntegrations.emptyTitle")}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {t("integrations.panel.myIntegrations.emptyDescription")}
        </p>
      </div>
    );
  }

  const activeConnections = connected.filter((c) => c.integration.status === "active");
  const pendingConnections = connected.filter((c) => c.integration.status === "pending_auth");
  const errorConnections = connected.filter((c) => c.integration.status === "error");
  const inactiveConnections = connected.filter((c) => c.integration.status === "inactive");

  return (
    <div className="space-y-6 max-h-[calc(100vh-320px)] overflow-y-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{activeConnections.length}</div>
            <div className="text-xs text-muted-foreground">{t("integrations.panel.myIntegrations.active")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{pendingConnections.length}</div>
            <div className="text-xs text-muted-foreground">{t("integrations.panel.myIntegrations.pending")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{errorConnections.length}</div>
            <div className="text-xs text-muted-foreground">{t("integrations.panel.myIntegrations.errors")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-400">{inactiveConnections.length}</div>
            <div className="text-xs text-muted-foreground">{t("integrations.panel.myIntegrations.inactive")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {connected.map((item) => (
          <Card key={item.integration.id} className="hover-elevate cursor-pointer transition-all duration-200" onClick={() => navigate(`/app/integrations/${item.app.slug}`)} data-testid={`card-connected-${item.app.slug}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {getAppIcon(item.app.slug)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{item.app.name}</h3>
                    <StatusBadge status={item.integration.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.app.description}
                  </p>
                  {item.integration.lastSyncAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {t("integrations.panel.myIntegrations.lastSync")}: {new Date(item.integration.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); resyncMutation.mutate(item.integration.id); }} disabled={resyncMutation.isPending} data-testid={`button-resync-${item.app.slug}`}>
                    <RefreshCw className={`w-3 h-3 mr-1 ${resyncMutation.isPending ? "animate-spin" : ""}`} />
                    {t("integrations.panel.myIntegrations.resync")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/app/integrations/${item.app.slug}`); }} data-testid={`button-configure-${item.app.slug}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    {t("integrations.panel.myIntegrations.configure")}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDisconnectTarget(item); }} data-testid={`button-disconnect-${item.app.slug}`}>
                    <Unplug className="w-3 h-3 mr-1" />
                    {t("integrations.panel.myIntegrations.disconnect")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("integrations.panel.myIntegrations.disconnectTitle")}</DialogTitle>
            <DialogDescription>
              {t("integrations.panel.myIntegrations.disconnectConfirm", { name: disconnectTarget?.app.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)} data-testid="button-cancel-disconnect">
              {t("integrations.panel.myIntegrations.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => disconnectTarget && disconnectMutation.mutate(disconnectTarget.integration.id)} disabled={disconnectMutation.isPending} data-testid="button-confirm-disconnect">
              {disconnectMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Unplug className="w-3 h-3 mr-1" />}
              {t("integrations.panel.myIntegrations.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> {t("integrations.panel.status.connected")}</Badge>;
    case "pending_auth":
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("integrations.panel.status.pendingAuth")}</Badge>;
    case "error":
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> {t("integrations.panel.status.error")}</Badge>;
    case "inactive":
      return <Badge variant="outline">{t("integrations.panel.status.inactive")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function WebhooksTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [apiWebhooksTab, setApiWebhooksTab] = useState<"apiKeys" | "webhooks">("apiKeys");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeliveryLogsOpen, setIsDeliveryLogsOpen] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", url: "", campaignId: "" });
  const [generatedApiKeyById, setGeneratedApiKeyById] = useState<Record<string, string>>({});
  const [isCreateApiKeyOpen, setIsCreateApiKeyOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);

  const { data: user, isLoading: userLoading, isError: userError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: webhooks = [], isLoading } = useQuery<WebhookItem[]>({
    queryKey: ["/api/webhooks"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: deliveryLogs = [] } = useQuery<WebhookDelivery[]>({
    queryKey: ["/api/webhooks", selectedWebhookId, "deliveries"],
    enabled: !!selectedWebhookId && isDeliveryLogsOpen,
  });

  const { data: apiKeysResp } = useQuery<{ success: boolean; data: ApiKeyListItem[] }>({
    queryKey: ["/api/user/api-keys"],
  });

  const apiKeys = apiKeysResp?.data || [];

  // #region agent log
  fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-webhooks-ui-pre',hypothesisId:'UI1',location:'client/src/pages/IntegrationsPanel.tsx:WebhooksTab',message:'WebhooksTab render snapshot',data:{apiKeysCount:apiKeys.length,webhooksCount:Array.isArray(webhooks)?webhooks.length:null,campaignsCount:Array.isArray(campaigns)?campaigns.length:null,userLoaded:!!user,isFreeUser:user?.planType==='free',isCreateDialogOpen,isDeliveryLogsOpen},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const createApiKeyMutation = useMutation({
    mutationFn: async () => {
      const name = newApiKeyName.trim();
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K4',location:'client/src/pages/IntegrationsPanel.tsx:createApiKeyMutation',message:'Create API key submit',data:{nameLen:name.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const res = await apiRequest("POST", "/api/user/api-keys", { name });
      return await res.json();
    },
    onSuccess: (data: any) => {
      const key = data?.data?.key ? String(data.data.key) : null;
      const id = data?.data?.id ? String(data.data.id) : null;
      if (key) {
        if (id) {
          setGeneratedApiKeyById((prev) => ({ ...prev, [id]: key }));
        }
        navigator.clipboard.writeText(key);
      }
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K5',location:'client/src/pages/IntegrationsPanel.tsx:createApiKeyMutation',message:'Create API key success (client)',data:{hasKey:!!key,keyPrefix:data?.data?.keyPrefix||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setIsCreateApiKeyOpen(false);
      setNewApiKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({ title: "API key generated", description: "Copied to clipboard." });
    },
    onError: (error: Error) => {
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K6',location:'client/src/pages/IntegrationsPanel.tsx:createApiKeyMutation',message:'Create API key failed (client)',data:{name:error.name,message:error.message,status:(error as any)?.status||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast({ title: "Create API key failed", description: error.message, variant: "destructive" });
    },
  });

  const regenerateNamedApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/user/api-keys/${id}/regenerate`, {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      const key = data?.data?.key ? String(data.data.key) : null;
      const id = data?.data?.id ? String(data.data.id) : null;
      if (key) {
        if (id) {
          setGeneratedApiKeyById((prev) => ({ ...prev, [id]: key }));
        }
        navigator.clipboard.writeText(key);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({ title: "API key regenerated", description: "Copied to clipboard." });
    },
    onError: (error: Error) => {
      toast({ title: "Regenerate failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/user/api-keys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({ title: "API key deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; campaignId: string | null }) => await apiRequest("POST", "/api/webhooks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: t("integrations.toast.created"), description: t("integrations.toast.createdDesc") });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", url: "", campaignId: "" });
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.toast.createFailed"), description: error.message || t("integrations.toast.createFailedDesc"), variant: "destructive" });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { isActive?: boolean; name?: string; url?: string } }) => await apiRequest("PUT", `/api/webhooks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: t("integrations.toast.updated"), description: t("integrations.toast.updatedDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.toast.updateFailed"), description: error.message || t("integrations.toast.updateFailedDesc"), variant: "destructive" });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/webhooks/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: t("integrations.toast.deleted"), description: t("integrations.toast.deletedDesc") });
      setWebhookToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.toast.deleteFailed"), description: error.message || t("integrations.toast.deleteFailedDesc"), variant: "destructive" });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("POST", `/api/webhooks/${id}/test`, {}),
    onSuccess: () => {
      toast({ title: t("integrations.toast.testSent"), description: t("integrations.toast.testSentDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("integrations.toast.testFailed"), description: error.message || t("integrations.toast.testFailedDesc"), variant: "destructive" });
    },
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/api-keys/regenerate", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data?.apiKey) {
        setGeneratedApiKey(String(data.apiKey));
        setShowApiKey(true);
      }
      setIsRegeneratingKey(false);
      toast({ title: t("integrations.apiKeys.regenerated"), description: t("integrations.apiKeys.regeneratedDesc") });
    },
    onError: (error: Error) => {
      setIsRegeneratingKey(false);
      toast({ title: t("integrations.apiKeys.regenerateFailed"), description: error.message, variant: "destructive" });
    },
  });

  const handleCreateWebhook = () => {
    if (!formData.name || !formData.url) {
      toast({ title: t("integrations.toast.missingFields"), description: t("integrations.toast.missingFieldsDesc"), variant: "destructive" });
      return;
    }
    // #region agent log
    fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'webhook-create-pre',hypothesisId:'A',location:'client/src/pages/IntegrationsPanel.tsx:handleCreateWebhook',message:'Submitting create webhook from UI',data:{nameLen:formData.name?.length||0,urlLen:formData.url?.length||0,campaignIdValue:formData.campaignId||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    createWebhookMutation.mutate({ name: formData.name, url: formData.url, campaignId: formData.campaignId || null });
  };

  const handleToggleActive = (webhook: WebhookItem) => {
    updateWebhookMutation.mutate({ id: webhook.id, data: { isActive: !webhook.isActive } });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("integrations.toast.copied"), description: t("integrations.toast.copiedDesc") });
  };

  if (userLoading) {
    return <div className="text-center py-16 text-muted-foreground">{t("integrations.loading")}</div>;
  }

  if (userError) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">{t("integrations.error.title")}</h2>
        <p className="text-muted-foreground">{t("integrations.error.description")}</p>
      </Card>
    );
  }

  const isFreeUser = user?.planType === "free";

  if (isFreeUser) {
    return (
      <Card className="p-8 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <Webhook className="w-20 h-20 text-muted-foreground/30" />
              <Lock className="w-8 h-8 text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">{t("integrations.unlock.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("integrations.unlock.description")}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg mb-4">{t("integrations.unlock.proFeaturesTitle")}</h3>
            <div className="grid gap-3 text-left">
              {["realTimeEvents", "crmAutoSync", "customWorkflows", "secureReliable"].map((key) => (
                <div key={key} className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t(`integrations.unlock.${key}`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`integrations.unlock.${key}Desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <Button size="lg" className="gap-2" onClick={() => setLocation("/app/upgrade")} data-testid="button-upgrade-to-pro">
              <Crown className="w-5 h-5" />
              {t("integrations.unlock.upgradeButton")}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">{t("integrations.unlock.upgradeDesc")}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={apiWebhooksTab} onValueChange={(v) => setApiWebhooksTab(v as any)}>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-1">
          <TabsList className="grid h-11 w-full grid-cols-2 bg-transparent p-0">
          <TabsTrigger
            value="apiKeys"
            data-testid="tab-api-keys"
            className="h-10 rounded-xl text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Key className="w-4 h-4 mr-2" />
            API keys
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            data-testid="tab-webhooks"
            className="h-10 rounded-xl text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="apiKeys" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                <CardTitle>{t("integrations.apiKeys.title")}</CardTitle>
              </div>
              <CardDescription>{t("integrations.apiKeys.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  {apiKeys.length} key(s)
                </div>
                <Dialog open={isCreateApiKeyOpen} onOpenChange={setIsCreateApiKeyOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-open-create-api-key">
                      <Plus className="w-4 h-4 mr-2" />
                      Generate API key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate API key</DialogTitle>
                      <DialogDescription>Give your key a name (e.g. “Production”, “Zapier”, “n8n”).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newApiKeyName}
                        onChange={(e) => setNewApiKeyName(e.target.value)}
                        placeholder="Production key"
                        data-testid="input-api-key-name"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateApiKeyOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createApiKeyMutation.mutate()}
                        disabled={createApiKeyMutation.isPending || !newApiKeyName.trim()}
                        data-testid="button-create-api-key"
                      >
                        {createApiKeyMutation.isPending ? "Generating…" : "Generate"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="text-sm font-medium mb-2">Your API keys</div>
                {apiKeys.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No API keys yet.</div>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{k.name}</div>
                          <div className="text-xs text-muted-foreground">{k.keyPrefix}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const key = generatedApiKeyById[k.id];
                              if (key) {
                                copyToClipboard(key);
                                return;
                              }
                              regenerateNamedApiKeyMutation.mutate(k.id);
                            }}
                            data-testid={`button-copy-api-key-${k.id}`}
                            title={!generatedApiKeyById[k.id] ? "Will regenerate and copy a new key" : undefined}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy key
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateNamedApiKeyMutation.mutate(k.id)}
                            disabled={regenerateNamedApiKeyMutation.isPending}
                            data-testid={`button-regenerate-named-api-key-${k.id}`}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Regenerate
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteApiKeyMutation.mutate(k.id)}
                            disabled={deleteApiKeyMutation.isPending}
                            data-testid={`button-delete-api-key-${k.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">{t("integrations.apiKeys.warning")}</p>
                <AlertDialog open={isRegeneratingKey} onOpenChange={setIsRegeneratingKey}>
                  <Button variant="outline" size="sm" onClick={() => setIsRegeneratingKey(true)} data-testid="button-regenerate-api-key">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {t("integrations.apiKeys.regenerate")}
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("integrations.apiKeys.regenerateTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("integrations.apiKeys.regenerateConfirm")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-regenerate">{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => regenerateApiKeyMutation.mutate()} data-testid="button-confirm-regenerate">
                        {t("integrations.apiKeys.regenerate")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("integrations.panel.webhooks.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("integrations.panel.webhooks.subtitle")}</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-webhook">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("integrations.createWebhook")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("integrations.dialog.createTitle")}</DialogTitle>
                  <DialogDescription>{t("integrations.dialog.createDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("integrations.form.nameLabel")}</Label>
                    <Input id="name" data-testid="input-webhook-name" placeholder={t("integrations.form.namePlaceholder")} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">{t("integrations.form.urlLabel")}</Label>
                    <Input id="url" data-testid="input-webhook-url" placeholder={t("integrations.form.urlPlaceholder")} value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign">{t("integrations.form.campaignLabel")}</Label>
                    <Select value={formData.campaignId || "all"} onValueChange={(value) => setFormData({ ...formData, campaignId: value === "all" ? "" : value })}>
                      <SelectTrigger data-testid="select-webhook-campaign">
                        <SelectValue placeholder={t("integrations.form.allCampaigns")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("integrations.form.allCampaigns")}</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">{t("common.cancel")}</Button>
                  <Button onClick={handleCreateWebhook} disabled={createWebhookMutation.isPending} data-testid="button-submit-create">
                    {createWebhookMutation.isPending ? t("integrations.actions.creating") : t("common.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">{t("integrations.loadingWebhooks")}</div>
            ) : webhooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("integrations.empty.title")}</h3>
                  <p className="text-muted-foreground text-center mb-4">{t("integrations.empty.description")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {webhooks.map((webhook) => (
                  <Card key={webhook.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle>{webhook.name}</CardTitle>
                            <Badge variant={webhook.isActive ? "default" : "secondary"}>
                              {webhook.isActive ? t("integrations.status.active") : t("integrations.status.inactive")}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <ExternalLink className="w-3 h-3" />
                            {webhook.url}
                          </CardDescription>
                          {webhook.campaign && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("integrations.webhook.campaign")}: {webhook.campaign.name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={webhook.isActive}
                            onCheckedChange={() => handleToggleActive(webhook)}
                            data-testid={`switch-webhook-active-${webhook.id}`}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md flex-1 min-w-0">
                          <code className="text-xs truncate flex-1">
                            {t("integrations.webhook.secret")}: {webhook.secret.substring(0, 20)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(webhook.secret)}
                            data-testid={`button-copy-secret-${webhook.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                          disabled={testWebhookMutation.isPending}
                          data-testid={`button-test-webhook-${webhook.id}`}
                        >
                          {t("integrations.actions.testWebhook")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedWebhookId(webhook.id);
                            setIsDeliveryLogsOpen(true);
                          }}
                          data-testid={`button-view-logs-${webhook.id}`}
                        >
                          {t("integrations.actions.viewLogs")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWebhookToDelete(webhook.id)}
                          data-testid={`button-delete-webhook-${webhook.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Dialog open={isDeliveryLogsOpen} onOpenChange={setIsDeliveryLogsOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("integrations.dialog.logsTitle")}</DialogTitle>
                <DialogDescription>{t("integrations.dialog.logsDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {deliveryLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{t("integrations.logs.noLogs")}</div>
                ) : (
                  deliveryLogs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {log.status === "success" ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                            <span className="font-medium">
                              {log.status === "success" ? t("integrations.logs.success") : t("integrations.logs.failed")}
                            </span>
                            {log.responseCode && (
                              <Badge variant="outline">
                                {t("integrations.logs.http")} {log.responseCode}
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              {t("integrations.logs.attempt")} {log.attemptCount}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        {log.errorMessage && <p className="text-sm text-red-600 mt-2">{log.errorMessage}</p>}
                        {log.responseBody && (
                          <details className="mt-2">
                            <summary className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                              {t("integrations.logs.viewResponse")}
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">{log.responseBody}</pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!webhookToDelete} onOpenChange={() => setWebhookToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("integrations.dialog.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("integrations.dialog.deleteDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => webhookToDelete && deleteWebhookMutation.mutate(webhookToDelete)}
                  data-testid="button-confirm-delete"
                >
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
