"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FIT_HINTS,
  FIT_LABELS,
  GARMENT_FITS,
  GARMENT_SIZES,
  activeFits,
  fitTotal,
  piecesLabel,
  setSizeQuantity,
  sizeBreakdownTotal,
  type GarmentFit,
  type SizeBreakdown,
} from "@/lib/garmentSizes";

interface SizeGridProps {
  /** Desglose actual (null = sin tallas). */
  value: SizeBreakdown | null | undefined;
  onChange: (next: SizeBreakdown) => void;
  /** Prefijo de ids (varias grillas en la misma pantalla). */
  idPrefix: string;
  /** Nombre de la prenda para las etiquetas accesibles. */
  label?: string;
  className?: string;
}

/**
 * Grilla compacta de tallas: filas = cortes (General / Mujer / Youth, se
 * agregan a demanda), columnas = tallas XS…3XL, total por fila y general.
 *
 * Teclado: ↑/↓ suman o restan 1, Enter pasa a la casilla siguiente, Tab
 * recorre normal. Las casillas vacías valen 0.
 */
export function SizeGrid({ value, onChange, idPrefix, label, className }: SizeGridProps) {
  const [extraFits, setExtraFits] = useState<GarmentFit[]>(["general"]);
  const fromValue = activeFits(value);
  const shown = GARMENT_FITS.filter(
    (f) => fromValue.includes(f) || extraFits.includes(f) || (f === "general" && !fromValue.length && !extraFits.length)
  );
  const hidden = GARMENT_FITS.filter((f) => !shown.includes(f));
  const total = sizeBreakdownTotal(value);

  const cellId = (fit: GarmentFit, i: number) => `${idPrefix}-${fit}-${GARMENT_SIZES[i]}`;

  const focusNext = (fitIndex: number, i: number) => {
    const nextI = i + 1 < GARMENT_SIZES.length ? i + 1 : 0;
    const nextFit = i + 1 < GARMENT_SIZES.length ? shown[fitIndex] : shown[fitIndex + 1];
    if (nextFit) document.getElementById(cellId(nextFit, nextI))?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, fit: GarmentFit, fitIndex: number, i: number) => {
    const size = GARMENT_SIZES[i];
    const current = value?.[fit]?.[size] ?? 0;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(setSizeQuantity(value, fit, size, current + 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(setSizeQuantity(value, fit, size, Math.max(current - 1, 0)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      focusNext(fitIndex, i);
    }
  };

  const removeFit = (fit: GarmentFit) => {
    setExtraFits((prev) => prev.filter((f) => f !== fit));
    let next: SizeBreakdown = { ...(value ?? {}) };
    delete next[fit];
    if (!Object.keys(next).length) next = {};
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className)} data-testid={`${idPrefix}-grid`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-separate border-spacing-0 text-xs">
          <caption className="sr-only">Tallas{label ? ` de ${label}` : ""}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-1 py-1 text-left font-medium">
                Corte
              </th>
              {GARMENT_SIZES.map((s) => (
                <th key={s} scope="col" className="px-0.5 py-1 text-center font-medium">
                  {s}
                </th>
              ))}
              <th scope="col" className="px-1 py-1 text-right font-medium">
                Total
              </th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {shown.map((fit, fitIndex) => (
              <tr key={fit}>
                <th scope="row" className="whitespace-nowrap px-1 py-0.5 text-left font-medium" title={FIT_HINTS[fit]}>
                  {FIT_LABELS[fit]}
                </th>
                {GARMENT_SIZES.map((size, i) => {
                  const qty = value?.[fit]?.[size];
                  return (
                    <td key={size} className="px-0.5 py-0.5">
                      <input
                        id={cellId(fit, i)}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`${FIT_LABELS[fit]} ${size}${label ? ` de ${label}` : ""}`}
                        className="h-8 w-full min-w-9 rounded-md border border-input bg-background px-1 text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        value={qty ?? ""}
                        placeholder="0"
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          onChange(setSizeQuantity(value, fit, size, digits ? Number(digits) : undefined));
                        }}
                        onKeyDown={(e) => onKey(e, fit, fitIndex, i)}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </td>
                  );
                })}
                <td className="px-1 py-0.5 text-right font-semibold tabular-nums">{fitTotal(value, fit)}</td>
                <td className="py-0.5 pl-0.5">
                  {shown.length > 1 && (
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      aria-label={`Quitar corte ${FIT_LABELS[fit]}`}
                      onClick={() => removeFit(fit)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {hidden.map((fit) => (
          <button
            key={fit}
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={() => {
              setExtraFits((prev) => [...prev, fit]);
              requestAnimationFrame(() => document.getElementById(cellId(fit, 0))?.focus());
            }}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {FIT_HINTS[fit]}
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold tabular-nums" aria-live="polite" data-testid={`${idPrefix}-total`}>
          Total: {piecesLabel(total)}
        </span>
      </div>
    </div>
  );
}
