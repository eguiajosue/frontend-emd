"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderQuickStatusChip } from "@/components/orders/OrderQuickStatusChip";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatDate, formatDeliveryDate, getOrderClientName, type TimeFormatPreference } from "@/lib/format";
import {
  formatCountdown,
  formatElapsed,
  getOrderAreas,
  getTaskProgress,
  type DeadlineState,
  type DeadlineTone,
} from "@/lib/orderDeadline";
import { isDesignFlowStatusName } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

export const TONE_META: Record<
  DeadlineTone,
  { label: string; block: string; caption: string; dot: string }
> = {
  overdue: {
    label: "Vencido",
    block: "bg-rose-600 text-white dark:bg-rose-600/90",
    caption: "text-rose-50/85",
    dot: "bg-rose-500",
  },
  at_risk: {
    label: "En riesgo",
    block: "bg-amber-400 text-amber-950 dark:bg-amber-400/90",
    caption: "text-amber-950/70",
    dot: "bg-amber-400",
  },
  on_time: {
    label: "A tiempo",
    block: "bg-emerald-600 text-white dark:bg-emerald-600/85",
    caption: "text-emerald-50/85",
    dot: "bg-emerald-500",
  },
  no_date: {
    label: "Sin fecha",
    block: "bg-muted text-foreground",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  finished: {
    label: "Terminado",
    block: "bg-sky-600 text-white dark:bg-sky-600/85",
    caption: "text-sky-50/85",
    dot: "bg-sky-500",
  },
  delivered: {
    label: "Entregado",
    block: "bg-muted text-muted-foreground",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  cancelled: {
    label: "Cancelado",
    block: "bg-muted text-muted-foreground line-through decoration-1",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

function headline(order: Order, state: DeadlineState): string {
  if (state.remainingMs == null) {
    if (state.tone === "delivered") {
      return order.deliveredAt ? `El ${formatDate(order.deliveredAt)}` : "Cerrado";
    }
    if (state.tone === "cancelled") return "Sin entrega";
    if (state.tone === "finished") return "Listo para entregar";
    if (state.tone === "no_date") return "Falta fecha de entrega";
    return TONE_META[state.tone].label;
  }
  return formatCountdown(state.remainingMs);
}

interface OrderJobCardProps {
  order: Order;
  state: DeadlineState;
  timeFormat: TimeFormatPreference;
  onOpen: (id: number) => void;
  /** Sin esto no hay casilla de selección (roles operativos, modo TV). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (id: number, checked: boolean) => void;
  /** Modo TV: sin acciones, tipografía más grande para leer de lejos. */
  wall?: boolean;
}

/**
 * Tarjeta del muro de pedidos: quién, qué, qué áreas lo tocan y, sobre todo,
 * cuánto falta. El bloque de color es lo primero que se lee desde lejos;
 * todo lo demás es contexto para quien se acerca.
 */
export const OrderJobCard = memo(function OrderJobCard({
  order,
  state,
  timeFormat,
  onOpen,
  selectable = false,
  selected = false,
  onSelectedChange,
  wall = false,
}: OrderJobCardProps) {
  const meta = TONE_META[state.tone];
  // Mientras está en diseño, la primera "área" que lo toca es Diseño; las de
  // producción vienen después (antes se veía "Bordado" en un pedido que
  // todavía estaba en manos de Diseño).
  const inDesign = !!order.requiresDesign && isDesignFlowStatusName(order.status?.name);
  const allAreas = inDesign
    ? ["diseno", ...getOrderAreas(order).filter((a) => a !== "diseno")]
    : getOrderAreas(order);
  // Más de dos chips empujan el encabezado; el resto se resume en "+N".
  const areas = allAreas.slice(0, 2);
  const hiddenAreas = allAreas.length - areas.length;
  const tasks = getTaskProgress(order);
  const productCount = order.orderProducts?.length ?? 0;
  const clientName = getOrderClientName(order);
  const live = state.remainingMs != null;

  return (
    <article
      className={cn(
        "group relative flex w-full min-w-0 flex-col rounded-xl border bg-card transition-[box-shadow,border-color] duration-150 hover:border-foreground/15 hover:shadow-soft-md",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Botón que cubre toda la tarjeta: un solo destino de click, con nombre accesible. */}
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        aria-label={`Ver detalle del pedido #${order.id} de ${clientName}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <header className="pointer-events-none relative flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className={cn("font-heading font-semibold tabular-nums leading-none", wall ? "text-xl" : "text-base")}>
            #{order.id}
          </p>
          <p className={cn("mt-1.5 truncate font-medium", wall ? "text-base" : "text-sm")}>{clientName}</p>
          <p className="truncate text-xs text-muted-foreground" title={order.description}>
            {order.description}
          </p>
        </div>
        {areas.length > 0 && (
          <ul className="flex shrink-0 flex-wrap justify-end gap-1" aria-label="Áreas" title={allAreas.map(getAreaLabel).join(", ")}>
            {areas.map((area) => {
              const Icon = getAreaIcon(area);
              return (
                <li key={area}>
                  <Badge variant="muted" className="px-2">
                    {Icon && <Icon className="h-3 w-3" aria-hidden />}
                    {getAreaLabel(area)}
                  </Badge>
                </li>
              );
            })}
            {hiddenAreas > 0 && (
              <li>
                <Badge variant="muted" className="px-2">+{hiddenAreas}</Badge>
              </li>
            )}
          </ul>
        )}
        {selectable && (
          <div className="pointer-events-auto relative z-10 -mr-1 -mt-1 p-1">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectedChange?.(order.id, checked === true)}
              aria-label={`Seleccionar pedido #${order.id}`}
            />
          </div>
        )}
      </header>

      <div className={cn("pointer-events-none relative mx-3 rounded-lg px-3 py-2.5", meta.block)}>
        <p className={cn("text-xs font-medium", meta.caption)}>
          {meta.label}
          {state.tone === "overdue" && " hace"}
        </p>
        <p
          className={cn(
            "font-heading font-bold tabular-nums tracking-tight",
            live ? (wall ? "text-3xl" : "text-2xl") : "text-base",
          )}
        >
          {headline(order, state)}
        </p>
        <dl className={cn("mt-1.5 grid grid-cols-2 gap-2 text-xs leading-tight", meta.caption)}>
          <div>
            <dt className="opacity-80">Entrega</dt>
            <dd className="font-medium tabular-nums">
              {order.deliveryDate ? formatDeliveryDate(order.deliveryDate, timeFormat) : "—"}
            </dd>
          </div>
          <div className="text-right">
            <dt className="opacity-80">Transcurrido</dt>
            <dd className="font-medium tabular-nums">{formatElapsed(state.elapsedMs)}</dd>
          </div>
        </dl>
      </div>

      <div className="pointer-events-none relative grid grid-cols-2 gap-3 px-4 pb-3 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Productos</p>
          <p className="font-heading text-lg font-semibold tabular-nums leading-tight">{productCount}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">{inDesign ? "Áreas planificadas" : "Tareas de área"}</p>
          <p className="font-heading text-lg font-semibold tabular-nums leading-tight">
            {tasks.total === 0 ? "—" : `${tasks.done}/${tasks.total}`}
          </p>
          {tasks.total > 0 && (
            <div
              className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={tasks.total}
              aria-valuenow={tasks.done}
              aria-label="Tareas de área terminadas"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${(tasks.done / tasks.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="pointer-events-none relative mt-auto flex items-center gap-2 border-t px-4 py-2.5">
        <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
        {!wall && (
          <div className="pointer-events-auto relative z-10 ml-auto flex items-center">
            <OrderQuickStatusChip order={order} />
          </div>
        )}
        <ChevronRight
          className={cn(
            "pointer-events-none h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5",
            wall && "ml-auto"
          )}
          aria-hidden
        />
      </footer>
    </article>
  );
});
