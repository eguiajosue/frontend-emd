"use client";

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
import { PackageCheck } from "lucide-react";
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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" aria-hidden />
          Próximas entregas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay entregas próximas programadas.</p>
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {upcoming.map((order) => (
              <motion.div key={order.id} variants={staggerItemVariants}>
                <Button
                  variant="outline"
                  onClick={() => onSelectOrder(order.id)}
                  className="h-auto w-full justify-start gap-3 whitespace-normal p-3 text-left font-normal"
                >
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDotClasses(order.statusId, order.status?.name)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      #{order.id} · {getOrderClientName(order)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{order.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDeliveryDate(order.deliveryDate, timeFormat)}
                    </span>
                    <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                  </div>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
