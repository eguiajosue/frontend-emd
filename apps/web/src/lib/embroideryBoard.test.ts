import { describe, expect, it } from "vitest";
import {
  buildEmbroideryBoard,
  canMoveEmbroideryPrep,
  embroideryColumnOf,
  isEmbroideryView,
  prepStageOf,
  wasRejected,
} from "./embroideryBoard";
import {
  areaTaskToTvTask,
  buildTvBoard,
  type AreaBoardTask,
  type TvTask,
} from "./tvBoard";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const HOUR = 3_600_000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();

function task(
  id: number,
  extra: Partial<TvTask> & { due?: number | null } = {},
): TvTask {
  const { due, ...rest } = extra;
  return {
    key: `task-${id}`,
    kind: "production",
    area: "bordado",
    taskId: id,
    status: "pendiente",
    prepStage: null,
    mine: false,
    assignee: null,
    startedAt: null,
    order: {
      id: 100 + id,
      description: `Pedido ${id}`,
      deliveryDate: due == null ? null : iso(due),
      creationDate: iso(-20 * HOUR),
      statusId: 9,
      clientNameOverride: null,
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      status: { id: 9, name: "autorizado" },
    },
    ...rest,
  };
}

describe("columna de una tarea de Bordado", () => {
  it("sigue las etapas: digitalizado → en pruebas → producción → terminado", () => {
    expect(embroideryColumnOf(task(1, { prepStage: "digitalizado" }))).toBe(
      "digitalizado",
    );
    expect(embroideryColumnOf(task(2, { prepStage: "en_pruebas" }))).toBe(
      "en_pruebas",
    );
    expect(embroideryColumnOf(task(3))).toBe("produccion");
    expect(embroideryColumnOf(task(4, { status: "en_proceso" }))).toBe(
      "produccion",
    );
    expect(embroideryColumnOf(task(5, { status: "terminado" }))).toBe(
      "terminado",
    );
  });

  it("una tarea terminada no cuenta como en etapa previa", () => {
    expect(
      prepStageOf(task(1, { status: "terminado", prepStage: "en_pruebas" })),
    ).toBeNull();
  });

  it("detecta la prueba rechazada sólo mientras vuelve a digitalizado", () => {
    const lastTest = {
      round: 1,
      result: "rechazada" as const,
      resultNotes: "Se frunce",
    };
    expect(wasRejected(task(1, { prepStage: "digitalizado", lastTest }))).toBe(
      true,
    );
    expect(wasRejected(task(2, { prepStage: "en_pruebas", lastTest }))).toBe(
      false,
    );
    expect(
      wasRejected(
        task(3, {
          prepStage: "digitalizado",
          lastTest: { round: 1, result: null },
        }),
      ),
    ).toBe(false);
  });
});

describe("tablero de Bordado", () => {
  it("reparte en cuatro columnas e ignora lo que no es Bordado", () => {
    const board = buildEmbroideryBoard(
      [
        task(1, { prepStage: "digitalizado" }),
        task(2, { prepStage: "en_pruebas" }),
        task(3),
        task(4, { status: "en_proceso" }),
        task(5, { status: "terminado", completedAt: iso(-HOUR) }),
        task(6, { area: "taller" }),
        task(7, { kind: "design", area: "bordado" }),
      ],
      NOW,
    );
    expect(
      Object.fromEntries(
        Object.entries(board).map(([k, v]) => [k, v.map((t) => t.taskId)]),
      ),
    ).toEqual({
      digitalizado: [1],
      en_pruebas: [2],
      produccion: [4, 3],
      terminado: [5],
    });
  });

  it("lo rechazado va primero en Digitalizado; después, lo más urgente", () => {
    const rejected = {
      round: 1,
      result: "rechazada" as const,
      resultNotes: "x",
    };
    const board = buildEmbroideryBoard(
      [
        task(1, { prepStage: "digitalizado", due: 2 * HOUR }),
        task(2, {
          prepStage: "digitalizado",
          due: 40 * HOUR,
          lastTest: rejected,
        }),
        task(3, { prepStage: "digitalizado", due: HOUR }),
      ],
      NOW,
    );
    expect(board.digitalizado.map((t) => t.taskId)).toEqual([2, 3, 1]);
  });

  it("lo terminado va lo último primero", () => {
    const board = buildEmbroideryBoard(
      [
        task(1, { status: "terminado", completedAt: iso(-5 * HOUR) }),
        task(2, { status: "terminado", completedAt: iso(-HOUR) }),
      ],
      NOW,
    );
    expect(board.terminado.map((t) => t.taskId)).toEqual([2, 1]);
  });
});

describe("datos del backend", () => {
  const area = (extra: Partial<AreaBoardTask>): AreaBoardTask => ({
    id: 1,
    orderId: 101,
    area: "bordado",
    status: "pendiente",
    createdAt: iso(-HOUR),
    order: {
      id: 101,
      description: "x",
      deliveryDate: null,
      statusId: 9,
      clientNameOverride: null,
      client: null,
    },
    ...extra,
  });

  it("my-area-tasks trae la etapa y la última prueba en el registro", () => {
    const t = areaTaskToTvTask(
      area({
        prepStage: "digitalizado",
        sampleTests: [
          {
            id: 1,
            round: 1,
            sentAt: iso(-HOUR),
            result: "rechazada",
            resultNotes: "Corrige el contorno",
          },
          { id: 2, round: 2, sentAt: iso(-HOUR), result: null },
        ],
      }),
      7,
    );
    expect(t.prepStage).toBe("digitalizado");
    expect(t.lastTest).toMatchObject({ round: 2, result: null });
  });

  it("al juntar las dos fuentes la etapa de my-area-tasks manda", () => {
    const mine = task(1, { prepStage: null, mine: true });
    const board = buildTvBoard({
      myTasks: [mine],
      areaTasks: [area({ id: 1, prepStage: "en_pruebas" })],
      userId: 7,
      now: NOW,
    });
    expect(board.pendiente[0].prepStage).toBe("en_pruebas");
  });
});

describe("cuándo se usa el tablero de Bordado", () => {
  it("con el filtro Bordado, o si es lo único que trabaja el usuario", () => {
    expect(
      isEmbroideryView("bordado", ["bordado", "taller"], ["bordado", "taller"]),
    ).toBe(true);
    expect(
      isEmbroideryView("taller", ["bordado", "taller"], ["bordado", "taller"]),
    ).toBe(false);
    expect(isEmbroideryView(null, ["bordado"], ["bordado"])).toBe(true);
    expect(
      isEmbroideryView(null, ["bordado", "taller"], ["bordado", "taller"]),
    ).toBe(false);
  });

  it("Diseño y gerencia siguen viendo todas las áreas juntas", () => {
    expect(isEmbroideryView(null, ["bordado"], ["bordado", "diseno"])).toBe(
      false,
    );
    expect(isEmbroideryView(null, [], ["admin"])).toBe(false);
  });

  it("mueven las etapas Bordado y Recepción/admin; el resto no", () => {
    expect(canMoveEmbroideryPrep(["bordado"])).toBe(true);
    expect(canMoveEmbroideryPrep(["recepcion"])).toBe(true);
    expect(canMoveEmbroideryPrep(["admin"])).toBe(true);
    expect(canMoveEmbroideryPrep(["taller", "diseno"])).toBe(false);
  });
});
