import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { TeamCalendar } from "./TeamCalendar";
import type { CalendarEvent, Order } from "@/types";

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
  category: "instalacion",
  eventDate: day15.toISOString(),
  hasTime: true,
  status: "pendiente",
  reminderMinutesBefore: null,
  createdById: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const baseOrder: Order = {
  id: 42,
  clientId: null,
  clientNameOverride: "Hudson",
  statusId: 1,
  description: "Armar pendones",
  creationDate: "2026-01-01T00:00:00.000Z",
  deliveryDate: new Date(now.getFullYear(), now.getMonth(), 15, 16, 0).toISOString(),
  deliveredAt: null,
};

function renderCalendar(props: {
  events?: CalendarEvent[];
  orders?: Order[];
  onAddForDay?: (dateKey: string) => void;
  onEdit?: (event: CalendarEvent) => void;
  onSelectOrder?: (orderId: number) => void;
}) {
  return render(
    <TeamCalendar
      events={props.events ?? []}
      orders={props.orders ?? []}
      onAddForDay={props.onAddForDay ?? (() => {})}
      onEdit={props.onEdit ?? (() => {})}
      onSelectOrder={props.onSelectOrder ?? (() => {})}
    />
  );
}

async function openDay15Popover() {
  const cell = screen.getByText("15").closest("button");
  if (!cell) throw new Error("No se encontró la celda del día 15");
  await userEvent.click(cell);
}

describe("TeamCalendar", () => {
  it("un día con actividad se pinta con el rosa tenue de marca (fijo, no el acento del usuario)", () => {
    renderCalendar({ events: [baseEvent] });
    const cell = screen.getByText("15").closest("div");
    expect(cell).toHaveClass("bg-brand-50");
  });

  it("las bolitas de estado usan rojo/naranja/verde según pendiente/en_proceso/terminado", () => {
    renderCalendar({
      events: [
        { ...baseEvent, id: 1, status: "pendiente" },
        { ...baseEvent, id: 2, status: "en_proceso" },
        { ...baseEvent, id: 3, status: "terminado" },
      ],
    });
    const cell = screen.getByText("15").closest("button") as HTMLElement;
    expect(cell.querySelector(".bg-red-500")).not.toBeNull();
    expect(cell.querySelector(".bg-orange-500")).not.toBeNull();
    expect(cell.querySelector(".bg-emerald-500")).not.toBeNull();
  });

  it("muestra los eventos del día al hacer click en la celda", async () => {
    renderCalendar({ events: [baseEvent] });
    await openDay15Popover();

    // El título aparece dos veces (la píldora de vista previa en la celda del
    // mes y la fila del popover): se apunta al <p> del popover, no cualquiera.
    expect(screen.getByText("Instalar torniquetes", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("MEDLINE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pendiente/i })).toBeInTheDocument();
  });

  it("mezcla un pedido con entrega ese día, distinguido con el ícono de paquete", async () => {
    renderCalendar({ events: [baseEvent], orders: [baseOrder] });
    await openDay15Popover();

    expect(screen.getByText("Instalar torniquetes", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/Pedido #42/)).toBeInTheDocument();
    expect(screen.getByText("Armar pendones", { selector: "p" })).toBeInTheDocument();
  });

  it("clickear un pedido en el popover llama a onSelectOrder con su id", async () => {
    const onSelectOrder = vi.fn();
    renderCalendar({ orders: [baseOrder], onSelectOrder });
    await openDay15Popover();

    await userEvent.click(screen.getByText(/Pedido #42/).closest("button")!);
    expect(onSelectOrder).toHaveBeenCalledWith(42);
  });

  it("al hacer click en el estado, lo avanza un paso", async () => {
    renderCalendar({ events: [baseEvent] });
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: /Pendiente/i }));
    expect(updateStatusMock).toHaveBeenCalledWith(1, "en_proceso");
  });

  it("un evento terminado no se puede seguir avanzando", async () => {
    renderCalendar({ events: [{ ...baseEvent, status: "terminado" }] });
    await openDay15Popover();

    expect(screen.getByRole("button", { name: /Terminado/i })).toBeDisabled();
  });

  it("una junta (categoría sin seguimiento) no muestra franja ni botón de estado", async () => {
    renderCalendar({ events: [{ ...baseEvent, category: "junta" }] });
    await openDay15Popover();

    expect(screen.getByText("Junta / Reunión")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pendiente/i })).not.toBeInTheDocument();
  });

  it("pide confirmación antes de borrar y llama a remove al confirmar", async () => {
    renderCalendar({ events: [baseEvent] });
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar Instalar torniquetes" }));
    expect(await screen.findByText("¿Eliminar evento?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(removeMock).toHaveBeenCalledWith(1);
  });

  it("el botón de editar llama a onEdit con el evento", async () => {
    const onEdit = vi.fn();
    renderCalendar({ events: [baseEvent], onEdit });
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Editar Instalar torniquetes" }));
    expect(onEdit).toHaveBeenCalledWith(baseEvent);
  });

  it('"+" del popover llama a onAddForDay con la fecha del día', async () => {
    const onAddForDay = vi.fn();
    renderCalendar({ events: [baseEvent], onAddForDay });
    await openDay15Popover();

    await userEvent.click(screen.getByRole("button", { name: "Agregar evento este día" }));
    expect(onAddForDay).toHaveBeenCalledWith(day15Key);
  });
});
