"use client";

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { format, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { makeFcEventClickHandler, renderFcEventContent, useFcEvents } from "../fullcalendarShared";
import { weekDaysFor } from "./mobileCalendarUtils";
import type { CalendarEvent, Order } from "@/types";
import "../fullcalendar-theme.css";

const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** Ancho mínimo de columna: en un teléfono deja ~2 días visibles y el resto scrollea horizontal. */
const DAY_MIN_WIDTH = 150;

interface MobileDayWeekViewProps {
  events: CalendarEvent[];
  orders: Order[];
  /** Día por el que se entró (tocado en `MobileMonthList`). */
  initialDate: Date;
  onBack: () => void;
  onAddAt: (isoDateTime: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onSelectOrder: (orderId: number) => void;
}

/**
 * Vista Día+Semana combinada de mobile: una tira de 7 días (para saltar
 * directo a cualquiera de la semana) arriba de la misma grilla horaria de
 * FullCalendar que usa escritorio, con columnas angostas (`dayMinWidth`) que
 * fuerzan scroll horizontal — así entran ~2 días por pantalla, como en la
 * referencia, sin necesitar una vista custom de FullCalendar.
 *
 * Tocar un día de la tira no cambia la semana cargada: sólo desplaza el
 * scroll horizontal hasta esa columna (`data-date`, atributo que FullCalendar
 * ya expone). Las flechas sí cambian de semana, vía la API de FullCalendar.
 */
export function MobileDayWeekView({
  events,
  orders,
  initialDate,
  onBack,
  onAddAt,
  onEdit,
  onSelectOrder,
}: MobileDayWeekViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const fcRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fcEvents = useFcEvents(events, orders);
  const handleEventClick = makeFcEventClickHandler(onEdit, onSelectOrder);

  // Si se vuelve a la lista de mes y se toca otro día, esta vista se
  // reutiliza (el padre no la desmonta) con un `initialDate` nuevo.
  useEffect(() => {
    setSelectedDate(initialDate);
    fcRef.current?.getApi().gotoDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[data-date="${format(selectedDate, "yyyy-MM-dd")}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [selectedDate]);

  const handleDateClick = (info: DateClickArg) => {
    onAddAt(info.dateStr);
  };

  const goToWeek = (direction: 1 | -1) => {
    const api = fcRef.current?.getApi();
    if (!api) return;
    if (direction === 1) api.next();
    else api.prev();
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  };

  const strip = weekDaysFor(selectedDate);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Volver al mes">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-base font-semibold capitalize">
          {format(selectedDate, "MMMM yyyy", { locale: es })}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => goToWeek(-1)}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {strip.map((day, i) => {
            const selected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDate(day)}
                aria-current={selected ? "date" : undefined}
                aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
                className="flex flex-col items-center gap-1 rounded-lg py-1"
              >
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  {WEEKDAY_LETTERS[i]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                    selected && "bg-foreground text-background",
                    !selected && isToday(day) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => goToWeek(1)}
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div ref={containerRef} className="rounded-xl border bg-card p-1 shadow-soft">
        <FullCalendar
          ref={fcRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={initialDate}
          locale={esLocale}
          headerToolbar={false}
          dayMinWidth={DAY_MIN_WIDTH}
          height="auto"
          nowIndicator
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          events={fcEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventContent={renderFcEventContent}
        />
      </div>
    </div>
  );
}
