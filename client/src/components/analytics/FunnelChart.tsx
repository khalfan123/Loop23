import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelStage {
  name: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  data: FunnelStage[];
}

const DEFAULT_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
];

export function FunnelChart({ data }: FunnelChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <Card className="glass-card" data-testid="funnel-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {data.map((stage, i) => {
          const widthPct = Math.max((stage.value / maxVal) * 100, 8);
          const colorClass = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const conversionRate = i > 0 && data[i - 1].value > 0
            ? ((stage.value / data[i - 1].value) * 100).toFixed(1)
            : null;
          return (
            <div key={`${stage.name}-${i}`} className="flex items-center gap-3" data-testid={`funnel-stage-${i}`}>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.value}
                    {conversionRate && (
                      <span className="ml-1 text-[10px]">({conversionRate}%)</span>
                    )}
                  </span>
                </div>
                <div className="h-6 bg-muted/30 rounded-md overflow-hidden flex justify-center">
                  <div
                    className={`h-full ${colorClass} rounded-md transition-all duration-500`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
