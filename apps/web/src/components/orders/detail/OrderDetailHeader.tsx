"use client";

import { useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { TONE_META } from "@/components/orders/OrderJobCard";
import { useDeleteOrder } from "@/hooks/useOrders";
import { useNow } from "@/hooks/useNow";
import { useTimeFormat } from "@/hooks/useTimeFormat";
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

function MenuItem({
  icon: Icon,
  children,
  destructive = false,
  ...props
}: {
  icon: ElementType;
  children: ReactNode;
  destructive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </button>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const state = getDeadlineState(order, now);
  const tone = TONE_META[state.tone];

  const handleConfirmDelete = async () => {
    const result = await deleteOrder(order.id);
    setConfirmDeleteOpen(false);
    if (result !== undefined) onDeleted();
  };

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1.5 text-left">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Title className="font-heading text-lg font-semibold leading-tight tracking-tight">
            <span className="tabular-nums text-muted-foreground">#{order.id}</span>{" "}
            {getOrderClientName(order)}
          </Title>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              tone.block
            )}
          >
            {deadlineLabel(order, state)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {order.deliveryDate && (
            <>
              Entrega <span className="text-foreground">{formatDeliveryDate(order.deliveryDate, timeFormat)}</span>
              {" · "}
            </>
          )}
          Creado el {formatDate(order.creationDate)}
        </p>
      </div>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Más acciones del pedido"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1.5">
          {permissions.canEdit && (
            <MenuItem
              icon={Pencil}
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              Editar datos
            </MenuItem>
          )}
          <Link
            href={`/dashboard/hoja-materiales?order=${order.id}`}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            Hoja de materiales
          </Link>
          {showFullPageLink && (
            <Link
              href={`/dashboard/orders/${order.id}`}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Abrir en página completa
            </Link>
          )}
          {permissions.canDelete && (
            <>
              <div className="my-1 h-px bg-border" role="separator" />
              <MenuItem
                icon={Trash2}
                destructive
                disabled={isDeleting}
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDeleteOpen(true);
                }}
              >
                Eliminar pedido
              </MenuItem>
            </>
          )}
        </PopoverContent>
      </Popover>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleConfirmDelete}
        title={`¿Eliminar el pedido #${order.id}?`}
        description="Esta acción no se puede deshacer. El pedido y su historial dejarán de estar disponibles."
      />
    </div>
  );
}
