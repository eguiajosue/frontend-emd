import { cn } from "@/lib/utils";
import { getStatusBadgeClasses, getStatusLabel } from "@/lib/statusColors";

interface StatusBadgeProps {
  statusId: number;
  /**
   * Nombre del estado (típicamente `order.status?.name`). Necesario para que
   * los 4 estados del flujo de diseño se vean bien: sus ids los siembra el
   * backend y pueden variar entre entornos, así que sin el nombre no hay
   * forma de saber su color/label. Opcional para no romper los call sites
   * que sólo tienen el id de los 5 estados originales (estables).
   */
  statusName?: string | null;
  className?: string;
}

/** Pill de color consistente para el estado de un pedido. Ver src/lib/statusColors.ts. */
export function StatusBadge({ statusId, statusName, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        getStatusBadgeClasses(statusId, statusName),
        className
      )}
    >
      {getStatusLabel(statusId, statusName).toUpperCase()}
    </span>
  );
}
