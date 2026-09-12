"use client";

import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import { Package } from "lucide-react";
import { toCalendarItems, type CalendarItem } from "./calendarMerge";
import type { CalendarEvent, Order } from "@/types";
import "./fullcalendar-theme.css";

/** Color de la bolita/evento por estado — mismo semáforo que la vista Mes. */
const EVENT_HEX_BY_STATUS: Record<CalendarEvent["status"], string> = {
  pendiente: "#ef4444",
  en_proceso: "#f97316",
  terminado: "#10b981",
};

/**
 * Color de marca para los pedidos (distinto de los 3 estados de evento).
 * Referencia viva a `--brand-500` (no un hex fijo aparte) para no
 * desincronizarse si ese token cambia.
 */
const ORDER_COLOR = "hsl(var(--brand-500))";

interface TimeGridCalendarProps {
  view: "timeGridDay" | "timeGridWeek";
  events: CalendarEvent[];
  orders: Order[];
  onAddAt: (isoDateTime: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onSelectOrder: (orderId: number) => void;
}

/**
 * Vistas Día/Semana del calendario de equipo: grilla horaria completa
 * (FullCalendar) en vez de la grilla de bolitas de la vista Mes, para poder
 * ver a qué hora exacta cae cada evento/pedido cuando el día está cargado.
 * Sólo cubre día/semana — el mes sigue siendo `TeamCalendar`, cuyo sistema de
 * bolitas es demasiado a medida para retematizar sobre esta librería.
 */
export function TimeGridCalendar({
  view,
  events,
  orders,
  onAddAt,
  onEdit,
  onSelectOrder,
}: TimeGridCalendarProps) {
  const items = useMemo(() => toCalendarItems(events, orders), [events, orders]);

  const fcEvents = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.kind === "event" ? item.event.title : item.order.description,
        start: item.date,
        allDay: !item.hasTime,
        color: item.kind === "event" ? EVENT_HEX_BY_STATUS[item.event.status] : ORDER_COLOR,
        classNames: item.kind === "order" ? ["fc-order-event"] : [],
        extendedProps: { item } satisfies { item: CalendarItem },
      })),
    [items]
  );

  const handleEventClick = (info: EventClickArg) => {
    const item = info.event.extendedProps.item as CalendarItem;
    if (item.kind === "event") {
      onEdit(item.event);
    } else {
      onSelectOrder(item.order.id);
    }
  };

  const handleDateClick = (info: DateClickArg) => {
    onAddAt(info.dateStr);
  };

  const renderEventContent = (arg: EventContentArg) => {
    const item = arg.event.extendedProps.item as CalendarItem;
    return (
      <div className="flex items-center gap-1 overflow-hidden">
        {item.kind === "order" && <Package className="h-3 w-3 shrink-0" />}
        {arg.timeText && <span className="shrink-0 font-medium">{arg.timeText}</span>}
        <span className="truncate">{arg.event.title}</span>
      </div>
    );
  };

  return (
    <FullCalendar
      key={view}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView={view}
      locale={esLocale}
      headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
      height="auto"
      nowIndicator
      scrollTime="08:00:00"
      slotDuration="00:30:00"
      events={fcEvents}
      eventClick={handleEventClick}
      dateClick={handleDateClick}
      eventContent={renderEventContent}
      dayMaxEvents={false}
    />
  );
}
