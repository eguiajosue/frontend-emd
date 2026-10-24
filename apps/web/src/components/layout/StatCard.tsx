import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

const TONES = {
  navy: "bg-primary/10 text-primary dark:bg-primary/15",
  magenta: "bg-magenta-soft text-magenta-ink",
  cyan: "bg-cyan-soft text-cyan-ink",
  lime: "bg-lime-soft text-lime-ink",
} as const;

interface StatCardProps {
  label: string;
  /** Número (se anima) o nodo ya formateado. */
  value: number | React.ReactNode;
  /** Formato del número animado (moneda, porcentaje…). */
  format?: Intl.NumberFormatOptions | ((n: number) => string);
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  /** Cambio vs. periodo anterior, en %; positivo = sube. */
  delta?: number;
  /** Texto auxiliar bajo la cifra ("vs. semana pasada"). */
  hint?: React.ReactNode;
  className?: string;
}

/** KPI estándar: etiqueta, cifra grande animada, ícono tintado y delta opcional. */
export function StatCard({ label, value, format, icon: Icon, tone = "navy", delta, hint, className }: StatCardProps) {
  return (
    <div className={cn("surface-card interactive-lift p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-label">{label}</p>
        {Icon && (
          <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
            <Icon className="size-[1.125rem]" />
          </span>
        )}
      </div>
      <p className="text-stat mt-3">
        {typeof value === "number" ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
      {(delta != null || hint) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                delta >= 0 ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
              {Math.abs(delta)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}
