"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { SizeGrid } from "@/components/sizes/SizeGrid";
import { cn } from "@/lib/utils";
import { formatSizeBreakdown, isGarmentName, parseSizeBreakdown, sizeBreakdownTotal, type SizeBreakdown } from "@/lib/garmentSizes";

interface OrderProductSizesFieldProps {
  rowKey: string;
  productName: string;
  sizes: SizeBreakdown | null | undefined;
  /** Recibe el desglose limpio (null si quedó vacío) y su total de piezas. */
  onChange: (sizes: SizeBreakdown | null, total: number) => void;
}

/**
 * Desglose de tallas de una línea del alta de pedido. Autónomo a propósito
 * (el diálogo sólo guarda `sizes` en la fila y usa el total como cantidad):
 * si el producto parece prenda se ofrece abierto el botón "Tallas"; en
 * cualquier otro producto queda como opción discreta.
 */
export function OrderProductSizesField({ rowKey, productName, sizes, onChange }: OrderProductSizesFieldProps) {
  const hasSizes = sizeBreakdownTotal(sizes) > 0;
  const [open, setOpen] = useState(hasSizes);
  const garment = isGarmentName(productName);
  if (!garment && !open && !hasSizes) return null;

  return (
    <div className="col-span-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`order-sizes-${rowKey}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          open && "text-foreground"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Ruler className="h-3 w-3" aria-hidden />
        {open ? "Ocultar tallas" : hasSizes ? formatSizeBreakdown(sizes) : "Tallas"}
      </button>
      {open && (
        <div id={`order-sizes-${rowKey}`} className="mt-1 rounded-lg border border-border/60 p-2">
          <SizeGrid
            idPrefix={`order-sizes-${rowKey}`}
            label={productName}
            value={sizes}
            onChange={(next) => {
              const clean = parseSizeBreakdown(next);
              onChange(clean, sizeBreakdownTotal(clean));
            }}
          />
          {hasSizes && (
            <p className="mt-1 text-[11px] text-muted-foreground">La cantidad de la línea es el total de tallas.</p>
          )}
        </div>
      )}
    </div>
  );
}
