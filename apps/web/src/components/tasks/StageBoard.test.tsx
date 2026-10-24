import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageTasksBoard } from "./StageBoard";
import { buildStageBoard } from "@/lib/stageBoard";
import type { TvTask } from "@/lib/tvBoard";

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({
    advanceStage: {
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    },
    decideStage: {
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    },
  }),
  useSampleTestPhoto: () => ({
    isLoading: false,
    isError: false,
    data: undefined,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DIGITALIZADO = { id: 301, key: "digitalizado", name: "Digitalizado", kind: "work" } as const;
const EN_PRUEBAS = { id: 302, key: "en_pruebas", name: "En pruebas", kind: "review" } as const;

const NOW = new Date("2026-10-06T12:00:00Z").getTime();

function task(id: number, extra: Partial<TvTask> = {}): TvTask {
  return {
    key: `task-${id}`,
    kind: "production",
    area: "bordado",
    taskId: id,
    status: "pendiente",
    stage: null,
    mine: true,
    assignee: null,
    startedAt: null,
    order: {
      id: 100 + id,
      description: `Logo ${id}`,
      deliveryDate: null,
      creationDate: new Date(NOW - 3_600_000).toISOString(),
      statusId: 9,
      clientNameOverride: "Cliente",
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      status: { id: 9, name: "autorizado" },
    },
    ...extra,
  };
}

const tasks: TvTask[] = [
  task(1, {
    stage: DIGITALIZADO,
    lastTest: {
      round: 1,
      result: "rechazada",
      resultNotes: "El hilo se frunce",
    },
  }),
  task(2, { stage: EN_PRUEBAS, lastTest: { round: 1, result: null } }),
  task(3),
  task(4, { status: "en_proceso" }),
  task(5, {
    status: "terminado",
    completedAt: new Date(NOW - 3_600_000).toISOString(),
  }),
];

function setup(canMovePrep = true) {
  const onAdvance = vi.fn();
  render(
    <StageTasksBoard
      area="bordado"
      board={buildStageBoard("bordado", tasks, NOW)}
      now={NOW}
      timeFormat="24h"
      onOpen={vi.fn()}
      onAdvance={onAdvance}
      pendingKey={null}
      canMovePrep={canMovePrep}
    />,
  );
  return { onAdvance };
}

const column = (name: string) =>
  screen.getByRole("region", { name: new RegExp(`^${name}`) });

describe("tablero por etapas (Tareas asignadas)", () => {
  it("tiene las cuatro columnas del flujo con cada tarjeta en su etapa", () => {
    setup();
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent?.replace(/\d+$/, "")),
    ).toEqual(["Digitalizado", "En pruebas", "En producción", "Terminado"]);
    expect(
      within(column("Digitalizado")).getByText("Logo 1"),
    ).toBeInTheDocument();
    expect(
      within(column("En pruebas")).getByText("Logo 2"),
    ).toBeInTheDocument();
    expect(
      within(column("En producción")).getByText("Logo 3"),
    ).toBeInTheDocument();
    expect(
      within(column("En producción")).getByText("Logo 4"),
    ).toBeInTheDocument();
    expect(within(column("Terminado")).getByText("Logo 5")).toBeInTheDocument();
  });

  it("cada etapa ofrece su acción: pasar de etapa, aprobar/rechazar, empezar, terminar", () => {
    setup();
    expect(
      within(column("Digitalizado")).getByRole("button", {
        name: "Pasar a «En pruebas»",
      }),
    ).toBeInTheDocument();
    const pruebas = column("En pruebas");
    expect(
      within(pruebas).getByRole("button", { name: "Aprobar" }),
    ).toBeInTheDocument();
    expect(
      within(pruebas).getByRole("button", { name: "Rechazar" }),
    ).toBeInTheDocument();
    const produccion = column("En producción");
    expect(
      within(produccion).getByRole("button", { name: "Terminar" }),
    ).toBeInTheDocument();
    expect(
      within(produccion).getByRole("button", { name: "Empezar" }),
    ).toBeInTheDocument();
    // Lo que todavía no produce no se puede "empezar" (el backend lo rechaza).
    expect(
      within(column("Digitalizado")).queryByRole("button", { name: /Empezar/ }),
    ).toBeNull();
    expect(
      within(column("En pruebas")).queryByRole("button", { name: /Empezar/ }),
    ).toBeNull();
  });

  it("la tarjeta rechazada muestra qué hay que corregir", () => {
    setup();
    const note = within(column("Digitalizado")).getByRole("note");
    expect(note).toHaveTextContent("Revisión 1 rechazada");
    expect(note).toHaveTextContent("El hilo se frunce");
  });

  it("Empezar y Terminar avanzan la tarea", async () => {
    const { onAdvance } = setup();
    await userEvent.click(
      within(column("En producción")).getByRole("button", { name: "Empezar" }),
    );
    expect(onAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ key: "task-3" }),
      "en_proceso",
    );
    await userEvent.click(
      within(column("En producción")).getByRole("button", { name: "Terminar" }),
    );
    expect(onAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ key: "task-4" }),
      "terminado",
    );
  });

  it("Mandar a pruebas abre el diálogo con la foto opcional", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Pasar a «En pruebas»" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Pasar a «En pruebas»" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Foto para la revisión (opcional)"),
    ).toBeInTheDocument();
  });

  it("rechazar pide el motivo", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    await screen.findByRole("heading", { name: "Rechazar «En pruebas»" });
    const confirm = () => screen.getAllByRole("button", { name: "Rechazar" }).at(-1)!;
    expect(confirm()).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Observaciones"),
      "Corrige el contorno",
    );
    expect(confirm()).toBeEnabled();
  });

  it("sin permiso sólo se ve en qué va la tarea, sin botones de etapa", () => {
    setup(false);
    expect(
      screen.queryByRole("button", { name: "Pasar a «En pruebas»" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(
      screen.getByText("Pendiente de pasar a «En pruebas»"),
    ).toBeInTheDocument();
    expect(screen.getByText("En pruebas (revisión 1) en revisión")).toBeInTheDocument();
  });
});
