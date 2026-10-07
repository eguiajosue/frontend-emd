"use client";

import { SizeGrid } from "@/components/sizes/SizeGrid";
import { parseSizeBreakdown, piecesLabel, sizeBreakdownTotal, type SizeBreakdown } from "@/lib/garmentSizes";

/**
 * Panel "Tallas" del estudio de mockups: la misma grilla del alta de pedido.
 * Se guarda en `config.sizes` (mockup y plantilla) y se imprime como tabla al
 * pie de la lámina exportada. Autónomo para no mezclarse con el resto del
 * estudio.
 */
export function MockupSizesPanel({
  sizes,
  onChange,
}: {
  sizes: SizeBreakdown | null | undefined;
  onChange: (sizes: SizeBreakdown | null) => void;
}) {
  const total = sizeBreakdownTotal(sizes);
  return (
    <section
      className="space-y-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:px-5"
      aria-labelledby="mockup-sizes-title"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id="mockup-sizes-title" className="text-sm font-semibold">
          Tallas
        </h2>
        {total > 0 && <span className="text-meta tabular-nums">{piecesLabel(total)}</span>}
      </header>
      <SizeGrid idPrefix="mockup-sizes" value={sizes} onChange={(next) => onChange(parseSizeBreakdown(next))} />
      <p className="text-meta">Se imprime como tabla en la lámina.</p>
    </section>
  );
}
