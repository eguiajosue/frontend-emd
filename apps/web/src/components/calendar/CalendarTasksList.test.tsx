import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarTasksList } from "./CalendarTasksList";
import type { CalendarTask } from "@/types";

const setCompletedMock = vi.fn();
const removeMock = vi.fn();
let tasksData: CalendarTask[] = [];
let isPendingValue = false;

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: () => ({ data: tasksData, isPending: isPendingValue }),
  useCalendarTaskMutations: () => ({ create: vi.fn(), update: vi.fn(), remove: removeMock }),
  useUpdateCalendarTaskComplete: () => ({ setCompleted: setCompletedMock }),
}));

const pendingTask: CalendarTask = {
  id: 1,
  title: "Confirmar medidas",
  description: "Con el cliente Coca-Cola",
  completed: false,
  completedAt: null,
  createdById: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
};

const completedTask: CalendarTask = {
  id: 2,
  title: "Comprar material",
  description: null,
  completed: true,
  completedAt: "2026-09-02T00:00:00.000Z",
  createdById: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  setCompletedMock.mockReset();
  removeMock.mockReset();
  removeMock.mockResolvedValue(undefined);
  tasksData = [];
  isPendingValue = false;
});

describe("CalendarTasksList", () => {
  it('muestra el estado vacío cuando no hay tareas', () => {
    render(<CalendarTasksList />);
    expect(screen.getByText("No tienes tareas pendientes")).toBeInTheDocument();
  });

  it("separa las tareas pendientes de las completadas", () => {
    tasksData = [pendingTask, completedTask];
    render(<CalendarTasksList />);

    expect(screen.getByText("Confirmar medidas")).toBeInTheDocument();
    expect(screen.getByText("Comprar material")).toBeInTheDocument();
    expect(screen.getByText("Completadas")).toBeInTheDocument();
  });

  it("al tildar el checkbox, marca la tarea como completada", async () => {
    tasksData = [pendingTask];
    render(<CalendarTasksList />);

    await userEvent.click(screen.getByRole("checkbox", { name: /Marcar como completada/i }));
    expect(setCompletedMock).toHaveBeenCalledWith(1, true);
  });

  it("permite eliminar una tarea con confirmación", async () => {
    tasksData = [pendingTask];
    render(<CalendarTasksList />);

    await userEvent.click(screen.getByRole("button", { name: /Eliminar tarea/i }));
    expect(await screen.findByText("¿Eliminar tarea?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));
    expect(removeMock).toHaveBeenCalledWith(1);
  });
});
