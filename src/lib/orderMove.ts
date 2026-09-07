import type { AreaTaskStatus, Order } from "@/types";

/**
 * Estado de tarea de área equivalente a cada estado de producción del pedido.
 * "entregado" (5) y "cancelado" (10) no aparecen: son decisiones sobre el
 * pedido completo, no sobre el trabajo de un área.
 */
export const AREA_TASK_STATUS_BY_ORDER_STATUS: Record<number, AreaTaskStatus> = {
  1: "pendiente",
  3: "en_proceso",
  4: "terminado",
};

/** Quién está mirando, a efectos de decidir qué tareas puede mover. */
export interface MoveActor {
  /** Áreas de producción del usuario (vacío para recepción/admin). */
  areas: string[];
  /** Recepción/admin/superuser: pueden mover la tarea de cualquier área. */
  isManager: boolean;
}

/**
 * Tareas de área que esta persona mueve cuando cambia el estado del pedido.
 *
 * El tablero de producción ubica cada pedido por el estado de ESTAS tareas (ver
 * `effectiveProductionStatusId`), así que cambiar el estado —arrastrando la
 * tarjeta o con los botones del detalle— tiene que escribir acá. Escribir
 * `Order.statusId` en su lugar devuelve 200 y no mueve nada: la etiqueta cambia
 * pero la tarjeta se queda en su columna.
 *
 * Quien trabaja un área mueve la suya. Recepción/admin no trabajan ninguna, así
 * que mueven TODAS: decir "este pedido está en proceso" es decirlo de todo el
 * trabajo que tiene abierto.
 */
export function areaTasksToMove(order: Order, actor: MoveActor) {
  const tasks = order.areaTasks ?? [];
  if (tasks.length === 0) return [];
  const mine = tasks.filter((task) => actor.areas.includes(task.area));
  if (mine.length > 0) return mine;
  if (actor.isManager) return tasks;
  // Sin área propia y sin permiso de coordinación: sólo si no hay ambigüedad.
  return tasks.length === 1 ? tasks : [];
}

/** `true` si mover este pedido a ese estado va a poder aplicarse. */
export function canApplyOrderMove(
  order: Order,
  newStatusId: number,
  actor: MoveActor,
): boolean {
  const areaStatus = AREA_TASK_STATUS_BY_ORDER_STATUS[newStatusId];
  if (!areaStatus) return true; // entregado/cancelado: siempre a nivel pedido
  if ((order.areaTasks ?? []).length === 0) return true;
  const targets = areaTasksToMove(order, actor);
  // Si TODAS ya están ahí no hay nada que mover.
  return targets.length > 0 && targets.some((task) => task.status !== areaStatus);
}
