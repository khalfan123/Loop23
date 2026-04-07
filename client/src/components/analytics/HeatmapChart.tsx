import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HeatmapChart({ data }: HeatmapChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  const getCell = (day: string, hour: number) => {
    const entry = data.find(d => d.day === day && d.hour === hour);
    return entry?.value || 0;
  };

  const getOpacity = (val: number) => {
    if (val === 0) return 0.05;
    return 0.15 + (val / maxVal) * 0.85;
  };

  return (
    <Card className="glass-card" data-testid="heatmap-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Call Activity Heatmap</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="flex gap-[2px] mb-1 ml-10">
              {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                <span key={h} className="text-[9px] text-muted-foreground" style={{ width: `${(100 / 8)}%` }}>
                  {h.toString().padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                <span className="text-[10px] text-muted-foreground w-8 text-right mr-2">{day}</span>
                {HOURS.map(hour => {
                  const val = getCell(day, hour);
                  return (
                    <div
                      key={hour}
                      className="flex-1 h-5 rounded-sm bg-primary"
                      style={{ opacity: getOpacity(val) }}
                      title={`${day} ${hour}:00 - ${val} calls`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
