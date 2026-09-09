"use client";

import { Check, ChevronRight, CloudOff, Lock } from "lucide-react";
import {
  buildOrderHandoff,
  type HandoffStageState,
  type OrderHandoff as OrderHandoffData,
} from "@/lib/orderHandoff";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { usePendingSync } from "@/hooks/usePendingSync";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

/**
 * El pase del pedido: por qué manos ya pasó, en cuáles está ahora y qué falta.
 *
 * El badge de estado dice en qué estado está, no de quién es el trabajo. Un
 * pedido "esperando autorización" es de Recepción aunque su área siga siendo
 * Diseño; uno "autorizado" es de cada área de producción a la vez. Esta tira lo
 * dice de una: la etapa actual encendida, quién la tiene, y el siguiente paso
 * escrito en lenguaje del taller.
 */
export function OrderHandoff({ order }: { order: Order }) {
  // Misma queryKey que `AreaTasksSection`, que vive en el mismo diálogo: React
  // Query dedupe, no hay request extra.
  const { tasks } = useAreaTasks(order.id);
  const pendingSync = usePendingSync(order.id);
  return <HandoffStrip handoff={buildOrderHandoff(order, tasks)} pendingSync={pendingSync} />;
}

/** Sólo pinta. Separado de la carga de datos para poder verlo en cada estado. */
export function HandoffStrip({
  handoff,
  pendingSync = false,
}: {
  handoff: OrderHandoffData;
  /** El último cambio de estado se hizo sin red y espera a sincronizarse. */
  pendingSync?: boolean;
}) {
  return (
    <section
      aria-label="Pase del pedido"
      className={cn(
        "space-y-3 rounded-2xl border p-4",
        handoff.cancelled ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ol className="flex flex-wrap items-center gap-y-2">
        {handoff.stages.map((stage, index) => (
          <li key={stage.key} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                aria-hidden
                className="mx-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
              />
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                STAGE_CLASSES[stage.state]
              )}
              // El detalle completo queda a mano sin cargar la tira de texto.
              title={stage.detail ? `${stage.label}: ${stage.detail}` : stage.label}
            >
              {stage.state === "done" && <Check className="h-3 w-3 shrink-0" aria-hidden />}
              {stage.state === "blocked" && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
              {stage.label}
            </span>
          </li>
        ))}
        </ol>

        {pendingSync && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-amber-500/50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
            title="El último cambio se guardó sin conexión y se va a sincronizar solo apenas vuelva la red."
          >
            <CloudOff className="h-3 w-3 shrink-0" aria-hidden />
            Pendiente de sincronizar
          </span>
        )}
      </div>

      {!handoff.cancelled && (
        <div className="space-y-0.5 border-t pt-3 text-sm">
          <p>
            <span className="text-muted-foreground">Ahora en </span>
            <span className="font-medium">{handoff.current.label}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{handoff.holderLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground">{handoff.nextStep}</p>
        </div>
      )}

      {handoff.cancelled && (
        <p className="border-t border-destructive/30 pt-3 text-sm font-medium text-destructive">
          {handoff.nextStep}
        </p>
      )}
    </section>
  );
}

const STAGE_CLASSES: Record<HandoffStageState, string> = {
  done: "bg-muted text-muted-foreground",
  current: "bg-primary text-primary-foreground",
  // Bloqueada no es lo mismo que pendiente: el trabajo existe pero no puede
  // empezar todavía, y confundirlas hace que un área crea que se traspapeló.
  blocked: "border border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400",
  pending: "border border-dashed text-muted-foreground/70",
};
