import type { CSSProperties } from "react";

/**
 * Estilo común de los gráficos de barras (recharts) sobre tarjeta blanca:
 * grilla horizontal apenas insinuada, ejes sin línea con ticks en texto
 * muted, tooltip con la misma superficie que los popovers. Los colores de
 * serie salen siempre de --chart-1..5 (globals.css), que ya tienen su
 * versión clara/oscura.
 */
export const CHART_COLORS = [1, 2, 3, 4, 5].map((n) => `hsl(var(--chart-${n}))`);

/** Color de la barra `index`, rotando sobre --chart-1..5. */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export const GRID_PROPS = {
  vertical: false,
  stroke: "hsl(var(--border))",
  strokeDasharray: "0",
} as const;

export const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 12 } as const;

export const AXIS_PROPS = { axisLine: false, tickLine: false, tick: AXIS_TICK } as const;

export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.25)",
};

export const TOOLTIP_CURSOR = { fill: "hsl(var(--muted))", opacity: 0.6, radius: 8 } as const;
