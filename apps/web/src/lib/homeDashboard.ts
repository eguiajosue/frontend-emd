import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import { AT_RISK_WINDOW_MS } from "@/lib/orderDeadline";
import type {
  AreaHealth,
  AttentionReason,
  DesignWorkItem,
  ProductionWorkItem,
} from "@/types";

/**
 * Lógica pura de los Inicio (Recepción, Diseño, Producción): en qué orden se
 * muestran los trabajos y cómo se nombra cada situación. Sin React.
 */

/* ------------------------------- Prioridad -------------------------------- */

/**
 * Por qué un trabajo va antes que otro. Lo primero es lo que está por
 * caducar (o ya caducó) y lo que nadie empezó; recién después lo que ya está
 * en curso y con tiempo.
 */
export type WorkPriority = "overdue" | "changes" | "due_soon" | "not_started" | "in_progress";

export const PRIORITY_ORDER: WorkPriority[] = ["overdue", "changes", "due_soon", "not_started", "in_progress"];

export const PRIORITY_LABEL: Record<WorkPriority, string> = {
  overdue: "Vencidos",
  changes: "Cambios del cliente",
  due_soon: "Por vencer",
  not_started: "Sin empezar",
  in_progress: "En curso",
};

export interface Prioritized<T> {
  item: T;
  priority: WorkPriority;
  /** Milisegundos hasta la entrega (negativo si venció); null sin fecha. */
  remainingMs: number | null;
}

function remainingOf(deliveryDate: string | null, now: number): number | null {
  if (!deliveryDate) return null;
  const t = Date.parse(deliveryDate);
  return Number.isNaN(t) ? null : t - now;
}

function sortPrioritized<T extends { availableSince: string }>(list: Prioritized<T>[]): Prioritized<T>[] {
  return list.sort((a, b) => {
    const rank = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (rank !== 0) return rank;
    // Dentro del grupo: la entrega más cercana (o más vencida) primero; sin
    // fecha al final; a igualdad, el que espera hace más.
    const ra = a.remainingMs ?? Infinity;
    const rb = b.remainingMs ?? Infinity;
    if (ra !== rb) return ra - rb;
    return Date.parse(a.item.availableSince) - Date.parse(b.item.availableSince);
  });
}

function deadlinePriority(remainingMs: number | null): WorkPriority | null {
  if (remainingMs === null) return null;
  if (remainingMs < 0) return "overdue";
  if (remainingMs < AT_RISK_WINDOW_MS) return "due_soon";
  return null;
}

/** Trabajos de producción en el orden en que conviene hacerlos. */
export function prioritizeProduction(items: ProductionWorkItem[], now: number): Prioritized<ProductionWorkItem>[] {
  return sortPrioritized(
    items.map((item) => {
      const remainingMs = remainingOf(item.deliveryDate, now);
      const priority =
        deadlinePriority(remainingMs) ?? (item.status === "pendiente" ? "not_started" : "in_progress");
      return { item, priority, remainingMs };
    })
  );
}

export const isChangesRequested = (status: string) => status.toLowerCase() === "cambios solicitados";

/**
 * Bandeja de Diseño por prioridad: lo vencido; después lo que volvió con
 * cambios del cliente (el cliente está esperando); después lo que vence
 * pronto, lo nuevo sin abrir y, por último, lo que ya está en curso.
 */
export function prioritizeDesign(items: DesignWorkItem[], now: number): Prioritized<DesignWorkItem>[] {
  return sortPrioritized(
    items.map((item) => {
      const remainingMs = remainingOf(item.deliveryDate, now);
      const byDeadline = deadlinePriority(remainingMs);
      const priority: WorkPriority =
        byDeadline === "overdue"
          ? "overdue"
          : isChangesRequested(item.status)
            ? "changes"
            : (byDeadline ?? (item.designStartedAt ? "in_progress" : "not_started"));
      return { item, priority, remainingMs };
    })
  );
}

/** Agrupa una lista ya priorizada, respetando el orden de los grupos. */
export function groupByPriority<T>(list: Prioritized<T>[]): Array<{ priority: WorkPriority; items: Prioritized<T>[] }> {
  return PRIORITY_ORDER.map((priority) => ({
    priority,
    items: list.filter((p) => p.priority === priority),
  })).filter((group) => group.items.length > 0);
}

/* ------------------------------ Tiempo relativo ---------------------------- */

/** "hace 3 horas" / "en 2 días" (redondeado, sin segundos). */
export function relativeTo(iso: string | null, now: number): string {
  if (!iso) return "";
  const date = Date.parse(iso);
  if (Number.isNaN(date)) return "";
  if (Math.abs(date - now) < 60_000) return "ahora";
  return formatDistanceStrict(date, now, { locale: es, addSuffix: true, roundingMethod: "floor" });
}

/** Texto del plazo de un trabajo: "Vencido hace 3 horas" / "Vence en 20 horas" / "Entrega en 5 días". */
export function dueText(deliveryDate: string | null, now: number): string {
  const remaining = remainingOf(deliveryDate, now);
  if (remaining === null) return "Sin fecha de entrega";
  if (remaining < 0) return `Vencido ${relativeTo(deliveryDate, now)}`;
  if (remaining < AT_RISK_WINDOW_MS) return `Vence ${relativeTo(deliveryDate, now)}`;
  return `Entrega ${relativeTo(deliveryDate, now)}`;
}

/* --------------------------- Atención (Recepción) -------------------------- */

export const ATTENTION_META: Record<AttentionReason, { label: string; pill: string }> = {
  overdue: {
    label: "Vencido",
    pill: "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  },
  ready_not_delivered: {
    label: "Listo sin entregar",
    pill: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  },
  at_risk_not_started: {
    label: "Por vencer sin empezar",
    pill: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  waiting_client: {
    label: "Esperando al cliente",
    pill: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
  changes_requested: {
    label: "Cambios sin retomar",
    pill: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  design_not_started: {
    label: "Diseño sin empezar",
    pill: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  no_date: {
    label: "Sin fecha",
    pill: "bg-muted text-muted-foreground",
  },
};

/** Qué pasa y desde cuándo, en una frase (y qué conviene hacer). */
export function attentionText(reason: AttentionReason, since: string | null, now: number): string {
  const ago = relativeTo(since, now);
  switch (reason) {
    case "overdue":
      return `Venció ${ago}`;
    case "ready_not_delivered":
      return since ? `Listo ${ago}: avisar al cliente para que lo retire` : "Listo: avisar al cliente para que lo retire";
    case "at_risk_not_started":
      return `Vence ${ago} y nadie lo empezó`;
    case "waiting_client":
      return `Montaje enviado ${ago}: conviene llamar al cliente`;
    case "changes_requested":
      return `El cliente pidió cambios ${ago}`;
    case "design_not_started":
      return `Entró a Diseño ${ago} y nadie lo abrió`;
    case "no_date":
      return "Sin fecha de entrega: acordarla con el cliente";
  }
}

/* ------------------------------- Salud de área ----------------------------- */

export const HEALTH_META: Record<AreaHealth, { label: string; dot: string; text: string }> = {
  ok: { label: "Al día", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  warning: { label: "Atención", dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300" },
  critical: { label: "Con vencidos", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
};

/* ---------------------------------- Varios --------------------------------- */

/** Qué Inicio le toca a cada quien: Recepción/admin ven el control general; las áreas, el suyo. */
export type HomeKind = "reception" | "design" | "production";

const PRODUCTION_ROLES = ["taller", "dtf", "bordado", "laser", "impresiones"];

export function homeKindsFor(roles: string[]): HomeKind[] {
  if (roles.some((r) => r === "admin" || r === "superuser" || r === "recepcion")) return ["reception"];
  const kinds: HomeKind[] = [];
  if (roles.includes("diseno")) kinds.push("design");
  if (roles.some((r) => PRODUCTION_ROLES.includes(r))) kinds.push("production");
  return kinds;
}
