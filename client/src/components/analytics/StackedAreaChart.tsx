import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

interface StackedAreaChartProps {
  title: string;
  data: Array<Record<string, any>>;
  series: SeriesConfig[];
}

export function StackedAreaChart({ title, data, series }: StackedAreaChartProps) {
  return (
    <Card className="glass-card" data-testid="stacked-area-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                {series.map(s => (
                  <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
              {series.map(s => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  fill={`url(#gradient-${s.key})`}
                  strokeWidth={2}
                  stackId="1"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
        )}
      </CardContent>
    </Card>
  );
}
