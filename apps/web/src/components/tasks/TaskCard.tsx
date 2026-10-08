"use client";

import { OrderSizesList } from "@/components/sizes/OrderSizesList";
import { memo } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Loader2, Play, RotateCcw, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { AreaSupplySummary } from "@/components/orders/AreaSupplySummary";
import { PREP_STAGE_META } from "@/components/orders/EmbroideryPrepControls";
import { EmbroideryPrepActions, EmbroideryStepper, RejectionNote } from "@/components/tasks/EmbroideryCardParts";
import { Button } from "@/components/ui/button";
import { formatCountdown, type DeadlineState } from "@/lib/orderDeadline";
import { formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isEmbroideryTask, prepStageOf } from "@/lib/embroideryBoard";
import { isReturnedDesign } from "@/lib/myTasks";
import { cn } from "@/lib/utils";
import { AreaChip } from "@/components/AreaChip";
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
  /** Bordado: ¿puede mandar a pruebas / aprobar / rechazar? (el área y Recepción). */
  canMovePrep?: boolean;
}

/**
 * Una TAREA de la bandeja (no un pedido): de qué área es, para qué pedido,
 * cuánto falta para la entrega y el siguiente paso en un botón (tinta).
 * Formato kanban: píldora de área arriba, título, cliente, píldora de fecha y
 * pie con el plazo + la acción. Toda la tarjeta abre el detalle del pedido.
 */
export const TaskCard = memo(function TaskCard({ task, state, timeFormat, onOpen, onAdvance, busy, canMovePrep = false }: TaskCardProps) {
  const action = primaryAction(task);
  const ActionIcon = action.icon;
  const returned = isReturnedDesign(task);
  const inProgress = task.kind === "production" && task.status === "en_proceso";
  const embroidery = isEmbroideryTask(task);
  const stage = embroidery ? prepStageOf(task) : null;
  const stageMeta = stage ? PREP_STAGE_META[stage] : null;

  return (
    <article
      data-area={task.area}
      className={cn(
        "area-stripe group relative flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-[border-color,box-shadow] duration-150 hover:border-border hover:shadow-soft-md dark:border-border",
        returned && "border-orange-300/70 dark:border-orange-900"
      )}
    >
      <Button
        type="button"
        variant="bare"
        size="bare"
        onClick={() => onOpen(task.order.id)}
        aria-label={`Ver pedido #${task.order.id} de ${clientName(task)}`}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <AreaChip area={task.area} className="px-2.5 py-1" />
          {returned && (
            <Badge
              variant="muted"
              className="bg-orange-500/10 px-2.5 py-1 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Volvió con cambios
            </Badge>
          )}
          {stageMeta && (
            <Badge variant="muted" className={cn("px-2.5 py-1", stageMeta.classes)}>
              {stageMeta.label}
            </Badge>
          )}
          {inProgress && (
            <Badge
              variant="muted"
              className="bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
            >
              <Timer className="h-3.5 w-3.5" aria-hidden />
              En curso
            </Badge>
          )}
          {!task.mine && task.assignee == null && (
            <span className="text-xs text-muted-foreground">Libre</span>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <h3
            className="line-clamp-2 font-heading text-base font-semibold leading-snug"
            title={task.order.description}
          >
            {task.order.description || "Sin descripción"}
          </h3>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              <span className="tabular-nums">#{task.order.id}</span> · {clientName(task)}
            </p>
            <BranchBadge order={task.order} size="md" />
          </div>
          <OrderSizesList products={task.order.orderProducts} />
        </div>

        {embroidery && <EmbroideryStepper task={task} />}
        {embroidery && <RejectionNote task={task} />}

        {task.kind === "production" && <AreaSupplySummary supply={task.supply} />}

        {/* Sin fecha no hay píldora: el pie ya lo dice ("Sin fecha de entrega"). */}
        {task.order.deliveryDate && (
          <span
            className={cn(
              "mt-auto inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
              state.tone === "overdue"
                ? "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Entrega:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatDeliveryDate(task.order.deliveryDate, timeFormat)}
              </span>
            </span>
          </span>
        )}
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <p className="pointer-events-none flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[state.tone])} aria-hidden />
          <span className={cn("truncate", state.tone === "overdue" && "font-medium text-rose-600 dark:text-rose-400")}>
            {dueLabel(state)}
          </span>
        </p>
        {stage ? (
          <EmbroideryPrepActions task={task} canAct={canMovePrep} className="relative z-10 ml-auto" />
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => (action.next ? onAdvance(task, action.next) : onOpen(task.order.id))}
            className="z-10 ml-auto gap-1.5"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </article>
  );
});
