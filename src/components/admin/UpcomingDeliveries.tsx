"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusDotClasses } from "@/lib/statusColors";
import { getOrderClientName, formatDeliveryDate } from "@/lib/format";
import { staggerContainerVariants } from "@/lib/motion";
import { useMotionPreset } from "@/lib/motion";
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
  const now = Date.now();

  const upcoming = orders
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate).getTime() >= now - 86_400_000)
    .sort(
      (a, b) => new Date(a.deliveryDate as string).getTime() - new Date(b.deliveryDate as string).getTime()
    )
    .slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-5 w-5 text-primary" />
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
              <motion.button
                key={order.id}
                type="button"
                variants={staggerItemVariants}
                onClick={() => onSelectOrder(order.id)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card/50 p-3 text-left transition-colors hover:bg-muted"
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
                    {formatDeliveryDate(order.deliveryDate)}
                  </span>
                  <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
