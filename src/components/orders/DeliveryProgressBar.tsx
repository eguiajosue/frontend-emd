"use client";

import { useDeliveryProgress, getProgressLevel, PROGRESS_LEVEL_COLORS } from "@/lib/deliveryProgress";

interface DeliveryProgressBarProps {
  creationDate?: string | null;
  deliveryDate?: string | null;
  className?: string;
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
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
