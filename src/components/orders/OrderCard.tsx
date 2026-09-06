"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryProgressBar } from "@/components/orders/DeliveryProgressBar";
import { formatDeliveryDate, getAssignedUserName, getOrderClientName } from "@/lib/format";
import { useDeliveryProgress, getProgressLevel } from "@/lib/deliveryProgress";
import { getAreaLabel } from "@/lib/areas";
import { cn } from "@/lib/utils";
import { Paperclip, UserRound } from "lucide-react";
import type { Order } from "@/types";

interface OrderCardProps {
  order: Order;
  onOpen: (id: number) => void;
}

/**
 * Tarjeta de pedido para la vista en cuadrícula de "Estatus de Pedidos".
 * Memoizada: con muchos pedidos, sin esto cada refetch de React Query
 * (polling/invalidaciones) re-renderiza todas las tarjetas de todas las
 * columnas aunque su pedido no haya cambiado.
 */
function OrderCardImpl({ order, onOpen }: OrderCardProps) {
  const assignedName = getAssignedUserName(order.assignedUser);
  const progress = useDeliveryProgress(order.creationDate, order.deliveryDate);
  const isCritical = progress !== null && progress >= 95;

  return (
    <motion.div
      animate={isCritical ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={
        isCritical
          ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onOpen(order.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen(order.id);
        }}
        className={cn(
          "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md",
          isCritical && "border-2 border-destructive shadow-[0_0_0_1px_rgba(239,68,68,0.4)]"
        )}
      >
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">#{order.id}</span>
            <StatusBadge statusId={order.statusId} />
          </div>
          <p className="truncate text-sm font-medium">{getOrderClientName(order)}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {order.description}
          </p>
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>Entrega: {formatDeliveryDate(order.deliveryDate)}</span>
            {order.hasAuthorizationFile && (
              <span title="Tiene hoja de autorización adjunta">
                <Paperclip className="h-3.5 w-3.5" aria-label="Tiene hoja de autorización" />
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {assignedName ? (
              <span className="flex items-center gap-1 truncate" title={`Asignado a ${assignedName}`}>
                <UserRound className="h-3.5 w-3.5" />
                <span className="truncate">{assignedName}</span>
              </span>
            ) : (
              <span />
            )}
            {order.area && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {getAreaLabel(order.area)}
              </span>
            )}
          </div>
          <DeliveryProgressBar
            creationDate={order.creationDate}
            deliveryDate={order.deliveryDate}
            className="pt-1"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const OrderCard = memo(OrderCardImpl);

// Reexport util por si otras pantallas necesitan saber el nivel de una tarjeta.
export { getProgressLevel };
