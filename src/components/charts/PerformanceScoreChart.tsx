"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PerformanceScoreChartProps {
  data: Array<{ name: string; score: number | null }>;
}

/**
 * Extraído a su propio componente para cargarlo con next/dynamic (ssr: false),
 * igual que `AvgTimeBarChart` — recharts es pesado y no crítico en el primer
 * render de la página de rendimiento.
 */
export default function PerformanceScoreChart({ data }: PerformanceScoreChartProps) {
  const chartData = data.map((d) => ({ ...d, score: d.score ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip />
        <Bar dataKey="score" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
