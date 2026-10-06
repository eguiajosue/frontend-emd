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
import {
  AXIS_PROPS,
  GRID_PROPS,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_CURSOR,
  chartColor,
} from "./chartTheme";
import { getAreaLabel } from "@/lib/areas";

interface PerformanceScoreChartProps {
  data: Array<{ name: string; score: number | null }>;
  /** Área actualmente seleccionada (drill-down) — resalta esa barra. */
  activeName?: string | null;
  /** Click en una barra: togglea el drill-down de esa área. */
  onBarClick?: (name: string) => void;
}


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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" {...AXIS_PROPS} interval={0} tickFormatter={(v: string) => getAreaLabel(v)} />
        <YAxis domain={["auto", "auto"]} {...AXIS_PROPS} width={40} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelFormatter={(v) => getAreaLabel(String(v))}
        />
        <Bar
          dataKey="score"
          name="Score"
          radius={[8, 8, 8, 8]}
          maxBarSize={56}
          onClick={(entry) => {
            const name = (entry as unknown as { name?: string })?.name;
            if (name) onBarClick?.(name);
          }}
          cursor={onBarClick ? "pointer" : undefined}
        >
          {chartData.map((d, i) => (
            <Cell
              key={d.name}
              fill={chartColor(i)}
              // Con una barra seleccionada (drill-down) el resto se atenúa.
              fillOpacity={activeName == null || d.name === activeName ? 1 : 0.3}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
