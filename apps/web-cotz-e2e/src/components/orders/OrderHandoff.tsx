"use client";

import { Check, ChevronRight, Circle, CircleDot, CloudOff, Lock } from "lucide-react";
import {
  type HandoffStageState,
  type OrderHandoff as OrderHandoffData,
} from "@/lib/orderHandoff";
import { cn } from "@/lib/utils";

/**
 * El pase del pedido: por qué manos ya pasó, en cuáles está ahora y qué falta.
 *
 * El badge de estado dice en qué estado está, no de quién es el trabajo. Un
 * pedido "esperando autorización" es de Recepción aunque su área siga siendo
 * Diseño; uno "autorizado" es de cada área de producción a la vez. Esta tira lo
 * dice de una: la etapa actual encendida, quién la tiene, y el siguiente paso
 * escrito en lenguaje del taller.
 *
 * Sólo pinta (los datos los arma `buildOrderHandoff`). El detalle de pedido
 * usa `HandoffStages` dentro de su panel de progreso.
 */
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
        "space-y-3 rounded-2xl border p-5",
        handoff.cancelled ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card shadow-soft"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HandoffStages stages={handoff.stages} />

        {pendingSync && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
            title="El último cambio se guardó sin conexión y se va a sincronizar solo apenas vuelva la red."
          >
            <CloudOff className="h-3 w-3 shrink-0" aria-hidden />
            Pendiente de sincronizar
          </span>
        )}
      </div>

      {!handoff.cancelled && (
        <div className="space-y-1.5 border-t pt-3 text-sm">
          <p>
            <span className="text-muted-foreground">Ahora en </span>
            <span className="font-medium">{handoff.current.label}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{handoff.holderLabel}</span>
          </p>
          {/* La única acción que importa ahora mismo, destacada — el resto
              del detalle explica el cómo, pero esto dice el qué. */}
          <div>
            <p className="text-label">
              Siguiente acción
            </p>
            <p className="text-sm font-medium">{handoff.nextStep}</p>
          </div>
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

/** La cadena de etapas (Recepción → … → Entrega) con la actual encendida. */
export function HandoffStages({ stages }: { stages: OrderHandoffData["stages"] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 sm:gap-x-0" aria-label="Etapas del pedido">
      {stages.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.state];
        return (
          <li key={stage.key} className="flex items-center">
            {index > 0 && (
              <ChevronRight aria-hidden className="mx-1 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 sm:block" />
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                STAGE_CLASSES[stage.state]
              )}
              aria-current={stage.state === "current" ? "step" : undefined}
              // El detalle completo queda a mano sin cargar la tira de texto.
              title={stage.detail ? `${stage.label}: ${stage.detail}` : stage.label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const STAGE_ICONS: Record<HandoffStageState, typeof Check> = {
  done: Check,
  current: CircleDot,
  blocked: Lock,
  pending: Circle,
};

// Píldoras tintadas, como los estados del tablero: la actual en tinta (es lo
// que hay que mirar), lo hecho y lo pendiente en gris, lo bloqueado en ámbar.
const STAGE_CLASSES: Record<HandoffStageState, string> = {
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  current: "bg-ink text-ink-foreground shadow-sm",
  // Bloqueada no es lo mismo que pendiente: el trabajo existe pero no puede
  // empezar todavía, y confundirlas hace que un área crea que se traspapeló.
  blocked: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pending: "bg-muted text-muted-foreground",
};
