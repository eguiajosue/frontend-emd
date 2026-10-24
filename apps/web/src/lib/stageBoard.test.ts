import { afterEach, describe, expect, it } from "vitest";
import {
  advanceLabel,
  buildStageBoard,
  canMoveStages,
  columnOf,
  stageBoardArea,
  stageColumns,
  stageNeighbors,
  taskStage,
  wasRejected,
} from "./stageBoard";
import { DEFAULT_AREAS, resetAreaCatalog, setAreaCatalog } from "@emd/business/src/areas";
import type { AreaStage } from "@/types";
import {
  areaTaskToTvTask,
  buildTvBoard,
  type AreaBoardTask,
  type TvTask,
} from "./tvBoard";

const DIGITALIZADO: AreaStage = { id: 301, key: "digitalizado", name: "Digitalizado", kind: "work" };
const EN_PRUEBAS: AreaStage = { id: 302, key: "en_pruebas", name: "En pruebas", kind: "review" };

afterEach(() => resetAreaCatalog());

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
    stage: null,
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

describe("columna de una tarea con etapas", () => {
  it("sigue las etapas: digitalizado → en pruebas → producción → terminado", () => {
    expect(columnOf(task(1, { stage: DIGITALIZADO }))).toBe("stage:digitalizado");
    expect(columnOf(task(2, { stage: EN_PRUEBAS }))).toBe("stage:en_pruebas");
    expect(columnOf(task(3))).toBe("produccion");
    expect(columnOf(task(4, { status: "en_proceso" }))).toBe("produccion");
    expect(columnOf(task(5, { status: "terminado" }))).toBe("terminado");
  });

  it("una tarea terminada no cuenta como en etapa previa", () => {
    expect(
      taskStage(task(1, { status: "terminado", stage: EN_PRUEBAS })),
    ).toBeNull();
  });

  it("detecta la revisión rechazada sólo mientras vuelve a una etapa de trabajo", () => {
    const lastTest = {
      round: 1,
      result: "rechazada" as const,
      resultNotes: "Se frunce",
    };
    expect(wasRejected(task(1, { stage: DIGITALIZADO, lastTest }))).toBe(
      true,
    );
    expect(wasRejected(task(2, { stage: EN_PRUEBAS, lastTest }))).toBe(
      false,
    );
    expect(
      wasRejected(
        task(3, {
          stage: DIGITALIZADO,
          lastTest: { round: 1, result: null },
        }),
      ),
    ).toBe(false);
  });
});

describe("tablero por etapas", () => {
  it("reparte en cuatro columnas e ignora lo que no es Bordado", () => {
    const board = buildStageBoard(
      "bordado",
      [
        task(1, { stage: DIGITALIZADO }),
        task(2, { stage: EN_PRUEBAS }),
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
      "stage:digitalizado": [1],
      "stage:en_pruebas": [2],
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
    const board = buildStageBoard(
      "bordado",
      [
        task(1, { stage: DIGITALIZADO, due: 2 * HOUR }),
        task(2, {
          stage: DIGITALIZADO,
          due: 40 * HOUR,
          lastTest: rejected,
        }),
        task(3, { stage: DIGITALIZADO, due: HOUR }),
      ],
      NOW,
    );
    expect(board["stage:digitalizado"].map((t) => t.taskId)).toEqual([2, 3, 1]);
  });

  it("lo terminado va lo último primero", () => {
    const board = buildStageBoard(
      "bordado",
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

  it("my-area-tasks trae la etapa y la última ronda en el registro", () => {
    const t = areaTaskToTvTask(
      area({
        stage: DIGITALIZADO,
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
    expect(t.stage).toEqual(DIGITALIZADO);
    expect(t.lastTest).toMatchObject({ round: 2, result: null });
  });

  it("al juntar las dos fuentes la etapa de my-area-tasks manda", () => {
    const mine = task(1, { stage: null, mine: true });
    const board = buildTvBoard({
      myTasks: [mine],
      areaTasks: [area({ id: 1, stage: EN_PRUEBAS })],
      userId: 7,
      now: NOW,
    });
    expect(board.pendiente[0].stage).toEqual(EN_PRUEBAS);
  });
});

const PRINT_3D_STAGES: AreaStage[] = [
  { id: 901, key: "slicing", name: "Slicing", kind: "work" },
  { id: 902, key: "prueba", name: "Prueba de impresión", kind: "review" },
  { id: 903, key: "post", name: "Post-proceso", kind: "work" },
];

function withPrint3d() {
  setAreaCatalog([
    ...DEFAULT_AREAS,
    {
      ...DEFAULT_AREAS[0],
      id: 9,
      slug: "impresion-3d",
      name: "Impresión 3D",
      sortOrder: 70,
      stages: PRINT_3D_STAGES,
    },
  ]);
}

describe("áreas con etapas propias", () => {
  it("las columnas salen de las etapas del área, más producción y terminado", () => {
    expect(stageColumns("bordado").map((c) => c.label)).toEqual([
      "Digitalizado",
      "En pruebas",
      "En producción",
      "Terminado",
    ]);
    withPrint3d();
    expect(stageColumns("impresion-3d").map((c) => [c.id, c.kind])).toEqual([
      ["stage:slicing", "work"],
      ["stage:prueba", "review"],
      ["stage:post", "work"],
      ["produccion", "production"],
      ["terminado", "done"],
    ]);
  });

  it("un área sin etapas no tiene tablero por etapas", () => {
    expect(stageBoardArea("taller", { roles: [], areas: ["taller"] })).toBeNull();
    expect(stageBoardArea(null, { roles: [], areas: ["taller"] })).toBeNull();
  });

  it("reparte las tareas de un área nueva en sus columnas", () => {
    withPrint3d();
    const board = buildStageBoard(
      "impresion-3d",
      [
        task(1, { area: "impresion-3d", stage: PRINT_3D_STAGES[0] }),
        task(2, { area: "impresion-3d", stage: PRINT_3D_STAGES[1] }),
        task(3, { area: "impresion-3d", stage: PRINT_3D_STAGES[2] }),
        task(4, { area: "impresion-3d" }),
        task(5, { area: "bordado", stage: DIGITALIZADO }),
      ],
      NOW,
    );
    expect(
      Object.fromEntries(
        Object.entries(board).map(([k, v]) => [k, v.map((t) => t.taskId)]),
      ),
    ).toEqual({
      "stage:slicing": [1],
      "stage:prueba": [2],
      "stage:post": [3],
      produccion: [4],
      terminado: [],
    });
  });

  it("una etapa que ya no está en el área cuenta como producción", () => {
    expect(
      columnOf(task(1, { stage: { id: 999, key: "vieja", name: "Vieja", kind: "work" } })),
    ).toBe("produccion");
  });

  it("vecinas: la siguiente etapa y la anterior, para los textos y el rechazo", () => {
    withPrint3d();
    expect(stageNeighbors("impresion-3d", PRINT_3D_STAGES[1])).toEqual({
      next: PRINT_3D_STAGES[2],
      previous: PRINT_3D_STAGES[0],
    });
    expect(stageNeighbors("impresion-3d", PRINT_3D_STAGES[2]).next).toBeNull();
    expect(advanceLabel(PRINT_3D_STAGES[1])).toBe("Pasar a «Prueba de impresión»");
    expect(advanceLabel(null)).toBe("Listo para producir");
  });
});

describe("cuándo se usa el tablero por etapas", () => {
  it("con el filtro de un área con etapas, o si es lo único que trabaja el usuario", () => {
    expect(
      stageBoardArea("bordado", { roles: [], areas: ["bordado", "taller"] }),
    ).toBe("bordado");
    expect(
      stageBoardArea("taller", { roles: [], areas: ["bordado", "taller"] }),
    ).toBeNull();
    expect(stageBoardArea(null, { roles: [], areas: ["bordado"] })).toBe("bordado");
    expect(
      stageBoardArea(null, { roles: [], areas: ["bordado", "taller"] }),
    ).toBeNull();
  });

  it("funciona igual para un área nueva", () => {
    withPrint3d();
    expect(stageBoardArea(null, { roles: [], areas: ["impresion-3d"] })).toBe("impresion-3d");
  });

  it("Diseño y gerencia siguen viendo todas las áreas juntas", () => {
    expect(stageBoardArea(null, { roles: [], areas: ["bordado", "diseno"] })).toBeNull();
    expect(stageBoardArea(null, { roles: ["admin"], areas: [] })).toBeNull();
  });

  it("mueven las etapas quien trabaja un área y Recepción/admin; el resto no", () => {
    expect(canMoveStages({ roles: [], areas: ["bordado"] })).toBe(true);
    expect(canMoveStages({ roles: ["recepcion"], areas: [] })).toBe(true);
    expect(canMoveStages({ roles: ["admin"], areas: [] })).toBe(true);
    expect(canMoveStages({ roles: [], areas: ["diseno"] })).toBe(false);
  });
});
