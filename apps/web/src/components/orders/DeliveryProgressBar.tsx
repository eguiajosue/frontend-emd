"use client";

import { useDeliveryProgress, getProgressLevel, PROGRESS_LEVEL_COLORS } from "@/lib/deliveryProgress";
import { cn } from "@/lib/utils";

interface DeliveryProgressBarProps {
  creationDate?: string | null;
  deliveryDate?: string | null;
  className?: string;
  /**
   * `"always"` mantiene el texto bajo la barra. `"at-risk"` (por defecto en la
   * tarjeta del tablero) lo muestra sólo cuando el plazo ya aprieta: repetir
   * "34% del plazo transcurrido" en cada tarjeta de cada columna es ruido que
   * tapa justo a las que sí están en rojo. El dato sigue disponible en el
   * `title` de la barra y en el detalle del pedido.
   */
  label?: "always" | "at-risk";
}

/**
 * Barra delgada de progreso de vencimiento (tiempo transcurrido entre
 * creación y fecha de entrega). No se renderiza si el pedido no tiene
 * `deliveryDate`.
 */
export function DeliveryProgressBar({
  creationDate,
  deliveryDate,
  className,
  label: labelMode = "always",
}: DeliveryProgressBarProps) {
  const progress = useDeliveryProgress(creationDate, deliveryDate);
  if (progress === null) return null;

  const clamped = Math.min(Math.max(progress, 0), 100);
  const level = getProgressLevel(progress);
  const color = PROGRESS_LEVEL_COLORS[level];
  const label =
    progress > 100
      ? `Vencido (${Math.round(progress)}%)`
      : `${Math.round(progress)}% del plazo transcurrido`;

  const showLabel = labelMode === "always" || level === "danger" || level === "critical";

  return (
    <div className={className} title={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
          }}
        />
      </div>
      {showLabel && (
        <p
          className={cn(
            "mt-1 text-[10px]",
            level === "critical" ? "font-medium text-destructive" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
      )}
    </div>
  );
}
