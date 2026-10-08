import { compareByUrgency } from "@/lib/orderDeadline";
import { taskDeadline } from "@/lib/myTasks";
import type { TvTask } from "@/lib/tvBoard";
import type { EmbroideryPrepStage } from "@/types";

/**
 * Tablero de Bordado (Tareas asignadas y Modo TV). Bordado no arranca directo
 * en producción: antes se digitaliza y se prueba (WORKFLOW.md §3.1), así que su
 * tablero lleva cuatro columnas en lugar de las tres de las demás áreas:
 *
 *   Digitalizado → En pruebas → En producción → Terminado
 *
 * "En producción" junta lo pendiente y lo que ya está en proceso (la tarjeta
 * dice cuál de los dos es).
 */

export const EMBROIDERY_AREA = "bordado";

export type EmbroideryColumnId =
  | "digitalizado"
  | "en_pruebas"
  | "produccion"
  | "terminado";

export const EMBROIDERY_COLUMNS: {
  id: EmbroideryColumnId;
  label: string;
  hint: string;
}[] = [
  {
    id: "digitalizado",
    label: "Digitalizado",
    hint: "Se digitaliza el diseño y se manda a prueba.",
  },
  {
    id: "en_pruebas",
    label: "En pruebas",
    hint: "Esperando que se apruebe o rechace la prueba.",
  },
  {
    id: "produccion",
    label: "En producción",
    hint: "Prueba aprobada: ya se puede bordar.",
  },
  { id: "terminado", label: "Terminado", hint: "Últimas 12 h" },
];

export type EmbroideryBoard = Record<EmbroideryColumnId, TvTask[]>;

/** ¿Es una tarea de producción de Bordado? (Diseño nunca lo es.) */
export function isEmbroideryTask(task: Pick<TvTask, "kind" | "area">): boolean {
  return task.kind === "production" && task.area === EMBROIDERY_AREA;
}

/** Etapa previa vigente de una tarea (null = ya produce o terminó). */
export function prepStageOf(
  task: Pick<TvTask, "prepStage" | "status">,
): EmbroideryPrepStage | null {
  return task.status === "terminado" ? null : (task.prepStage ?? null);
}

/** Columna de una tarea de Bordado. */
export function embroideryColumnOf(
  task: Pick<TvTask, "prepStage" | "status">,
): EmbroideryColumnId {
  if (task.status === "terminado") return "terminado";
  const stage = prepStageOf(task);
  if (stage === "digitalizado") return "digitalizado";
  if (stage === "en_pruebas") return "en_pruebas";
  return "produccion";
}

/** ¿La prueba anterior se rechazó y la tarea volvió a digitalizado? */
export function wasRejected(
  task: Pick<TvTask, "prepStage" | "status" | "lastTest">,
): boolean {
  return (
    prepStageOf(task) === "digitalizado" &&
    task.lastTest?.result === "rechazada"
  );
}

/** Quien trabaja Bordado (o Recepción/admin) puede mover las etapas (mismo criterio que el backend). */
export function canMoveEmbroideryPrep(roles: string[]): boolean {
  return roles.some(
    (r) =>
      r === EMBROIDERY_AREA ||
      r === "recepcion" ||
      r === "admin" ||
      r === "superuser",
  );
}

/**
 * ¿La vista muestra sólo Bordado? Entonces va el tablero de cuatro columnas.
 * `activeArea` es el filtro elegido; sin filtro, aplica si el usuario trabaja
 * únicamente Bordado (y no es Diseño ni gerencia, que ven más áreas).
 */
export function isEmbroideryView(
  activeArea: string | null,
  productionRoles: string[],
  allRoles: string[],
): boolean {
  if (activeArea) return activeArea === EMBROIDERY_AREA;
  const areas = productionRoles.filter((r) => r !== "diseno");
  return (
    areas.length === 1 &&
    areas[0] === EMBROIDERY_AREA &&
    !allRoles.some(
      (r) =>
        r === "diseno" ||
        r === "admin" ||
        r === "superuser" ||
        r === "recepcion",
    )
  );
}

/** Reparte las tareas de Bordado en columnas, cada una ordenada como se trabaja. */
export function buildEmbroideryBoard(
  tasks: TvTask[],
  now: number,
): EmbroideryBoard {
  const board: EmbroideryBoard = {
    digitalizado: [],
    en_pruebas: [],
    produccion: [],
    terminado: [],
  };
  for (const task of tasks)
    if (isEmbroideryTask(task)) board[embroideryColumnOf(task)].push(task);

  const byUrgency = (a: TvTask, b: TvTask) =>
    compareByUrgency(taskDeadline(a, now), taskDeadline(b, now)) ||
    a.order.id - b.order.id;
  // Lo rechazado va primero (hay que corregirlo); lo que ya se está bordando, antes que lo que falta empezar.
  board.digitalizado.sort(
    (a, b) =>
      Number(wasRejected(b)) - Number(wasRejected(a)) || byUrgency(a, b),
  );
  board.en_pruebas.sort(byUrgency);
  board.produccion.sort(
    (a, b) =>
      Number(b.status === "en_proceso") - Number(a.status === "en_proceso") ||
      byUrgency(a, b),
  );
  board.terminado.sort(
    (a, b) =>
      new Date(b.completedAt ?? 0).getTime() -
      new Date(a.completedAt ?? 0).getTime(),
  );
  return board;
}
