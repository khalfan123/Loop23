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
    bgColor: "from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30"
  },
  {
    id: "lead-qualifier",
    title: "Lead Qualifier",
    description: "Pre-screen inbound leads with qualifying questions",
    icon: Target,
    category: "sales",
    color: "from-blue-500 to-indigo-500",
    bgColor: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30"
  },
  {
    id: "survey",
    title: "Survey Collector",
    description: "Gather customer feedback with automated surveys",
    icon: ClipboardCheck,
    category: "surveys",
    color: "from-emerald-500 to-teal-500",
    bgColor: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
  },
  {
    id: "payment",
    title: "Payment Reminder",
    description: "Collect overdue payments with friendly reminders",
    icon: DollarSign,
    category: "reminders",
    color: "from-amber-500 to-orange-500",
    bgColor: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
  },
  {
    id: "support",
    title: "Customer Support",
    description: "Handle common support queries automatically",
    icon: HeadphonesIcon,
    category: "support",
    color: "from-violet-500 to-purple-500",
    bgColor: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"
  },
  {
    id: "notification",
    title: "Event Notification",
    description: "Send automated event updates and alerts",
    icon: Bell,
    category: "reminders",
    color: "from-cyan-500 to-sky-500",
    bgColor: "from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30"
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
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ml-2 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(trend)}%
      </span>
    );
  };

  const userName = dashboard?.userName || 'User';

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-950/50 dark:via-purple-950/30 dark:to-fuchsia-950/50 p-8 md:p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-300/30 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-fuchsia-300/30 to-pink-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Welcome back, {userName}</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3" data-testid="text-hero-title">
            Automate your calls with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400">AI agents</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Create custom voice agents to manage calls, qualify leads, and engage customers across your campaigns
          </p>
          
          {/* Quick Create Input */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Describe a task for your AI agent..."
                value={quickCreateInput}
                onChange={(e) => setQuickCreateInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                className="pl-10 bg-background/80 backdrop-blur-sm border-violet-200 dark:border-violet-800 focus:border-violet-400"
                data-testid="input-quick-create"
              />
            </div>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25"
              onClick={handleQuickCreate}
              data-testid="button-create-agent"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
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

      {/* Agent Template Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4" data-testid="text-templates-heading">Pre-built Agent Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id}
              className={`group cursor-pointer hover-elevate border-0 bg-gradient-to-br ${template.bgColor}`}
              onClick={() => handleTemplateClick(template.id)}
              data-testid={`card-template-${template.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <template.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                      {template.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-use-template-${template.id}`}>
                    <Send className="h-4 w-4 mr-1" />
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Overview Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4" data-testid="text-stats-heading">Your Activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Total Calls */}
          <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30 border-cyan-100 dark:border-cyan-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-total-calls">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                  <div className="flex items-baseline">
                    <span className="text-xl font-bold">{dashboard?.totalCalls || 0}</span>
                    <TrendBadge trend={dashboard?.weeklyTrend || 0} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Incoming */}
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-100 dark:border-emerald-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-incoming-calls">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <PhoneIncoming className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Incoming</p>
                  <div className="flex items-baseline">
                    <span className="text-xl font-bold">{dashboard?.callTypeStats?.incoming?.count || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outgoing */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-100 dark:border-blue-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/calls')} data-testid="stat-outgoing-calls">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <PhoneOutgoing className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outgoing</p>
                  <div className="flex items-baseline">
                    <span className="text-xl font-bold">{dashboard?.callTypeStats?.outgoing?.count || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-100 dark:border-teal-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/contacts')} data-testid="stat-contacts">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contacts</p>
                  <span className="text-xl font-bold">{contactsCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns */}
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-100 dark:border-violet-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/campaigns')} data-testid="stat-campaigns">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Campaigns</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{dashboard?.callTypeStats?.campaign?.count || 0}</span>
                    <span className="text-xs text-emerald-600">{dashboard?.callTypeStats?.campaign?.active || 0} active</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agents */}
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-100 dark:border-orange-900/50 cursor-pointer hover-elevate" onClick={() => setLocation('/app/agents')} data-testid="stat-agents">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI Agents</p>
                  <span className="text-xl font-bold">{dashboard?.templatesCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions and Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1" data-testid="card-quick-actions">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
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

        {/* Weekly Activity Chart */}
        <Card className="lg:col-span-2" data-testid="card-weekly-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
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
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
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
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Incoming" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorIncoming)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
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

      {/* Feature Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/appointments')} data-testid="feature-appointments">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Appointments</p>
                <span className="text-2xl font-bold">{dashboard?.appointmentsBooked || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/forms')} data-testid="feature-forms">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Forms Submitted</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{dashboard?.formsSubmitted || 0}</span>
                  <span className="text-xs text-muted-foreground">({dashboard?.formsCount || 0} forms)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/knowledge-base')} data-testid="feature-knowledge">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Knowledge Base</p>
                <span className="text-2xl font-bold">{dashboard?.knowledgeBaseCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/app/flows/webhooks')} data-testid="feature-webhooks">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Webhooks</p>
                <span className="text-2xl font-bold">{dashboard?.webhooksCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </div>
  );
}
