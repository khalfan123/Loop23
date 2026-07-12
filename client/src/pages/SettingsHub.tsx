import { Switch, Route, useLocation, Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Workflow, BarChart3, Globe, CreditCard, ChevronRight, UserCog as UserCogIcon, LifeBuoy, Key, LayoutGrid, Sparkles, KeyRound } from "lucide-react";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { BUILD_VERSION_FULL } from "@/lib/build-version";
import Settings from "@/pages/Settings";
import FlowsPage from "@/pages/FlowsPage";
import FlowBuilderPage from "@/pages/FlowBuilderPage";
import FlowExecutionLogsPage from "@/pages/FlowExecutionLogsPage";
import AutomationHub from "@/pages/automation/AutomationHub";
import FormsPage from "@/pages/FormsPage";
import WidgetsPage from "@/pages/WidgetsPage";
import PlanBillingPage from "@/pages/PlanBillingPage";
import SupportTicketsPage from "@/pages/SupportTicketsPage";
import { useQuery } from "@tanstack/react-query";

type WebhookNavItem = { id: string; name: string; isActive?: boolean };

const settingsItems = [
  {
    id: "account",
    title: "Account Settings",
    description: "Manage your profile, KYC documents, notifications, and account",
    url: "/app/settings/account",
    icon: UserCogIcon,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "flows",
    title: "Flow Builder",
    description: "Create and manage automated call flows",
    url: "/app/settings/flows",
    icon: Workflow,
    iconColor: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  {
    id: "execution",
    title: "Flow Execution Logs",
    description: "View execution history and debug flows",
    url: "/app/settings/execution",
    icon: BarChart3,
    iconColor: "text-slate-500",
    bgColor: "bg-slate-50 dark:bg-slate-950/30",
  },
  {
    id: "widgets",
    title: "Website Widgets",
    description: "Embed call widgets on your website",
    url: "/app/settings/widgets",
    icon: Globe,
    iconColor: "text-sky-500",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
  },
  {
    id: "billing",
    title: "Plan & Billing",
    description: "Manage your plan, credits, and billing",
    url: "/app/settings/billing",
    icon: CreditCard,
    iconColor: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    id: "support",
    title: "Support Tickets",
    description: "Create and track support requests",
    url: "/app/settings/support",
    icon: LifeBuoy,
    iconColor: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
  },
];

function SettingsOverview({ onNavigate }: { onNavigate: (url: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t('nav.settings', 'Settings')}</h1>
        <p className="text-muted-foreground">
          Manage your workflows, integrations, and billing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsItems.map((item) => (
          <Card
            key={item.id}
            className="hover-elevate cursor-pointer transition-all duration-200 h-full group"
            onClick={() => onNavigate(item.url)}
            data-testid={`settings-card-${item.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg ${item.bgColor}`}>
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4 text-center">
        <span className="text-xs text-muted-foreground/50" data-testid="text-settings-build-version">{BUILD_VERSION_FULL}</span>
      </div>
    </div>
  );
}

export default function SettingsHub() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const isWebhooksPage =
    location === "/app/settings/automation" ||
    location.startsWith("/app/settings/automation/") ||
    location === "/app/settings/webhooks" ||
    location.startsWith("/app/settings/webhooks/");

  const isItemActive = (url: string) => {
    if (url === "/app/settings/account") {
      return location === "/app/settings/account";
    }
    return location === url || location.startsWith(url + "/");
  };

  const { data: webhooks = [] } = useQuery<WebhookNavItem[]>({
    queryKey: ["/api/webhooks"],
    enabled: isWebhooksPage,
  });

  const subPanelContent = isWebhooksPage ? (
    <>
      <SubPanelSection title={t('automation.subnav.sections', 'Sections')}>
        <SubPanelItem
          icon={<LayoutGrid className="w-4 h-4" />}
          label={t('automation.tabs.marketplace', 'Marketplace')}
          isActive={location.startsWith('/app/settings/automation/marketplace')}
          onClick={() => setLocation('/app/settings/automation/marketplace')}
          data-testid="nav-automation-marketplace"
        />
        <SubPanelItem
          icon={<Sparkles className="w-4 h-4" />}
          label={t('automation.tabs.starterPack', 'Starter pack')}
          isActive={location.startsWith('/app/settings/automation/starter')}
          onClick={() => setLocation('/app/settings/automation/starter')}
          data-testid="nav-automation-starter"
        />
        <SubPanelItem
          icon={<Workflow className="w-4 h-4" />}
          label={t('automation.tabs.mine', 'My Automations')}
          isActive={location.startsWith('/app/settings/automation/mine')}
          onClick={() => setLocation('/app/settings/automation/mine')}
          badge={webhooks.length > 0 ? webhooks.length : undefined}
          data-testid="nav-automation-mine"
        />
        <SubPanelItem
          icon={<KeyRound className="w-4 h-4" />}
          label={t('automation.tabs.api', 'API & Webhooks')}
          isActive={location.startsWith('/app/settings/automation/api')}
          onClick={() => setLocation('/app/settings/automation/api')}
          data-testid="nav-automation-api"
        />
      </SubPanelSection>
      {webhooks.length > 0 && location.startsWith('/app/settings/automation/mine') && (
        <SubPanelSection title={t('automation.subnav.yours', 'Your automations')}>
          {webhooks.map((w) => (
            <SubPanelItem
              key={w.id}
              icon={<Workflow className="w-4 h-4" />}
              label={w.name}
              isActive={false}
              onClick={() => setLocation('/app/settings/automation/mine')}
              data-testid={`webhook-nav-${w.id}`}
            />
          ))}
        </SubPanelSection>
      )}
    </>
  ) : (
    <SubPanelSection>
      {settingsItems.map((item) => (
        <SubPanelItem
          key={item.id}
          icon={<item.icon className="w-4 h-4" />}
          label={item.title}
          isActive={isItemActive(item.url)}
          onClick={() => setLocation(item.url)}
          data-testid={`settings-nav-${item.id}`}
        />
      ))}
    </SubPanelSection>
  );

  const subPanelHeader = isWebhooksPage ? (
    <span className="font-medium text-sm flex items-center gap-2">
      <Workflow className="h-4 w-4 text-primary" />
      {t("webhooks.flowBuilder.pageTitle", "Automation")}
    </span>
  ) : (
    <span className="font-medium text-sm flex items-center gap-2">
      <SettingsIcon className="h-4 w-4 text-primary" />
      {t('nav.settings', 'Settings')}
    </span>
  );

  return (
    <ThreeColumnLayout
      subPanel={subPanelContent}
      subPanelWidth="sm"
      subPanelHeader={subPanelHeader}
    >
      <Switch>
        <Route path="/app/settings/account" component={Settings} />
        <Route path="/app/settings/flows/new" component={FlowBuilderPage} />
        <Route path="/app/settings/flows/forms" component={FormsPage} />
        <Route path="/app/settings/flows/appointments">
          <Redirect to="/app/ops" />
        </Route>
        <Route path="/app/settings/flows/:id" component={FlowBuilderPage} />
        <Route path="/app/settings/flows" component={FlowsPage} />
        <Route path="/app/settings/execution" component={FlowExecutionLogsPage} />
        <Route path="/app/settings/automation/*" component={AutomationHub} />
        <Route path="/app/settings/automation" component={AutomationHub} />
        <Route path="/app/settings/webhooks">
          <Redirect to="/app/settings/automation" />
        </Route>
        <Route path="/app/settings/widgets" component={WidgetsPage} />
        <Route path="/app/settings/upgrade">
          <Redirect to="/app/settings/billing" />
        </Route>
        <Route path="/app/settings/billing" component={PlanBillingPage} />
        <Route path="/app/settings/support" component={SupportTicketsPage} />
        <Route path="/app/settings">
          <SettingsOverview onNavigate={setLocation} />
        </Route>
      </Switch>
    </ThreeColumnLayout>
  );
}
