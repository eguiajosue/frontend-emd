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
 * Clases Tailwind (bg + texto + borde) por tono con tokens de DESIGN.md
 * (semánticos `*-soft`/`*-ink`, magenta de marca, destructive): ya cambian
 * solos en dark y cumplen >= 4.5:1. Píldora tintada suave, sin
 * borde visible (el `border-transparent` mantiene la altura de los call sites
 * que todavía agregan `border`). El color fuerte queda para el texto y el
 * punto/barra; nunca un bloque saturado.
 */
const CLASSES_BY_TONE: Record<StatusTone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  info: "border-transparent bg-info-soft text-info",
  warning: "border-transparent bg-warning-soft text-warning",
  progress: "border-transparent bg-magenta-soft text-magenta-ink",
  success: "border-transparent bg-success-soft text-success",
  done: "border-transparent bg-primary/10 text-foreground",
  danger: "border-transparent bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  critical: "border-transparent bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30",
};

/** Punto (indicador) sólido por tono, para usar en leyendas/gráficos. */
const DOT_BY_TONE: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/50",
  info: "bg-info",
  warning: "bg-warning",
  progress: "bg-magenta",
  success: "bg-success",
  done: "bg-primary",
  danger: "bg-orange-500",
  critical: "bg-destructive",
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
