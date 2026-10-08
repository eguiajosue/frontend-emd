"use client";

import { memo } from "react";
import {
  Ban,
  CalendarDays,
  CalendarX2,
  CheckCheck,
  ChevronRight,
  Clock,
  Flame,
  Hourglass,
  ListChecks,
  Package,
  PackageCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { OrderStageLine, OrderStepButton, OrderTurnLabel } from "@/components/orders/OrderNextStep";
import { useOrderStep } from "@/hooks/useOrderStep";
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
import { DESIGN_FLOW_STATUS_NAMES, isDesignFlowStatusName, isOrderInDesignStatus } from "@/lib/orderStatus";
import { getStatusDotClasses } from "@/lib/statusColors";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

export const TONE_META: Record<
  DeadlineTone,
  {
    label: string;
    /** Bloque saturado: sólo para la píldora compacta del detalle del pedido. */
    block: string;
    caption: string;
    dot: string;
    /** Píldora tintada suave (texto del color + fondo al ~10%). */
    pill: string;
    /** Color de la cuenta regresiva y del ícono de la tarjeta de métrica. */
    text: string;
    icon: LucideIcon;
  }
> = {
  overdue: {
    label: "Vencido",
    block: "bg-rose-600 text-white dark:bg-rose-600/90",
    caption: "text-rose-50/85",
    dot: "bg-rose-500",
    pill: "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
    icon: Flame,
  },
  at_risk: {
    label: "En riesgo",
    block: "bg-amber-400 text-amber-950 dark:bg-amber-400/90",
    caption: "text-amber-950/70",
    dot: "bg-amber-400",
    pill: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    icon: Hourglass,
  },
  on_time: {
    label: "A tiempo",
    block: "bg-emerald-600 text-white dark:bg-emerald-600/85",
    caption: "text-emerald-50/85",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: Timer,
  },
  no_date: {
    label: "Sin fecha",
    block: "bg-muted text-foreground",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
    pill: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    icon: CalendarX2,
  },
  finished: {
    label: "Terminado",
    block: "bg-sky-600 text-white dark:bg-sky-600/85",
    caption: "text-sky-50/85",
    dot: "bg-sky-500",
    pill: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    icon: PackageCheck,
  },
  delivered: {
    label: "Entregado",
    block: "bg-muted text-muted-foreground",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    pill: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    icon: CheckCheck,
  },
  cancelled: {
    label: "Cancelado",
    block: "bg-muted text-muted-foreground line-through decoration-1",
    caption: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    pill: "bg-muted text-muted-foreground line-through decoration-1",
    text: "text-muted-foreground",
    icon: Ban,
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
  /** Modo TV: tipografía más grande para leer de lejos. */
  wall?: boolean;
  /** Elegida con el teclado (flechas / J-K): se resalta y Enter le da el siguiente paso. */
  keyboardActive?: boolean;
}

/**
 * Tarjeta del muro de pedidos: quién, qué, qué áreas lo tocan y, sobre todo,
 * cuánto falta. La píldora de plazo y la cuenta regresiva en su color son lo
 * primero que se lee desde lejos; todo lo demás es contexto para quien se
 * acerca.
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
  keyboardActive = false,
}: OrderJobCardProps) {
  const stepCtx = useOrderStep();
  const step = stepCtx?.stepFor(order) ?? null;
  const meta = TONE_META[state.tone];
  // Mientras está en diseño, la primera "área" que lo toca es Diseño; las de
  // producción vienen después (antes se veía "Bordado" en un pedido que
  // todavía estaba en manos de Diseño).
  // "autorizado" ya es producción: el diseño terminó y las áreas arrancan.
  const inDesign =
    !!order.requiresDesign &&
    isDesignFlowStatusName(order.status?.name) &&
    !isOrderInDesignStatus(order.status?.name, DESIGN_FLOW_STATUS_NAMES.AUTORIZADO);
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

  const ToneIcon = meta.icon;
  const pct = tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0;

  return (
    <article
      data-order-card={order.id}
      tabIndex={-1}
      aria-current={keyboardActive ? "true" : undefined}
      className={cn(
        "group relative flex w-full min-w-0 flex-col rounded-2xl outline-none border border-border/60 bg-card shadow-soft transition-[box-shadow,border-color] duration-150 hover:border-border hover:shadow-soft-md",
        // Vencido: el borde se tiñe apenas; la píldora y la cuenta en rojo ya
        // lo dicen sin pintar la tarjeta entera.
        state.tone === "overdue" && "border-rose-500/35 dark:border-rose-400/35",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        keyboardActive && "ring-4 ring-primary/70 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Botón que cubre toda la tarjeta: un solo destino de click, con nombre accesible. */}
      <Button
        type="button"
        variant="bare"
        size="bare"
        onClick={() => onOpen(order.id)}
        aria-label={`Ver detalle del pedido #${order.id} de ${clientName}`}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className={cn("pointer-events-none relative flex flex-1 flex-col", wall ? "gap-4 p-5" : "gap-3.5 p-5 pb-4")}>
        {/* Urgencia: píldora tintada + cuenta regresiva en el mismo color. Es
            lo primero que se lee desde lejos, sin bloque de fondo saturado. */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
              wall ? "text-sm" : "text-xs",
              meta.pill
            )}
          >
            <ToneIcon className={wall ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
            {meta.label}
            {state.tone === "overdue" && " hace"}
          </span>
          <p
            className={cn(
              "ml-auto min-w-0 truncate text-right font-heading font-semibold tabular-nums tracking-tight",
              live ? (wall ? "text-2xl" : "text-lg") : wall ? "text-base" : "text-xs font-medium",
              meta.text
            )}
          >
            {headline(order, state)}
          </p>
          {selectable && (
            <div className="pointer-events-auto relative z-10 -my-1 -mr-1 p-1">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectedChange?.(order.id, checked === true)}
                aria-label={`Seleccionar pedido #${order.id}`}
              />
            </div>
          )}
        </div>

        <div className="min-w-0">
          {/* El logo de la sucursal va junto al cliente: de un vistazo se ve de dónde viene. */}
          <div className="flex items-center gap-2">
            <p className={cn("min-w-0 flex-1 truncate font-heading font-semibold leading-snug", wall ? "text-xl" : "text-base")}>
              {clientName}
            </p>
            <BranchBadge order={order} size={wall ? "lg" : "md"} />
          </div>
          <p className={cn("mt-0.5 truncate text-muted-foreground", wall ? "text-sm" : "text-[0.8125rem]")} title={order.description}>
            <span className="tabular-nums text-foreground/70">#{order.id}</span>
            {order.description ? ` · ${order.description}` : ""}
          </p>
        </div>

        {areas.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Áreas" title={allAreas.map(getAreaLabel).join(", ")}>
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

        {step && <OrderStageLine step={step} large={wall} />}

        {/* Progreso de tareas de área: barra gruesa del color del estado. */}
        <div className="mt-auto space-y-2">
          <div className={cn("flex items-center gap-1.5", wall ? "text-sm" : "text-[0.8125rem]")}>
            <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">{inDesign ? "Áreas planificadas" : "Tareas de área"}</span>
            <span className="ml-auto font-medium tabular-nums">
              {tasks.total === 0 ? "—" : inDesign ? tasks.total : `${tasks.done}/${tasks.total}`}
            </span>
          </div>
          {tasks.total > 0 && !inDesign ? (
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={tasks.total}
              aria-valuenow={tasks.done}
              aria-label="Tareas de área terminadas"
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", getStatusDotClasses(order.statusId, order.status?.name))}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <div className="h-2 rounded-full bg-muted" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 tabular-nums text-muted-foreground",
              wall ? "text-sm" : "text-xs"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Entrega:{" "}
            <span className="font-medium text-foreground">
              {order.deliveryDate ? formatDeliveryDate(order.deliveryDate, timeFormat) : "—"}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={`${productCount} producto${productCount === 1 ? "" : "s"}`}>
              <Package className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Productos:</span>
              {productCount}
            </span>
            <span className="inline-flex items-center gap-1" title="Tiempo transcurrido desde que se creó">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Transcurrido:</span>
              {formatElapsed(state.elapsedMs)}
            </span>
          </span>
        </div>
      </div>

      <footer className="pointer-events-none relative flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
        {step?.turn ? (
          <OrderTurnLabel step={step} large={wall} />
        ) : (
          <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
        )}
        {step?.action ? (
          <OrderStepButton order={order} step={step} onOpen={onOpen} large={wall} className="ml-auto" />
        ) : (
          <ChevronRight
            className="pointer-events-none ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </footer>
    </article>
  );
});
