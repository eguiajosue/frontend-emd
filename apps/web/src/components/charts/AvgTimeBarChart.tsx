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

interface AvgTimeBarChartProps {
  data: Array<{ etapa: string; horasPromedio: number }>;
  /** Etapa actualmente seleccionada (drill-down) — resalta esa barra. */
  activeEtapa?: string | null;
  /** Click en una barra: togglea el drill-down de esa etapa. */
  onBarClick?: (etapa: string) => void;
}

const BASE_FILL = "hsl(var(--chart-1))";
const ACTIVE_FILL = "hsl(var(--chart-2))";

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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="etapa" />
        <YAxis />
        <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
        <Bar
          dataKey="horasPromedio"
          radius={[4, 4, 0, 0]}
          onClick={(entry) => {
            const etapa = (entry as unknown as { etapa?: string })?.etapa;
            if (etapa) onBarClick?.(etapa);
          }}
          cursor={onBarClick ? "pointer" : undefined}
        >
          {data.map((d) => (
            <Cell key={d.etapa} fill={d.etapa === activeEtapa ? ACTIVE_FILL : BASE_FILL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
