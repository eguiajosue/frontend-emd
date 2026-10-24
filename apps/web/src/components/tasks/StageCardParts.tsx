"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Hourglass,
  MessageSquareWarning,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StageDialog,
  type StageDialogMode,
} from "@/components/orders/StageDialog";
import {
  DONE_COLUMN,
  advanceLabel,
  columnOf,
  stageColumns,
  stageNeighbors,
  taskStage,
  wasRejected,
} from "@/lib/stageBoard";
import type { TvTask } from "@/lib/tvBoard";
import { cn } from "@/lib/utils";
import { getAreaLabel } from "@/lib/areas";

/**
 * Piezas de las tarjetas de un área con etapas compartidas por "Tareas
 * asignadas" y el Modo TV: la barrita de avance (en Bordado: Digitalizado →
 * En pruebas → Producción → Listo), el motivo del rechazo y los botones de
 * cada etapa previa.
 */

/** Dónde va el pedido en el camino del área: lo hecho en tinta, lo actual resaltado. */
export function StageStepper({
  task,
  tv = false,
}: {
  task: TvTask;
  tv?: boolean;
}) {
  const steps = stageColumns(task.area).map((column) => ({
    column: column.id,
    label: column.kind === "done" ? "Listo" : column.label,
  }));
  const current = steps.findIndex((s) => s.column === columnOf(task));
  return (
    <ol
      aria-label={`Etapas de ${getAreaLabel(task.area)}`}
      className={cn("grid gap-1", tv ? "text-sm" : "text-[0.6875rem]")}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const done =
          index < current ||
          (index === current && step.column === DONE_COLUMN);
        const active = index === current && !done;
        return (
          <li
            key={step.column}
            aria-current={active ? "step" : undefined}
            className="min-w-0 space-y-1"
          >
            <span
              className={cn(
                "block rounded-full",
                tv ? "h-1.5" : "h-1",
                done
                  ? "bg-foreground"
                  : active
                    ? "bg-primary"
                    : "bg-muted-foreground/25",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "block truncate leading-none",
                // En la tele (columnas angostas) sólo se rotula la etapa actual.
                tv && !active && "sr-only",
                active
                  ? "font-semibold text-foreground"
                  : done
                    ? "text-foreground/70"
                    : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Por qué se rechazó la revisión anterior: lo primero que el área necesita leer al volver a la etapa de trabajo. */
export function RejectionNote({
  task,
  tv = false,
}: {
  task: TvTask;
  tv?: boolean;
}) {
  if (!wasRejected(task)) return null;
  const test = task.lastTest;
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-xl bg-orange-500/10 px-3 py-2 text-orange-800 dark:text-orange-300",
        tv ? "text-base" : "text-xs",
      )}
    >
      <MessageSquareWarning
        className={cn("mt-0.5 shrink-0", tv ? "h-5 w-5" : "h-3.5 w-3.5")}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="font-semibold">Revisión {test?.round} rechazada</span>
        {test?.resultNotes ? `: ${test.resultNotes}` : ""}
      </span>
    </p>
  );
}

interface StageActionsProps {
  task: TvTask;
  /** Quien trabaja el área (o Recepción/admin) puede mover las etapas. */
  canAct: boolean;
  tv?: boolean;
  className?: string;
}

/**
 * El siguiente paso de una tarea que todavía no produce, en un botón con el
 * verbo de lo que toca: una etapa de trabajo → "Pasar a «En pruebas»" (o
 * "Listo para producir" si es la última); una revisión → "Aprobar" /
 * "Rechazar". Sin permiso, un aviso de en qué va.
 */
export function StageActions({
  task,
  canAct,
  tv = false,
  className,
}: StageActionsProps) {
  const [mode, setMode] = useState<StageDialogMode | null>(null);
  const stage = taskStage(task);
  if (!stage || task.taskId == null) return null;
  const { next } = stageNeighbors(task.area, stage);

  const size = tv ? "lg" : "sm";
  const btn = tv
    ? "h-14 flex-1 gap-2 rounded-2xl text-lg [&_svg]:size-6"
    : "gap-1.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {stage.kind === "work" &&
        (canAct ? (
          <Button
            type="button"
            size={size}
            className={cn("relative z-10", btn, !tv && "ml-auto")}
            onClick={() => setMode("advance")}
          >
            {next?.kind === "review" ? (
              <FlaskConical className={tv ? undefined : "h-4 w-4"} aria-hidden />
            ) : (
              <ArrowRight className={tv ? undefined : "h-4 w-4"} aria-hidden />
            )}
            {advanceLabel(next)}
          </Button>
        ) : (
          <Waiting
            tv={tv}
            label={next ? `Pendiente de pasar a «${next.name}»` : `Pendiente de completar «${stage.name}»`}
          />
        ))}
      {stage.kind === "review" &&
        (canAct ? (
          <>
            <Button
              type="button"
              size={size}
              variant="outline"
              className={cn("relative z-10", btn)}
              onClick={() => setMode("reject")}
            >
              <XCircle className={tv ? undefined : "h-4 w-4"} aria-hidden />
              Rechazar
            </Button>
            <Button
              type="button"
              size={size}
              className={cn("relative z-10", btn)}
              onClick={() => setMode("approve")}
            >
              <CheckCircle2
                className={tv ? undefined : "h-4 w-4"}
                aria-hidden
              />
              Aprobar
            </Button>
          </>
        ) : (
          <Waiting
            tv={tv}
            label={`${stage.name}${task.lastTest?.round ? ` (revisión ${task.lastTest.round})` : ""} en revisión`}
          />
        ))}
      {mode && task.taskId != null && (
        <StageDialog
          orderId={task.order.id}
          taskId={task.taskId}
          area={task.area}
          stage={stage}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

function Waiting({ label, tv }: { label: string; tv: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        tv ? "text-base" : "text-xs",
      )}
    >
      <Hourglass className={tv ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden />
      {label}
    </span>
  );
}
