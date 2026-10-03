"use client";

import { memo } from "react";
import { ArrowRight, CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatCountdown, type DeadlineState } from "@/lib/orderDeadline";
import { formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isReturnedDesign } from "@/lib/myTasks";
import { cn } from "@/lib/utils";
import type { AreaTaskStatus, MyTask } from "@/types";

const TONE_DOT: Record<DeadlineState["tone"], string> = {
  overdue: "bg-rose-500",
  at_risk: "bg-amber-400",
  on_time: "bg-emerald-500",
  no_date: "bg-muted-foreground/40",
  finished: "bg-sky-500",
  delivered: "bg-muted-foreground/40",
  cancelled: "bg-muted-foreground/40",
};

function dueLabel(state: DeadlineState): string {
  if (state.remainingMs == null) return "Sin fecha de entrega";
  return state.remainingMs < 0
    ? `Vencido hace ${formatCountdown(state.remainingMs).toLowerCase()}`
    : `Entrega en ${formatCountdown(state.remainingMs).toLowerCase()}`;
}

function clientName(task: MyTask): string {
  const c = task.order.client;
  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : task.order.clientNameOverride ?? "Sin cliente";
}

/** La acción del momento: un solo botón, con el verbo de lo que toca. */
function primaryAction(task: MyTask): { label: string; next?: AreaTaskStatus; icon: typeof Play } {
  if (task.kind === "design") {
    return isReturnedDesign(task)
      ? { label: "Ver cambios", icon: RotateCcw }
      : { label: task.order.designStartedAt ? "Continuar" : "Abrir y empezar", icon: ArrowRight };
  }
  if (task.status === "en_proceso") return { label: "Terminar", next: "terminado", icon: CheckCircle2 };
  return { label: task.mine ? "Empezar" : "Tomar y empezar", next: "en_proceso", icon: Play };
}

interface TaskCardProps {
  task: MyTask;
  state: DeadlineState;
  timeFormat: TimeFormatPreference;
  onOpen: (orderId: number) => void;
  onAdvance: (task: MyTask, status: AreaTaskStatus) => void;
  busy: boolean;
}

/**
 * Una TAREA de la bandeja (no un pedido): de qué área es, para qué pedido,
 * cuánto falta para la entrega y el siguiente paso en un botón. Toda la
 * tarjeta abre el detalle del pedido.
 */
export const TaskCard = memo(function TaskCard({ task, state, timeFormat, onOpen, onAdvance, busy }: TaskCardProps) {
  const AreaIcon = getAreaIcon(task.area);
  const action = primaryAction(task);
  const ActionIcon = action.icon;
  const returned = isReturnedDesign(task);
  const inProgress = task.kind === "production" && task.status === "en_proceso";

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] duration-150 hover:border-foreground/15 hover:shadow-soft-md sm:flex-row sm:items-center",
        returned && "border-orange-300 dark:border-orange-900"
      )}
    >
      <Button
        type="button"
        variant="bare"
        size="bare"
        onClick={() => onOpen(task.order.id)}
        aria-label={`Ver pedido #${task.order.id} de ${clientName(task)}`}
        className="absolute inset-0 z-0 rounded-xl"
      />

      <div className="pointer-events-none relative min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="muted" className="gap-1 px-2">
            {AreaIcon && <AreaIcon className="h-3 w-3" aria-hidden />}
            {getAreaLabel(task.area)}
          </Badge>
          {returned && (
            <Badge variant="muted" className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
              Volvió con cambios
            </Badge>
          )}
          {inProgress && (
            <Badge variant="muted" className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              En curso
            </Badge>
          )}
          {!task.mine && task.assignee == null && (
            <span className="text-xs text-muted-foreground">Libre</span>
          )}
        </div>
        <p className="truncate text-sm font-medium">
          <span className="font-heading tabular-nums">#{task.order.id}</span> · {clientName(task)}
        </p>
        <p className="truncate text-sm text-muted-foreground" title={task.order.description}>
          {task.order.description}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[state.tone])} aria-hidden />
          <span className={cn(state.tone === "overdue" && "font-medium text-rose-600 dark:text-rose-400")}>
            {dueLabel(state)}
          </span>
          {task.order.deliveryDate && (
            <span className="tabular-nums">· {formatDeliveryDate(task.order.deliveryDate, timeFormat)}</span>
          )}
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 sm:justify-end">
        <Button
          type="button"
          size="sm"
          variant={inProgress || task.kind === "design" ? "outline" : "default"}
          disabled={busy}
          onClick={() => (action.next ? onAdvance(task, action.next) : onOpen(task.order.id))}
          className="w-full gap-1.5 sm:w-auto"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
          {action.label}
        </Button>
      </div>
    </article>
  );
});
