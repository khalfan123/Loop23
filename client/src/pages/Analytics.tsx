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
import { Download, Phone, Users, TrendingUp, Clock, Loader2, PhoneIncoming, PhoneOutgoing, Target, BarChart3 } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { AuthStorage } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";

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
  campaignPerformance: Array<{ name: string; value: number }>;
  dailyCalls: Array<{ date: string; count: number }>;
  typeBreakdown?: TypeBreakdown;
}

export default function Analytics() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState("7days");
  const [callType, setCallType] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const currentUser = AuthStorage.getUser();
  const isAdmin = currentUser?.role === 'admin';

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange, callType],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const response = await fetch(`/api/analytics?timeRange=${timeRange}&callType=${callType}`, {
        credentials: 'include',
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7days': return t('analytics.timeRange.last7Days');
      case '30days': return t('analytics.timeRange.last30Days');
      case '90days': return t('analytics.timeRange.last90Days');
      case 'year': return t('analytics.timeRange.thisYear');
      default: return t('analytics.timeRange.last7Days');
    }
  };

  const getCallTypeLabel = () => {
    switch (callType) {
      case 'all': return t('analytics.callTypes.all');
      case 'incoming': return t('analytics.callTypes.incoming');
      case 'outgoing': return t('analytics.callTypes.outgoing');
      case 'batch': return t('analytics.callTypes.campaigns');
      default: return t('analytics.callTypes.all');
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest('POST', '/api/analytics/export-pdf', {
        timeRange,
        callType
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: t('analytics.toast.reportExported'),
        description: t('analytics.toast.reportExportedDesc')
      });
    } catch (error) {
      toast({
        title: t('analytics.toast.exportFailed'),
        description: t('analytics.toast.exportFailedDesc'),
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  const formattedDailyCalls = dailyCalls.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    value: d.count
  }));

  const getCallVolumeTitle = () => {
    if (timeRange === 'year') return t('analytics.monthlyCallVolume');
    if (timeRange === '30days' || timeRange === '90days') return t('analytics.weeklyCallVolume');
    return t('analytics.dailyCallVolume');
  };

  const callTypes = [
    { value: 'all', label: t('analytics.callTypes.all'), labelShort: t('analytics.callTypes.allShort'), icon: Phone, count: typeBreakdown.total },
    { value: 'incoming', label: t('analytics.callTypes.incoming'), labelShort: t('analytics.callTypes.incomingShort'), icon: PhoneIncoming, count: typeBreakdown.incoming },
    { value: 'outgoing', label: t('analytics.callTypes.outgoing'), labelShort: t('analytics.callTypes.outgoingShort'), icon: PhoneOutgoing, count: typeBreakdown.outgoing },
    { value: 'batch', label: t('analytics.callTypes.campaigns'), labelShort: t('analytics.callTypes.campaignsShort'), icon: Target, count: typeBreakdown.batch },
  ];

  return (
    <div className="space-y-6 p-6" ref={reportRef}>
      {/* iOS 18 Style Header - Clean and Minimal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-foreground/70" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-analytics-title">
              {t('analytics.title')}
            </h1>
            <p className="text-sm text-foreground/50 mt-0.5">{t('analytics.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger 
              className="w-[150px] h-10 rounded-xl border-border/40 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors" 
              data-testid="select-time-range"
            >
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
            variant="default"
            className="h-10 rounded-xl"
            onClick={handleExportPDF}
            disabled={isExporting}
            data-testid="button-export-report"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('analytics.exportReport')}
          </Button>
        </div>
      </div>

      {/* iOS 18 Style Pill Tabs */}
      <div className="flex flex-wrap gap-2" data-testid="tabs-call-type">
        {callTypes.map((type) => {
          const Icon = type.icon;
          const isActive = callType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => setCallType(type.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-foreground/[0.08] text-foreground" 
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
              )}
              data-testid={`tab-${type.value}-calls`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{type.label}</span>
              <span className="sm:hidden">{type.labelShort}</span>
              {type.count > 0 && (
                <span className={cn(
                  "ml-1 text-xs px-2 py-0.5 rounded-full",
                  isActive 
                    ? "bg-foreground/[0.08] text-foreground" 
                    : "bg-foreground/[0.05] text-foreground/50"
                )}>
                  {type.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Metrics Grid - iOS 18 Style Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('analytics.totalCalls')}
          value={totalCalls.toLocaleString()}
          icon={Phone}
          trend={totalCalls > 0 ? { value: 0, direction: "up" as const } : undefined}
          testId="metric-total-calls"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
          iconClassName="text-cyan-500"
        />
        <MetricCard
          title={t('analytics.successRate')}
          value={`${successRate}%`}
          icon={TrendingUp}
          trend={successRate > 0 ? { value: 0, direction: "up" as const } : undefined}
          testId="metric-success-rate"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
          iconClassName="text-emerald-500"
        />
        <MetricCard
          title={t('analytics.qualifiedLeads')}
          value={qualifiedLeads.toLocaleString()}
          icon={Users}
          trend={qualifiedLeads > 0 ? { value: 0, direction: "up" as const } : undefined}
          testId="metric-qualified-leads"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
          iconClassName="text-blue-500"
        />
        <MetricCard
          title={t('analytics.avgDurationLabel')}
          value={formatDuration(avgDuration)}
          icon={Clock}
          subtitle={t('analytics.minutesPerCall')}
          testId="metric-avg-duration"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
          iconClassName="text-violet-500"
        />
      </div>

      {/* Charts Grid - iOS 18 Style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsChart 
          title={getCallVolumeTitle()} 
          type="bar" 
          data={formattedDailyCalls.length > 0 ? formattedDailyCalls : [{ name: t('analytics.noData'), value: 0 }]} 
          testId="chart-calls-this-week"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
        />
        <AnalyticsChart 
          title={t('analytics.leadDistribution')} 
          type="pie" 
          data={leadDistribution.length > 0 ? leadDistribution : [{ name: t('analytics.noData'), value: 1 }]} 
          testId="chart-lead-distribution"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsChart 
          title={t('analytics.campaignSuccessRate')} 
          type="bar" 
          data={campaignPerformance.length > 0 ? campaignPerformance : [{ name: t('analytics.noCampaigns'), value: 0 }]} 
          xAxisKey="name"
          dataKey="value"
          testId="chart-campaign-success"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
        />
        <AnalyticsChart 
          title={t('analytics.sentimentAnalysis')} 
          type="pie" 
          data={sentimentDistribution.length > 0 ? sentimentDistribution : [{ name: t('analytics.noData'), value: 1 }]} 
          testId="chart-sentiment-analysis"
          gradientClassName="rounded-2xl bg-foreground/[0.02] border-border/30"
        />
      </div>

      {/* Call Type Breakdown - iOS 18 Style */}
      {callType === 'all' && typeBreakdown.total > 0 && (
        <div className="rounded-2xl bg-foreground/[0.02] border border-border/30 p-6" data-testid="card-call-breakdown">
          <h3 className="text-base font-semibold text-foreground mb-5">{t('analytics.callTypeBreakdown')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-border/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-center text-sm text-foreground/50 mb-1">{t('analytics.callTypes.incoming')}</p>
              <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-incoming">
                {typeBreakdown.incoming}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-border/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <p className="text-center text-sm text-foreground/50 mb-1">{t('analytics.callTypes.outgoing')}</p>
              <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-outgoing">
                {typeBreakdown.outgoing}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-border/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-violet-500" />
                </div>
              </div>
              <p className="text-center text-sm text-foreground/50 mb-1">{t('analytics.callTypes.campaigns')}</p>
              <p className="text-center text-2xl font-bold text-foreground" data-testid="breakdown-campaigns">
                {typeBreakdown.batch}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
