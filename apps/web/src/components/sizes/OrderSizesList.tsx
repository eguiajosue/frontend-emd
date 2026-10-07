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
}: {
  products?: Array<{ customName?: string | null; quantity: number; sizes?: unknown }> | null;
  className?: string;
}) {
  const sized = (products ?? []).filter((p) => parseSizeBreakdown(p.sizes));
  if (!sized.length) return null;
  return (
    <ul className={cn("space-y-1", className)} aria-label="Tallas" data-testid="order-sizes-list">
      {sized.map((p, i) => (
        <li key={i} className="text-xs">
          <span className="font-semibold">{p.customName}</span>
          <SizeSummary sizes={p.sizes} className="inline [&]:ml-1" />
        </li>
      ))}
    </ul>
  );
}
