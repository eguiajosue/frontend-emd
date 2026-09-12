import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { TeamCalendar } from "./TeamCalendar";
import type { CalendarEvent } from "@/types";

const updateStatusMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@/hooks/useCalendarEvents", () => ({
  useUpdateCalendarEventStatus: () => ({ updateStatus: updateStatusMock }),
  useCalendarEventMutations: () => ({ remove: removeMock }),
}));

beforeEach(() => {
  updateStatusMock.mockReset();
  removeMock.mockReset();
  removeMock.mockResolvedValue(undefined);
});

// Día 15 del mes actual: siempre existe y nunca cae en el relleno de días del
// mes adyacente (que como mucho ocupa unas pocas celdas al borde de la
// grilla), así que el texto "15" identifica una sola celda sin depender de
// qué día sea "hoy" quien corra el test.
const now = new Date();
const day15 = new Date(now.getFullYear(), now.getMonth(), 15, 10, 0);
const day15Key = format(day15, "yyyy-MM-dd");

const baseEvent: CalendarEvent = {
  id: 1,
  title: "Instalar torniquetes",
  clientName: "MEDLINE",
  clientId: null,
  eventDate: day15.toISOString(),
  hasTime: true,
  status: "pendiente",
  reminderMinutesBefore: null,
  createdById: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function openDay15Popover() {
  const cell = screen.getByText("15").closest("button");
  if (!cell) throw new Error("No se encontró la celda del día 15");
  await userEvent.click(cell);
}

describe("TeamCalendar", () => {
  it("muestra los eventos del día al hacer click en la celda", async () => {
    render(<TeamCalendar events={[baseEvent]} onAddForDay={() => {}} onEdit={() => {}} />);
    await openDay15Popover();

    expect(screen.getByText("Instalar torniquetes")).toBeInTheDocument();
    expect(screen.getByText("MEDLINE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pendiente/i })).toBeInTheDocument();
  });

  it("al hacer click en el estado, lo avanza un paso", async () => {
    render(<TeamCalendar events={[baseEvent]} onAddForDay={() => {}} onEdit={() => {}} />);
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: /Pendiente/i }));
    expect(updateStatusMock).toHaveBeenCalledWith(1, "en_proceso");
  });

  it("un evento terminado no se puede seguir avanzando", async () => {
    render(
      <TeamCalendar
        events={[{ ...baseEvent, status: "terminado" }]}
        onAddForDay={() => {}}
        onEdit={() => {}}
      />
    );
    await openDay15Popover();

    expect(screen.getByRole("button", { name: /Terminado/i })).toBeDisabled();
  });

  it("pide confirmación antes de borrar y llama a remove al confirmar", async () => {
    render(<TeamCalendar events={[baseEvent]} onAddForDay={() => {}} onEdit={() => {}} />);
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar Instalar torniquetes" }));
    expect(await screen.findByText("¿Eliminar evento?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(removeMock).toHaveBeenCalledWith(1);
  });

  it("el botón de editar llama a onEdit con el evento", async () => {
    const onEdit = vi.fn();
    render(<TeamCalendar events={[baseEvent]} onAddForDay={() => {}} onEdit={onEdit} />);
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Editar Instalar torniquetes" }));
    expect(onEdit).toHaveBeenCalledWith(baseEvent);
  });

  it('"+" del popover llama a onAddForDay con la fecha del día', async () => {
    const onAddForDay = vi.fn();
    render(<TeamCalendar events={[baseEvent]} onAddForDay={onAddForDay} onEdit={() => {}} />);
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Agregar evento este día" }));
    expect(onAddForDay).toHaveBeenCalledWith(day15Key);
  });
});
