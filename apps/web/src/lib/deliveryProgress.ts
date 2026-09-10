"use client";

/**
 * Progreso de tiempo transcurrido de un pedido respecto a su fecha de entrega:
 *
 *   progreso = (ahora - creationDate) / (deliveryDate - creationDate) * 100
 *
 * Sin techo: un pedido vencido devuelve > 100. `null` si el pedido no tiene
 * `deliveryDate` o las fechas son inválidas/inconsistentes.
 */
import { useEffect, useState } from "react";

export function computeDeliveryProgress(
  creationDate?: string | null,
  deliveryDate?: string | null,
  now: number = Date.now()
): number | null {
  if (!creationDate || !deliveryDate) return null;
  const start = new Date(creationDate).getTime();
  const end = new Date(deliveryDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  // Vencido ya (independiente de cómo se relacionen start/end): siempre >100,
  // más cuanto más tiempo pasó desde el vencimiento. Cubre el caso de editar
  // la fecha de entrega a una fecha anterior a la creación del pedido, donde
  // (end - start) da negativo o cero y el cálculo proporcional no aplica.
  if (end <= now) {
    const overdueHours = (now - end) / (1000 * 60 * 60);
    return 100 + Math.min(overdueHours, 100);
  }
  if (end <= start) return 100;
  return ((now - start) / (end - start)) * 100;
}

/** true si el pedido ya venció (progreso > 100%). */
export function isOverdue(creationDate?: string | null, deliveryDate?: string | null): boolean {
  const progress = computeDeliveryProgress(creationDate, deliveryDate);
  return progress !== null && progress > 100;
}

export type ProgressLevel = "ok" | "warning" | "danger" | "critical";

/** Umbral de color: 0-60% verde, 60-80% amarillo, 80-95% naranja, 95%+ rojo. */
export function getProgressLevel(progress: number): ProgressLevel {
  if (progress >= 95) return "critical";
  if (progress >= 80) return "danger";
  if (progress >= 60) return "warning";
  return "ok";
}

export const PROGRESS_LEVEL_COLORS: Record<ProgressLevel, string> = {
  ok: "#22c55e", // verde
  warning: "#eab308", // amarillo
  danger: "#f97316", // naranja
  critical: "#ef4444", // rojo
};

const RECALC_INTERVAL_MS = 60_000;

/**
 * Recalcula el progreso de entrega de un pedido al montar y cada 1 minuto
 * (no hace falta precisión al segundo para una barra de progreso visual).
 */
export function useDeliveryProgress(
  creationDate?: string | null,
  deliveryDate?: string | null
): number | null {
  const [progress, setProgress] = useState<number | null>(() =>
    computeDeliveryProgress(creationDate, deliveryDate)
  );

  useEffect(() => {
    setProgress(computeDeliveryProgress(creationDate, deliveryDate));
    if (!creationDate || !deliveryDate) return;
    const id = setInterval(() => {
      setProgress(computeDeliveryProgress(creationDate, deliveryDate));
    }, RECALC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [creationDate, deliveryDate]);

  return progress;
}
