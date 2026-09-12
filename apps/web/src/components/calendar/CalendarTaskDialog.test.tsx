import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarTaskDialog } from "./CalendarTaskDialog";
import type { CalendarTask } from "@/types";

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTaskMutations: () => ({ create: createMock, update: updateMock }),
}));

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 1 });
  updateMock.mockReset();
  updateMock.mockResolvedValue({ id: 1 });
});

describe("CalendarTaskDialog", () => {
  it("no deja crear una tarea sin título", async () => {
    render(<CalendarTaskDialog open onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Crear tarea/i }));

    expect(await screen.findByText("El título es obligatorio")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crea una tarea sólo con título (sin fecha, sin descripción)", async () => {
    render(<CalendarTaskDialog open onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText(/Qué hay que hacer/), "Confirmar medidas");
    await userEvent.click(screen.getByRole("button", { name: /Crear tarea/i }));

    expect(createMock).toHaveBeenCalledWith({
      title: "Confirmar medidas",
      description: undefined,
    });
  });

  it("manda la descripción cuando se completa", async () => {
    render(<CalendarTaskDialog open onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText(/Qué hay que hacer/), "Preparar material");
    await userEvent.type(screen.getByLabelText(/Detalle/), "Revisar stock antes");
    await userEvent.click(screen.getByRole("button", { name: /Crear tarea/i }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Revisar stock antes" })
    );
  });

  it("en modo edición, precarga los datos de la tarea y manda un update", async () => {
    const task: CalendarTask = {
      id: 5,
      title: "Revisar dirección",
      description: "Confirmar con el cliente",
      completed: false,
      completedAt: null,
      createdById: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    render(<CalendarTaskDialog open onClose={() => {}} task={task} />);

    expect(screen.getByDisplayValue("Revisar dirección")).toBeInTheDocument();
    expect(screen.getByText("Editar tarea")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(updateMock).toHaveBeenCalledWith(5, expect.objectContaining({ title: "Revisar dirección" }));
  });
});
