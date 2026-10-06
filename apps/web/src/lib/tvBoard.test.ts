import { describe, expect, it } from "vitest";
import { buildTvBoard, findArrivalTask, tvBoardAreas, type AreaBoardTask } from "./tvBoard";
import type { MyTask } from "@/types";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const HOUR = 3_600_000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();

function areaTask(id: number, extra: Partial<AreaBoardTask> & { due?: number | null } = {}): AreaBoardTask {
  const { due, ...rest } = extra;
  return {
    id,
    orderId: 100 + id,
    area: "bordado",
    status: "pendiente",
    assignedUserId: null,
    createdAt: iso(-10 * HOUR),
    startedAt: null,
    completedAt: null,
    assignedUser: null,
    order: {
      id: 100 + id,
      description: `Pedido ${id}`,
      deliveryDate: due == null ? null : iso(due),
      statusId: 9,
      clientNameOverride: "Cliente",
      client: null,
    },
    ...rest,
  };
}

function myTask(key: string, extra: Partial<MyTask> = {}): MyTask {
  return {
    key,
    kind: "production",
    area: "bordado",
    taskId: Number(key.replace(/\D/g, "")),
    status: "pendiente",
    mine: false,
    assignee: null,
    startedAt: null,
    order: {
      id: 100 + Number(key.replace(/\D/g, "")),
      description: key,
      deliveryDate: null,
      creationDate: iso(-20 * HOUR),
      statusId: 9,
      clientNameOverride: null,
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      status: { id: 9, name: "autorizado" },
    },
    ...extra,
  };
}

const companero = { id: 8, username: "luis", firstName: "Luis", lastName: "Paz", isSharedAccount: false };
const compartida = { id: 2, username: "bordado", firstName: "Bordado", lastName: "", isSharedAccount: true };

describe("buildTvBoard", () => {
  it("reparte TODO el área en Pendiente / En proceso / Terminado, incluso lo de los compañeros", () => {
    const board = buildTvBoard({
      myTasks: [myTask("task-1")],
      areaTasks: [
        areaTask(1),
        areaTask(2, { status: "en_proceso", assignedUserId: 8, assignedUser: companero }),
        areaTask(3, { status: "terminado", completedAt: iso(-HOUR), assignedUserId: 8, assignedUser: companero }),
        areaTask(4, { status: "pendiente", assignedUserId: 8, assignedUser: companero }),
      ],
      userId: 3,
      now: NOW,
    });
    expect(board.pendiente.map((t) => t.key).sort()).toEqual(["task-1", "task-4"]);
    expect(board.en_proceso.map((t) => t.key)).toEqual(["task-2"]);
    expect(board.terminado.map((t) => t.key)).toEqual(["task-3"]);
    expect(board.en_proceso[0].assignee?.firstName).toBe("Luis");
  });

  it("'tuya' sólo si está a mi nombre; la cuenta compartida cuenta como libre", () => {
    const board = buildTvBoard({
      myTasks: [myTask("task-1"), myTask("task-2", { mine: true })],
      areaTasks: [
        areaTask(1, { assignedUserId: 2, assignedUser: compartida }),
        areaTask(2, { assignedUserId: 3, assignedUser: { ...companero, id: 3 } }),
      ],
      userId: 3,
      now: NOW,
    });
    const byKey = Object.fromEntries(board.pendiente.map((t) => [t.key, t]));
    expect(byKey["task-1"].mine).toBe(false);
    expect(byKey["task-1"].assignee).toBeNull();
    expect(byKey["task-2"].mine).toBe(true);
  });

  it("deja fuera las pendientes libres planificadas (pedido aún en Diseño: no están en my-tasks)", () => {
    const input = { myTasks: [] as MyTask[], areaTasks: [areaTask(9)], userId: 3, now: NOW };
    expect(buildTvBoard(input).pendiente).toHaveLength(0);
    // Si my-tasks falló no se puede saber: se muestran.
    expect(buildTvBoard({ ...input, dropPlanned: false }).pendiente).toHaveLength(1);
  });

  it("Terminado: sólo lo de las últimas 12 h, lo más reciente primero", () => {
    const board = buildTvBoard({
      myTasks: [],
      areaTasks: [
        areaTask(1, { status: "terminado", completedAt: iso(-3 * HOUR) }),
        areaTask(2, { status: "terminado", completedAt: iso(-1 * HOUR) }),
        areaTask(3, { status: "terminado", completedAt: iso(-30 * HOUR) }),
      ],
      userId: 3,
      now: NOW,
    });
    expect(board.terminado.map((t) => t.key)).toEqual(["task-2", "task-1"]);
  });

  it("pendientes por urgencia: vencido primero, sin fecha al final", () => {
    const board = buildTvBoard({
      myTasks: [myTask("task-1"), myTask("task-2"), myTask("task-3")],
      areaTasks: [areaTask(1, { due: 72 * HOUR }), areaTask(2, { due: null }), areaTask(3, { due: -HOUR })],
      userId: 3,
      now: NOW,
    });
    expect(board.pendiente.map((t) => t.key)).toEqual(["task-3", "task-1", "task-2"]);
  });

  it("Diseño (sólo en my-tasks) entra; empezado = en proceso", () => {
    const design = (id: number, started: boolean) =>
      myTask(`design-${id}`, {
        kind: "design",
        area: "diseno",
        taskId: null,
        status: "en diseño",
        order: { ...myTask("x").order, id, designStartedAt: started ? iso(-HOUR) : null },
      });
    const board = buildTvBoard({ myTasks: [design(1, false), design(2, true)], areaTasks: null, userId: 3, now: NOW });
    expect(board.pendiente.map((t) => t.key)).toEqual(["design-1"]);
    expect(board.en_proceso.map((t) => t.key)).toEqual(["design-2"]);
  });

  it("filtra por área", () => {
    const board = buildTvBoard({
      myTasks: [myTask("task-1"), myTask("task-2", { area: "dtf" })],
      areaTasks: [areaTask(1), areaTask(2, { area: "dtf" })],
      userId: 3,
      now: NOW,
      area: "dtf",
    });
    expect(board.pendiente.map((t) => t.key)).toEqual(["task-2"]);
  });
});

describe("helpers", () => {
  it("findArrivalTask prefiere el área del aviso", () => {
    const board = buildTvBoard({
      myTasks: [myTask("task-1"), myTask("task-2", { area: "dtf", order: { ...myTask("task-1").order } })],
      areaTasks: null,
      userId: 3,
      now: NOW,
    });
    expect(findArrivalTask(board, 101, "dtf")?.key).toBe("task-2");
    expect(findArrivalTask(board, 101, null)).not.toBeNull();
    expect(findArrivalTask(board, 999, null)).toBeNull();
  });

  it("tvBoardAreas: primero las del usuario, después las demás", () => {
    const tasks = [myTask("task-1", { area: "dtf" }), myTask("task-2", { area: "bordado" }), myTask("task-3", { area: "laser" })];
    expect(tvBoardAreas(tasks, ["bordado", "dtf"])).toEqual(["bordado", "dtf", "laser"]);
  });
});
