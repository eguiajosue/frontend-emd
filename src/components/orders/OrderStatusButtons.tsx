"use client";

import { cn } from "@/lib/utils";
import { statusOptions } from "@/lib/orderStatus";
import { getStatusBadgeClasses } from "@/lib/statusColors";

interface OrderStatusButtonsProps {
  /** Estado actual del pedido. */
  currentStatusId: number;
  /** Si el usuario logueado puede cambiar el estado de este pedido. */
  canChange: boolean;
  /** Mientras hay una mutación de cambio de estado en curso. */
  isChanging?: boolean;
  onChange: (statusId: number) => void;
  className?: string;
}

/**
 * Fila de botones de estado (uno por cada estado del flujo), con el color
 * semántico de `statusColors.ts`. Reemplaza al viejo patrón de
 * select + botón "Confirmar": un click en un estado distinto al actual
 * dispara el cambio directamente, sin paso intermedio.
 *
 * Si el usuario no tiene permiso para cambiar el estado, los botones se
 * muestran deshabilitados (no ocultos), para que sea claro que existen.
 */
export function OrderStatusButtons({
  currentStatusId,
  canChange,
  isChanging = false,
  onChange,
  className,
}: OrderStatusButtonsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {statusOptions.map((opt) => {
        const isCurrent = opt.value === currentStatusId;
        const disabled = !canChange || isCurrent || isChanging;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={isCurrent}
            onClick={() => !disabled && onChange(opt.value)}
            title={
              !canChange
                ? "No tenés permiso para cambiar el estado de este pedido"
                : opt.label
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all",
              getStatusBadgeClasses(opt.value),
              isCurrent
                ? "ring-2 ring-offset-2 ring-offset-background ring-current"
                : "opacity-60 hover:opacity-100",
              !canChange && "cursor-not-allowed opacity-40 hover:opacity-40",
              canChange && !isCurrent && "cursor-pointer",
              isChanging && "cursor-wait"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
