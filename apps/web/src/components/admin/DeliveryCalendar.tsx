"use client";

import { formatOrderCode } from "@/lib/orderCode";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge } from "@/components/StatusBadge";
import { getOrderClientName } from "@/lib/format";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Order } from "@/types";

interface DeliveryCalendarProps {
  orders: Order[];
  onSelectOrder: (id: number) => void;
}

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Calendario mensual de entregas: agrupa los pedidos con `deliveryDate` por
 * día y muestra un indicador en cada celda con pedidos. Al hacer click en un
 * día con pedidos, abre un popover con la lista (cliente, descripción,
 * estado) que navega al mismo detalle usado en el resto de la app.
 */
export function DeliveryCalendar({ orders, onSelectOrder }: DeliveryCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const { staggerItemVariants } = useMotionPreset();

  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((order) => {
      if (!order.deliveryDate) return;
      const date = new Date(order.deliveryDate);
      if (Number.isNaN(date.getTime())) return;
      const key = format(date, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    });
    return map;
  }, [orders]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex min-w-0 items-center gap-2.5 whitespace-nowrap">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-muted" aria-hidden>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </span>
          Calendario de entregas
        </CardTitle>
        <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-card"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[6.25rem] text-center text-xs font-medium capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-card"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
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
            const dayOrders = ordersByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            // Acento sutil: los días con entregas llevan un fondo magenta al
            // ~10% y el conteo en un punto; hoy se marca en tinta. Nada de
            // celdas enteras en magenta saturado.
            const hasOrders = dayOrders.length > 0;
            const cell = (
              <div
                className={cn(
                  "relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl text-sm tabular-nums transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  hasOrders && !today && "bg-primary/10 font-semibold hover:bg-primary/15",
                  today && "bg-ink font-semibold text-ink-foreground",
                  hasOrders && "cursor-pointer",
                  !hasOrders && !today && "hover:bg-muted"
                )}
              >
                <span className="leading-none">{format(day, "d")}</span>
                {hasOrders && (
                  <span
                    className={cn(
                      "text-[0.6875rem] font-semibold leading-none",
                      today ? "text-ink-foreground/80" : "text-primary"
                    )}
                  >
                    {dayOrders.length}
                  </span>
                )}
              </div>
            );

            return (
              <motion.div key={key} variants={staggerItemVariants}>
                {dayOrders.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="bare"
                        size="bare"
                        className="block w-full rounded-xl"
                        aria-label={`${format(day, "d 'de' MMMM", { locale: es })}: ${dayOrders.length} entrega${dayOrders.length === 1 ? "" : "s"}`}
                      >
                        {cell}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 rounded-2xl" align="center">
                      <p className="mb-2 text-sm font-semibold capitalize">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <div className="space-y-2">
                        {dayOrders.map((order) => (
                          <Button
                            key={order.id}
                            variant="ghost"
                            onClick={() => onSelectOrder(order.id)}
                            className="h-auto w-full flex-col items-stretch gap-1 whitespace-normal rounded-xl bg-muted/50 p-3 text-left font-normal"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{formatOrderCode(order.id)} · {getOrderClientName(order)}</span>
                              <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {order.description}
                            </p>
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  cell
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
