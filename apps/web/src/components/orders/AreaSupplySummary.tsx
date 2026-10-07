import { Package } from "lucide-react";
import { supplySummary } from "@/lib/areaSupply";
import { cn } from "@/lib/utils";
import type { AreaSupply } from "@/types";

/**
 * "Insumos: del cliente — 12 × playeras negras" / "Insumos: nuestros — Film
 * DTF 2 m, Tinta blanca 1". No pinta nada si el área no tiene hoja (pedidos
 * anteriores). Pensado para tarjetas: una línea con elipsis y el texto
 * completo en el `title`.
 */
export function AreaSupplySummary({
  supply,
  className,
  clamp = true,
}: {
  supply: AreaSupply | null | undefined;
  className?: string;
  clamp?: boolean;
}) {
  const summary = supplySummary(supply);
  if (!summary) return null;
  const text = summary.detail ? `${summary.origin} — ${summary.detail}` : summary.origin;
  return (
    <p
      className={cn("flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground", className)}
      title={`Insumos: ${text}`}
      data-testid="area-supply-summary"
    >
      <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className={cn(clamp && "line-clamp-2")}>
        <span className="font-medium text-foreground/80">Insumos:</span> {text}
      </span>
    </p>
  );
}
