"use client";

import { formatOrderCode } from "@/lib/orderCode";
import { useState, type ElementType } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { TONE_META } from "@/components/orders/OrderJobCard";
import { useDeleteOrder } from "@/hooks/useOrders";
import { useNow } from "@/hooks/useNow";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatDate, formatDeliveryDate, getOrderClientName } from "@/lib/format";
import { formatElapsed, getDeadlineState, type DeadlineState } from "@/lib/orderDeadline";
import type { OrderDetailPermissions } from "@/lib/orderDetail";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

/** Texto del semáforo de entrega: lo mismo que dice la tarjeta del muro. */
export function deadlineLabel(order: Order, state: DeadlineState): string {
  const span = state.remainingMs != null ? formatElapsed(Math.abs(state.remainingMs)) : "";
  switch (state.tone) {
    case "overdue":
      return `Vencido hace ${span}`;
    case "at_risk":
      return `Vence en ${span}`;
    case "on_time":
      return `Faltan ${span}`;
    case "finished":
      return "Listo para entregar";
    case "delivered":
      return order.deliveredAt ? `Entregado el ${formatDate(order.deliveredAt)}` : "Entregado";
    case "cancelled":
      return "Cancelado";
    case "no_date":
      return "Sin fecha de entrega";
  }
}

/**
 * Cabecera del pedido: de quién es, cuánto falta y las acciones de gestión
 * (editar, hoja de materiales, eliminar) guardadas en "⋯". Eliminar ya no
 * vive pegado a la X de cerrar.
 */
export function OrderDetailHeader({
  order,
  permissions,
  onEdit,
  onDeleted,
  showFullPageLink = false,
  Title = "h2",
}: {
  order: Order;
  permissions: OrderDetailPermissions;
  onEdit: () => void;
  onDeleted: () => void;
  /** En el diálogo: link a `/dashboard/orders/[id]`. */
  showFullPageLink?: boolean;
  /** `DialogTitle` en el diálogo, `h1` en la página. */
  Title?: ElementType;
}) {
  const now = useNow();
  const { timeFormat } = useTimeFormat();
  const { deleteOrder, isDeleting } = useDeleteOrder();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const state = getDeadlineState(order, now);
  const tone = TONE_META[state.tone];

  const handleConfirmDelete = async () => {
    const result = await deleteOrder(order.id);
    setConfirmDeleteOpen(false);
    if (result !== undefined) onDeleted();
  };

  const AreaIcon = getAreaIcon(order.area);
  const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-3 text-left">
        <Title className="font-heading text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-[1.75rem]">
          <span className="tabular-nums text-muted-foreground">{formatOrderCode(order.id)}</span>{" "}
          {getOrderClientName(order)}
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(pill, "font-semibold tabular-nums", tone.pill)}>
            <tone.icon className="h-3.5 w-3.5" aria-hidden />
            {deadlineLabel(order, state)}
          </span>
          <StatusBadge
            statusId={order.statusId}
            statusName={order.status?.name}
            className="py-1"
          />
          {order.area && (
            <span className={cn(pill, "border border-border/60 bg-card text-foreground")}>
              {AreaIcon && <AreaIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
              {getAreaLabel(order.area)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {order.deliveryDate && (
            <span className={cn(pill, "border border-border/60 bg-card")}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Entrega:{" "}
              <span className="text-foreground">{formatDeliveryDate(order.deliveryDate, timeFormat)}</span>
            </span>
          )}
          <span className={cn(pill, "border border-border/60 bg-card")}>
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Creado el <span className="text-foreground">{formatDate(order.creationDate)}</span>
          </span>
        </div>
      </div>

      <DropdownMenu>
        <SimpleTooltip label="Más acciones">
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Más acciones del pedido"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
        </SimpleTooltip>
        <DropdownMenuContent align="end" className="w-56">
          {permissions.canEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              Editar datos
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/hoja-materiales?order=${order.id}`}>
              <ClipboardList aria-hidden />
              Hoja de materiales
            </Link>
          </DropdownMenuItem>
          {showFullPageLink && (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/orders/${order.id}`}>
                <ExternalLink aria-hidden />
                Abrir en página completa
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                disabled={isDeleting}
                onSelect={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 aria-hidden />
                Eliminar pedido
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleConfirmDelete}
        title={`¿Eliminar el pedido ${formatOrderCode(order.id)}?`}
        description="Esta acción no se puede deshacer. El pedido y su historial dejarán de estar disponibles."
      />
    </div>
  );
}
