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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendario de entregas
        </CardTitle>
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
          <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize">
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
            const dayOrders = ordersByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            const cell = (
              <div
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  dayOrders.length > 0 &&
                    "cursor-pointer bg-primary text-primary-foreground font-semibold hover:bg-primary/90",
                  dayOrders.length === 0 && today && "border border-primary/60 font-semibold",
                  dayOrders.length === 0 && !today && "hover:bg-muted"
                )}
              >
                <span>{format(day, "d")}</span>
                {dayOrders.length > 0 && (
                  <span className="text-[9px] leading-none opacity-90">
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
                      <button type="button" className="w-full">
                        {cell}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="center">
                      <p className="mb-2 text-sm font-semibold capitalize">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <div className="space-y-2">
                        {dayOrders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => onSelectOrder(order.id)}
                            className="flex w-full flex-col gap-1 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">#{order.id} · {getOrderClientName(order)}</span>
                              <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {order.description}
                            </p>
                          </button>
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
