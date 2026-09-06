/**
 * Mapeo único de color por estado de pedido. Usar SIEMPRE desde acá
 * (tabla de pedidos, Mis Tareas, panel admin, tablero de estatus, detalle
 * de pedido) para que el significado de cada color sea consistente en
 * toda la app, en light y dark mode.
 */
import { statusMap } from "@/lib/orderStatus";

export type StatusTone = "neutral" | "info" | "warning" | "progress" | "success" | "done";

const TONE_BY_STATUS_ID: Record<number, StatusTone> = {
  1: "neutral", // pendiente
  2: "info", // en pruebas
  3: "warning", // en proceso
  4: "progress", // terminado
  5: "success", // entregado
};

/** Clases Tailwind (bg + texto + borde) por tono, pensadas para light y dark. */
const CLASSES_BY_TONE: Record<StatusTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  info: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  warning:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  progress:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
  success:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  done: "bg-primary/10 text-primary border-primary/20",
};

/** Punto (indicador) sólido por tono, para usar en leyendas/gráficos. */
const DOT_BY_TONE: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  progress: "bg-violet-500",
  success: "bg-emerald-500",
  done: "bg-primary",
};

export function getStatusTone(statusId: number): StatusTone {
  return TONE_BY_STATUS_ID[statusId] ?? "neutral";
}

/** Clases para un badge/pill de estado (bg + texto + borde). */
export function getStatusBadgeClasses(statusId: number): string {
  return CLASSES_BY_TONE[getStatusTone(statusId)];
}

/** Clase de color sólido, útil para un punto indicador o barra. */
export function getStatusDotClasses(statusId: number): string {
  return DOT_BY_TONE[getStatusTone(statusId)];
}

export function getStatusLabel(statusId: number): string {
  return statusMap[statusId] ?? "desconocido";
}

/** Colores HEX por estado, para series/tooltips de recharts. */
export const STATUS_CHART_COLORS: Record<number, string> = {
  1: "#94a3b8", // slate-400
  2: "#0ea5e9", // sky-500
  3: "#f59e0b", // amber-500
  4: "#8b5cf6", // violet-500
  5: "#10b981", // emerald-500
};

export function getStatusChartColor(statusId: number): string {
  return STATUS_CHART_COLORS[statusId] ?? "#94a3b8";
}
