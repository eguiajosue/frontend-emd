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

/**
 * Tarea de área que le corresponde mover a quien está viendo el tablero, o
 * `null` si no hay una inequívoca.
 *
 * El tablero de producción ubica cada pedido por el estado de ESTA tarea (ver
 * `effectiveProductionStatusId`), así que arrastrar la tarjeta tiene que
 * escribir acá. Escribir `Order.statusId` en su lugar devolvía 200 y no movía
 * nada: la tarjeta volvía a su columna y parecía un cambio rechazado.
 */
export function areaTaskToMove(order: Order, viewerAreas: string[]) {
  const tasks = order.areaTasks ?? [];
  if (tasks.length === 0) return null;
  const mine = tasks.filter((task) => viewerAreas.includes(task.area));
  if (mine.length === 1) return mine[0];
  // Recepción/admin no trabajan un área: sólo hay destino inequívoco si el
  // pedido tiene una sola tarea. Con varias en paralelo, cuál avanzar se
  // decide en el detalle del pedido, no arrastrando una tarjeta.
  if (mine.length === 0 && tasks.length === 1) return tasks[0];
  return null;
}

/** `true` si arrastrar este pedido a ese estado va a poder aplicarse. */
export function canApplyOrderMove(
  order: Order,
  newStatusId: number,
  viewerAreas: string[],
): boolean {
  const areaStatus = AREA_TASK_STATUS_BY_ORDER_STATUS[newStatusId];
  if (!areaStatus) return true; // entregado/cancelado: siempre a nivel pedido
  if ((order.areaTasks ?? []).length === 0) return true;
  const task = areaTaskToMove(order, viewerAreas);
  return task !== null && task.status !== areaStatus;
}
