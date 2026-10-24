import { compareByUrgency } from "@/lib/orderDeadline";
import { taskDeadline } from "@/lib/myTasks";
import type { TvTask } from "@/lib/tvBoard";
import type { AreaStage } from "@/types";
import { stagesOf, type SessionAccess } from "@emd/business/src/areas";
import { DESIGN_AREA, productionAreasOf } from "@/lib/areas";

/**
 * Tablero por etapas (Tareas asignadas y Modo TV). Un área con etapas previas
 * a producción (en Bordado: digitalizar y probar, WORKFLOW.md §3.1) no arranca
 * directo en producción, así que su tablero lleva una columna por etapa antes
 * de las dos de siempre:
 *
 *   <etapa 1> → … → <etapa n> → En producción → Terminado
 *
 * "En producción" junta lo pendiente y lo que ya está en proceso (la tarjeta
 * dice cuál de los dos es). Las etapas salen del catálogo de áreas.
 */

export const PRODUCTION_COLUMN = "produccion";
export const DONE_COLUMN = "terminado";

const STAGE_COLUMN_PREFIX = "stage:";

export type StageColumnKind = "work" | "review" | "production" | "done";

export interface StageColumn {
  /** `stage:<clave>` para una etapa; `produccion` o `terminado`. */
  id: string;
  label: string;
  hint: string;
  kind: StageColumnKind;
}

/** Tarjetas del tablero por columna (`StageColumn.id`). */
export type StageBoard = Record<string, TvTask[]>;

export const stageColumnId = (stage: Pick<AreaStage, "key">) =>
  `${STAGE_COLUMN_PREFIX}${stage.key}`;

/** ¿El área tiene etapas previas a producción? */
export function hasStages(area: string | null | undefined): boolean {
  return stagesOf(area).length > 0;
}

/** ¿Es una tarea de producción de un área con etapas? (Diseño nunca lo es.) */
export function isStageTask(task: Pick<TvTask, "kind" | "area">): boolean {
  return task.kind === "production" && hasStages(task.area);
}

/** Etapa previa vigente de una tarea (null = ya produce o terminó). */
export function taskStage(
  task: Pick<TvTask, "stage" | "status">,
): AreaStage | null {
  return task.status === "terminado" ? null : (task.stage ?? null);
}

/** La etapa que sigue a `stage` en su área y la anterior (null = producción / primera). */
export function stageNeighbors(
  area: string,
  stage: Pick<AreaStage, "id"> | null,
): { next: AreaStage | null; previous: AreaStage | null } {
  const stages = stagesOf(area);
  const index = stage ? stages.findIndex((s) => s.id === stage.id) : -1;
  if (index === -1) return { next: stage ? null : (stages[0] ?? null), previous: null };
  return { next: stages[index + 1] ?? null, previous: stages[index - 1] ?? null };
}

/** Texto del botón que avanza una etapa de trabajo hacia `next` (null = producción). */
export function advanceLabel(next: { name: string } | null): string {
  return next ? `Pasar a «${next.name}»` : "Listo para producir";
}

/** Columnas del tablero de un área: una por etapa, producción y terminado. */
export function stageColumns(area: string): StageColumn[] {
  const stages = stagesOf(area);
  return [
    ...stages.map((stage, index): StageColumn => ({
      id: stageColumnId(stage),
      label: stage.name,
      kind: stage.kind,
      hint:
        stage.kind === "review"
          ? "Esperando que se apruebe o se rechace."
          : stages[index + 1]
            ? `Se completa y pasa a «${stages[index + 1].name}».`
            : "Se completa y queda lista para producir.",
    })),
    {
      id: PRODUCTION_COLUMN,
      label: "En producción",
      kind: "production",
      hint: "Etapas listas: ya se puede producir.",
    },
    { id: DONE_COLUMN, label: "Terminado", kind: "done", hint: "Últimas 12 h" },
  ];
}

/** Columna de una tarea (una etapa que ya no está en el área cuenta como producción). */
export function columnOf(
  task: Pick<TvTask, "stage" | "status" | "area">,
): string {
  if (task.status === "terminado") return DONE_COLUMN;
  const stage = taskStage(task);
  if (stage && stagesOf(task.area).some((s) => s.id === stage.id)) {
    return stageColumnId(stage);
  }
  return PRODUCTION_COLUMN;
}

/** ¿La revisión anterior se rechazó y la tarea regresó a una etapa de trabajo? */
export function wasRejected(
  task: Pick<TvTask, "stage" | "status" | "lastTest">,
): boolean {
  return (
    taskStage(task)?.kind === "work" && task.lastTest?.result === "rechazada"
  );
}

const isManager = (roles: readonly string[]) =>
  roles.some((r) => r === "recepcion" || r === "admin" || r === "superuser");

/** Quien trabaja un área (o Recepción/admin) puede mover las etapas (mismo criterio que el backend). */
export function canMoveStages({ roles, areas }: SessionAccess): boolean {
  return isManager(roles) || productionAreasOf(areas).length > 0;
}

/**
 * El área cuyo tablero por etapas se muestra, o null si va el de tres
 * columnas. `activeArea` es el filtro elegido; sin filtro, aplica si el
 * usuario trabaja únicamente un área con etapas (y no es Diseño ni gerencia,
 * que ven más áreas).
 */
export function stageBoardArea(
  activeArea: string | null,
  { roles, areas }: SessionAccess,
): string | null {
  if (activeArea) return hasStages(activeArea) ? activeArea : null;
  const production = productionAreasOf(areas);
  return production.length === 1 &&
    hasStages(production[0]) &&
    !areas.includes(DESIGN_AREA) &&
    !isManager(roles)
    ? production[0]
    : null;
}

/** Reparte las tareas de un área en columnas, cada una ordenada como se trabaja. */
export function buildStageBoard(
  area: string,
  tasks: TvTask[],
  now: number,
): StageBoard {
  const board: StageBoard = Object.fromEntries(
    stageColumns(area).map((column) => [column.id, [] as TvTask[]]),
  );
  for (const task of tasks) {
    if (task.kind === "production" && task.area === area) {
      board[columnOf(task)].push(task);
    }
  }

  const byUrgency = (a: TvTask, b: TvTask) =>
    compareByUrgency(taskDeadline(a, now), taskDeadline(b, now)) ||
    a.order.id - b.order.id;
  for (const column of stageColumns(area)) {
    const list = board[column.id];
    if (column.kind === "work") {
      // Lo rechazado va primero (hay que corregirlo).
      list.sort(
        (a, b) =>
          Number(wasRejected(b)) - Number(wasRejected(a)) || byUrgency(a, b),
      );
    } else if (column.kind === "production") {
      // Lo que ya se está haciendo, antes que lo que falta empezar.
      list.sort(
        (a, b) =>
          Number(b.status === "en_proceso") -
            Number(a.status === "en_proceso") || byUrgency(a, b),
      );
    } else if (column.kind === "done") {
      list.sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      );
    } else {
      list.sort(byUrgency);
    }
  }
  return board;
}
