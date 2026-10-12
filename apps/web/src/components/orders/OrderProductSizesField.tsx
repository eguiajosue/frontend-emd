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
 * (el diálogo sólo guarda `sizes` en la fila y usa el total como cantidad).
 *
 * Devuelve DOS celdas para la grilla de la línea: el botón "Tallas" (en la
 * misma fila que la cantidad, con área táctil de 44px) y el panel con la
 * grilla de tallas, que ocupa todo el ancho debajo. Si el producto no parece
 * prenda y no tiene tallas, la celda del botón queda vacía (mantiene la
 * alineación de las columnas).
 */
export function OrderProductSizesField({ rowKey, productName, sizes, onChange }: OrderProductSizesFieldProps) {
  const hasSizes = sizeBreakdownTotal(sizes) > 0;
  const [open, setOpen] = useState(hasSizes);
  const garment = isGarmentName(productName);
  const showToggle = garment || open || hasSizes;

  return (
    <>
      {showToggle ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`order-sizes-${rowKey}`}
          title={hasSizes && !open ? formatSizeBreakdown(sizes) : undefined}
          className={cn(
            // Móvil: junto a la papelera; escritorio: pegado a la cantidad (columna compartida).
            "inline-flex min-h-11 max-w-[11rem] items-center gap-1 justify-self-end rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 sm:justify-self-start",
            (open || hasSizes) && "text-foreground"
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{open ? "Ocultar tallas" : hasSizes ? formatSizeBreakdown(sizes) : "Tallas"}</span>
        </button>
      ) : (
        <span aria-hidden />
      )}
      {open && (
        <div
          id={`order-sizes-${rowKey}`}
          className="col-span-full mt-1 rounded-lg border border-border/60 p-2 duration-200 animate-in fade-in-0 motion-safe:slide-in-from-top-1"
        >
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
    </>
  );
}
