"use client";

import { formatOrderCode } from "@/lib/orderCode";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusDotClasses } from "@/lib/statusColors";
import { getOrderClientName, formatDeliveryDate } from "@/lib/format";
import { staggerContainerVariants } from "@/lib/motion";
import { useMotionPreset } from "@/lib/motion";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { CalendarDays, PackageCheck } from "lucide-react";
import type { Order } from "@/types";

interface UpcomingDeliveriesProps {
  orders: Order[];
  onSelectOrder: (id: number) => void;
  limit?: number;
}

/** Próximas entregas: siguientes pedidos ordenados por fecha de entrega más cercana (hoy en adelante). */
export function UpcomingDeliveries({ orders, onSelectOrder, limit = 6 }: UpcomingDeliveriesProps) {
  const { staggerItemVariants } = useMotionPreset();
  const { timeFormat } = useTimeFormat();

  // `orders` se invalida seguido (cualquier evento de pedido del socket, ver
  // useSocket), lo que dispara un re-render de este panel en el dashboard con
  // frecuencia; sin memo, cada uno repetía el filter+sort+slice sobre TODOS
  // los pedidos aunque `orders`/`limit` no hubieran cambiado.
  const upcoming = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => o.deliveryDate && new Date(o.deliveryDate).getTime() >= now - 86_400_000)
      .sort(
        (a, b) => new Date(a.deliveryDate as string).getTime() - new Date(b.deliveryDate as string).getTime()
      )
      .slice(0, limit);
  }, [orders, limit]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-muted" aria-hidden>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </span>
          Próximas entregas
        </CardTitle>
        {upcoming.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {upcoming.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {upcoming.length === 0 ? (
          <p className="px-2 pb-2 text-sm text-muted-foreground">No hay entregas próximas programadas.</p>
        ) : (
          <motion.ul
            className="divide-y divide-border/60"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {upcoming.map((order) => (
              <motion.li key={order.id} variants={staggerItemVariants} className="py-1">
                <Button
                  variant="ghost"
                  onClick={() => onSelectOrder(order.id)}
                  className="h-auto w-full flex-col items-stretch gap-2 whitespace-normal rounded-xl px-2.5 py-2.5 text-left font-normal"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${getStatusDotClasses(order.statusId, order.status?.name)}`}
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      <span className="tabular-nums">{formatOrderCode(order.id)}</span> · {getOrderClientName(order)}
                    </p>
                    <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                  </div>
                  <p className="truncate pl-[1.125rem] text-xs text-muted-foreground">{order.description}</p>
                  <span className="ml-[1.125rem] inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    Entrega: <span className="font-medium tabular-nums text-foreground">{formatDeliveryDate(order.deliveryDate, timeFormat)}</span>
                  </span>
                </Button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </CardContent>
    </Card>
  );
}
