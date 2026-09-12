import { describe, expect, it } from "vitest";
import {
  calendarItemClientLabel,
  calendarItemTitle,
  groupItemsByDay,
  nextEventStatus,
  toCalendarItems,
} from "./calendarMerge";
import type { CalendarEvent, Order } from "@/types";

const event: CalendarEvent = {
  id: 1,
  title: "Instalar torniquetes",
  clientName: "MEDLINE",
  clientId: null,
  eventDate: "2026-09-15T10:00:00.000Z",
  hasTime: true,
  status: "pendiente",
  reminderMinutesBefore: null,
  createdById: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const orderWithTime: Order = {
  id: 42,
  clientId: null,
  clientNameOverride: "Hudson",
  statusId: 1,
  description: "Armar pendones",
  creationDate: "2026-01-01T00:00:00.000Z",
  deliveryDate: "2026-09-15T15:30:00.000Z",
  deliveredAt: null,
};

const orderNoTime: Order = {
  id: 43,
  clientId: null,
  clientNameOverride: "OFEX",
  statusId: 1,
  description: "Rotular caja",
  creationDate: "2026-01-01T00:00:00.000Z",
  deliveryDate: "2026-09-16T00:00:00.000Z",
  deliveredAt: null,
};

describe("toCalendarItems", () => {
  it("mezcla eventos y pedidos en una sola lista, ordenada por fecha", () => {
    const items = toCalendarItems([event], [orderWithTime, orderNoTime]);
    expect(items.map((i) => i.id)).toEqual(["event-1", "order-42", "order-43"]);
  });

  it("descarta pedidos sin deliveryDate (no hay nada que ubicar en el calendario)", () => {
    const withoutDelivery: Order = { ...orderWithTime, deliveryDate: null };
    const items = toCalendarItems([], [withoutDelivery]);
    expect(items).toHaveLength(0);
  });

  it("un pedido con hora real de entrega se marca hasTime; a medianoche se toma como todo el día", () => {
    const items = toCalendarItems([], [orderWithTime, orderNoTime]);
    const withTime = items.find((i) => i.id === "order-42");
    const noTime = items.find((i) => i.id === "order-43");
    expect(withTime?.hasTime).toBe(true);
    expect(noTime?.hasTime).toBe(false);
  });

  it("calendarItemTitle/calendarItemClientLabel leen el campo correcto según el tipo", () => {
    const items = toCalendarItems([event], [orderWithTime]);
    const eventItem = items.find((i) => i.kind === "event")!;
    const orderItem = items.find((i) => i.kind === "order")!;
    expect(calendarItemTitle(eventItem)).toBe("Instalar torniquetes");
    expect(calendarItemClientLabel(eventItem)).toBe("MEDLINE");
    expect(calendarItemTitle(orderItem)).toBe("Armar pendones");
    expect(calendarItemClientLabel(orderItem)).toBe("Hudson");
  });
});

describe("groupItemsByDay", () => {
  it("agrupa por fecha local yyyy-MM-dd", () => {
    const items = toCalendarItems([event], [orderWithTime, orderNoTime]);
    const map = groupItemsByDay(items);
    expect(map.get("2026-09-15")).toHaveLength(2);
    expect(map.get("2026-09-16")).toHaveLength(1);
  });
});

describe("nextEventStatus", () => {
  it("avanza pendiente -> en_proceso -> terminado, y termina en null", () => {
    expect(nextEventStatus("pendiente")).toBe("en_proceso");
    expect(nextEventStatus("en_proceso")).toBe("terminado");
    expect(nextEventStatus("terminado")).toBeNull();
  });
});
