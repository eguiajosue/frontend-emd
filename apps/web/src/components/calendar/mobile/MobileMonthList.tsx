"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { groupItemsByDay, toCalendarItems } from "../calendarMerge";
import { CalendarPill } from "../TeamCalendar";
import {
  buildContinuousWeeks,
  extendRangeBackward,
  extendRangeForward,
  initialMonthRange,
  type MonthRange,
} from "./mobileCalendarUtils";
import type { CalendarEvent, Order } from "@/types";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/** Máximo de píldoras por día en esta vista densa (la referencia no muestra "+N", sólo trunca). */
const MAX_VISIBLE_PILLS = 2;

interface MobileMonthListProps {
  events: CalendarEvent[];
  orders: Order[];
  onSelectDay: (date: Date) => void;
}

/**
 * Lista continua de semanas con scroll infinito (mobile), estilo Calendario
 * de Apple: reemplaza la grilla de celdas altas de escritorio por filas de
 * semana compactas, apiladas verticalmente. Tocar cualquier día — tenga o no
 * actividad — abre la vista Día+Semana combinada (`MobileDayWeekView`)
 * centrada en esa fecha.
 *
 * El rango cargado (`range`) arranca en el mes actual ±2 y se extiende de a
 * `MONTH_LOAD_STEP` meses cuando el scroll se acerca al borde de arriba o de
 * abajo (`IntersectionObserver` sobre un centinela en cada punta), hasta
 * `MAX_LOADED_MONTHS`. Al extender hacia ARRIBA se corrige el `scrollTop` en
 * el mismo frame (antes del paint, vía `useLayoutEffect`) para que el
 * contenido nuevo no empuje visualmente lo que se estaba mirando.
 */
export function MobileMonthList({ events, orders, onSelectDay }: MobileMonthListProps) {
  const [range, setRange] = useState<MonthRange>(() => initialMonthRange(new Date()));
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollFixRef = useRef<number | null>(null);

  const itemsByDay = useMemo(() => groupItemsByDay(toCalendarItems(events, orders)), [events, orders]);
  const weeks = useMemo(() => buildContinuousWeeks(range), [range]);

  // Corrige el salto de scroll que dejaría agregar semanas ARRIBA del punto
  // donde está mirando el usuario. Corre antes del paint del navegador.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && pendingScrollFixRef.current !== null) {
      const delta = container.scrollHeight - pendingScrollFixRef.current;
      container.scrollTop += delta;
      pendingScrollFixRef.current = null;
    }
  }, [range]);

  useEffect(() => {
    const container = containerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!container || !topEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === topEl) {
            const next = extendRangeBackward(range);
            if (!next) return;
            pendingScrollFixRef.current = container.scrollHeight;
            setRange(next);
          } else if (entry.target === bottomEl) {
            const next = extendRangeForward(range);
            if (next) setRange(next);
          }
        });
      },
      { root: container, rootMargin: "300px 0px" }
    );
    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [range]);

  return (
    <div
      ref={containerRef}
      // TODO: altura estimada sin verificación visual en navegador real —
      // ajustar contra el alto real del header de la página + la barra de
      // tabs móvil una vez se pueda probar en dispositivo.
      className="h-[calc(100dvh-16rem)] overflow-y-auto"
    >
      <div className="sticky top-0 z-10 grid grid-cols-7 gap-0.5 bg-background py-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i}>{label}</div>
        ))}
      </div>

      <div ref={topSentinelRef} className="h-px" aria-hidden />

      {weeks.map((week) => (
        <div key={week.weekStart.toISOString()}>
          {week.monthLabel && (
            <p className="px-1 pb-1 pt-3 text-sm font-semibold capitalize">{week.monthLabel}</p>
          )}
          <div className="grid grid-cols-7 gap-0.5 border-b py-1">
            {week.days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDay.get(key) ?? [];
              const visible = dayItems.slice(0, MAX_VISIBLE_PILLS);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDay(day)}
                  aria-label={format(day, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                  className="flex min-h-[3.5rem] flex-col items-center gap-0.5 rounded px-0.5 pt-1 text-left hover:bg-muted"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      today && "bg-foreground text-background"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex w-full min-w-0 flex-col gap-0.5">
                    {visible.map((item) => (
                      <CalendarPill key={item.id} item={item} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div ref={bottomSentinelRef} className="h-px" aria-hidden />
    </div>
  );
}
