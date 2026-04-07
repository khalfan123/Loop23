'use strict';
import { db } from "../db";
import { calls, campaigns } from "@shared/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";

interface HeatmapPoint {
  hour: number;
  day: number;
  value: number;
}

interface FunnelStage {
  stage: string;
  value: number;
  percentage: number;
}

interface PeriodMetric {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}

interface CampaignComparison {
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
}

interface DailyTrend {
  date: string;
  completed: number;
  failed: number;
  qualified: number;
  total: number;
}

interface AdvancedAnalyticsResult {
  heatmap: HeatmapPoint[];
  funnel: FunnelStage[];
  periodComparison: PeriodMetric[];
  campaignComparisons: CampaignComparison[];
  dailyTrendSeries: DailyTrend[];
  trends: {
    totalCallsTrend: number;
    successRateTrend: number;
    qualifiedLeadsTrend: number;
    avgDurationTrend: number;
  };
}

function getDateRange(timeRange: string): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const end = new Date(now);
  let days = 7;
  if (timeRange === '30days') days = 30;
  else if (timeRange === '90days') days = 90;
  else if (timeRange === 'year') days = 365;

  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);

  return { start, end, prevStart, prevEnd };
}

export async function calculateAdvancedAnalytics(userId: string, timeRange: string): Promise<AdvancedAnalyticsResult> {
  const { start, end, prevStart, prevEnd } = getDateRange(timeRange);

  const currentCalls = await db.select().from(calls)
    .where(and(eq(calls.userId, userId), gte(calls.createdAt, start)))
    .orderBy(desc(calls.createdAt));

  const previousCalls = await db.select().from(calls)
    .where(and(eq(calls.userId, userId), gte(calls.createdAt, prevStart), sql`${calls.createdAt} < ${start}`));

  const heatmap: HeatmapPoint[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap.push({ day, hour, value: 0 });
    }
  }
  for (const call of currentCalls) {
    const callTime = call.startedAt || call.createdAt;
    if (callTime) {
      const d = new Date(callTime);
      const day = d.getDay();
      const hour = d.getHours();
      const point = heatmap.find(h => h.day === day && h.hour === hour);
      if (point) point.value++;
    }
  }

  const totalCurrent = currentCalls.length;
  const completedCurrent = currentCalls.filter(c => c.status === 'completed').length;
  const qualifiedCurrent = currentCalls.filter(c =>
    c.leadClassification === 'hot' || c.leadClassification === 'warm'
  ).length;
  const failedCurrent = currentCalls.filter(c => c.status === 'failed' || c.status === 'error').length;

  const funnel: FunnelStage[] = [
    { stage: 'Total Calls', value: totalCurrent, percentage: 100 },
    { stage: 'Connected', value: completedCurrent + failedCurrent, percentage: totalCurrent > 0 ? Math.round(((completedCurrent + failedCurrent) / totalCurrent) * 100) : 0 },
    { stage: 'Completed', value: completedCurrent, percentage: totalCurrent > 0 ? Math.round((completedCurrent / totalCurrent) * 100) : 0 },
    { stage: 'Qualified', value: qualifiedCurrent, percentage: totalCurrent > 0 ? Math.round((qualifiedCurrent / totalCurrent) * 100) : 0 },
  ];

  const totalPrev = previousCalls.length;
  const completedPrev = previousCalls.filter(c => c.status === 'completed').length;
  const qualifiedPrev = previousCalls.filter(c =>
    c.leadClassification === 'hot' || c.leadClassification === 'warm'
  ).length;

  const avgDurCurrent = completedCurrent > 0
    ? currentCalls.filter(c => c.status === 'completed' && c.duration).reduce((s, c) => s + (c.duration || 0), 0) / completedCurrent
    : 0;
  const avgDurPrev = completedPrev > 0
    ? previousCalls.filter(c => c.status === 'completed' && c.duration).reduce((s, c) => s + (c.duration || 0), 0) / completedPrev
    : 0;

  const successRateCurrent = totalCurrent > 0 ? (completedCurrent / totalCurrent) * 100 : 0;
  const successRatePrev = totalPrev > 0 ? (completedPrev / totalPrev) * 100 : 0;

  function calcDelta(curr: number, prev: number): { delta: number; deltaPercent: number } {
    const delta = curr - prev;
    const deltaPercent = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
    return { delta, deltaPercent };
  }

  const periodComparison: PeriodMetric[] = [
    { metric: 'Total Calls', current: totalCurrent, previous: totalPrev, ...calcDelta(totalCurrent, totalPrev) },
    { metric: 'Success Rate', current: Math.round(successRateCurrent), previous: Math.round(successRatePrev), ...calcDelta(successRateCurrent, successRatePrev) },
    { metric: 'Qualified', current: qualifiedCurrent, previous: qualifiedPrev, ...calcDelta(qualifiedCurrent, qualifiedPrev) },
    { metric: 'Avg Duration', current: Math.round(avgDurCurrent), previous: Math.round(avgDurPrev), ...calcDelta(avgDurCurrent, avgDurPrev) },
  ];

  const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  const campaignComparisons: CampaignComparison[] = userCampaigns.slice(0, 10).map(camp => {
    const campCalls = currentCalls.filter(c => c.campaignId === camp.id);
    const completed = campCalls.filter(c => c.status === 'completed');
    const hot = campCalls.filter(c => c.leadClassification === 'hot').length;
    const warm = campCalls.filter(c => c.leadClassification === 'warm').length;
    const cold = campCalls.filter(c => c.leadClassification === 'cold').length;

    const dailyMap = new Map<string, number>();
    for (const c of campCalls) {
      const cTime = c.startedAt || c.createdAt;
      if (cTime) {
        const dateKey = new Date(cTime).toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }
    }

    return {
      campaignId: camp.id,
      campaignName: camp.name,
      totalCalls: campCalls.length,
      completedCalls: completed.length,
      successRate: campCalls.length > 0 ? Math.round((completed.length / campCalls.length) * 100) : 0,
      avgDuration: completed.length > 0
        ? Math.round(completed.reduce((s, c) => s + (c.duration || 0), 0) / completed.length)
        : 0,
      hotLeads: hot,
      warmLeads: warm,
      coldLeads: cold,
      dailyData: Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  const dailyMap = new Map<string, DailyTrend>();
  for (const c of currentCalls) {
    const cTime = c.startedAt || c.createdAt;
    if (cTime) {
      const dateKey = new Date(cTime).toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, completed: 0, failed: 0, qualified: 0, total: 0 });
      }
      const entry = dailyMap.get(dateKey)!;
      entry.total++;
      if (c.status === 'completed') entry.completed++;
      if (c.status === 'failed' || c.status === 'error') entry.failed++;
      if (c.leadClassification === 'hot' || c.leadClassification === 'warm') entry.qualified++;
    }
  }
  const dailyTrendSeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const trends = {
    totalCallsTrend: calcDelta(totalCurrent, totalPrev).deltaPercent,
    successRateTrend: calcDelta(successRateCurrent, successRatePrev).deltaPercent,
    qualifiedLeadsTrend: calcDelta(qualifiedCurrent, qualifiedPrev).deltaPercent,
    avgDurationTrend: calcDelta(avgDurCurrent, avgDurPrev).deltaPercent,
  };

  return {
    heatmap,
    funnel,
    periodComparison,
    campaignComparisons,
    dailyTrendSeries,
    trends,
  };
}
