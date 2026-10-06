import {
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Hourglass,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStatusBadgeClasses,
  getStatusLabel,
  getStatusTone,
  type StatusTone,
} from "@/lib/statusColors";

/**
 * Ícono por tono de estado: acompaña al color para que el estado no dependa
 * sólo del matiz (daltonismo, tele del taller con colores lavados).
 */
const ICON_BY_TONE: Record<StatusTone, LucideIcon> = {
  neutral: CircleDashed, // pendiente: todavía no arrancó
  info: Hourglass, // en pruebas / en diseño: etapa temprana, en revisión
  warning: CircleDot, // en proceso / esperando autorización
  progress: CircleCheck, // terminado
  success: BadgeCheck, // entregado / autorizado
  done: CircleCheck,
  danger: RotateCcw, // cambios solicitados: vuelve atrás
  critical: Ban, // cancelado
};

export function getStatusIcon(statusId: number, statusName?: string | null): LucideIcon {
  return ICON_BY_TONE[getStatusTone(statusId, statusName)];
}

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
  /** Contador en burbuja al final (cabeceras de columna del tablero). */
  count?: number;
  /** `false` oculta el ícono (tablas densas). */
  icon?: boolean;
  className?: string;
}

/**
 * Píldora tintada para el estado de un pedido: ícono + nombre (+ contador).
 * Color desde src/lib/statusColors.ts, fuente única del mapeo estado→color.
 */
export function StatusBadge({ statusId, statusName, count, icon = true, className }: StatusBadgeProps) {
  const Icon = getStatusIcon(statusId, statusName);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getStatusBadgeClasses(statusId, statusName),
        className
      )}
    >
      {icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="inline-block first-letter:uppercase">{getStatusLabel(statusId, statusName)}</span>
      {count != null && (
        // Burbuja del mismo color que la píldora, un paso más intensa.
        <span className="-mr-1 ml-0.5 rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-1.5 text-[0.6875rem] font-semibold tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}
