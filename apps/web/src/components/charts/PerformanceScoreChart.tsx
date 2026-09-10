"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PerformanceScoreChartProps {
  data: Array<{ name: string; score: number | null }>;
  /** Área actualmente seleccionada (drill-down) — resalta esa barra. */
  activeName?: string | null;
  /** Click en una barra: togglea el drill-down de esa área. */
  onBarClick?: (name: string) => void;
}

const BASE_FILL = "hsl(var(--chart-2))";
const ACTIVE_FILL = "hsl(var(--chart-4))";

/**
 * Extraído a su propio componente para cargarlo con next/dynamic (ssr: false),
 * igual que `AvgTimeBarChart` — recharts es pesado y no crítico para el primer
 * render de la página de rendimiento.
 *
 * Soporta drill-down: click en una barra dispara `onBarClick` con el nombre
 * del área (el panel de desglose vive en la página, debajo del gráfico).
 */
export default function PerformanceScoreChart({
  data,
  activeName,
  onBarClick,
}: PerformanceScoreChartProps) {
  const chartData = data.map((d) => ({ ...d, score: d.score ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
        <Bar
          dataKey="score"
          radius={[4, 4, 0, 0]}
          onClick={(entry) => {
            const name = (entry as unknown as { name?: string })?.name;
            if (name) onBarClick?.(name);
          }}
          cursor={onBarClick ? "pointer" : undefined}
        >
          {chartData.map((d) => (
            <Cell key={d.name} fill={d.name === activeName ? ACTIVE_FILL : BASE_FILL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
