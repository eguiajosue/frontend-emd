import { format } from "date-fns";
import { getOrderClientName } from "@/lib/format";
import type { AreaTaskStatus, CalendarEvent, Order } from "@/types";

/**
 * Un ítem del calendario de equipo: o un evento propio (editable) o un
 * pedido con fecha de entrega (sólo lectura desde acá — se edita en
 * "Pedidos"). Se homogeneízan a esta forma para poder mezclarlos en la
 * misma grilla/lista sin que cada consumidor tenga que distinguir el tipo
 * en cada paso.
 */
export type CalendarItem =
  | { kind: "event"; id: string; date: Date; hasTime: boolean; event: CalendarEvent }
  | { kind: "order"; id: string; date: Date; hasTime: boolean; order: Order };

export function toCalendarItems(events: CalendarEvent[], orders: Order[]): CalendarItem[] {
  const eventItems = events
    .map((event) => {
      const date = new Date(event.eventDate);
      if (Number.isNaN(date.getTime())) return null;
      return { kind: "event" as const, id: `event-${event.id}`, date, hasTime: event.hasTime, event };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const orderItems = orders
    .filter((order) => Boolean(order.deliveryDate))
    .map((order) => {
      const date = new Date(order.deliveryDate!);
      if (Number.isNaN(date.getTime())) return null;
      // La entrega de un pedido casi siempre se carga sin hora (ver
      // CreateOrderDialog): sólo se toma como horaria si no cae justo en
      // medianoche, para no dibujar un bloque de 00:00 falso en día/semana.
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
      return { kind: "order" as const, id: `order-${order.id}`, date, hasTime, order };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return [...eventItems, ...orderItems].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  items.forEach((item) => {
    const key = format(item.date, "yyyy-MM-dd");
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  });
  return map;
}

export function calendarItemTitle(item: CalendarItem): string {
  return item.kind === "event" ? item.event.title : item.order.description;
}

export function calendarItemClientLabel(item: CalendarItem): string | null {
  if (item.kind === "event") {
    if (item.event.client) {
      return [item.event.client.first_name, item.event.client.last_name].filter(Boolean).join(" ");
    }
    return item.event.clientName ?? null;
  }
  return getOrderClientName(item.order);
}

/**
 * Colores semáforo (rojo/naranja/verde) para el ciclo pendiente → en_proceso
 * → terminado de un evento — distinto, a propósito, del ámbar/azul/esmeralda
 * que usan las tareas de área de un pedido (ver AreaTasksSection): acá el
 * calendario necesita leerse de un vistazo, con la misma semántica de
 * semáforo que ya usaban a mano por WhatsApp (❌ 🟠 ✅).
 */
export const EVENT_STATUS_DOT_CLASS: Record<AreaTaskStatus, string> = {
  pendiente: "bg-red-500",
  en_proceso: "bg-orange-500",
  terminado: "bg-emerald-500",
};

export const EVENT_STATUS_BADGE_CLASS: Record<AreaTaskStatus, string> = {
  pendiente:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  en_proceso:
    "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  terminado:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
};

export const EVENT_STATUS_LABEL: Record<AreaTaskStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  terminado: "Terminado",
};

/** Siguiente paso del ciclo corto pendiente → en proceso → terminado. */
export function nextEventStatus(status: AreaTaskStatus): AreaTaskStatus | null {
  if (status === "pendiente") return "en_proceso";
  if (status === "en_proceso") return "terminado";
  return null;
}
