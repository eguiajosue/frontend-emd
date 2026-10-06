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

/** Punto de estado — mismo semáforo que la vista Mes. */
export const STATUS_HEX: Record<CalendarEvent["status"], string> = {
  pendiente: "#ef4444",
  en_proceso: "#f97316",
  terminado: "#10b981",
};

/**
 * Bloque tintado por categoría (mismo tono que `CATEGORY_META`): fondo del
 * color al ~10–15% + texto del mismo color, como las píldoras de la vista
 * Mes. Son referencias a variables CSS de `fullcalendar-theme.css`, que las
 * redefine en oscuro (un hex fijo no podría cambiar de tono con el tema).
 */
export const CATEGORY_FC_COLORS: Record<CalendarEventCategory, { bg: string; fg: string }> = {
  instalacion: { bg: "var(--cal-instalacion-bg)", fg: "var(--cal-instalacion-fg)" },
  visita: { bg: "var(--cal-visita-bg)", fg: "var(--cal-visita-fg)" },
  entrega: { bg: "var(--cal-entrega-bg)", fg: "var(--cal-entrega-fg)" },
  junta: { bg: "var(--cal-junta-bg)", fg: "var(--cal-junta-fg)" },
  compras: { bg: "var(--cal-compras-bg)", fg: "var(--cal-compras-fg)" },
  otro: { bg: "hsl(var(--muted))", fg: "hsl(var(--foreground) / 0.75)" },
};

/**
 * Pedidos: píldora gris (mismo criterio que la vista Mes) con ícono de
 * paquete y borde punteado — distinta de cualquier categoría de evento.
 */
export const ORDER_FC_COLORS = { bg: "hsl(var(--muted))", fg: "hsl(var(--foreground) / 0.8)" };

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
        backgroundColor:
          item.kind === "event" ? CATEGORY_FC_COLORS[item.event.category].bg : ORDER_FC_COLORS.bg,
        borderColor: "transparent",
        textColor:
          item.kind === "event" ? CATEGORY_FC_COLORS[item.event.category].fg : ORDER_FC_COLORS.fg,
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

/** Contenido de un bloque de evento/pedido: punto de estado (si aplica), ícono de pedido, hora y título. */
export function renderFcEventContent(arg: EventContentArg) {
  const item = arg.event.extendedProps.item as CalendarItem;
  const showCuticle = item.kind === "event" && CATEGORY_META[item.event.category].tracksStatus;
  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {showCuticle && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
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
