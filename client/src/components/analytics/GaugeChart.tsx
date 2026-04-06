import { Card, CardContent } from "@/components/ui/card";

interface GaugeChartProps {
  value: number;
  maxValue?: number;
  title: string;
  unit?: string;
  thresholds?: { green: number; yellow: number };
}

export function GaugeChart({ value, maxValue = 100, title, unit = "%", thresholds }: GaugeChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const getColor = () => {
    if (!thresholds) {
      if (percentage >= 60) return "text-green-500";
      if (percentage >= 30) return "text-yellow-500";
      return "text-red-500";
    }
    if (percentage >= thresholds.green) return "text-green-500";
    if (percentage >= thresholds.yellow) return "text-yellow-500";
    return "text-red-500";
  };

  const strokeDasharray = `${percentage * 2.51327} ${251.327 - percentage * 2.51327}`;

  return (
    <Card className="glass-card" data-testid={`gauge-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4 flex flex-col items-center">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={strokeDasharray} strokeLinecap="round" className={getColor()} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{Math.round(value)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">{title}</p>
        {unit && <p className="text-[10px] text-muted-foreground/60">{unit}</p>}
      </CardContent>
    </Card>
  );
}
