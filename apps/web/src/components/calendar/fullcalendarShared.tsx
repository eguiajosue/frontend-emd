import { useMemo } from "react";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { Package } from "lucide-react";
import { toCalendarItems, type CalendarItem } from "./calendarMerge";
import { CATEGORY_META } from "./eventCategories";
import type { TimeFormatPreference } from "@/lib/format";
import type { CalendarEvent, CalendarEventCategory, Order } from "@/types";

/**
 * Formato de hora (eje horario + hora de eventos) para pasarle a
 * `<FullCalendar slotLabelFormat={...} eventTimeFormat={...}>`, respetando la
 * preferencia 24h/12h del usuario en vez del default de la librería.
 */
export function fcTimeFormatOptions(timeFormat: TimeFormatPreference) {
  return timeFormat === "24h"
    ? { hour: "2-digit" as const, minute: "2-digit" as const, hour12: false, meridiem: false as const }
    : { hour: "numeric" as const, minute: "2-digit" as const, hour12: true, meridiem: "short" as const };
}

/**
 * Plumbing de FullCalendar compartido entre la vista Día/Semana de escritorio
 * (`TimeGridCalendar`) y la grilla Día+Semana combinada de mobile
 * (`mobile/MobileDayWeekView`): mapeo de eventos+pedidos a la forma que
 * espera la librería, colores y el renderizado de cada bloque. Vive aparte
 * para que ninguna de las dos duplique esta lógica.
 */

/** Franja ("cuticle") de estado — mismo semáforo que la vista Mes. */
export const STATUS_HEX: Record<CalendarEvent["status"], string> = {
  pendiente: "#ef4444",
  en_proceso: "#f97316",
  terminado: "#10b981",
};

/** Color sólido del bloque de evento por categoría (mismo tono que `CATEGORY_META`, en hex para FullCalendar). */
export const CATEGORY_HEX: Record<CalendarEventCategory, string> = {
  instalacion: "#f97316",
  visita: "#3b82f6",
  entrega: "#14b8a6",
  junta: "#a855f7",
  otro: "#6b7280",
};

/**
 * Color de marca para los pedidos (distinto de las categorías de evento).
 * Referencia viva a `--brand-500` (no un hex fijo aparte) para no
 * desincronizarse si ese token cambia.
 */
export const ORDER_COLOR = "hsl(var(--brand-500))";

/** Arma la lista de eventos en el formato que espera `<FullCalendar events={...}>`. */
export function useFcEvents(events: CalendarEvent[], orders: Order[]) {
  const items = useMemo(() => toCalendarItems(events, orders), [events, orders]);

  return useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.kind === "event" ? item.event.title : item.order.description,
        start: item.date,
        allDay: !item.hasTime,
        color: item.kind === "event" ? CATEGORY_HEX[item.event.category] : ORDER_COLOR,
        classNames: item.kind === "order" ? ["fc-order-event"] : [],
        extendedProps: { item } satisfies { item: CalendarItem },
      })),
    [items]
  );
}

/** Handler de `eventClick` común: edita el evento o abre el detalle del pedido. */
export function makeFcEventClickHandler(
  onEdit: (event: CalendarEvent) => void,
  onSelectOrder: (orderId: number) => void
) {
  return (info: EventClickArg) => {
    const item = info.event.extendedProps.item as CalendarItem;
    if (item.kind === "event") {
      onEdit(item.event);
    } else {
      onSelectOrder(item.order.id);
    }
  };
}

/** Contenido de un bloque de evento/pedido: franja de estado (si aplica), ícono de pedido, hora y título. */
export function renderFcEventContent(arg: EventContentArg) {
  const item = arg.event.extendedProps.item as CalendarItem;
  const showCuticle = item.kind === "event" && CATEGORY_META[item.event.category].tracksStatus;
  return (
    <div className="flex items-stretch gap-1 overflow-hidden">
      {showCuticle && (
        <span
          className="w-1 shrink-0 rounded-full"
          style={{
            backgroundColor: STATUS_HEX[(item as Extract<CalendarItem, { kind: "event" }>).event.status],
          }}
        />
      )}
      <div className="flex min-w-0 items-center gap-1">
        {item.kind === "order" && <Package className="h-3 w-3 shrink-0" />}
        {arg.timeText && <span className="shrink-0 font-medium">{arg.timeText}</span>}
        <span className="truncate">{arg.event.title}</span>
      </div>
    </div>
  );
}
