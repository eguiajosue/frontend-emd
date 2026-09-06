"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, getOrderClientName } from "@/lib/format";
import { Paperclip } from "lucide-react";
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
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(order.id);
      }}
      className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
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
          <span>Entrega: {formatDate(order.deliveryDate)}</span>
          {order.hasAuthorizationFile && (
            <Paperclip className="h-3.5 w-3.5" aria-label="Tiene hoja de autorización" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const OrderCard = memo(OrderCardImpl);
