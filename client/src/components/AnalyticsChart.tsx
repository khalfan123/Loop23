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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

interface AnalyticsChartProps {
  title: string;
  type: "bar" | "pie" | "area";
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  xAxisKey?: string;
  testId?: string;
  gradientClassName?: string;
  onSegmentClick?: (data: { name: string; value: number }) => void;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const glassTooltipStyle = {
  backgroundColor: "var(--glass-bg-heavy)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--glass-border)",
  borderRadius: "16px",
  boxShadow: "var(--glass-shadow-lg)",
  padding: "10px 14px",
  fontSize: "12px",
  letterSpacing: "-0.01em",
};

export function AnalyticsChart({ title, type, data, dataKey = "value", xAxisKey = "name", testId, gradientClassName, onSegmentClick }: AnalyticsChartProps) {
  return (
    <Card className={cn("p-6", gradientClassName)} data-testid={testId || `chart-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3 className="text-base font-semibold text-foreground mb-4 tracking-tight">{title}</h3>
      <div className="min-h-[300px]">
        {type === "bar" ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} barSize={32}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={glassTooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                cursor={{ fill: 'hsl(var(--foreground) / 0.03)', radius: 8 }}
              />
              <Bar dataKey={dataKey} fill="url(#barGradient)" radius={[10, 10, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        ) : type === "area" ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={glassTooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                fill="url(#areaGradient)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: 'hsl(var(--chart-1))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey={dataKey}
                strokeWidth={2}
                stroke="hsl(var(--background))"
                paddingAngle={2}
                onClick={onSegmentClick ? (entry: { name: string; value: number }) => onSegmentClick(entry) : undefined}
                style={onSegmentClick ? { cursor: 'pointer' } : undefined}
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={glassTooltipStyle}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--foreground))' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
