import { getDeadlineState, type DeadlineTone } from "@/lib/orderDeadline";
import type { Order } from "@/types";

/** Query param de Pedidos que fija el filtro por plazo del muro de tarjetas. */
export const ORDER_TONE_PARAM = "plazo";

/**
 * Accesos guardados que cuelgan de "Pedidos" en el menú: las tres preguntas
 * que se hacen varias veces al día ("¿qué está atrasado?", "¿qué vence ya?",
 * "¿qué está listo para entregar?"), a un click y con su conteo en vivo.
 */
export const SAVED_ORDER_VIEWS: { tone: DeadlineTone; label: string }[] = [
  { tone: "overdue", label: "Vencidos" },
  { tone: "at_risk", label: "Vencen en 48 h" },
  { tone: "finished", label: "Por entregar" },
];

const VALID_TONES = new Set<DeadlineTone>([
  "overdue",
  "at_risk",
  "on_time",
  "no_date",
  "finished",
  "delivered",
  "cancelled",
]);

export function parseToneParam(value: string | null | undefined): DeadlineTone | null {
  return value && VALID_TONES.has(value as DeadlineTone) ? (value as DeadlineTone) : null;
}

export function orderViewHref(tone: DeadlineTone): string {
  return `/dashboard/orders?${ORDER_TONE_PARAM}=${tone}`;
}

export function countOrdersByTone(orders: Order[], now: number): Record<DeadlineTone, number> {
  const counts = Object.fromEntries([...VALID_TONES].map((t) => [t, 0])) as Record<DeadlineTone, number>;
  for (const order of orders) counts[getDeadlineState(order, now).tone] += 1;
  return counts;
}
