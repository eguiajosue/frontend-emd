"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { fcTimeFormatOptions, makeFcEventClickHandler, renderFcEventContent, useFcEvents } from "./fullcalendarShared";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { CalendarEvent, Order } from "@/types";
import "./fullcalendar-theme.css";

interface TimeGridCalendarProps {
  view: "timeGridDay" | "timeGridWeek";
  events: CalendarEvent[];
  orders: Order[];
  onAddAt: (isoDateTime: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onSelectOrder: (orderId: number) => void;
}

/**
 * Vistas Día/Semana de escritorio del calendario de equipo: grilla horaria
 * completa (FullCalendar) en vez de la lista de píldoras de la vista Mes,
 * para poder ver a qué hora exacta cae cada evento/pedido cuando el día está
 * cargado. El mes sigue siendo `TeamCalendar`, cuyo layout es demasiado a
 * medida para retematizar sobre esta librería; la versión mobile combinada
 * de día+semana es `mobile/MobileDayWeekView`, que reusa el mismo plumbing
 * (`fullcalendarShared.tsx`) con su propia tira de días y scroll horizontal.
 */
export function TimeGridCalendar({
  view,
  events,
  orders,
  onAddAt,
  onEdit,
  onSelectOrder,
}: TimeGridCalendarProps) {
  const fcEvents = useFcEvents(events, orders);
  const handleEventClick = makeFcEventClickHandler(onEdit, onSelectOrder);
  const { timeFormat } = useTimeFormat();
  const timeFormatOptions = fcTimeFormatOptions(timeFormat);

  const handleDateClick = (info: DateClickArg) => {
    onAddAt(info.dateStr);
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
      slotLabelFormat={timeFormatOptions}
      eventTimeFormat={timeFormatOptions}
      events={fcEvents}
      eventClick={handleEventClick}
      dateClick={handleDateClick}
      eventContent={renderFcEventContent}
      dayMaxEvents={false}
    />
  );
}
