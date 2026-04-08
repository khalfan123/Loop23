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
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Phone, Users, TrendingUp, Clock, Loader2, PhoneIncoming, PhoneOutgoing, Target, BarChart3, Radio, PhoneCall, ChevronDown, Sparkles } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { AuthStorage } from "@/lib/auth-storage";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import LiveMonitoring from "@/pages/LiveMonitoring";
import Calls from "@/pages/Calls";

import { HeatmapChart } from "@/components/analytics/HeatmapChart";
import { FunnelChart } from "@/components/analytics/FunnelChart";
import { GaugeChart } from "@/components/analytics/GaugeChart";
import { TreemapChart } from "@/components/analytics/TreemapChart";
import { PeriodComparisonCard } from "@/components/analytics/PeriodComparisonCard";
import { AnalyticsDataTable, type CallRow } from "@/components/analytics/AnalyticsDataTable";
import { CampaignComparisonChart } from "@/components/analytics/CampaignComparisonChart";
import { StackedAreaChart } from "@/components/analytics/StackedAreaChart";

interface TypeBreakdown {
  incoming: number;
  outgoing: number;
  batch: number;
  campaigns: number;
  total: number;
}

interface AnalyticsData {
  totalCalls: number;
  successRate: number;
  qualifiedLeads: number;
  avgDuration: number;
  leadDistribution: Array<{ name: string; value: number }>;
  sentimentDistribution: Array<{ name: string; value: number }>;
  campaignPerformance: Array<{ name: string; value: number; totalCalls?: number; completedCalls?: number }>;
  dailyCalls: Array<{ date: string; count: number }>;
  typeBreakdown?: TypeBreakdown;
}

interface AdvancedAnalyticsData {
  heatmap: Array<{ hour: number; day: number; value: number }>;
  funnel: Array<{ stage: string; value: number; percentage: number }>;
  periodComparison: Array<{ metric: string; current: number; previous: number; delta: number; deltaPercent: number }>;
  campaignComparisons: Array<{
    campaignId: string;
    campaignName: string;
    totalCalls: number;
    completedCalls: number;
    successRate: number;
    avgDuration: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    dailyData: Array<{ date: string; count: number }>;
  }>;
  dailyTrendSeries: Array<{ date: string; completed: number; failed: number; qualified: number; total: number }>;
  trends: {
    totalCallsTrend: number;
    successRateTrend: number;
    qualifiedLeadsTrend: number;
    avgDurationTrend: number;
  };
}

const TIME_RANGE_LABELS: Record<string, { current: string; previous: string }> = {
  '7days': { current: 'Last 7 Days', previous: 'Prior 7 Days' },
  '30days': { current: 'Last 30 Days', previous: 'Prior 30 Days' },
  '90days': { current: 'Last 90 Days', previous: 'Prior 90 Days' },
  'year': { current: 'This Year', previous: 'Last Year' },
};

export default function Analytics() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState("7days");
  const callType = 'all';
  const [activeView, setActiveView] = useState<"analytics" | "call-history" | "live-monitoring">("analytics");
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [drillFilter, setDrillFilter] = useState<{ type: string; value: string } | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [trendsOpen, setTrendsOpen] = useState(true);
  const [distributionOpen, setDistributionOpen] = useState(true);
  const [campaignOpen, setCampaignOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange, callType],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;
      const response = await fetch(`/api/analytics?timeRange=${timeRange}&callType=${callType}`, {
        credentials: 'include', headers
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  const { data: advanced, isLoading: advancedLoading } = useQuery<AdvancedAnalyticsData>({
    queryKey: ['/api/analytics/advanced', timeRange],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;
      const response = await fetch(`/api/analytics/advanced?timeRange=${timeRange}`, {
        credentials: 'include', headers
      });
      if (!response.ok) throw new Error('Failed to fetch advanced analytics');
      return response.json();
    }
  });

  const { data: callsData } = useQuery<CallRow[]>({
    queryKey: ['/api/calls-for-table'],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;
      const response = await fetch('/api/calls', { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch calls');
      const result = await response.json();
      const rawCalls = Array.isArray(result) ? result : result.data || [];
      return rawCalls.map((c: Record<string, unknown>) => ({
        id: c.id,
        phone: (c.phoneNumber || c.fromNumber || c.toNumber || '') as string,
        status: c.status as string | undefined,
        duration: c.duration as number | undefined,
        classification: c.classification as string | undefined,
        sentiment: c.sentiment as string | undefined,
        callDirection: c.callDirection as string | undefined,
        date: c.createdAt ? new Date(c.createdAt as string).toLocaleDateString() : undefined,
        campaign: ((c as any).campaignName || (c as any).campaign?.name || undefined) as string | undefined,
      }));
    }
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest('POST', '/api/analytics/export-pdf', { timeRange, callType });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: t('analytics.toast.reportExported'), description: t('analytics.toast.reportExportedDesc') });
    } catch {
      toast({ title: t('analytics.toast.exportFailed'), description: t('analytics.toast.exportFailedDesc'), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const [analyzeProgress, setAnalyzeProgress] = useState('');

  const handleBatchAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalyzeProgress('Starting...');
    try {
      const response = await apiRequest('POST', '/api/calls/batch-analyze');
      const result = await response.json();

      if (result.status === 'complete' && result.total === 0) {
        toast({ title: 'No Calls to Analyze', description: 'All calls with transcripts already have analysis data.' });
        setIsAnalyzing(false);
        setAnalyzeProgress('');
        return;
      }

      toast({ title: 'AI Analysis Started', description: `Analyzing ${result.total} call(s) in background using Bedrock Claude...` });

      const pollStatus = async () => {
        const headers: Record<string, string> = {};
        const authHeader = AuthStorage.getAuthHeader();
        if (authHeader) headers['Authorization'] = authHeader;
        const statusRes = await fetch('/api/calls/batch-analyze/status', { credentials: 'include', headers });
        return statusRes.json();
      };

      const poll = setInterval(async () => {
        try {
          const status = await pollStatus();
          setAnalyzeProgress(`${status.analyzed}/${status.total} analyzed`);
          if (status.status !== 'running') {
            clearInterval(poll);
            setIsAnalyzing(false);
            setAnalyzeProgress('');
            if (status.analyzed > 0) {
              toast({ title: 'AI Analysis Complete', description: `Analyzed ${status.analyzed} call(s). Refreshing data...` });
              window.location.reload();
            } else {
              toast({ title: 'Analysis Done', description: `${status.failed} call(s) could not be analyzed.`, variant: 'destructive' });
            }
          }
        } catch {
          clearInterval(poll);
          setIsAnalyzing(false);
          setAnalyzeProgress('');
        }
      }, 3000);

    } catch {
      toast({ title: 'Analysis Failed', description: 'Could not start AI analysis. Please try again.', variant: 'destructive' });
      setIsAnalyzing(false);
      setAnalyzeProgress('');
    }
  };

  const {
    totalCalls = 0,
    successRate = 0,
    qualifiedLeads = 0,
    avgDuration = 0,
    leadDistribution = [],
    sentimentDistribution = [],
    campaignPerformance = [],
    dailyCalls = [],
    typeBreakdown = { incoming: 0, outgoing: 0, batch: 0, campaigns: 0, total: 0 }
  } = analytics || {};

  const trends = advanced?.trends;
  const trendSeries = advanced?.dailyTrendSeries || [];

  const sparklineTotals = trendSeries.map(d => d.total);
  const sparklineCompleted = trendSeries.map(d => d.completed);
  const sparklineQualified = trendSeries.map(d => d.qualified);
  const sparklineDuration = dailyCalls.map(d => d.count);

  const formattedDailyCalls = dailyCalls.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    value: d.count
  }));

  const getCallVolumeTitle = () => {
    if (timeRange === 'year') return t('analytics.monthlyCallVolume');
    if (timeRange === '30days' || timeRange === '90days') return t('analytics.weeklyCallVolume');
    return t('analytics.dailyCallVolume');
  };

  const handlePieClick = (type: string, data: { name: string; value: number }) => {
    if (data?.name) {
      setDrillFilter({ type, value: data.name.toLowerCase() });
      setActiveTab('calls');
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t('analytics.views', 'VIEWS')}>
        <SubPanelItem
          icon={<BarChart3 className="w-4 h-4" />}
          label={t('nav.analytics', 'Analytics')}
          isActive={activeView === "analytics"}
          onClick={() => setActiveView("analytics")}
          data-testid="nav-analytics-view"
        />
        <SubPanelItem
          icon={<PhoneCall className="w-4 h-4" />}
          label={t('nav.callHistory', 'Call History')}
          isActive={activeView === "call-history"}
          onClick={() => setActiveView("call-history")}
          data-testid="nav-call-history-view"
        />
        <SubPanelItem
          icon={<Radio className="w-4 h-4" />}
          label="Live Monitoring"
          isActive={activeView === "live-monitoring"}
          onClick={() => setActiveView("live-monitoring")}
          data-testid="nav-live-monitoring-view"
        />
      </SubPanelSection>

      {activeView === "analytics" && (
        <>
          <SubPanelSection title={t('analytics.metrics', 'METRICS')}>
            <div className="px-2.5 py-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('analytics.successRate')}</span>
                <span className="font-medium text-emerald-600">{successRate}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('analytics.avgDurationLabel')}</span>
                <span className="font-medium">{formatDuration(avgDuration)}</span>
              </div>
              {trends && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Call Trend</span>
                    <span className={`font-medium ${trends.totalCallsTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {trends.totalCallsTrend > 0 ? '+' : ''}{trends.totalCallsTrend.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </SubPanelSection>
        </>
      )}
    </div>
  );

  if (activeView === "call-history") {
    return (
      <ThreeColumnLayout subPanel={subPanelContent} subPanelWidth="sm" subPanelHeader={<span className="font-medium text-sm">{t('nav.dashboard', 'Dashboard')}</span>}>
        <Calls embedded />
      </ThreeColumnLayout>
    );
  }

  if (activeView === "live-monitoring") {
    return (
      <ThreeColumnLayout subPanel={subPanelContent} subPanelWidth="sm" subPanelHeader={<span className="font-medium text-sm">{t('nav.dashboard', 'Dashboard')}</span>}>
        <LiveMonitoring />
      </ThreeColumnLayout>
    );
  }

  if (isLoading) {
    return (
      <ThreeColumnLayout subPanel={subPanelContent} subPanelWidth="sm" subPanelHeader={<span className="font-medium text-sm">{t('nav.dashboard', 'Dashboard')}</span>}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ThreeColumnLayout>
    );
  }

  const SectionHeader = ({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) => (
    <CollapsibleTrigger asChild onClick={onToggle}>
      <button className="flex items-center gap-2 w-full text-left mb-4 group" data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
        <div className="flex-1 border-b border-border/30" />
      </button>
    </CollapsibleTrigger>
  );

  return (
    <ThreeColumnLayout subPanel={subPanelContent} subPanelWidth="sm" subPanelHeader={<span className="font-medium text-sm">{t('nav.dashboard', 'Dashboard')}</span>}>
      <div className="space-y-6" ref={reportRef}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl glass-card flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-analytics-title">
                {t('analytics.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('analytics.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 glass-surface rounded-2xl px-3 py-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px] rounded-xl border-border/40 bg-background/50" data-testid="select-time-range">
                <SelectValue placeholder={t('analytics.selectPeriod')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="7days">{t('analytics.timeRange.last7Days')}</SelectItem>
                <SelectItem value="30days">{t('analytics.timeRange.last30Days')}</SelectItem>
                <SelectItem value="90days">{t('analytics.timeRange.last90Days')}</SelectItem>
                <SelectItem value="year">{t('analytics.timeRange.thisYear')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleBatchAnalyze}
              disabled={isAnalyzing}
              data-testid="button-batch-analyze"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {isAnalyzing ? (analyzeProgress || 'Starting...') : 'AI Analyze Calls'}
            </Button>
            <Button
              variant="default"
              className="rounded-xl"
              onClick={handleExportPDF}
              disabled={isExporting}
              data-testid="button-export-report"
            >
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {t('analytics.exportReport')}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="glass-surface rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-lg" data-testid="tab-campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="calls" className="rounded-lg" data-testid="tab-calls">Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
              <SectionHeader title="Key Metrics" open={overviewOpen} onToggle={() => setOverviewOpen(!overviewOpen)} />
              <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <MetricCard
                    title={t('analytics.totalCalls')}
                    value={totalCalls.toLocaleString()}
                    icon={Phone}
                    trend={trends ? { value: Math.abs(trends.totalCallsTrend), direction: trends.totalCallsTrend >= 0 ? "up" : "down" } : undefined}
                    sparklineData={sparklineTotals}
                    testId="metric-total-calls"
                    gradientClassName="glass-card rounded-2xl"
                    iconClassName="text-cyan-500"
                  />
                  <MetricCard
                    title={t('analytics.successRate')}
                    value={`${successRate}%`}
                    icon={TrendingUp}
                    trend={trends ? { value: Math.abs(trends.successRateTrend), direction: trends.successRateTrend >= 0 ? "up" : "down" } : undefined}
                    sparklineData={sparklineCompleted}
                    testId="metric-success-rate"
                    gradientClassName="glass-card rounded-2xl"
                    iconClassName="text-emerald-500"
                  />
                  <MetricCard
                    title={t('analytics.qualifiedLeads')}
                    value={qualifiedLeads.toLocaleString()}
                    icon={Users}
                    trend={trends ? { value: Math.abs(trends.qualifiedLeadsTrend), direction: trends.qualifiedLeadsTrend >= 0 ? "up" : "down" } : undefined}
                    sparklineData={sparklineQualified}
                    testId="metric-qualified-leads"
                    gradientClassName="glass-card rounded-2xl"
                    iconClassName="text-blue-500"
                  />
                  <MetricCard
                    title={t('analytics.avgDurationLabel')}
                    value={formatDuration(avgDuration)}
                    icon={Clock}
                    trend={trends ? { value: Math.abs(trends.avgDurationTrend), direction: trends.avgDurationTrend >= 0 ? "up" : "down" } : undefined}
                    sparklineData={sparklineDuration}
                    subtitle={t('analytics.minutesPerCall')}
                    testId="metric-avg-duration"
                    gradientClassName="glass-card rounded-2xl"
                    iconClassName="text-violet-500"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <GaugeChart value={successRate} title="Success Rate" unit="%" />
                  <GaugeChart value={qualifiedLeads} maxValue={Math.max(totalCalls, 1)} title="Qualified Rate" unit={`/ ${totalCalls}`} thresholds={{ green: 30, yellow: 15 }} />
                  <GaugeChart value={typeBreakdown.incoming} maxValue={Math.max(typeBreakdown.total, 1)} title="Incoming %" unit={`/ ${typeBreakdown.total}`} thresholds={{ green: 40, yellow: 20 }} />
                  <GaugeChart value={typeBreakdown.batch} maxValue={Math.max(typeBreakdown.total, 1)} title="Campaign %" unit={`/ ${typeBreakdown.total}`} thresholds={{ green: 50, yellow: 25 }} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={trendsOpen} onOpenChange={setTrendsOpen}>
              <SectionHeader title="Trends & Activity" open={trendsOpen} onToggle={() => setTrendsOpen(!trendsOpen)} />
              <CollapsibleContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <AnalyticsChart
                    title={getCallVolumeTitle()}
                    type="bar"
                    data={formattedDailyCalls.length > 0 ? formattedDailyCalls : [{ name: t('analytics.noData'), value: 0 }]}
                    testId="chart-calls-this-week"
                    gradientClassName="glass-card rounded-2xl"
                  />
                  {advanced && <HeatmapChart data={advanced.heatmap} />}
                </div>
                {advanced && (
                  <PeriodComparisonCard
                    data={advanced.periodComparison}
                    currentLabel={TIME_RANGE_LABELS[timeRange]?.current || 'Current'}
                    previousLabel={TIME_RANGE_LABELS[timeRange]?.previous || 'Previous'}
                  />
                )}
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={distributionOpen} onOpenChange={setDistributionOpen}>
              <SectionHeader title="Distribution & Pipeline" open={distributionOpen} onToggle={() => setDistributionOpen(!distributionOpen)} />
              <CollapsibleContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <AnalyticsChart
                    title={t('analytics.leadDistribution')}
                    type="pie"
                    data={leadDistribution.length > 0 ? leadDistribution : [{ name: t('analytics.noData'), value: 1 }]}
                    testId="chart-lead-distribution"
                    gradientClassName="glass-card rounded-2xl"
                    onSegmentClick={(data) => handlePieClick('classification', data)}
                  />
                  <AnalyticsChart
                    title={t('analytics.sentimentAnalysis')}
                    type="pie"
                    data={sentimentDistribution.length > 0 ? sentimentDistribution : [{ name: t('analytics.noData'), value: 1 }]}
                    testId="chart-sentiment-analysis"
                    gradientClassName="glass-card rounded-2xl"
                    onSegmentClick={(data) => handlePieClick('sentiment', data)}
                  />
                </div>
                {advanced && <FunnelChart data={advanced.funnel} />}
              </CollapsibleContent>
            </Collapsible>

            {typeBreakdown.total > 0 && (
              <div className="glass-card rounded-2xl p-6" data-testid="card-call-breakdown">
                <h3 className="text-base font-semibold text-foreground mb-5">{t('analytics.callTypeBreakdown')}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl glass-surface">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mb-1">{t('analytics.callTypes.incoming')}</p>
                    <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-incoming">{typeBreakdown.incoming}</p>
                  </div>
                  <div className="p-4 rounded-2xl glass-surface">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                      </div>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mb-1">{t('analytics.callTypes.outgoing')}</p>
                    <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-outgoing">{typeBreakdown.outgoing}</p>
                  </div>
                  <div className="p-4 rounded-2xl glass-surface">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <Target className="h-4 w-4 text-violet-500" />
                      </div>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mb-1">{t('analytics.callTypes.campaigns')}</p>
                    <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-campaigns">{typeBreakdown.batch}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4 mt-4">
            <Collapsible open={campaignOpen} onOpenChange={setCampaignOpen}>
              <SectionHeader title="Campaign Performance" open={campaignOpen} onToggle={() => setCampaignOpen(!campaignOpen)} />
              <CollapsibleContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <AnalyticsChart
                    title={t('analytics.campaignSuccessRate')}
                    type="bar"
                    data={campaignPerformance.length > 0 ? campaignPerformance : [{ name: t('analytics.noCampaigns'), value: 0 }]}
                    xAxisKey="name"
                    dataKey="value"
                    testId="chart-campaign-success"
                    gradientClassName="glass-card rounded-2xl"
                  />
                  <TreemapChart
                    data={campaignPerformance.map(c => ({ name: c.name, value: c.totalCalls || c.value }))}
                    onItemClick={(name) => {
                      setDrillFilter({ type: 'campaign', value: name });
                      setActiveTab('calls');
                    }}
                  />
                </div>
                {advanced && advanced.campaignComparisons.length > 0 && (
                  <CampaignComparisonChart
                    campaigns={advanced.campaignComparisons}
                    selectedIds={selectedCampaignIds}
                    onToggle={toggleCampaign}
                  />
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-4">
            <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
              <SectionHeader title="Trend Reports" open={reportsOpen} onToggle={() => setReportsOpen(!reportsOpen)} />
              <CollapsibleContent>
                <div className="grid grid-cols-1 gap-4">
                  <StackedAreaChart
                    title="Call Outcomes Over Time"
                    data={trendSeries.map(d => ({
                      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      Completed: d.completed,
                      Failed: d.failed,
                      Qualified: d.qualified,
                    }))}
                    series={[
                      { key: 'Completed', label: 'Completed', color: 'hsl(var(--chart-1))' },
                      { key: 'Failed', label: 'Failed', color: 'hsl(var(--chart-3))' },
                      { key: 'Qualified', label: 'Qualified', color: 'hsl(var(--chart-2))' },
                    ]}
                  />
                  {advanced && <FunnelChart data={advanced.funnel} />}
                  {advanced && (
                    <PeriodComparisonCard
                      data={advanced.periodComparison}
                      currentLabel={TIME_RANGE_LABELS[timeRange]?.current || 'Current'}
                      previousLabel={TIME_RANGE_LABELS[timeRange]?.previous || 'Previous'}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="calls" className="mt-4">
            <AnalyticsDataTable
              data={callsData || []}
              activeFilter={drillFilter}
              onClearFilter={() => setDrillFilter(null)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ThreeColumnLayout>
  );
}
