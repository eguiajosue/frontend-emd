"use client";

import { ArrowRight, CheckCircle2, Loader2, PackageCheck, Play, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrderStep } from "@/hooks/useOrderStep";
import type { OrderNextStep as Step } from "@/lib/orderNextStep";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

/**
 * "Qué sigue" en las tarjetas de pedido (Lista, Cuadrícula y Modo TV): la
 * línea de etapas, de quién es el turno y el botón con el verbo de lo que
 * toca. Fuera de `OrderStepProvider` no se muestra (tarjetas de sólo lectura).
 */

const MOVE_ICON: Record<number, LucideIcon> = { 3: Play, 4: CheckCircle2, 5: PackageCheck };

/** Barrita con todas las etapas: lo hecho en tinta y la actual resaltada. */
export function OrderStageLine({ step, large = false }: { step: Step; large?: boolean }) {
  return (
    <ol
      aria-label="Etapas del pedido"
      // Las etiquetas se quedan chicas también en la tele: cinco etapas no caben a text-sm.
      className={cn("grid gap-1", large ? "text-xs" : "text-[0.6875rem]")}
      style={{ gridTemplateColumns: `repeat(${step.stages.length}, minmax(0, 1fr))` }}
    >
      {step.stages.map((stage, index) => {
        const last = index === step.stages.length - 1;
        const done = index < step.current || (index === step.current && last);
        const active = index === step.current && !done;
        return (
          <li key={stage.key} aria-current={active ? "step" : undefined} className="min-w-0 space-y-1">
            <span
              aria-hidden
              className={cn(
                "block rounded-full",
                large ? "h-1.5" : "h-1",
                done ? "bg-foreground/80" : active ? "bg-primary" : "bg-muted-foreground/25"
              )}
            />
            <span
              className={cn(
                "block truncate leading-none",
                active ? "font-semibold text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
              )}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Te toca" resaltado; si no, a quién le toca. */
export function OrderTurnLabel({ step, large = false }: { step: Step; large?: boolean }) {
  if (!step.turn) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1",
        large ? "text-sm" : "text-xs",
        step.turn.mine ? "bg-primary/10 font-semibold text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      <UserRound className={cn("shrink-0", large ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
      <span className="truncate">{step.turn.label}</span>
    </span>
  );
}

interface OrderStepButtonProps {
  order: Order;
  step: Step;
  onOpen: (orderId: number) => void;
  large?: boolean;
  className?: string;
}

/** El siguiente paso en un botón. Un cambio de estado se aplica al instante (con "Deshacer"). */
export function OrderStepButton({ order, step, onOpen, large = false, className }: OrderStepButtonProps) {
  const ctx = useOrderStep();
  const action = step.action;
  if (!ctx || !action) return null;
  const busy = ctx.pendingOrderId === order.id;
  const Icon = action.kind === "move" ? MOVE_ICON[action.statusId] ?? ArrowRight : ArrowRight;
  return (
    <Button
      type="button"
      size={large ? "default" : "sm"}
      variant={action.kind === "move" ? "default" : "outline"}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        if (action.kind === "move") void ctx.advance(order);
        else onOpen(order.id);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`${action.label} · pedido #${order.id}`}
      className={cn("pointer-events-auto relative z-10 gap-1.5", large && "h-11 px-5 text-base", className)}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" aria-hidden />}
      {action.label}
    </Button>
  );
}
