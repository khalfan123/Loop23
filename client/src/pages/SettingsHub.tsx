import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Settings, Workflow, BarChart3, Webhook, Globe, TrendingUp, CreditCard, ChevronRight, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";

const settingsItems = [
  {
    title: "Account Settings",
    description: "Manage your profile, KYC documents, notifications, and account",
    url: "/app/settings/account",
    icon: UserCog,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    title: "Flow Builder",
    description: "Create and manage automated call flows",
    url: "/app/flows",
    icon: Workflow,
    iconColor: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  {
    title: "Flow Execution Logs",
    description: "View execution history and debug flows",
    url: "/app/flows/execution",
    icon: BarChart3,
    iconColor: "text-slate-500",
    bgColor: "bg-slate-50 dark:bg-slate-950/30",
  },
  {
    title: "Webhooks",
    description: "Configure webhook endpoints for integrations",
    url: "/app/flows/webhooks",
    icon: Webhook,
    iconColor: "text-violet-500",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    title: "Website Widgets",
    description: "Embed call widgets on your website",
    url: "/app/tools/widgets",
    icon: Globe,
    iconColor: "text-sky-500",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
  },
  {
    title: "Upgrade Plan",
    description: "View and upgrade your subscription plan",
    url: "/app/upgrade",
    icon: TrendingUp,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    title: "Billing & Credits",
    description: "Manage billing, invoices, and credits",
    url: "/app/billing",
    icon: CreditCard,
    iconColor: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
];

export default function SettingsHub() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/40 dark:via-gray-950/30 dark:to-zinc-950/40 border p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('nav.settings', 'Settings')}</h1>
            <p className="text-muted-foreground">
              Manage your workflows, integrations, and billing
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => (
          <Link key={item.url} href={item.url}>
            <Card 
              className="hover-elevate cursor-pointer transition-all duration-200 h-full group"
              data-testid={`settings-card-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
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
          </Link>
        ))}
      </div>
    </div>
  );
}
