"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMotionPreset } from "@/lib/motion";
import { useCalendarEventMutations, useUpdateCalendarEventStatus } from "@/hooks/useCalendarEvents";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  calendarItemClientLabel,
  calendarItemTitle,
  EVENT_STATUS_BADGE_CLASS,
  EVENT_STATUS_LABEL,
  groupItemsByDay,
  nextEventStatus,
  toCalendarItems,
  type CalendarItem,
} from "./calendarMerge";
import type { CalendarEvent, Order } from "@/types";

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

/** Máximo de bolitas visibles por día antes de resumir el resto en "+N". */
const MAX_VISIBLE_DOTS = 5;

interface TeamCalendarProps {
  events: CalendarEvent[];
  orders: Order[];
  onAddForDay: (dateKey: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onSelectOrder: (orderId: number) => void;
}

/**
 * Calendario de equipo de Recepción, vista Mes: grilla mensual con eventos
 * propios (editables) y pedidos con fecha de entrega (sólo lectura, se
 * editan desde "Pedidos") mezclados en el mismo día.
 *
 * Un día con actividad se pinta rosa/magenta de marca (`bg-brand-*`, fijo —
 * no seguimos `--primary`, que el usuario puede recolorear en Apariencia)
 * para que salte a la vista sin depender del acento elegido. Dentro, un
 * sistema de bolitas resume el estado: rojo/naranja/verde por evento
 * (pendiente/en_proceso/terminado) y una bolita blanca por pedido —, cada
 * una con un aro blanco fino para distinguirse del fondo rosa.
 */
export function TeamCalendar({ events, orders, onAddForDay, onEdit, onSelectOrder }: TeamCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const { staggerItemVariants } = useMotionPreset();
  const { updateStatus } = useUpdateCalendarEventStatus();
  const { remove } = useCalendarEventMutations();

  const itemsByDay = useMemo(
    () => groupItemsByDay(toCalendarItems(events, orders)),
    [events, orders]
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleAdvance = async (event: CalendarEvent) => {
    const next = nextEventStatus(event.status);
    if (!next) return;
    await updateStatus(event.id, next);
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    try {
      await remove(eventToDelete.id);
      toast.success("Evento eliminado");
      setEventToDelete(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el evento."));
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col items-start gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Calendario de equipo</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm font-medium capitalize sm:min-w-[7.5rem]">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <motion.div
          className="grid grid-cols-7 gap-1"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.01 } } }}
        >
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const hasItems = dayItems.length > 0;
            const visibleDots = dayItems.slice(0, MAX_VISIBLE_DOTS);
            const overflow = dayItems.length - visibleDots.length;

            const cell = (
              <div
                className={cn(
                  "flex aspect-square w-full flex-col items-center gap-1 rounded-lg pt-1 text-sm transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  hasItems &&
                    "cursor-pointer bg-brand-500 text-white font-semibold hover:bg-brand-500/90 dark:bg-brand-600 dark:hover:bg-brand-600/90",
                  !hasItems && today && "border border-primary/60 font-semibold",
                  !hasItems && !today && "hover:bg-muted"
                )}
              >
                <span>{format(day, "d")}</span>
                {hasItems && (
                  <div className="flex flex-wrap items-center justify-center gap-0.5 px-1">
                    {visibleDots.map((item) => (
                      <span
                        key={item.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full ring-1 ring-white",
                          item.kind === "event"
                            ? {
                                pendiente: "bg-red-500",
                                en_proceso: "bg-orange-500",
                                terminado: "bg-emerald-500",
                              }[item.event.status]
                            : "bg-white"
                        )}
                      />
                    ))}
                    {overflow > 0 && (
                      <span className="text-[8px] font-semibold leading-none opacity-90">
                        +{overflow}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            return (
              <motion.div key={key} variants={staggerItemVariants}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="w-full">
                      {cell}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="center">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => onAddForDay(key)}
                        aria-label="Agregar evento este día"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {dayItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin actividad este día.</p>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((item) =>
                          item.kind === "event" ? (
                            <EventRow
                              key={item.id}
                              item={item}
                              onEdit={onEdit}
                              onAdvance={handleAdvance}
                              onDelete={setEventToDelete}
                            />
                          ) : (
                            <OrderRow key={item.id} item={item} onSelectOrder={onSelectOrder} />
                          )
                        )}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>

      <AlertDialog open={Boolean(eventToDelete)} onOpenChange={(next) => !next && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {eventToDelete ? `"${eventToDelete.title}" se borra para todo el equipo.` : ""} Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EventRow({
  item,
  onEdit,
  onAdvance,
  onDelete,
}: {
  item: Extract<CalendarItem, { kind: "event" }>;
  onEdit: (event: CalendarEvent) => void;
  onAdvance: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  const event = item.event;
  const client = calendarItemClientLabel(item);
  const next = nextEventStatus(event.status);

  return (
    <div className="rounded-lg border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {client && <p className="truncate text-xs font-semibold text-muted-foreground">{client}</p>}
          <p className="truncate font-medium">{calendarItemTitle(item)}</p>
          {event.hasTime && (
            <p className="text-xs text-muted-foreground">{format(item.date, "HH:mm")}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Editar ${event.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(event)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Eliminar ${event.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdvance(event)}
        disabled={!next}
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
          EVENT_STATUS_BADGE_CLASS[event.status],
          next && "cursor-pointer hover:opacity-80",
          !next && "cursor-default"
        )}
        title={next ? `Marcar como ${EVENT_STATUS_LABEL[next].toLowerCase()}` : "Terminado"}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            { pendiente: "bg-red-500", en_proceso: "bg-orange-500", terminado: "bg-emerald-500" }[
              event.status
            ]
          )}
        />
        {EVENT_STATUS_LABEL[event.status]}
      </button>
    </div>
  );
}

function OrderRow({
  item,
  onSelectOrder,
}: {
  item: Extract<CalendarItem, { kind: "order" }>;
  onSelectOrder: (orderId: number) => void;
}) {
  const order = item.order;
  const client = calendarItemClientLabel(item);

  return (
    <button
      type="button"
      onClick={() => onSelectOrder(order.id)}
      className="flex w-full flex-col gap-1 rounded-lg border border-dashed p-2.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Package className="h-3 w-3" />
        Pedido #{order.id} · {client}
      </div>
      <p className="truncate font-medium">{calendarItemTitle(item)}</p>
      {item.hasTime && <p className="text-xs text-muted-foreground">{format(item.date, "HH:mm")}</p>}
    </button>
  );
}
