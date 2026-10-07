import { SizeSummary } from "@/components/sizes/SizeSummary";
import { parseSizeBreakdown } from "@/lib/garmentSizes";
import { cn } from "@/lib/utils";

/**
 * Líneas del pedido que traen desglose de tallas, en sólo lectura:
 * "Playera — General: 5 S · 2 M · 3 L — 10 pzas". No pinta nada si ninguna
 * línea tiene tallas (pedidos viejos). Para Hoja de materiales y Tareas/TV.
 */
export function OrderSizesList({
  products,
  className,
  summaryClassName,
}: {
  products?: Array<{ customName?: string | null; quantity: number; sizes?: unknown }> | null;
  className?: string;
  /** Clases del resumen de tallas de cada línea (ej. `text-base` en el Modo TV, donde `text-xs` no se lee). */
  summaryClassName?: string;
}) {
  const sized = (products ?? []).filter((p) => parseSizeBreakdown(p.sizes));
  if (!sized.length) return null;
  return (
    <ul className={cn("space-y-1", className)} aria-label="Tallas" data-testid="order-sizes-list">
      {sized.map((p, i) => (
        <li key={i} className="text-xs">
          <span className="font-semibold">{p.customName}</span>
          <SizeSummary sizes={p.sizes} className={cn("inline [&]:ml-1", summaryClassName)} />
        </li>
      ))}
    </ul>
  );
}
