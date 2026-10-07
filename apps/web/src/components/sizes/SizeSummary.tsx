import { FIT_LABELS, formatFitSizes, activeFits, piecesLabel, sizeBreakdownTotal, parseSizeBreakdown } from "@/lib/garmentSizes";
import { cn } from "@/lib/utils";

/**
 * Resumen de sólo lectura de un desglose de tallas, una línea por corte:
 * "General: 5 S · 2 M · 3 L" y el total "— 10 pzas". No pinta nada si no hay
 * tallas (pedidos viejos o productos que no son prenda).
 */
export function SizeSummary({ sizes, className }: { sizes: unknown; className?: string }) {
  const b = parseSizeBreakdown(sizes);
  if (!b) return null;
  const fits = activeFits(b);
  return (
    <p className={cn("text-xs text-muted-foreground", className)} data-testid="size-summary">
      {fits.map((f, i) => (
        <span key={f}>
          {i > 0 && " | "}
          <span className="font-medium text-foreground">{FIT_LABELS[f]}:</span> {formatFitSizes(b, f)}
        </span>
      ))}
      <span className="font-semibold text-foreground"> — {piecesLabel(sizeBreakdownTotal(b))}</span>
    </p>
  );
}
