"use client";

import { formatOrderCode } from "@/lib/orderCode";
import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryProgressBar } from "@/components/orders/DeliveryProgressBar";
import { formatDeliveryDate, getAssignedUserName, getOrderClientName } from "@/lib/format";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { chatInitials } from "@/hooks/useChat";
import { useDeliveryProgress, getProgressLevel } from "@/lib/deliveryProgress";
import { getAreaLabel, getAreaIcon } from "@/lib/areas";
import { orderAreaTags } from "@/lib/orderAreas";
import { cn } from "@/lib/utils";
import { useMotionPreset } from "@/lib/motion";
import { isDeliveredStatus } from "@/lib/orderStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { CalendarDays, ListChecks, Paperclip } from "lucide-react";
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
  const delivered = isDeliveredStatus(order.statusId);
  const progress = useDeliveryProgress(order.creationDate, order.deliveryDate);
  const isCritical = !delivered && progress !== null && progress >= 95;
  const { staggerItemVariants, cardHoverMotion, cardTapMotion } = useMotionPreset();
  const areaTags = orderAreaTags(order);
  const { timeFormat } = useTimeFormat();

  // Tareas pendientes por marcar de este pedido: tareas de producción por
  // área (ya vienen en `order.areaTasks`) + tareas del calendario de equipo
  // vinculadas a este pedido (`/calendar-tasks`, gateado por permiso — sólo
  // recepcion/admin/superuser pueden verlas, así que en un tablero de área
  // esta cuenta simplemente da 0 sin disparar ningún pedido).
  const { canManageOperations } = usePermissions();
  const { data: calendarTasks } = useCalendarTasks({ enabled: canManageOperations });
  const pendingAreaTasksCount =
    order.areaTasks?.filter((t) => t.status !== "terminado").length ?? 0;
  const pendingLinkedTasksCount = calendarTasks.filter(
    (t) => t.orderId === order.id && !t.completed
  ).length;
  const pendingTasksCount = pendingAreaTasksCount + pendingLinkedTasksCount;

  return (
    <motion.div variants={staggerItemVariants}>
      {/* Sin pulso infinito: en una columna con varias tarjetas vencidas eran
          seis animaciones latiendo a la vez y la urgencia dejaba de leerse. El
          borde teñido, la barra en rojo y el texto "Vencido" ya lo dicen. */}
      <motion.div
        whileHover={{ ...cardHoverMotion.whileHover, transition: cardHoverMotion.transition }}
        whileTap={{ ...cardTapMotion.whileTap, transition: cardTapMotion.transition }}
      >
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onOpen(order.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpen(order.id);
          }}
          className={cn(
            "cursor-pointer shadow-soft transition-[box-shadow,border-color] duration-200 hover:shadow-soft-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isCritical && "border-rose-500/40 dark:border-rose-400/40"
          )}
        >
        <CardContent className="density-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatOrderCode(order.id)}</span>
          </div>

          <div className="min-w-0 space-y-1">
            <p className="truncate font-heading text-base font-semibold leading-snug text-foreground">
              {getOrderClientName(order)}
            </p>
            <p className="line-clamp-2 text-[0.8125rem] text-muted-foreground">
              {order.description}
            </p>
          </div>

          {!delivered && (
            <DeliveryProgressBar
              creationDate={order.creationDate}
              deliveryDate={order.deliveryDate}
              label="at-risk"
            />
          )}

          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Entrega: <span className="font-medium text-foreground">{formatDeliveryDate(order.deliveryDate, timeFormat)}</span>
            </span>
          </span>

          {/* Pie: áreas a la izquierda; adjuntos, tareas pendientes y
              asignado a la derecha, como los contadores de la referencia. */}
          {(areaTags.length > 0 || order.hasClientResourceFile || pendingTasksCount > 0 || assignedName) && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            {/* Una etiqueta por área, no una sola: un pedido puede ir a
                Bordado Y DTF. Ver `orderAreaTags`. */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {areaTags.map((area) => {
                const AreaIcon = getAreaIcon(area);
                return (
                  <Badge key={area} variant="muted" className="px-2 text-foreground/80">
                    {AreaIcon && <AreaIcon className="h-3 w-3" aria-hidden />}
                    {getAreaLabel(area)}
                  </Badge>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
              {order.hasClientResourceFile && (
                <span className="inline-flex items-center gap-1" title="Tiene archivos del cliente adjuntos">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Tiene adjuntos</span>
                </span>
              )}
              {pendingTasksCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300"
                  title={`${pendingTasksCount} tarea${pendingTasksCount === 1 ? "" : "s"} pendiente${pendingTasksCount === 1 ? "" : "s"} por marcar`}
                >
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  {pendingTasksCount}
                </span>
              )}
              {assignedName && (
                <Avatar className="h-7 w-7 border-2 border-card" title={`Asignado a ${assignedName}`}>
                  <AvatarFallback className="text-[0.6875rem] font-semibold">
                    {chatInitials(order.assignedUser)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
          )}
        </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export const OrderCard = memo(OrderCardImpl);

// Reexport util por si otras pantallas necesitan saber el nivel de una tarjeta.
export { getProgressLevel };
