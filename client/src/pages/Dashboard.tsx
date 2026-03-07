/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Users,
  Loader2,
  Megaphone,
  Bot,
  Workflow,
  Target,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Calendar,
  FileText,
  BookOpen,
  Webhook,
  Search,
  Sparkles,
  MessageSquare,
  ClipboardCheck,
  DollarSign,
  HeadphonesIcon,
  Bell,
  Send,
  Zap,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { useState } from "react";
import { CreateCampaignDialog } from "@/components/CreateCampaignDialog";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { AuthStorage } from "@/lib/auth-storage";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CallTypeStat {
  count: number;
  trend: number;
  successRate: number;
  avgDuration: number;
}

interface CampaignStat {
  count: number;
  active: number;
  completed: number;
  successRate: number;
  avgDuration: number;
  totalCalls: number;
}

interface DashboardData {
  callTypeStats: {
    incoming: CallTypeStat;
    outgoing: CallTypeStat;
    campaign: CampaignStat;
  };
  weeklyCallsChart: Array<{ date: string; incoming: number; outgoing: number }>;
  leadDistribution: {
    hot: number;
    warm: number;
    cold: number;
    lost: number;
  };
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recentCalls: Array<{
    id: string;
    phoneNumber: string | null;
    status: string;
    duration: number | null;
    classification: string | null;
    callDirection: string | null;
    createdAt: string;
    callType: string;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    createdAt: string | null;
  }>;
  userName: string;
  totalCalls: number;
  totalThisWeek: number;
  totalPrevWeek: number;
  weeklyTrend: number;
  appointmentsBooked: number;
  formsSubmitted: number;
  formsCount: number;
  knowledgeBaseCount: number;
  webhooksCount: number;
  templatesCount: number;
}

const agentTemplates = [
  {
    id: "appointment",
    title: "Appointment Reminder",
    description: "Confirm appointments and send reminders automatically",
    icon: Calendar,
    category: "reminders",
    color: "from-pink-500 to-rose-500",
    iconBg: "bg-pink-500/[0.1] dark:bg-pink-500/[0.15]",
    iconColor: "text-pink-500"
  },
  {
    id: "lead-qualifier",
    title: "Lead Qualifier",
    description: "Pre-screen inbound leads with qualifying questions",
    icon: Target,
    category: "sales",
    color: "from-blue-500 to-indigo-500",
    iconBg: "bg-blue-500/[0.1] dark:bg-blue-500/[0.15]",
    iconColor: "text-blue-500"
  },
  {
    id: "survey",
    title: "Survey Collector",
    description: "Gather customer feedback with automated surveys",
    icon: ClipboardCheck,
    category: "surveys",
    color: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-500/[0.1] dark:bg-emerald-500/[0.15]",
    iconColor: "text-emerald-500"
  },
  {
    id: "payment",
    title: "Payment Reminder",
    description: "Collect overdue payments with friendly reminders",
    icon: DollarSign,
    category: "reminders",
    color: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-500/[0.1] dark:bg-amber-500/[0.15]",
    iconColor: "text-amber-500"
  },
  {
    id: "support",
    title: "Customer Support",
    description: "Handle common support queries automatically",
    icon: HeadphonesIcon,
    category: "support",
    color: "from-violet-500 to-purple-500",
    iconBg: "bg-violet-500/[0.1] dark:bg-violet-500/[0.15]",
    iconColor: "text-violet-500"
  },
  {
    id: "notification",
    title: "Event Notification",
    description: "Send automated event updates and alerts",
    icon: Bell,
    category: "reminders",
    color: "from-cyan-500 to-sky-500",
    iconBg: "bg-cyan-500/[0.1] dark:bg-cyan-500/[0.15]",
    iconColor: "text-cyan-500"
  }
];

const categories = [
  { id: "all", label: "All Templates" },
  { id: "sales", label: "Sales" },
  { id: "support", label: "Support" },
  { id: "reminders", label: "Reminders" },
  { id: "surveys", label: "Surveys" },
  { id: "custom", label: "Custom" }
];

export default function Dashboard() {
  const { t } = useTranslation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [quickCreateInput, setQuickCreateInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const response = await fetch("/api/dashboard", {
        credentials: 'include',
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    }
  });

  const { data: contacts = [] } = useQuery<Array<{ source: 'campaign' | 'call'; callCount: number }>>({
    queryKey: ["/api/contacts/deduplicated"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const response = await fetch("/api/contacts/deduplicated", {
        credentials: 'include',
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    }
  });

  const contactsCount = contacts.length;

  const weeklyChartData = (dashboard?.weeklyCallsChart || []).map(day => ({
    name: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    Incoming: day.incoming,
    Outgoing: day.outgoing,
    Total: day.incoming + day.outgoing
  }));

  const filteredTemplates = selectedCategory === "all" 
    ? agentTemplates 
    : agentTemplates.filter(t => t.category === selectedCategory);

  const handleQuickCreate = () => {
    if (quickCreateInput.trim()) {
      setLocation('/app/agents');
    }
  };

  const handleTemplateClick = (templateId: string) => {
    setLocation('/app/agents');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TrendBadge = ({ trend }: { trend: number }) => {
    if (trend === 0) return <span className="text-muted-foreground/60 text-xs ml-1">--</span>;
    const isPositive = trend > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ml-2 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(trend)}%
      </span>
    );
  };

  const userName = dashboard?.userName || 'User';

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t('dashboard.quickActions', 'QUICK ACTIONS')}>
        <SubPanelItem
          icon={<Megaphone className="w-4 h-4" />}
          label={t('dashboard.newCampaign', 'New Campaign')}
          onClick={() => setCreateDialogOpen(true)}
        />
        <SubPanelItem
          icon={<Bot className="w-4 h-4" />}
          label={t('dashboard.createAgent', 'Create Agent')}
          onClick={() => setLocation('/app/agents')}
        />
        <SubPanelItem
          icon={<Phone className="w-4 h-4" />}
          label={t('dashboard.viewCalls', 'View Calls')}
          onClick={() => setLocation('/app/calls')}
        />
      </SubPanelSection>
      
      <SubPanelSection title={t('dashboard.stats', 'STATS')}>
        <div className="px-2.5 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t('dashboard.totalCalls', 'Total Calls')}</span>
            <span className="font-medium">{dashboard?.totalCalls || 0}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t('dashboard.thisWeek', 'This Week')}</span>
            <span className="font-medium">{dashboard?.totalThisWeek || 0}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t('dashboard.appointments', 'Appointments')}</span>
            <span className="font-medium">{dashboard?.appointmentsBooked || 0}</span>
          </div>
        </div>
      </SubPanelSection>
    </div>
  );

  return (
    <ThreeColumnLayout 
      subPanel={subPanelContent} 
      subPanelWidth="sm"
      subPanelHeader={<span className="font-medium text-sm">{t('dashboard.navigation', 'Navigation')}</span>}
    >
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.06) 50%, rgba(236, 72, 153, 0.04) 100%)' }}>
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-400/10 to-indigo-500/8 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-purple-400/10 to-violet-500/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Welcome back, {userName}</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight" data-testid="text-hero-title">
              Automate your calls with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">AI agents</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Create custom voice agents to manage calls, qualify leads, and engage customers across your campaigns
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Describe a task for your AI agent..."
                  value={quickCreateInput}
                  onChange={(e) => setQuickCreateInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                  className="pl-10 bg-background/60 backdrop-blur-sm"
                  data-testid="input-quick-create"
                />
              </div>
              <Button 
                size="lg" 
                onClick={handleQuickCreate}
                data-testid="button-create-agent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="rounded-full"
              data-testid={`tab-category-${category.id}`}
            >
              {category.label}
            </Button>
          ))}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4 tracking-tight" data-testid="text-templates-heading">Pre-built Agent Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card 
                key={template.id}
                className="group cursor-pointer hover-elevate"
                onClick={() => handleTemplateClick(template.id)}
                data-testid={`card-template-${template.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-2xl ${template.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <template.icon className={`h-5 w-5 ${template.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1 tracking-tight">
                        {template.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ visibility: 'hidden' }} data-testid={`button-use-template-${template.id}`}>
                      <Send className="h-4 w-4 mr-1" />
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4 tracking-tight" data-testid="text-stats-heading">Your Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-total-calls">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Calls</p>
                    <div className="flex items-baseline">
                      <span className="text-xl font-bold tracking-tight">{dashboard?.totalCalls || 0}</span>
                      <TrendBadge trend={dashboard?.weeklyTrend || 0} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-incoming-calls">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <PhoneIncoming className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Incoming</p>
                    <div className="flex items-baseline">
                      <span className="text-xl font-bold tracking-tight">{dashboard?.callTypeStats?.incoming?.count || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-outgoing-calls">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <PhoneOutgoing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outgoing</p>
                    <div className="flex items-baseline">
                      <span className="text-xl font-bold tracking-tight">{dashboard?.callTypeStats?.outgoing?.count || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/contacts')} data-testid="stat-contacts">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contacts</p>
                    <span className="text-xl font-bold tracking-tight">{contactsCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/campaigns')} data-testid="stat-campaigns">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Campaigns</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold tracking-tight">{dashboard?.callTypeStats?.campaign?.count || 0}</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">{dashboard?.callTypeStats?.campaign?.active || 0} active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover-elevate" onClick={() => setLocation('/app/agents')} data-testid="stat-agents">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AI Agents</p>
                    <span className="text-xl font-bold tracking-tight">{dashboard?.templatesCount || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1" data-testid="card-quick-actions">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setCreateDialogOpen(true)}
                data-testid="action-create-campaign"
              >
                <Megaphone className="h-4 w-4 mr-3 text-orange-500" />
                Create Campaign
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/app/agents')}
                data-testid="action-create-agent"
              >
                <Bot className="h-4 w-4 mr-3 text-blue-500" />
                Create AI Agent
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/app/flows/new')}
                data-testid="action-build-flow"
              >
                <Workflow className="h-4 w-4 mr-3 text-indigo-500" />
                Build Flow
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/app/knowledge-base')}
                data-testid="action-knowledge-base"
              >
                <BookOpen className="h-4 w-4 mr-3 text-violet-500" />
                Add Knowledge
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2" data-testid="card-weekly-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </div>
                Weekly Call Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyChartData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--glass-bg-heavy)', 
                          backdropFilter: 'blur(20px) saturate(180%)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '16px',
                          fontSize: '12px',
                          boxShadow: 'var(--glass-shadow-lg)'
                        }} 
                      />
                      <Area 
                        type="natural" 
                        dataKey="Incoming" 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorIncoming)" 
                        strokeWidth={2}
                      />
                      <Area 
                        type="natural" 
                        dataKey="Outgoing" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorOutgoing)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No call data yet</p>
                    <p className="text-xs mt-1">Start a campaign to see activity</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/appointments')} data-testid="feature-appointments">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-500/10 dark:bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Appointments</p>
                  <span className="text-2xl font-bold tracking-tight">{dashboard?.appointmentsBooked || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/forms')} data-testid="feature-forms">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Forms Submitted</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight">{dashboard?.formsSubmitted || 0}</span>
                    <span className="text-xs text-muted-foreground">({dashboard?.formsCount || 0} forms)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/knowledge-base')} data-testid="feature-knowledge">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Knowledge Base</p>
                  <span className="text-2xl font-bold tracking-tight">{dashboard?.knowledgeBaseCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/webhooks')} data-testid="feature-webhooks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Webhook className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Webhooks</p>
                  <span className="text-2xl font-bold tracking-tight">{dashboard?.webhooksCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <CreateCampaignDialog 
          open={createDialogOpen} 
          onOpenChange={setCreateDialogOpen} 
        />
        </div>
    </ThreeColumnLayout>
  );
}
