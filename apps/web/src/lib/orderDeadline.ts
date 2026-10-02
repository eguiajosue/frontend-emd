import {
  isCancelledStatus,
  isDeliveredStatus,
  FINISHED_STATUS_ID,
} from "@/lib/orderStatus";
import type { Order } from "@/types";

/** Menos de esto para la entrega = "en riesgo". */
export const AT_RISK_WINDOW_MS = 48 * 60 * 60 * 1000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Semáforo del muro de pedidos. Los tres primeros son plazo vivo; el resto
 * son pedidos cuyo reloj ya no corre (o nunca arrancó).
 */
export type DeadlineTone =
  | "overdue"
  | "at_risk"
  | "on_time"
  | "no_date"
  | "finished"
  | "delivered"
  | "cancelled";

export interface DeadlineState {
  tone: DeadlineTone;
  /** ms hasta la entrega (negativo si venció); `null` sin fecha o reloj parado. */
  remainingMs: number | null;
  /** ms desde el alta del pedido. */
  elapsedMs: number;
}

export function getDeadlineState(order: Order, now: number): DeadlineState {
  const created = new Date(order.creationDate).getTime();
  const elapsedMs = Number.isNaN(created) ? 0 : Math.max(0, now - created);

  if (isCancelledStatus(order.statusId)) return { tone: "cancelled", remainingMs: null, elapsedMs };
  if (isDeliveredStatus(order.statusId)) return { tone: "delivered", remainingMs: null, elapsedMs };
  if (order.statusId === FINISHED_STATUS_ID) return { tone: "finished", remainingMs: null, elapsedMs };

  const due = order.deliveryDate ? new Date(order.deliveryDate).getTime() : NaN;
  if (Number.isNaN(due)) return { tone: "no_date", remainingMs: null, elapsedMs };

  const remainingMs = due - now;
  const tone: DeadlineTone =
    remainingMs < 0 ? "overdue" : remainingMs < AT_RISK_WINDOW_MS ? "at_risk" : "on_time";
  return { tone, remainingMs, elapsedMs };
}

/**
 * "4D 2H 40M" / "5H 12M" / "42M". Sin segundos a propósito: el muro se lee de
 * lejos y un número que cambia cada segundo distrae más de lo que informa.
 */
export function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  const minutes = Math.floor((abs % HOUR) / MINUTE);
  if (days > 0) return `${days}D ${hours}H ${minutes}M`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
}

/** Duración compacta para el "transcurrido": "3d 4h" / "5h 12m" / "8m". */
export function formatElapsed(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const TONE_RANK: Record<DeadlineTone, number> = {
  overdue: 0,
  at_risk: 1,
  on_time: 2,
  no_date: 3,
  finished: 4,
  delivered: 5,
  cancelled: 6,
};

/** Lo más urgente primero; dentro de cada tono, el plazo más corto. */
export function compareByUrgency(a: DeadlineState, b: DeadlineState): number {
  const rank = TONE_RANK[a.tone] - TONE_RANK[b.tone];
  if (rank !== 0) return rank;
  if (a.remainingMs != null && b.remainingMs != null) return a.remainingMs - b.remainingMs;
  return 0;
}

/** Tareas de área terminadas / totales (lo que la imagen llama "tasks"). */
export function getTaskProgress(order: Order): { done: number; total: number } {
  const tasks = order.areaTasks ?? [];
  return {
    done: tasks.filter((t) => t.status === "terminado").length,
    total: tasks.length,
  };
}

/** Áreas que tocan el pedido: las de sus tareas, o el área destino/actual. */
export function getOrderAreas(order: Order): string[] {
  const fromTasks = (order.areaTasks ?? []).map((t) => t.area);
  if (fromTasks.length > 0) return Array.from(new Set(fromTasks));
  const fallback = order.productionArea ?? order.area;
  return fallback ? [fallback] : [];
}
