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
import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

function MetricSparkline({ values, color = "currentColor" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 64, h = 20;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
    </svg>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  trendLabel?: string;
  sparklineData?: number[];
  subtitle?: string;
  testId?: string;
  gradientClassName?: string;
  iconClassName?: string;
}

export function MetricCard({ title, value, icon: Icon, trend, trendLabel, sparklineData, subtitle, testId, gradientClassName, iconClassName }: MetricCardProps) {
  return (
    <Card className={cn("p-6 hover:shadow-md transition-all duration-300", gradientClassName)} data-testid={testId || `card-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between space-y-0 pb-2">
        <h3 className="text-[13px] font-medium text-muted-foreground tracking-tight">{title}</h3>
        <div className="h-8 w-8 rounded-xl bg-primary/[0.08] dark:bg-primary/[0.15] flex items-center justify-center">
          <Icon className={cn("h-4 w-4 text-primary/70", iconClassName)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="text-metric-value">{value}</span>
          {sparklineData && sparklineData.length >= 2 && (
            <MetricSparkline values={sparklineData} color={trend?.direction === "up" ? "#10b981" : trend?.direction === "down" ? "#f87171" : "#94a3b8"} />
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className={trend.direction === "up" ? "text-emerald-500" : "text-red-400"}>
              {trend.value.toFixed(1)}%
            </span>
            <span className="text-muted-foreground/70">{trendLabel || 'vs previous period'}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
