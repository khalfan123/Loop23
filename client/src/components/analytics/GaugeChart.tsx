import { Card, CardContent } from "@/components/ui/card";

interface GaugeChartProps {
  value: number;
  maxValue?: number;
  title: string;
  unit?: string;
  thresholds?: { green: number; yellow: number };
  /** Force a specific ring color (hex) — overrides threshold logic */
  color?: string;
}

export function GaugeChart({
  value,
  maxValue = 100,
  title,
  unit = "%",
  thresholds,
  color,
}: GaugeChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const getColor = () => {
    if (color) return color;
    if (!thresholds) {
      if (percentage >= 60) return "var(--l9-success-ring)";
      if (percentage >= 30) return "var(--l9-warning)";
      return "var(--l9-danger)";
    }
    if (percentage >= thresholds.green) return "var(--l9-success-ring)";
    if (percentage >= thresholds.yellow) return "var(--l9-warning)";
    return "var(--l9-danger)";
  };

  const r = 46;
  const circ = 2 * Math.PI * r;
  const strokeDasharray = `${(percentage / 100) * circ} ${circ}`;

  return (
    <Card
      className="border-[var(--l9-border-card)] shadow-[var(--l9-shadow-card)] rounded-2xl bg-[var(--l9-surface)]"
      data-testid={`gauge-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-[22px] flex flex-col items-center">
        <div className="relative w-[112px] h-[112px]">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
            <circle
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke="var(--l9-chart-track)"
              strokeWidth="9"
            />
            <circle
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke={getColor()}
              strokeWidth="9"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[26px] font-bold tabular-nums text-[var(--l9-text)]">
              {Math.round(value)}
            </span>
          </div>
        </div>
        <p className="text-[14px] font-semibold text-[var(--l9-text)] mt-3 text-center">{title}</p>
        {unit && <p className="text-[12.5px] text-[var(--l9-text-faint)] mt-0.5">{unit}</p>}
      </CardContent>
    </Card>
  );
}
