import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface PeriodMetric {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}

interface PeriodComparisonCardProps {
  data: PeriodMetric[];
  currentLabel: string;
  previousLabel: string;
}

export function PeriodComparisonCard({ data, currentLabel, previousLabel }: PeriodComparisonCardProps) {
  return (
    <Card className="glass-card" data-testid="period-comparison">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {currentLabel} vs {previousLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.map((m) => {
            const isPositive = m.delta > 0;
            const isNeutral = m.delta === 0;
            return (
              <div key={m.metric} className="space-y-1" data-testid={`comparison-${m.metric.toLowerCase().replace(/\s+/g, '-')}`}>
                <p className="text-xs text-muted-foreground">{m.metric}</p>
                <p className="text-lg font-bold">{m.current.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs">
                  {isNeutral ? (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  ) : isPositive ? (
                    <ArrowUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={isNeutral ? "text-muted-foreground" : isPositive ? "text-green-500" : "text-red-500"}>
                    {Math.abs(m.deltaPercent).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs {m.previous.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
