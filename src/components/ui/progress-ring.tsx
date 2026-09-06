import { cn } from "@/lib/utils";

/**
 * Anillo circular de progreso para métricas puntuales (ej. "% a tiempo" en
 * las tarjetas de rendimiento del admin). Usa `currentColor` para el trazo
 * activo, así hereda el color de texto que le pasemos (incluye el acento de
 * marca vía `text-primary`) y funciona igual en claro/oscuro.
 */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  className,
  trackClassName,
  label,
}: {
  /** 0-100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  label?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={typeof label === "string" ? label : `${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn("fill-none stroke-muted", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="fill-none stroke-current transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">
        {label ?? `${clamped}%`}
      </span>
    </div>
  );
}
