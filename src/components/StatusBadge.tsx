import { cn } from "@/lib/utils";
import { getStatusBadgeClasses, getStatusLabel } from "@/lib/statusColors";

interface StatusBadgeProps {
  statusId: number;
  className?: string;
}

/** Pill de color consistente para el estado de un pedido. Ver src/lib/statusColors.ts. */
export function StatusBadge({ statusId, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        getStatusBadgeClasses(statusId),
        className
      )}
    >
      {getStatusLabel(statusId).toUpperCase()}
    </span>
  );
}
