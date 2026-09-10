"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoveOrderStatus } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import {
  getNextStatusOption,
  isDeliveredStatus,
  isDesignFlowStatusName,
} from "@/lib/orderStatus";
import type { Order } from "@/types";

interface OrderQuickStatusChipProps {
  order: Order;
}

/**
 * Chip de acción rápida para avanzar el estado de un pedido directo desde la
 * fila de la lista, sin abrir la tarjeta de detalle ni pasar por un
 * dropdown: un solo click aplica el cambio (confirmación optimista vía
 * `useChangeOrderStatus`, que ya dispara el toast de éxito/error).
 *
 * Sólo ofrece el "próximo" estado del flujo lineal (ver `getNextStatusOption`)
 * — para saltar a cualquier otro estado a mano sigue estando el detalle del
 * pedido (`OrderStatusButtons`). No se muestra nada si el usuario no puede
 * cambiar el estado de este pedido, si ya está entregado, o si está en un
 * estado del flujo de diseño (esos sólo se avanzan desde "Proceso de diseño").
 */
export function OrderQuickStatusChip({ order }: OrderQuickStatusChipProps) {
  const { roles, canManageOperations } = usePermissions();
  // Mismo camino que el tablero y el detalle: si el pedido tiene tareas de
  // área, avanzar escribe la tarea, no `Order.statusId`.
  const moveActor = useMemo(
    () => ({
      areas: roles.filter((r) => PRODUCTION_AREA_OPTIONS.some((a) => a.value === r)),
      isManager: canManageOperations,
    }),
    [roles, canManageOperations]
  );
  const { move, isMoving } = useMoveOrderStatus(moveActor);

  const myStageIds = statusIdsForRoles(roles);
  const isInDesignLimbo =
    !!order.requiresDesign && isDesignFlowStatusName(order.status?.name);
  const canChange =
    !isInDesignLimbo && (canManageOperations || myStageIds.includes(order.statusId));
  const next = getNextStatusOption(order.statusId);
  const isChanging = isMoving;

  if (!canChange || !next || isDeliveredStatus(order.statusId)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-xs"
      disabled={isChanging}
      onClick={(e) => {
        e.stopPropagation();
        void move(order, next.value);
      }}
    >
      {isChanging && <Loader2 className="h-3 w-3 animate-spin" />}
      Marcar {next.label}
    </Button>
  );
}
