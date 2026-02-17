import { Switch, Route, useLocation, Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Workflow, BarChart3, Globe, TrendingUp, CreditCard, ChevronRight, UserCog } from "lucide-react";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import Settings from "@/pages/Settings";
import FlowsPage from "@/pages/FlowsPage";
import FlowBuilderPage from "@/pages/FlowBuilderPage";
import FlowExecutionLogsPage from "@/pages/FlowExecutionLogsPage";
import WebhookConfigPage from "@/pages/WebhookConfigPage";
import FormsPage from "@/pages/FormsPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import WidgetsPage from "@/pages/WidgetsPage";
import Upgrade from "@/pages/Upgrade";
import Billing from "@/pages/Billing";

const settingsItems = [
  {
    id: "account",
    title: "Account Settings",
    description: "Manage your profile, KYC documents, notifications, and account",
    url: "/app/settings/account",
    icon: UserCog,
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
    id: "upgrade",
    title: "Upgrade Plan",
    description: "View and upgrade your subscription plan",
    url: "/app/settings/upgrade",
    icon: TrendingUp,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "billing",
    title: "Billing & Credits",
    description: "Manage billing, invoices, and credits",
    url: "/app/settings/billing",
    icon: CreditCard,
    iconColor: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
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
    </div>
  );
}

export default function SettingsHub() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();

  const isItemActive = (url: string) => {
    if (url === "/app/settings/account") {
      return location === "/app/settings/account";
    }
    return location === url || location.startsWith(url + "/");
  };

  const subPanelContent = (
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

  return (
    <ThreeColumnLayout
      subPanel={subPanelContent}
      subPanelWidth="sm"
      subPanelHeader={
        <span className="font-medium text-sm flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" />
          {t('nav.settings', 'Settings')}
        </span>
      }
    >
      <Switch>
        <Route path="/app/settings/account" component={Settings} />
        <Route path="/app/settings/flows/new" component={FlowBuilderPage} />
        <Route path="/app/settings/flows/forms" component={FormsPage} />
        <Route path="/app/settings/flows/appointments" component={AppointmentsPage} />
        <Route path="/app/settings/flows/:id" component={FlowBuilderPage} />
        <Route path="/app/settings/flows" component={FlowsPage} />
        <Route path="/app/settings/execution" component={FlowExecutionLogsPage} />
        <Route path="/app/settings/webhooks" component={WebhookConfigPage} />
        <Route path="/app/settings/widgets" component={WidgetsPage} />
        <Route path="/app/settings/upgrade" component={Upgrade} />
        <Route path="/app/settings/billing" component={Billing} />
        <Route path="/app/settings">
          <SettingsOverview onNavigate={setLocation} />
        </Route>
      </Switch>
    </ThreeColumnLayout>
  );
}
