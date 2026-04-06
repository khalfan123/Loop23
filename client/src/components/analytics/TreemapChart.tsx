import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface TreemapItem {
  name: string;
  value: number;
}

interface TreemapChartProps {
  data: TreemapItem[];
  onItemClick?: (name: string) => void;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function CustomContent(props: any) {
  const { x, y, width, height, name, index, value } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={COLORS[index % COLORS.length]}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        rx={4}
        style={{ cursor: 'pointer' }}
      />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={12} fontWeight={600}>
            {name?.length > Math.floor(width / 8) ? name.substring(0, Math.floor(width / 8)) + '…' : name}
          </text>
          <text x={x + 8} y={y + 34} fill="rgba(255,255,255,0.7)" fontSize={11}>
            {value}
          </text>
        </>
      )}
    </g>
  );
}

export function TreemapChart({ data, onItemClick }: TreemapChartProps) {
  return (
    <Card className="glass-card" data-testid="treemap-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Campaign Distribution</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <Treemap
            data={data}
            dataKey="value"
            nameKey="name"
            content={<CustomContent />}
            onClick={(item: any) => {
              if (onItemClick && item?.name) onItemClick(item.name);
            }}
          >
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-md px-3 py-2 text-sm shadow-md">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-muted-foreground">{d.value} calls</p>
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
