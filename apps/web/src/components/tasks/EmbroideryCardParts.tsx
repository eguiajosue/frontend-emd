"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  Hourglass,
  MessageSquareWarning,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmbroideryPrepDialog,
  type PrepDialogMode,
} from "@/components/orders/EmbroideryPrepDialog";
import {
  embroideryColumnOf,
  wasRejected,
  type EmbroideryColumnId,
} from "@/lib/embroideryBoard";
import type { TvTask } from "@/lib/tvBoard";
import { cn } from "@/lib/utils";

/**
 * Piezas de las tarjetas de Bordado compartidas por "Tareas asignadas" y el
 * Modo TV: la barrita de avance (Digitalizado → Pruebas → Producción →
 * Terminado), el motivo del rechazo y los botones de cada etapa previa.
 */

const STEPS: { column: EmbroideryColumnId; label: string }[] = [
  { column: "digitalizado", label: "Digitalizado" },
  { column: "en_pruebas", label: "Pruebas" },
  { column: "produccion", label: "Producción" },
  { column: "terminado", label: "Listo" },
];

/** Dónde va el pedido en el camino de Bordado: lo hecho en tinta, lo actual resaltado. */
export function EmbroideryStepper({
  task,
  tv = false,
}: {
  task: TvTask;
  tv?: boolean;
}) {
  const current = STEPS.findIndex((s) => s.column === embroideryColumnOf(task));
  return (
    <ol
      aria-label="Etapas de Bordado"
      className={cn(
        "grid grid-cols-4 gap-1",
        tv ? "text-sm" : "text-[0.6875rem]",
      )}
    >
      {STEPS.map((step, index) => {
        const done =
          index < current || (index === current && step.column === "terminado");
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

/** Por qué se rechazó la prueba anterior: lo primero que Bordado necesita leer al volver a digitalizar. */
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
        <span className="font-semibold">Prueba {test?.round} rechazada</span>
        {test?.resultNotes ? `: ${test.resultNotes}` : ""}
      </span>
    </p>
  );
}

interface PrepActionsProps {
  task: TvTask;
  /** Quien trabaja Bordado (o Recepción/admin) puede mover las etapas. */
  canAct: boolean;
  tv?: boolean;
  className?: string;
}

/**
 * El siguiente paso de una tarea que todavía no produce, en un botón con el
 * verbo de lo que toca: digitalizado → "Mandar a pruebas"; en pruebas →
 * "Aprobar" / "Rechazar". Sin permiso, un aviso de en qué va.
 */
export function EmbroideryPrepActions({
  task,
  canAct,
  tv = false,
  className,
}: PrepActionsProps) {
  const [mode, setMode] = useState<PrepDialogMode | null>(null);
  const stage = embroideryColumnOf(task);
  if (
    (stage !== "digitalizado" && stage !== "en_pruebas") ||
    task.taskId == null
  )
    return null;

  const size = tv ? "lg" : "sm";
  const btn = tv
    ? "h-14 flex-1 gap-2 rounded-2xl text-lg [&_svg]:size-6"
    : "gap-1.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {stage === "digitalizado" &&
        (canAct ? (
          <Button
            type="button"
            size={size}
            className={cn("relative z-10", btn, !tv && "ml-auto")}
            onClick={() => setMode("send")}
          >
            <FlaskConical className={tv ? undefined : "h-4 w-4"} aria-hidden />
            Mandar a pruebas
          </Button>
        ) : (
          <Waiting tv={tv} label="Pendiente de mandar a pruebas" />
        ))}
      {stage === "en_pruebas" &&
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
            label={`Prueba ${task.lastTest?.round ?? ""} en revisión`.replace(
              "  ",
              " ",
            )}
          />
        ))}
      {mode && task.taskId != null && (
        <EmbroideryPrepDialog
          orderId={task.order.id}
          taskId={task.taskId}
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
