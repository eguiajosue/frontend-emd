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
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
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
import type { AreaTaskStatus, CalendarEvent } from "@/types";

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

const STATUS_META: Record<AreaTaskStatus, { label: string; classes: string; icon: typeof Circle }> = {
  pendiente: {
    label: "Pendiente",
    classes:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    icon: Circle,
  },
  en_proceso: {
    label: "En proceso",
    classes:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    icon: Play,
  },
  terminado: {
    label: "Terminado",
    classes:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

/** Siguiente paso del ciclo corto pendiente → en proceso → terminado (mismo criterio que las tareas de área). */
function nextStatus(status: AreaTaskStatus): AreaTaskStatus | null {
  if (status === "pendiente") return "en_proceso";
  if (status === "en_proceso") return "terminado";
  return null;
}

function eventClientLabel(event: CalendarEvent): string | null {
  if (event.client) {
    return [event.client.first_name, event.client.last_name].filter(Boolean).join(" ");
  }
  return event.clientName ?? null;
}

interface TeamCalendarProps {
  events: CalendarEvent[];
  onAddForDay: (dateKey: string) => void;
  onEdit: (event: CalendarEvent) => void;
}

/**
 * Calendario de equipo de Recepción: mismo componente de grilla mensual que
 * `DeliveryCalendar`, pero con eventos propios (no pedidos) que se pueden
 * crear/editar/borrar y cuyo estado se cicla con un click, igual que las
 * tareas de área de un pedido.
 */
export function TeamCalendar({ events, onAddForDay, onEdit }: TeamCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const { staggerItemVariants } = useMotionPreset();
  const { updateStatus } = useUpdateCalendarEventStatus();
  const { remove } = useCalendarEventMutations();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const date = new Date(event.eventDate);
      if (Number.isNaN(date.getTime())) return;
      const key = format(date, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    );
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleAdvance = async (event: CalendarEvent) => {
    const next = nextStatus(event.status);
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
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const pendingCount = dayEvents.filter((e) => e.status !== "terminado").length;

            const cell = (
              <div
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  dayEvents.length > 0 &&
                    (pendingCount > 0
                      ? "cursor-pointer bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                      : "cursor-pointer bg-emerald-600 text-white font-semibold hover:bg-emerald-600/90"),
                  dayEvents.length === 0 && today && "border border-primary/60 font-semibold",
                  dayEvents.length === 0 && !today && "hover:bg-muted"
                )}
              >
                <span>{format(day, "d")}</span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] leading-none opacity-90">{dayEvents.length}</span>
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
                    {dayEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
                    ) : (
                      <div className="space-y-2">
                        {dayEvents.map((event) => {
                          const meta = STATUS_META[event.status];
                          const StatusIcon = meta.icon;
                          const client = eventClientLabel(event);
                          return (
                            <div key={event.id} className="rounded-lg border p-2.5 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {client && (
                                    <p className="truncate text-xs font-semibold text-muted-foreground">
                                      {client}
                                    </p>
                                  )}
                                  <p className="truncate font-medium">{event.title}</p>
                                  {event.hasTime && (
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(event.eventDate), "HH:mm")}
                                    </p>
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
                                    onClick={() => setEventToDelete(event)}
                                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Eliminar ${event.title}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdvance(event)}
                                disabled={event.status === "terminado"}
                                className={cn(
                                  "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                                  meta.classes,
                                  event.status !== "terminado" && "cursor-pointer hover:opacity-80",
                                  event.status === "terminado" && "cursor-default"
                                )}
                                title={
                                  event.status === "terminado"
                                    ? "Terminado"
                                    : `Marcar como ${STATUS_META[nextStatus(event.status)!].label.toLowerCase()}`
                                }
                              >
                                <StatusIcon className="h-3 w-3" />
                                {meta.label}
                              </button>
                            </div>
                          );
                        })}
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
