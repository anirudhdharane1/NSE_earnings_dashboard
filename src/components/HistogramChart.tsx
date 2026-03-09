

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";

interface HistogramChartProps {
  data: Array<{
    date: string;
    price_change_pct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
  }>;
  ticker: string;
  stats: {
    absolute_mean: number | null;
    first_std: number | null;
    second_std: number | null;
    third_std: number | null;
  };
}

// Color constants
const STD_COLORS = {
  first: "yellow",
  second: "orange",
  third: "red",
  zero: "white",
};

export function HistogramChart({ data, ticker, stats }: HistogramChartProps) {
  const validMoves = data
    .map(item => item.price_change_pct)
    .filter(move => move !== null) as number[];

  // Binning as before
  const binEdges = Array.from({ length: 15 }, (_, i) => -7 + i); // [-7, ..., 7]
  const bins: Array<{ binStart: number; binEnd: number; frequency: number; binLabel: string }> = [];
  for (let i = 0; i < binEdges.length - 1; i++) {
    const binStart = binEdges[i];
    const binEnd = binEdges[i + 1];
    const frequency = validMoves.filter(move => move >= binStart && move < binEnd).length;
    bins.push({
      binStart,
      binEnd,
      frequency,
      binLabel: `${binStart} to ${binEnd}`,
    });
  }

  /*const yTicks = Array.from({ length: 6 }, (_, i) => i);*/
  const xTicks = binEdges;
  // after 'bins' are built from your data
const maxFreq = bins.length > 0 ? Math.max(...bins.map(bin => bin.frequency)) : 0;
const yTicks = Array.from({ length: maxFreq + 2 }, (_, i) => i); // 0 to maxFreq+1


  // Custom legend component
  const Legend = () => (
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: "2rem",
      marginBottom: "0.75rem",
      marginTop: "0.5rem",
      fontSize: "0.95rem",
    }}>
      <span style={{ color: STD_COLORS.first, display: "flex", alignItems: "center" }}>
        <span style={{
          display: "inline-block",
          width: "16px",
          height: "4px",
          backgroundColor: STD_COLORS.first,
          marginRight: "4px",
          verticalAlign: "middle"
        }}></span>
        1σ
      </span>
      <span style={{ color: STD_COLORS.second, display: "flex", alignItems: "center" }}>
        <span style={{
          display: "inline-block",
          width: "16px",
          height: "4px",
          backgroundColor: STD_COLORS.second,
          marginRight: "4px",
          verticalAlign: "middle"
        }}></span>
        2σ
      </span>
      <span style={{ color: STD_COLORS.third, display: "flex", alignItems: "center" }}>
        <span style={{
          display: "inline-block",
          width: "16px",
          height: "4px",
          backgroundColor: STD_COLORS.third,
          marginRight: "4px",
          verticalAlign: "middle"
        }}></span>
        3σ
      </span>
    </div>
  );

  return (
    <Card className="card-green-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Distribution of Price Changes - {ticker}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={bins}>
            {/* Duller White, more transparent grid */}
            <CartesianGrid stroke="rgba(255,255,255,0.13)" strokeDasharray="3 3" vertical={true} horizontal={true} />
            {/* X axis label moved lower */}
            <XAxis
              dataKey="binStart"
              ticks={xTicks}
              type="number"
              domain={[-7, 7]}
              interval={0}
              tick={{ fontSize: 14, fill: "#e3e3e3" }}
              label={{
                value: "Percentage Price Change (%)",
                position: "bottom", // Moves label lower
                offset: 16,         // Positive offset pushes the label down
                fill: "#e3e3e3",
                fontSize: 16,
              }}
            />
            {/* Y axis label closer to axis, slightly right */}
           <YAxis
            tick={{ fontSize: 14, fill: "#e3e3e3" }}
            ticks={yTicks}
            domain={[0, maxFreq + 1]}
            interval={0}
            allowDecimals={false}
            label={{
            value: "Frequency",
            angle: -90,
            position: "insideLeft",
            offset: 15,
            fill: "#e3e3e3",
            fontSize: 16,
            }}
          />
            <Tooltip
              formatter={(value: any) => [`${value} occurrences`, "Frequency"]}
              labelFormatter={(label: string) => `Range: ${label}`}
              contentStyle={{
                backgroundColor: "#23272B",
                border: "1px solid #444",
                fontSize: "14px",
                color: "#e3e3e3",
              }}
              itemStyle={{ color: "#e3e3e3", fontSize: "14px" }}
              labelStyle={{ color: "#e3e3e3", fontSize: "14px" }}
              cursor={{ fill: "rgba(0,255,0,0.1)" }}
            />
            <Bar dataKey="frequency" fill="#00FF00" />
            <ReferenceLine x={0} stroke={STD_COLORS.zero} strokeDasharray="6 3" />
            {stats.absolute_mean != null && (
              <>
                <ReferenceLine x={stats.absolute_mean} stroke={STD_COLORS.first} strokeDasharray="5 5" />
                <ReferenceLine x={-stats.absolute_mean} stroke={STD_COLORS.first} strokeDasharray="5 5" />
              </>
            )}
            {stats.first_std != null && (
              <>
                <ReferenceLine x={stats.first_std} stroke={STD_COLORS.second} strokeDasharray="5 5" />
                <ReferenceLine x={-stats.first_std} stroke={STD_COLORS.second} strokeDasharray="5 5" />
              </>
            )}
            {stats.second_std != null && (
              <>
                <ReferenceLine x={stats.second_std} stroke={STD_COLORS.third} strokeDasharray="5 5" />
                <ReferenceLine x={-stats.second_std} stroke={STD_COLORS.third} strokeDasharray="5 5" />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
        {/* Legend below chart, above subtitle */}
        <Legend />
        <p className="text-sm mt-2" style={{ color: "#ffffffc4" }}>
          Distribution of percentage price changes on T+1 day after earnings announcements
          <br />
          Reference lines: Mean ({stats.absolute_mean?.toFixed(1)}%), ±1σ ({stats.first_std?.toFixed(1)}%), ±2σ ({stats.second_std?.toFixed(1)}%)
        </p>
      </CardContent>
    </Card>
  );
}
