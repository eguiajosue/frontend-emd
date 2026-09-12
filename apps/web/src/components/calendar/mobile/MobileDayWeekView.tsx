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
import { fcTimeFormatOptions, makeFcEventClickHandler, renderFcEventContent, useFcEvents } from "../fullcalendarShared";
import { weekDaysFor } from "./mobileCalendarUtils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { formatHourLabel } from "@/lib/format";
import type { CalendarEvent, Order } from "@/types";
import "../fullcalendar-theme.css";

const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Ancho mínimo de columna: en un teléfono deja ~2 días visibles y el resto scrollea horizontal. */
const DAY_MIN_WIDTH = 150;
/** Ancho de la columna de horas propia (no la de FullCalendar, ver comentario abajo). Un poco más ancha que en 24h para que quepan etiquetas como "11p". */
const AXIS_WIDTH = 40;

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
 * FullCalendar que usa escritorio, con columnas angostas que fuerzan scroll
 * horizontal — así entran ~2 días por pantalla, como en la referencia, sin
 * necesitar una vista custom de FullCalendar.
 *
 * El ancho angosto NO usa la opción `dayMinWidth` de FullCalendar: esa
 * activa internamente su layout de scroll horizontal "premium"
 * (`renderHScrollLayout`), que requiere el plugin de pago
 * `@fullcalendar/scrollgrid` — sin él, tira `Error: No ScrollGrid
 * implementation` (así se rompía esta pantalla en producción). En su lugar,
 * se envuelve el calendario en un contenedor angosto (7 columnas al ancho
 * mínimo) dentro de un `overflow-x-auto` normal: mismo resultado visual,
 * sin plugin de pago.
 *
 * Columna de horas: la que genera FullCalendar queda DENTRO de esa misma
 * área con scroll horizontal, así que al desplazarse para ver días
 * posteriores se va con el resto (quedaría fuera de vista). No se la
 * "congela" en su lugar ahí mismo — se probaron `position: sticky` y
 * `transform` por JS, y en Chromium (confirmado real, no sólo en el
 * navegador headless de pruebas) cualquiera de los dos deja la celda bien
 * posicionada pero deja de pintar su texto. En vez de pelear con eso, la
 * nativa de FullCalendar se blanquea (`slotLabelContent`/`allDayText`,
 * props declarativas — no hay mutación de DOM después del montaje) y se
 * dibuja una columna de horas propia, fija, fuera del área con scroll:
 * como nunca se la reposiciona tras su primer render, no le pega el mismo
 * bug de pintado.
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
  const [axisLayout, setAxisLayout] = useState<{ headerHeight: number; slotHeight: number } | null>(null);

  const fcEvents = useFcEvents(events, orders);
  const handleEventClick = makeFcEventClickHandler(onEdit, onSelectOrder);
  const { timeFormat } = useTimeFormat();

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

  // Mide, sin tocar nada de FullCalendar (sólo lectura), cuánto ocupa el
  // encabezado + la fila "todo el día" (`headerHeight`, lo que hay arriba de
  // la primera franja horaria) y cuánto mide cada franja de 30 min
  // (`slotHeight`), para que la columna de horas propia calce con las líneas
  // reales de la grilla.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const root = container.querySelector<HTMLElement>(".fc");
      const body = container.querySelector<HTMLElement>(".fc-timegrid-body");
      const slot = container.querySelector<HTMLElement>(".fc-timegrid-slot");
      if (!root || !body || !slot) return;
      const headerHeight = body.getBoundingClientRect().top - root.getBoundingClientRect().top;
      const slotHeight = slot.getBoundingClientRect().height;
      if (headerHeight > 0 && slotHeight > 0) {
        setAxisLayout({ headerHeight, slotHeight });
      }
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [fcEvents]);

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

      <div className="flex overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="shrink-0 border-r" aria-hidden style={{ width: AXIS_WIDTH }}>
          <div style={{ height: axisLayout?.headerHeight ?? 0 }} />
          {axisLayout &&
            HOURS.map((hour) => (
              <div key={hour} style={{ height: axisLayout.slotHeight * 2 }} className="relative">
                {hour > 0 && (
                  <span className="absolute right-1 top-0 -translate-y-1/2 text-[11px] text-muted-foreground">
                    {formatHourLabel(hour, timeFormat)}
                  </span>
                )}
              </div>
            ))}
        </div>

        <div ref={containerRef} className="min-w-0 flex-1 overflow-x-auto p-1">
          <div style={{ minWidth: `${7 * DAY_MIN_WIDTH}px` }}>
            <FullCalendar
              ref={fcRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              initialDate={initialDate}
              locale={esLocale}
              headerToolbar={false}
              height="auto"
              nowIndicator
              scrollTime="08:00:00"
              slotDuration="00:30:00"
              slotLabelContent={() => ""}
              eventTimeFormat={fcTimeFormatOptions(timeFormat)}
              allDayText=""
              events={fcEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventContent={renderFcEventContent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
