"use client";

import { OrderSizesList } from "@/components/sizes/OrderSizesList";
import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, Play, RotateCcw, UserRound } from "lucide-react";
import { AreaSupplySummary } from "@/components/orders/AreaSupplySummary";
import { Button } from "@/components/ui/button";
import { TONE_META } from "@/components/orders/OrderJobCard";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatCountdown, formatElapsed, type DeadlineState } from "@/lib/orderDeadline";
import { formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isReturnedDesign } from "@/lib/myTasks";
import { PRIORITY_STYLE, type ArrivalPriority } from "@/lib/packageArrivals";
import { assigneeLabel, tvColumnOf, type TvTask } from "@/lib/tvBoard";
import { cn } from "@/lib/utils";
import type { AreaTaskStatus } from "@/types";

function clientName(task: TvTask): string {
  const c = task.order.client;
  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : task.order.clientNameOverride ?? "Sin cliente";
}

type TvAction = { label: string; next?: AreaTaskStatus; icon: typeof Play } | null;

/**
 * La acción de la tele. A diferencia de la bandeja, aquí se ve el trabajo de
 * los compañeros: lo pendiente que ya tiene dueño no ofrece "Tomar" (no se le
 * quita a nadie de un toque), pero lo que está en proceso sí se puede marcar
 * terminado desde la tele del área.
 */
export function tvAction(task: TvTask): TvAction {
  if (task.kind === "design") {
    return isReturnedDesign(task)
      ? { label: "Ver cambios", icon: RotateCcw }
      : { label: task.order.designStartedAt ? "Continuar" : "Abrir", icon: ArrowRight };
  }
  const column = tvColumnOf(task);
  if (column === "terminado") return null;
  if (column === "en_proceso") return { label: "Terminar", next: "terminado", icon: CheckCircle2 };
  if (task.mine) return { label: "Empezar", next: "en_proceso", icon: Play };
  if (task.assignee == null) return { label: "Tomar y empezar", next: "en_proceso", icon: Play };
  return null;
}

interface TvTaskCardProps {
  task: TvTask;
  state: DeadlineState;
  now: number;
  timeFormat: TimeFormatPreference;
  onOpen: (orderId: number) => void;
  onAdvance: (task: TvTask, status: AreaTaskStatus) => void;
  busy: boolean;
  /** Oculta mientras su paquete no llegó (ocupa su lugar igual: es el destino del vuelo). */
  hidden: boolean;
  /** Brillo de recién llegada, del color de la prioridad. */
  highlight: ArrivalPriority | null;
  reduced: boolean;
}

/**
 * Tarjeta de tarea para la tele: letra grande para leer de lejos y un solo
 * botón alto (≥56 px) para usar con el dedo.
 */
export const TvTaskCard = memo(function TvTaskCard({
  task,
  state,
  now,
  timeFormat,
  onOpen,
  onAdvance,
  busy,
  hidden,
  highlight,
  reduced,
}: TvTaskCardProps) {
  const AreaIcon = getAreaIcon(task.area);
  const action = tvAction(task);
  const ActionIcon = action?.icon;
  const column = tvColumnOf(task);
  const done = column === "terminado";
  const tone = TONE_META[state.tone];
  const glow = highlight ? PRIORITY_STYLE[highlight] : null;
  const completedAgo = task.completedAt ? now - new Date(task.completedAt).getTime() : null;

  return (
    <motion.li
      layoutId={reduced ? undefined : `tv-${task.key}`}
      layout={reduced ? false : "position"}
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ layout: { type: "spring", bounce: 0.15, duration: 0.5 }, opacity: { duration: 0.25 } }}
      className="min-w-0 list-none"
    >
      <article
        data-tv-card={task.key}
        aria-label={`Pedido #${task.order.id} · ${getAreaLabel(task.area)}`}
        className={cn(
          "relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition-[box-shadow,border-color] duration-500",
          "hover:border-foreground/30",
          done && "opacity-75",
          glow && cn("ring-4", glow.ring)
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Toda la tarjeta abre el detalle (el ::after la cubre entera), menos
              el botón de acción, que queda por encima. Es un <button> de
              verdad: se llega con Tab y se abre con Enter/Espacio. */}
          <button
            type="button"
            onClick={() => onOpen(task.order.id)}
            aria-label={`Ver detalle del pedido #${task.order.id}`}
            className={cn(
              "rounded-lg text-left font-heading text-3xl font-bold tabular-nums leading-none outline-none",
              "after:absolute after:inset-0 after:cursor-pointer after:rounded-3xl after:content-['']",
              "focus-visible:after:ring-4 focus-visible:after:ring-ring"
            )}
          >
            #{task.order.id}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-base text-foreground/85">
            {AreaIcon && <AreaIcon className="h-4 w-4" aria-hidden />}
            {getAreaLabel(task.area)}
          </span>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 text-xl font-semibold leading-snug" title={task.order.description}>
            {task.order.description || "Sin descripción"}
          </p>
          <p className="truncate text-lg text-muted-foreground">{clientName(task)}</p>
          {task.kind === "production" && (
            <AreaSupplySummary supply={task.supply} className="text-base" />
          )}
          {task.order.branch?.name && (
            <span
              data-testid="branch-badge"
              className="inline-flex rounded-full border border-white/20 px-2.5 py-0.5 text-sm font-medium"
            >
              {task.order.branch.name}
            </span>
          )}
          <OrderSizesList products={task.order.orderProducts} className="[&_li]:text-base" summaryClassName="text-base" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-base font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {completedAgo == null
                ? "Terminado"
                : completedAgo < 60_000
                  ? "Recién terminada"
                  : `Terminó hace ${formatElapsed(completedAgo)}`}
            </span>
          ) : (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-medium", tone.pill)}>
              <tone.icon className="h-4 w-4" aria-hidden />
              {state.remainingMs == null
                ? "Sin fecha"
                : state.remainingMs < 0
                  ? `Vencido ${formatCountdown(state.remainingMs)}`
                  : formatCountdown(state.remainingMs)}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base",
              task.mine ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <UserRound className="h-4 w-4" aria-hidden />
            {assigneeLabel(task)}
          </span>
        </div>

        {task.order.deliveryDate && !done && (
          <p className="text-base text-muted-foreground">
            Entrega: <span className="font-medium text-foreground">{formatDeliveryDate(task.order.deliveryDate, timeFormat)}</span>
          </p>
        )}

        {action && ActionIcon && (
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => (action.next ? onAdvance(task, action.next) : onOpen(task.order.id))}
            aria-label={`${action.label} · pedido #${task.order.id}`}
            className="relative z-10 h-14 w-full gap-2 rounded-2xl text-lg [&_svg]:size-6"
          >
            {busy ? <Loader2 className="animate-spin" /> : <ActionIcon />}
            {action.label}
          </Button>
        )}
      </article>
    </motion.li>
  );
});
