/**
 * MetricCard — Loop9 AURA Command KPI card
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
  }).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
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
  iconTileClassName?: string;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  sparklineData,
  subtitle,
  testId,
  gradientClassName,
  iconClassName,
  iconTileClassName,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "p-5 px-[22px] border-[var(--l9-border-card)] shadow-[var(--l9-shadow-card)] rounded-2xl bg-[var(--l9-surface)]",
        gradientClassName,
      )}
      data-testid={testId || `card-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium text-[var(--l9-text-muted)] tracking-tight">{title}</h3>
        <div
          className={cn(
            "h-[34px] w-[34px] rounded-[10px] flex items-center justify-center",
            iconTileClassName || "bg-[var(--l9-primary-tint)]",
          )}
        >
          <Icon className={cn("h-4 w-4 text-[var(--l9-primary)]", iconClassName)} />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 my-3.5">
          <span
            className="text-[38px] font-bold tabular-nums tracking-[-0.03em] leading-none text-[var(--l9-text)]"
            data-testid="text-metric-value"
          >
            {value}
          </span>
          {sparklineData && sparklineData.length >= 2 && (
            <MetricSparkline
              values={sparklineData}
              color={
                trend?.direction === "up"
                  ? "var(--l9-success)"
                  : trend?.direction === "down"
                    ? "var(--l9-danger)"
                    : "var(--l9-text-faint)"
              }
            />
          )}
        </div>
        {subtitle && !trend && (
          <p className="text-[12.5px] text-[var(--l9-text-faint)]">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 text-[13px]">
            {trend.direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--l9-success)]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[var(--l9-danger)]" />
            )}
            <span
              className={cn(
                "font-semibold",
                trend.direction === "up" ? "text-[var(--l9-success)]" : "text-[var(--l9-danger)]",
              )}
            >
              {trend.value}%
            </span>
            <span className="text-[var(--l9-text-faint)]">{trendLabel || " vs previous period"}</span>
          </div>
        )}
        {subtitle && trend && (
          <p className="text-[12.5px] text-[var(--l9-text-faint)] mt-1">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}
