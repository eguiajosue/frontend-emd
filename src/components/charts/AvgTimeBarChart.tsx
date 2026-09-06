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

interface AvgTimeBarChartProps {
  data: Array<{ etapa: string; horasPromedio: number }>;
}

/**
 * Extraído a su propio componente para poder cargarlo con next/dynamic
 * (ssr: false) desde la página de admin — recharts es pesado y no es crítico
 * para el primer render del panel.
 */
export default function AvgTimeBarChart({ data }: AvgTimeBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="etapa" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="horasPromedio" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
