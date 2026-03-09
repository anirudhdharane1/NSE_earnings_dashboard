import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

// Props interface: What comes from Dashboard.tsx (simple, as expected)
interface ChartDisplayProps {
  data: Array<{
    date: string;
    move: number;
    direction: "up" | "down";
  }>;
  ticker: string;
}

// Internal type for chartData (adds rawMove, fill for tooltip and styling)
interface ChartDataItem {
  date: string;
  move: number;
  rawMove: number;
  fill: string;
}

export function ChartDisplay({ data, ticker }: ChartDisplayProps) {
  // Filter out invalid/zero moves and bad dates
  const validData = data.filter(item =>
    item.move !== undefined &&
    item.move !== null &&
    item.move !== 0 &&
    item.date &&
    !isNaN(new Date(item.date).getTime())
  );

  if (validData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "#e3e3e3" }}>
            <BarChart3 className="w-5 h-5" />
            Price Movement Distribution - {ticker}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No valid price movement data available for charts. Try analyzing recent earnings dates.
        </CardContent>
      </Card>
    );
  }

  // === CHANGES START HERE ===
  // 1) Sort chartData so earliest left, latest right (ascending).
  // 2) Use darker green/red colors.
  // 3) Change Y-axis tick interval to 1.
  const sortedValidData = [...validData].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const chartData: ChartDataItem[] = sortedValidData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    move: Math.abs(item.move),
    rawMove: item.move,
    // DARK colors: green "#16a34a" (emerald-700), red "#dc2626" (red-600)
    fill: item.move >= 0 ? "#00FF00" : "#fd1414ff",
  }));

  // Dynamic yAxis ticks at 1% intervals (ABSOLUTE values)
  const moves = chartData.map(item => item.move);
  const minMove = Math.max(0, Math.floor(Math.min(...moves)));
  const maxMove = Math.ceil(Math.max(...moves));
  const yTicks: number[] = [];
  for (let i = minMove; i <= maxMove; i += 1) {
    yTicks.push(Number(i.toFixed(1)));
  }

  return (
    <Card className="card-green-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: "#e3e3e3" }}>
          <BarChart3 className="w-5 h-5" />
          Price Movement Distribution - {ticker}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.13)" strokeDasharray="3 3" vertical={true} horizontal={true} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 14, fill: "#e3e3e3" }}
              angle={-45}
              textAnchor="end"
              height={60}
              label={{
                value: "Date",
                position: "bottom",
                offset: 16,
                fill: "#e3e3e3",
                fontSize: 16,
              }}
            />
            <YAxis
              tick={{ fontSize: 14, fill: "#e3e3e3" }}
              ticks={yTicks}
              domain={[minMove, maxMove]}
              interval={0}
              allowDecimals={true}
              label={{
                value: "Absolute Price Change (%)",
                angle: -90,
                position: "insideLeft",
                offset: 15,
                dy: 90,
                fill: "#e3e3e3",
                fontSize: 16,
              }}
            />
            <Tooltip
              formatter={(value: any, name: any, props: any) => [
                `${props.payload.rawMove > 0 ? '+' : ''}${props.payload.rawMove.toFixed(1)}%`,
                'Price Move'
              ]}
              contentStyle={{
                backgroundColor: "#23272B",
                border: "1px solid #444",
                fontSize: "14px",
                color: "#e3e3e3",
              }}
              itemStyle={{ color: "#e3e3e3", fontSize: "14px" }}
              labelStyle={{ color: "#e3e3e3", fontSize: "14px" }}
              cursor={{ fill: "rgba(22,163,74,0.18)" /* faint green for hover */ }}
            />
            <Bar dataKey="move">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-sm mt-4" style={{ color: "#ffffffc4" }}>
          Absolute percentage price moves on T+1 day after earnings announcements
        </p>
      </CardContent>
    </Card>
  );
}
