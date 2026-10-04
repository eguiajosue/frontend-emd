"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR, chartColor } from "@/components/charts/chartTheme";

interface ThroughputChartProps {
  data: Array<{ day: string; created: number; delivered: number }>;
}

/**
 * Pedidos creados vs. entregados por día (última semana). Cargado con
 * next/dynamic (ssr: false) desde el Inicio: recharts es pesado y no es
 * crítico para el primer render.
 */
export default function ThroughputChart({ data }: ThroughputChartProps) {
  const rows = data.map((d) => ({
    label: format(new Date(d.day), "EEE d", { locale: es }),
    Creados: d.created,
    Entregados: d.delivered,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} barGap={2}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval={0} tickMargin={6} />
        <YAxis {...AXIS_PROPS} width={28} allowDecimals={false} />
        <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Creados" fill={chartColor(0)} radius={[6, 6, 6, 6]} maxBarSize={18} />
        <Bar dataKey="Entregados" fill={chartColor(1)} radius={[6, 6, 6, 6]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
