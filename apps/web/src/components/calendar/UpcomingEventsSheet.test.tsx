import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpcomingEventsSheet } from "./UpcomingEventsSheet";
import type { CalendarEvent, Order } from "@/types";

const inTwoDays = new Date();
inTwoDays.setDate(inTwoDays.getDate() + 2);

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const upcomingEvent: CalendarEvent = {
  id: 1,
  title: "Visita a planta",
  clientName: "MEDLINE",
  clientId: null,
  category: "visita",
  eventDate: inTwoDays.toISOString(),
  hasTime: true,
  status: "pendiente",
  reminderMinutesBefore: null,
  createdById: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const pastEvent: CalendarEvent = {
  ...upcomingEvent,
  id: 2,
  title: "Evento ya pasado",
  eventDate: yesterday.toISOString(),
};

const upcomingOrder: Order = {
  id: 42,
  clientId: null,
  clientNameOverride: "Hudson",
  statusId: 1,
  description: "Armar pendones",
  creationDate: "2026-01-01T00:00:00.000Z",
  deliveryDate: inTwoDays.toISOString(),
  deliveredAt: null,
};

describe("UpcomingEventsSheet", () => {
  it("muestra eventos y pedidos futuros, pero no los que ya pasaron", () => {
    render(
      <UpcomingEventsSheet
        open
        onOpenChange={() => {}}
        events={[upcomingEvent, pastEvent]}
        orders={[upcomingOrder]}
        onEdit={() => {}}
        onSelectOrder={() => {}}
      />
    );

    expect(screen.getByText("Visita a planta")).toBeInTheDocument();
    expect(screen.getByText("Armar pendones")).toBeInTheDocument();
    expect(screen.queryByText("Evento ya pasado")).not.toBeInTheDocument();
  });

  it("clickear un evento lo abre para editar y cierra la hoja", async () => {
    const onEdit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <UpcomingEventsSheet
        open
        onOpenChange={onOpenChange}
        events={[upcomingEvent]}
        orders={[]}
        onEdit={onEdit}
        onSelectOrder={() => {}}
      />
    );

    await userEvent.click(screen.getByText("Visita a planta"));
    expect(onEdit).toHaveBeenCalledWith(upcomingEvent);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clickear un pedido llama a onSelectOrder con su id", async () => {
    const onSelectOrder = vi.fn();
    render(
      <UpcomingEventsSheet
        open
        onOpenChange={() => {}}
        events={[]}
        orders={[upcomingOrder]}
        onEdit={() => {}}
        onSelectOrder={onSelectOrder}
      />
    );

    await userEvent.click(screen.getByText("Armar pendones"));
    expect(onSelectOrder).toHaveBeenCalledWith(42);
  });

  it("sin nada agendado, muestra el estado vacío", () => {
    render(
      <UpcomingEventsSheet
        open
        onOpenChange={() => {}}
        events={[]}
        orders={[]}
        onEdit={() => {}}
        onSelectOrder={() => {}}
      />
    );

    expect(screen.getByText("No hay nada agendado")).toBeInTheDocument();
  });
});
