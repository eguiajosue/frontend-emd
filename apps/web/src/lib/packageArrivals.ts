import { getDeadlineState } from "@/lib/orderDeadline";
import type { Order } from "@/types";

/**
 * "Llegada de paquetes" del Modo TV de Tareas: cada trabajo nuevo del área (o
 * asignado a mí) entra como una caja que cae, se abre y suelta su hoja.
 * Aquí vive la parte pura: de qué avisos sale una llegada, qué prioridad
 * tiene (color + tipo de animación + sonido) y cómo se arma la cola.
 */

export type ArrivalPriority = "overdue" | "at_risk" | "calm" | "changes";

export type ArrivalSource = "area" | "assigned" | "demo";

export interface PackageArrival {
  /** Único por llegada (dos avisos del mismo pedido son dos llegadas). */
  id: string;
  orderId: number;
  area: string | null;
  clientName: string | null;
  description: string | null;
  deliveryDate: string | null;
  source: ArrivalSource;
  /** Volvió de Recepción con cambios del cliente (Diseño). */
  changes: boolean;
  receivedAt: number;
}

let seq = 0;
function nextId(orderId: number): string {
  seq += 1;
  return `arrival-${orderId}-${Date.now().toString(36)}-${seq}`;
}

/** Payload de `newOrderNotification`: `orderId` si va a un área, `id` si es el del admin. */
export interface NewOrderPayload {
  id?: number | string;
  orderId?: number | string;
  clientName?: string | null;
  description?: string | null;
  area?: string | null;
  deliveryDate?: string | null;
  createdBy?: string;
}

/** Payload de `newAssignedOrderNotification`. */
export interface AssignedOrderPayload {
  orderId: number | string;
  description?: string | null;
  area?: string | null;
  deliveryDate?: string | null;
  clientName?: string | null;
  reason?: "order_assigned" | "design_montage_sent";
}

const CHANGES_RE = /cambios/i;

function toOrderId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Aviso de trabajo nuevo para el área. El del admin (`id` + `createdBy`, sin
 * área) no es trabajo de nadie en particular: no es un paquete.
 */
export function arrivalFromNewOrder(payload: NewOrderPayload, now = Date.now()): PackageArrival | null {
  if (payload.orderId == null) return null;
  const orderId = toOrderId(payload.orderId);
  if (orderId == null) return null;
  const description = payload.description ?? null;
  return {
    id: nextId(orderId),
    orderId,
    area: payload.area ?? null,
    clientName: payload.clientName ?? null,
    description,
    deliveryDate: payload.deliveryDate ?? null,
    source: "area",
    changes: payload.area === "diseno" && CHANGES_RE.test(description ?? ""),
    receivedAt: now,
  };
}

/** Pedido asignado a mí. El "montaje enviado" es de Recepción: no es un paquete. */
export function arrivalFromAssigned(payload: AssignedOrderPayload, now = Date.now()): PackageArrival | null {
  if (payload.reason === "design_montage_sent") return null;
  const orderId = toOrderId(payload.orderId);
  if (orderId == null) return null;
  const description = payload.description ?? null;
  return {
    id: nextId(orderId),
    orderId,
    area: payload.area ?? null,
    clientName: payload.clientName ?? null,
    description,
    deliveryDate: payload.deliveryDate ?? null,
    source: "assigned",
    changes: payload.area === "diseno" && CHANGES_RE.test(description ?? ""),
    receivedAt: now,
  };
}

/** Llegada de mentira para la demo / los tests. */
export function demoArrival(
  input: Partial<PackageArrival> & { orderId: number },
  now = Date.now()
): PackageArrival {
  return {
    area: null,
    clientName: null,
    description: null,
    deliveryDate: null,
    changes: false,
    ...input,
    id: nextId(input.orderId),
    source: "demo",
    receivedAt: now,
  };
}

/**
 * Prioridad por fecha de entrega (los mismos tonos que el muro de pedidos):
 * vencido → rojo, en riesgo → ámbar, a tiempo / sin fecha → calma. Los
 * cambios solicitados ganan sobre el plazo: es otra clase de aviso.
 */
export function arrivalPriority(
  arrival: Pick<PackageArrival, "deliveryDate" | "changes">,
  now: number
): ArrivalPriority {
  if (arrival.changes) return "changes";
  const { tone } = getDeadlineState(
    { deliveryDate: arrival.deliveryDate, creationDate: new Date(now).toISOString(), statusId: 1 } as unknown as Order,
    now
  );
  if (tone === "overdue") return "overdue";
  if (tone === "at_risk") return "at_risk";
  return "calm";
}

const PRIORITY_RANK: Record<ArrivalPriority, number> = { overdue: 0, changes: 1, at_risk: 2, calm: 3 };

/** La más urgente de un grupo (la caja grande toma su color). */
export function topPriority(priorities: ArrivalPriority[]): ArrivalPriority {
  return priorities.reduce<ArrivalPriority>(
    (best, p) => (PRIORITY_RANK[p] < PRIORITY_RANK[best] ? p : best),
    "calm"
  );
}

/** Cómo se ve y se mueve cada prioridad. Los colores son los del semáforo de la app. */
export interface PriorityStyle {
  label: string;
  /** Color principal (cinta, brillo) en hex: va a atributos SVG. */
  color: string;
  /** Clases para la hoja/tarjeta. */
  ring: string;
  badge: string;
  /** Segundos que tarda la caja en caer. */
  dropDuration: number;
  /** Rebote del spring al aterrizar (0 = sin rebote). */
  bounce: number;
  /** Sacudida al aterrizar (vencido). */
  shake: boolean;
  /** Brillo que late mientras se muestra la hoja. */
  pulse: boolean;
  /** Flota suave en lugar de caer. */
  float: boolean;
}

export const PRIORITY_STYLE: Record<ArrivalPriority, PriorityStyle> = {
  overdue: {
    label: "Vencido",
    color: "#f43f5e",
    ring: "ring-rose-500 shadow-[0_0_48px_rgba(244,63,94,0.55)]",
    badge: "bg-rose-500/15 text-rose-300",
    dropDuration: 0.42,
    bounce: 0.45,
    shake: true,
    pulse: true,
    float: false,
  },
  at_risk: {
    label: "Urgente",
    color: "#f59e0b",
    ring: "ring-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.45)]",
    badge: "bg-amber-400/15 text-amber-300",
    dropDuration: 0.7,
    bounce: 0.35,
    shake: false,
    pulse: false,
    float: false,
  },
  calm: {
    label: "Nuevo",
    color: "#38bdf8",
    ring: "ring-sky-400 shadow-[0_0_36px_rgba(56,189,248,0.4)]",
    badge: "bg-sky-400/15 text-sky-300",
    dropDuration: 1.1,
    bounce: 0.15,
    shake: false,
    pulse: false,
    float: true,
  },
  changes: {
    label: "Cambios solicitados",
    color: "#a78bfa",
    ring: "ring-violet-400 shadow-[0_0_40px_rgba(167,139,250,0.45)]",
    badge: "bg-violet-400/15 text-violet-300",
    dropDuration: 0.8,
    bounce: 0.25,
    shake: false,
    pulse: false,
    float: false,
  },
};

/**
 * Tiempos (ms desde que empieza) de cada paso de un paquete. Vencido va más
 * rápido; la calma, más pausada. La hoja vuela a su tarjeta en `fly` y todo
 * termina en `done` (~4 s).
 */
export interface ArrivalTimeline {
  land: number;
  open: number;
  sheet: number;
  fly: number;
  done: number;
}

export function arrivalTimeline(priority: ArrivalPriority, batch = false): ArrivalTimeline {
  const style = PRIORITY_STYLE[priority];
  const land = Math.round(style.dropDuration * 1000);
  const open = land + (style.shake ? 450 : 300);
  const sheet = open + 450;
  const fly = sheet + (batch ? 1900 : 1500);
  return { land, open, sheet, fly, done: fly + 750 };
}

/** Timeline corto para prefers-reduced-motion: aparece, se lee, se va. */
export const REDUCED_TIMELINE: ArrivalTimeline = { land: 0, open: 0, sheet: 0, fly: 2600, done: 3000 };

/** Más de esto en cola = una sola caja grande con todos. */
export const BATCH_THRESHOLD = 3;
/** Hojas que se dibujan en el abanico (el resto se cuenta en el rótulo). */
export const MAX_FAN = 5;

/** Lo que se muestra a continuación: un paquete o la caja grande. */
export type ArrivalStep =
  | { kind: "single"; arrivals: [PackageArrival] }
  | { kind: "batch"; arrivals: PackageArrival[] };

/**
 * Saca el siguiente paso de la cola. Con más de `BATCH_THRESHOLD` esperando
 * no tiene sentido verlos de a uno (serían 16 s de cajas): van todos juntos.
 */
export function takeNextStep(queue: PackageArrival[]): { step: ArrivalStep | null; rest: PackageArrival[] } {
  if (queue.length === 0) return { step: null, rest: [] };
  if (queue.length > BATCH_THRESHOLD) return { step: { kind: "batch", arrivals: queue.slice() }, rest: [] };
  const [first, ...rest] = queue;
  return { step: { kind: "single", arrivals: [first] }, rest };
}

/** Ventana en la que dos avisos del mismo pedido y área son el mismo paquete. */
export const DEDUPE_WINDOW_MS = 10_000;

/**
 * Encola una llegada, salvo que el mismo pedido/área ya esté esperando (el
 * backend puede avisar a la room del área y al usuario por el mismo pedido).
 */
export function enqueueArrival(queue: PackageArrival[], arrival: PackageArrival): PackageArrival[] {
  const dup = queue.some(
    (a) =>
      a.orderId === arrival.orderId &&
      (a.area ?? null) === (arrival.area ?? null) &&
      Math.abs(a.receivedAt - arrival.receivedAt) < DEDUPE_WINDOW_MS
  );
  return dup ? queue : [...queue, arrival];
}
