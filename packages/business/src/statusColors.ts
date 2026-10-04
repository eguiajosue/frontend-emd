/**
 * Mapeo único de color por estado de pedido. Usar SIEMPRE desde aquí
 * (tabla de pedidos, Mis Tareas, panel admin, tablero de estatus, detalle
 * de pedido) para que el significado de cada color sea consistente en
 * toda la app, en light y dark mode.
 *
 * Los 5 estados originales (pendiente..entregado) se resuelven por id, que
 * es estable. Los 4 estados del flujo de diseño (ver `DESIGN_FLOW_STATUS_NAMES`
 * en `orderStatus.ts`) los siembra el backend con ids que pueden variar entre
 * entornos, así que se resuelven por NOMBRE — por eso toda función aquí acepta
 * un `statusName` opcional (típicamente `order.status?.name`) que, cuando
 * matchea un estado de diseño conocido, tiene prioridad sobre el id.
 */
import { statusMap } from "./orderStatus";

export type StatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "progress"
  | "success"
  | "done"
  | "danger"
  | "critical";

const TONE_BY_STATUS_ID: Record<number, StatusTone> = {
  1: "neutral", // pendiente
  2: "info", // en pruebas
  3: "warning", // en proceso
  4: "progress", // terminado
  5: "success", // entregado
  10: "critical", // cancelado
};

/**
 * Tono por nombre de estado (lowercase) para los 4 estados del flujo de
 * diseño — nunca por id, porque el backend los siembra con ids variables.
 */
const TONE_BY_DESIGN_STATUS_NAME: Record<string, StatusTone> = {
  "en diseño": "info", // misma familia que "en pruebas": etapa temprana
  "esperando autorización": "warning", // ámbar: esperando algo externo (al cliente)
  "cambios solicitados": "danger", // requiere acción de Recepción/Diseño
  autorizado: "success", // verde: listo para pasar a producción
};

/**
 * Clases Tailwind (bg + texto + borde) por tono, pensadas para light y dark.
 * Píldora tintada suave: texto del color + fondo del mismo color al ~10%, sin
 * borde visible (el `border-transparent` mantiene la altura de los call sites
 * que todavía agregan `border`). El color fuerte queda para el texto y el
 * punto/barra; nunca un bloque saturado.
 */
const CLASSES_BY_TONE: Record<StatusTone, string> = {
  neutral: "border-transparent bg-slate-500/10 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  info: "border-transparent bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  warning: "border-transparent bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  progress: "border-transparent bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  success: "border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  done: "border-transparent bg-primary/10 text-primary",
  danger: "border-transparent bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  critical: "border-transparent bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
};

/** Punto (indicador) sólido por tono, para usar en leyendas/gráficos. */
const DOT_BY_TONE: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  progress: "bg-violet-500",
  success: "bg-emerald-500",
  done: "bg-primary",
  danger: "bg-orange-500",
  critical: "bg-red-500",
};

function toneByName(statusName: string | null | undefined): StatusTone | null {
  if (!statusName) return null;
  return TONE_BY_DESIGN_STATUS_NAME[statusName.toLowerCase()] ?? null;
}

/**
 * Tono semántico de un estado. Si `statusName` matchea uno de los 4 estados
 * del flujo de diseño, gana por sobre `statusId` (cuyo id para esos estados
 * puede variar entre entornos); si no, se resuelve por id como siempre.
 */
export function getStatusTone(statusId: number, statusName?: string | null): StatusTone {
  return toneByName(statusName) ?? TONE_BY_STATUS_ID[statusId] ?? "neutral";
}

/** Clases para un badge/pill de estado (bg + texto + borde). */
export function getStatusBadgeClasses(statusId: number, statusName?: string | null): string {
  return CLASSES_BY_TONE[getStatusTone(statusId, statusName)];
}

/** Clase de color sólido, útil para un punto indicador o barra. */
export function getStatusDotClasses(statusId: number, statusName?: string | null): string {
  return DOT_BY_TONE[getStatusTone(statusId, statusName)];
}

/**
 * Nombre visible de un estado. Prioriza `statusName` (necesario para los 4
 * estados de diseño, ausentes de `statusMap`); si no viene, cae al mapa fijo
 * de los 5 estados originales.
 */
export function getStatusLabel(statusId: number, statusName?: string | null): string {
  return statusName ?? statusMap[statusId] ?? "desconocido";
}

/** Colores HEX por estado, para series/tooltips de recharts. */
export const STATUS_CHART_COLORS: Record<number, string> = {
  1: "#94a3b8", // slate-400
  2: "#0ea5e9", // sky-500
  3: "#f59e0b", // amber-500
  4: "#8b5cf6", // violet-500
  5: "#10b981", // emerald-500
  10: "#ef4444", // red-500
};

/** Colores HEX por nombre, para los 4 estados de diseño (ids variables entre entornos). */
const CHART_COLOR_BY_DESIGN_STATUS_NAME: Record<string, string> = {
  "en diseño": "#0ea5e9",
  "esperando autorización": "#f59e0b",
  "cambios solicitados": "#f97316", // orange-500
  autorizado: "#10b981",
};

export function getStatusChartColor(statusId: number, statusName?: string | null): string {
  if (statusName) {
    const byName = CHART_COLOR_BY_DESIGN_STATUS_NAME[statusName.toLowerCase()];
    if (byName) return byName;
  }
  return STATUS_CHART_COLORS[statusId] ?? "#94a3b8";
}
