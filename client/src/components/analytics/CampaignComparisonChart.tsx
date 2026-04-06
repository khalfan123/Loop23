import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";

interface CampaignData {
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

interface CampaignComparisonChartProps {
  campaigns: CampaignData[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

const LINE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function CampaignComparisonChart({ campaigns, selectedIds, onToggle }: CampaignComparisonChartProps) {
  const selected = campaigns.filter(c => selectedIds.includes(c.campaignId));

  const allDates = new Set<string>();
  selected.forEach(c => c.dailyData.forEach(d => allDates.add(d.date)));
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map(date => {
    const point: Record<string, any> = { date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    selected.forEach(c => {
      const entry = c.dailyData.find(d => d.date === date);
      point[c.campaignName] = entry?.count || 0;
    });
    return point;
  });

  return (
    <Card className="glass-card" data-testid="campaign-comparison-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Campaign Comparison</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-3 mb-4">
          {campaigns.map(c => (
            <label key={c.campaignId} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`toggle-campaign-${c.campaignId}`}>
              <Checkbox
                checked={selectedIds.includes(c.campaignId)}
                onCheckedChange={() => onToggle(c.campaignId)}
              />
              <span>{c.campaignName}</span>
              <span className="text-xs text-muted-foreground">({c.totalCalls})</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
              {selected.map((c, i) => (
                <Line
                  key={c.campaignId}
                  type="monotone"
                  dataKey={c.campaignName}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Select campaigns above to compare</p>
        )}
      </CardContent>
    </Card>
  );
}
