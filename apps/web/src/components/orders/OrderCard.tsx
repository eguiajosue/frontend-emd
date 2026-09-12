"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
import { Paperclip, ArrowUpRight, CheckCircle2 } from "lucide-react";
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

  return (
    <motion.div variants={staggerItemVariants}>
      {/* Sin pulso infinito: en una columna con varias tarjetas vencidas eran
          seis animaciones latiendo a la vez y la urgencia dejaba de leerse. El
          borde rojo, la barra en rojo y el texto "Vencido" ya lo dicen. */}
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
            "cursor-pointer shadow-soft transition-shadow duration-200 hover:shadow-soft-md",
            isCritical && "border-destructive"
          )}
        >
        <CardContent className="density-card density-stack space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">#{order.id}</span>
            {delivered ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ENTREGADO
              </span>
            ) : (
              <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
            )}
          </div>

          {/* Chip de entrega + avatar del asignado: reemplaza la fila anterior
              de ícono+texto por el mismo patrón de "chip mudo + avatar" que ya
              usa el chat (`chatInitials`) para identificar a una persona de un
              vistazo, sin repetir el nombre completo en cada tarjeta. */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Entrega: {formatDeliveryDate(order.deliveryDate, timeFormat)}
            </span>
            {assignedName && (
              <Avatar className="h-7 w-7 border" title={`Asignado a ${assignedName}`}>
                <AvatarFallback className="text-[10px] font-semibold">
                  {chatInitials(order.assignedUser)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          <p className="truncate text-base font-semibold text-foreground">
            {getOrderClientName(order)}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {order.description}
          </p>

          {!delivered && (
            <DeliveryProgressBar
              creationDate={order.creationDate}
              deliveryDate={order.deliveryDate}
              label="at-risk"
              className="pt-1"
            />
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Una etiqueta por área, no una sola: un pedido puede ir a
                Bordado Y DTF. Ver `orderAreaTags`. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {areaTags.map((area) => {
                const AreaIcon = getAreaIcon(area);
                return (
                  <span
                    key={area}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                  >
                    {AreaIcon && <AreaIcon className="h-3 w-3" aria-hidden />}
                    {getAreaLabel(area)}
                  </span>
                );
              })}
              {order.hasClientResourceFile && (
                <span
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  title="Tiene archivos del cliente adjuntos"
                >
                  <Paperclip className="h-3 w-3" aria-hidden />
                  Adjunto
                </span>
              )}
            </div>
            {/* Botón "abrir" puramente decorativo: la tarjeta entera ya es el
                único disparador de click/teclado (`onOpen` arriba). Duplicar
                el handler acá abriría dos veces o generaría un target
                competidor si algún día cambia el layout. */}
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export const OrderCard = memo(OrderCardImpl);

// Reexport util por si otras pantallas necesitan saber el nivel de una tarjeta.
export { getProgressLevel };
