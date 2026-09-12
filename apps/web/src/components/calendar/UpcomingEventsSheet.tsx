"use client";

import { useMemo } from "react";
import { format, isToday, isTomorrow, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Package } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import {
  calendarItemClientLabel,
  calendarItemTitle,
  EVENT_STATUS_BADGE_CLASS,
  EVENT_STATUS_LABEL,
  groupItemsByDay,
  toCalendarItems,
} from "./calendarMerge";
import { CATEGORY_META } from "./eventCategories";
import type { CalendarEvent, Order } from "@/types";

interface UpcomingEventsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: CalendarEvent[];
  orders: Order[];
  onEdit: (event: CalendarEvent) => void;
  onSelectOrder: (orderId: number) => void;
}

function dayHeaderLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

/**
 * Panel "Próximos": agenda de todo lo que viene (eventos + pedidos con
 * entrega), agrupada por día — mismo rol que la lista de la izquierda en la
 * app de Calendario de referencia, pero como hoja lateral en vez de un 4to
 * tab, para no tapar la grilla que se estaba mirando.
 */
export function UpcomingEventsSheet({
  open,
  onOpenChange,
  events,
  orders,
  onEdit,
  onSelectOrder,
}: UpcomingEventsSheetProps) {
  const groupedDays = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const items = toCalendarItems(events, orders).filter((item) => item.date >= todayStart);
    const byDay = groupItemsByDay(items);
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, orders]);

  const handleSelect = (dayKey: string, itemId: string) => {
    const item = groupedDays.find(([key]) => key === dayKey)?.[1].find((i) => i.id === itemId);
    if (!item) return;
    onOpenChange(false);
    if (item.kind === "event") onEdit(item.event);
    else onSelectOrder(item.order.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Próximos</SheetTitle>
          <SheetDescription>Eventos y pedidos con entrega, de hoy en adelante.</SheetDescription>
        </SheetHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 py-2">
          {groupedDays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hay nada agendado"
              description="Los próximos eventos y pedidos con entrega van a aparecer acá."
            />
          ) : (
            <div className="space-y-5">
              {groupedDays.map(([dayKey, items]) => (
                <div key={dayKey}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dayHeaderLabel(items[0].date)}
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const client = calendarItemClientLabel(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(dayKey, item.id)}
                          className="flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            {item.kind === "event" && (
                              <span
                                className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[item.event.category].pillClasses}`}
                              >
                                {CATEGORY_META[item.event.category].label}
                              </span>
                            )}
                            {client && (
                              <p className="truncate text-xs font-semibold text-muted-foreground">
                                {client}
                              </p>
                            )}
                            <p className="truncate font-medium">{calendarItemTitle(item)}</p>
                            {item.hasTime && (
                              <p className="text-xs text-muted-foreground">
                                {format(item.date, "HH:mm")}
                              </p>
                            )}
                          </div>
                          {item.kind === "event" ? (
                            CATEGORY_META[item.event.category].tracksStatus && (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVENT_STATUS_BADGE_CLASS[item.event.status]}`}
                              >
                                {EVENT_STATUS_LABEL[item.event.status]}
                              </span>
                            )
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              <Package className="h-3 w-3" />
                              Pedido
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
