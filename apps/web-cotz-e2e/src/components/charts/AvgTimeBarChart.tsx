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

interface AvgTimeBarChartProps {
  data: Array<{ etapa: string; horasPromedio: number }>;
  /** Etapa actualmente seleccionada (drill-down) — resalta esa barra. */
  activeEtapa?: string | null;
  /** Click en una barra: togglea el drill-down de esa etapa. */
  onBarClick?: (etapa: string) => void;
}


/**
 * Extraído a su propio componente para poder cargarlo con next/dynamic
 * (ssr: false) desde la página de admin — recharts es pesado y no es crítico
 * para el primer render del panel.
 *
 * Soporta drill-down: click en una barra dispara `onBarClick` con la etapa
 * (el panel de desglose vive en la página, debajo del gráfico).
 */
export default function AvgTimeBarChart({ data, activeEtapa, onBarClick }: AvgTimeBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="etapa" {...AXIS_PROPS} interval={0} />
        <YAxis {...AXIS_PROPS} width={40} />
        <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Bar
          dataKey="horasPromedio"
          name="Horas promedio"
          radius={[8, 8, 8, 8]}
          maxBarSize={56}
          onClick={(entry) => {
            const etapa = (entry as unknown as { etapa?: string })?.etapa;
            if (etapa) onBarClick?.(etapa);
          }}
          cursor={onBarClick ? "pointer" : undefined}
        >
          {data.map((d, i) => (
            <Cell
              key={d.etapa}
              fill={chartColor(i)}
              // Con una barra seleccionada (drill-down) el resto se atenúa.
              fillOpacity={activeEtapa == null || d.etapa === activeEtapa ? 1 : 0.3}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
