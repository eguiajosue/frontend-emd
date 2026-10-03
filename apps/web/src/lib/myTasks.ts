import { compareByUrgency, getDeadlineState } from "@/lib/orderDeadline";
import type { MyTask, Order } from "@/types";

/** Urgencia de la tarea según la entrega de su pedido. */
export function taskDeadline(task: MyTask, now: number) {
  return getDeadlineState(task.order as unknown as Order, now);
}

/**
 * Bandeja de "Tareas asignadas": separada en lo propio y lo libre, cada parte
 * ordenada por urgencia (vencido, en riesgo, a tiempo, sin fecha). Dentro de
 * lo propio, lo que ya está en curso va antes que lo que falta empezar.
 */
export function groupMyTasks(
  tasks: MyTask[],
  now: number,
  area: string | null = null
): { mine: MyTask[]; free: MyTask[] } {
  const visible = area ? tasks.filter((t) => t.area === area) : tasks;
  const byUrgency = (a: MyTask, b: MyTask) => {
    const inProgress = Number(isInProgress(b)) - Number(isInProgress(a));
    if (inProgress !== 0) return inProgress;
    const urgency = compareByUrgency(taskDeadline(a, now), taskDeadline(b, now));
    return urgency !== 0 ? urgency : a.order.id - b.order.id;
  };
  return {
    mine: visible.filter((t) => t.mine).sort(byUrgency),
    free: visible.filter((t) => !t.mine).sort(byUrgency),
  };
}

export function isInProgress(task: MyTask): boolean {
  return task.kind === "production" && task.status === "en_proceso";
}

/** Volvió de Recepción con cambios del cliente. */
export function isReturnedDesign(task: MyTask): boolean {
  return task.kind === "design" && task.status.toLowerCase() === "cambios solicitados";
}

/** Áreas presentes en la bandeja, en el orden del usuario. */
export function taskAreas(tasks: MyTask[], userRoles: string[]): string[] {
  const present = new Set(tasks.map((t) => t.area));
  return userRoles.filter((role) => present.has(role));
}
