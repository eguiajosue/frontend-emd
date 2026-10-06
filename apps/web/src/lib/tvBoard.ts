import { compareByUrgency } from "@/lib/orderDeadline";
import { taskDeadline } from "@/lib/myTasks";
import type { AreaTaskStatus, MyTask } from "@/types";

/**
 * Tablero del Modo TV de "Tareas asignadas": TODO el trabajo de las áreas del
 * usuario (no sólo lo suyo y lo libre), en tres columnas.
 */

/** Tarea de `GET /orders/my-area-tasks` (backend `findForUser`). */
export interface AreaBoardTask {
  id: number;
  orderId: number;
  area: string;
  status: AreaTaskStatus;
  assignedUserId?: number | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  assignedUser?: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    username: string;
    isSharedAccount?: boolean;
  } | null;
  order: {
    id: number;
    description: string;
    deliveryDate: string | null;
    statusId: number;
    clientNameOverride: string | null;
    client: { first_name: string; last_name?: string | null } | null;
    /** Hoy no los manda el backend; se aprovechan si algún día llegan. */
    creationDate?: string;
    status?: { id: number; name: string };
  };
}

export type TvColumnId = "pendiente" | "en_proceso" | "terminado";

export const TV_COLUMNS: { id: TvColumnId; label: string }[] = [
  { id: "pendiente", label: "Pendiente" },
  { id: "en_proceso", label: "En proceso" },
  { id: "terminado", label: "Terminado" },
];

/** Una tarjeta del tablero: la forma de `MyTask` + cuándo terminó. */
export type TvTask = MyTask & { completedAt?: string | null };

export type TvBoard = Record<TvColumnId, TvTask[]>;

/** Cuánto tiempo se queda una tarea en "Terminado" (las recientes). */
export const RECENT_DONE_MS = 12 * 60 * 60 * 1000;
/** Tope de la columna "Terminado": la tele no es un historial. */
export const MAX_DONE = 12;

/** Columna de una tarea. Diseño: empezado (designStartedAt) = en proceso. */
export function tvColumnOf(task: TvTask): TvColumnId {
  if (task.kind === "design") return task.order.designStartedAt ? "en_proceso" : "pendiente";
  if (task.status === "terminado") return "terminado";
  if (task.status === "en_proceso") return "en_proceso";
  return "pendiente";
}

/** Convierte una tarea del área al formato de la bandeja. */
export function areaTaskToTvTask(task: AreaBoardTask, userId: number | null): TvTask {
  const shared = task.assignedUser?.isSharedAccount === true;
  const assigned = task.assignedUserId ?? task.assignedUser?.id ?? null;
  const { creationDate, status, ...order } = task.order;
  return {
    key: `task-${task.id}`,
    kind: "production",
    area: task.area,
    taskId: task.id,
    status: task.status,
    mine: !shared && assigned != null && assigned === userId,
    assignee:
      task.assignedUser && !shared
        ? {
            id: task.assignedUser.id,
            firstName: task.assignedUser.firstName,
            lastName: task.assignedUser.lastName,
            username: task.assignedUser.username,
          }
        : null,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    order: {
      ...order,
      creationDate: creationDate ?? task.createdAt,
      designStartedAt: null,
      designStartedByName: null,
      status: status ?? { id: order.statusId, name: "" },
    },
  };
}

interface BuildTvBoardInput {
  /** `GET /orders/my-tasks` (lo mío y lo libre, con Diseño). */
  myTasks: MyTask[];
  /** `GET /orders/my-area-tasks`; `null` si no está disponible. */
  areaTasks: AreaBoardTask[] | null;
  userId: number | null;
  now: number;
  area?: string | null;
  /**
   * `my-area-tasks` también trae las tareas planificadas de pedidos que
   * siguen en Diseño (todavía no son trabajo). El backend no manda el área
   * del pedido, pero `my-tasks` sí las excluye: una pendiente LIBRE que no
   * está ahí es una planificada. Sólo vale si `my-tasks` respondió.
   */
  dropPlanned?: boolean;
}

/**
 * Junta las dos fuentes (la del área manda en estado; la de "mis tareas"
 * aporta los datos del pedido que la otra no trae) y reparte en columnas.
 * Pendiente y En proceso van por urgencia; Terminado, lo último primero.
 */
export function buildTvBoard({
  myTasks,
  areaTasks,
  userId,
  now,
  area = null,
  dropPlanned = true,
}: BuildTvBoardInput): TvBoard {
  const byKey = new Map<string, TvTask>();
  for (const task of myTasks) byKey.set(task.key, task);

  const merged = new Map<string, TvTask>();
  for (const raw of areaTasks ?? []) {
    const fromArea = areaTaskToTvTask(raw, userId);
    const fromMine = byKey.get(fromArea.key);
    const free = !fromArea.mine && fromArea.assignee == null;
    if (dropPlanned && !fromMine && free && fromArea.status === "pendiente") continue;
    merged.set(
      fromArea.key,
      fromMine
        ? {
            ...fromMine,
            status: fromArea.status,
            completedAt: fromArea.completedAt,
            startedAt: fromArea.startedAt,
            // Lo que trae el área pisa (es la misma fila); lo que no trae, queda.
            order: {
              ...fromMine.order,
              description: raw.order.description,
              deliveryDate: raw.order.deliveryDate,
              statusId: raw.order.statusId,
              clientNameOverride: raw.order.clientNameOverride,
              client: raw.order.client,
            },
          }
        : fromArea
    );
  }
  // Lo que sólo trae "mis tareas" (Diseño, o todo si el área no respondió).
  for (const task of myTasks) if (!merged.has(task.key)) merged.set(task.key, task);

  const board: TvBoard = { pendiente: [], en_proceso: [], terminado: [] };
  for (const task of Array.from(merged.values())) {
    if (area && task.area !== area) continue;
    const column = tvColumnOf(task);
    if (column === "terminado") {
      const done = task.completedAt ? new Date(task.completedAt).getTime() : NaN;
      if (Number.isNaN(done) || now - done > RECENT_DONE_MS) continue;
    }
    board[column].push(task);
  }

  const byUrgency = (a: TvTask, b: TvTask) =>
    compareByUrgency(taskDeadline(a, now), taskDeadline(b, now)) || a.order.id - b.order.id;
  board.pendiente.sort(byUrgency);
  board.en_proceso.sort(byUrgency);
  board.terminado.sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
  );
  board.terminado = board.terminado.slice(0, MAX_DONE);
  return board;
}

/** Áreas presentes en el tablero, en el orden de los roles del usuario. */
export function tvBoardAreas(tasks: TvTask[], roles: string[]): string[] {
  const present = new Set(tasks.map((t) => t.area));
  const ordered = roles.filter((role) => present.has(role));
  // Gerencia (admin) ve áreas que no son roles suyos: también van.
  for (const a of Array.from(present)) if (!ordered.includes(a)) ordered.push(a);
  return ordered;
}

/** Busca la tarjeta que corresponde a un pedido que acaba de llegar. */
export function findArrivalTask(board: TvBoard, orderId: number, area?: string | null): TvTask | null {
  const all = [...board.pendiente, ...board.en_proceso, ...board.terminado];
  return (
    all.find((t) => t.order.id === orderId && (!area || t.area === area)) ??
    all.find((t) => t.order.id === orderId) ??
    null
  );
}

/** Nombre corto de quién tiene la tarea ("Libre" si nadie). */
export function assigneeLabel(task: TvTask): string {
  if (task.mine) return "Tuya";
  const a = task.assignee;
  if (!a) return "Libre";
  return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.username;
}
