import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbroideryTasksBoard } from "./EmbroideryBoard";
import { buildEmbroideryBoard } from "@/lib/embroideryBoard";
import type { TvTask } from "@/lib/tvBoard";

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({
    sendToTest: {
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    },
    decideTest: {
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

const NOW = new Date("2026-10-06T12:00:00Z").getTime();

function task(id: number, extra: Partial<TvTask> = {}): TvTask {
  return {
    key: `task-${id}`,
    kind: "production",
    area: "bordado",
    taskId: id,
    status: "pendiente",
    prepStage: null,
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
    prepStage: "digitalizado",
    lastTest: {
      round: 1,
      result: "rechazada",
      resultNotes: "El hilo se frunce",
    },
  }),
  task(2, { prepStage: "en_pruebas", lastTest: { round: 1, result: null } }),
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
    <EmbroideryTasksBoard
      board={buildEmbroideryBoard(tasks, NOW)}
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

describe("tablero de Bordado (Tareas asignadas)", () => {
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

  it("cada etapa ofrece su acción: mandar a pruebas, aprobar/rechazar, empezar, terminar", () => {
    setup();
    expect(
      within(column("Digitalizado")).getByRole("button", {
        name: "Mandar a pruebas",
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
    expect(note).toHaveTextContent("Prueba 1 rechazada");
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
      screen.getByRole("button", { name: "Mandar a pruebas" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Mandar a pruebas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Foto de la prueba (opcional)"),
    ).toBeInTheDocument();
  });

  it("rechazar pide el motivo", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(
      await screen.findByRole("button", { name: "Rechazar prueba" }),
    ).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Observaciones"),
      "Corrige el contorno",
    );
    expect(
      screen.getByRole("button", { name: "Rechazar prueba" }),
    ).toBeEnabled();
  });

  it("sin permiso sólo se ve en qué va la tarea, sin botones de etapa", () => {
    setup(false);
    expect(
      screen.queryByRole("button", { name: "Mandar a pruebas" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(
      screen.getByText("Pendiente de mandar a pruebas"),
    ).toBeInTheDocument();
    expect(screen.getByText("Prueba 1 en revisión")).toBeInTheDocument();
  });
});
