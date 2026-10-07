import type { GarmentFit, GarmentSize, SizeBreakdown } from "@/types";

/**
 * Tallas por prenda: constantes, normalización, totales y formato del
 * desglose (corte → talla → piezas). Espejo de `src/common/garment-sizes.ts`
 * del backend, que valida lo mismo. Sin React para poder testearlo aparte.
 */

export type { GarmentFit, GarmentSize, SizeBreakdown };

export const GARMENT_SIZES: readonly GarmentSize[] = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
export const GARMENT_FITS: readonly GarmentFit[] = ["general", "mujer", "youth"];

export const FIT_LABELS: Record<GarmentFit, string> = {
  general: "General",
  mujer: "Mujer",
  youth: "Youth",
};

/** Descripción larga del corte (tooltips / lectores de pantalla). */
export const FIT_HINTS: Record<GarmentFit, string> = {
  general: "General (unisex)",
  mujer: "Mujer (dama)",
  youth: "Youth (juvenil)",
};

export const MAX_PIECES_PER_SIZE = 100000;

/**
 * ¿El nombre del producto parece una prenda con tallas? Se usa para ofrecer
 * el desglose de entrada (el botón "Tallas" igual está en cualquier línea).
 */
const GARMENT_WORDS =
  /\b(camis[ae]s?|camiset[ae]s?|player[ae]s?|t-?shirts?|hoodies?|sudader[ae]s?|polos?|chamarr[ae]s?|chalec(o|os)|uniformes?|jerseys?|blus[ae]s?|sweaters?|su[eé]teres?)\b/i;

export function isGarmentName(name: string | null | undefined): boolean {
  return Boolean(name && GARMENT_WORDS.test(name.normalize("NFD").replace(/[̀-ͯ]/g, "")));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Lee un desglose desde datos no confiables (API, config de mockup vieja):
 * descarta cortes/tallas desconocidos y cantidades no válidas o en cero.
 * Devuelve null si no queda nada.
 */
export function parseSizeBreakdown(value: unknown): SizeBreakdown | null {
  if (!isObj(value)) return null;
  const out: SizeBreakdown = {};
  for (const fit of GARMENT_FITS) {
    const row = value[fit];
    if (!isObj(row)) continue;
    const clean: Partial<Record<GarmentSize, number>> = {};
    for (const size of GARMENT_SIZES) {
      const qty = row[size];
      if (typeof qty === "number" && Number.isInteger(qty) && qty > 0 && qty <= MAX_PIECES_PER_SIZE) {
        clean[size] = qty;
      }
    }
    if (Object.keys(clean).length) out[fit] = clean;
  }
  return Object.keys(out).length ? out : null;
}

export function fitTotal(b: SizeBreakdown | null | undefined, fit: GarmentFit): number {
  const row = b?.[fit];
  return row ? GARMENT_SIZES.reduce((sum, s) => sum + (row[s] ?? 0), 0) : 0;
}

export function sizeBreakdownTotal(b: SizeBreakdown | null | undefined): number {
  return GARMENT_FITS.reduce((sum, f) => sum + fitTotal(b, f), 0);
}

/** Cambia una casilla devolviendo un desglose nuevo (0/undefined la borra). */
export function setSizeQuantity(
  b: SizeBreakdown | null | undefined,
  fit: GarmentFit,
  size: GarmentSize,
  qty: number | undefined
): SizeBreakdown {
  const next: SizeBreakdown = { ...(b ?? {}) };
  const row = { ...(next[fit] ?? {}) };
  if (qty && qty > 0) row[size] = Math.min(Math.floor(qty), MAX_PIECES_PER_SIZE);
  else delete row[size];
  next[fit] = row;
  return next;
}

/** "5 S · 2 M · 3 L" de un corte (vacío si no tiene piezas). */
export function formatFitSizes(b: SizeBreakdown | null | undefined, fit: GarmentFit): string {
  const row = b?.[fit];
  if (!row) return "";
  return GARMENT_SIZES.filter((s) => (row[s] ?? 0) > 0)
    .map((s) => `${row[s]} ${s}`)
    .join(" · ");
}

export function piecesLabel(n: number): string {
  return `${n} ${n === 1 ? "pza" : "pzas"}`;
}

/**
 * Resumen de una línea: "General: 5 S · 2 M · 3 L — 10 pzas", con varios
 * cortes separados por " | ". Vacío si no hay tallas.
 */
export function formatSizeBreakdown(b: SizeBreakdown | null | undefined): string {
  const parts = GARMENT_FITS.map((f) => {
    const text = formatFitSizes(b, f);
    return text ? `${FIT_LABELS[f]}: ${text}` : "";
  }).filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(" | ")} — ${piecesLabel(sizeBreakdownTotal(b))}`;
}

/** Cortes con al menos una pieza (filas visibles por defecto en la grilla). */
export function activeFits(b: SizeBreakdown | null | undefined): GarmentFit[] {
  return GARMENT_FITS.filter((f) => fitTotal(b, f) > 0);
}

/** Tabla para la lámina: filas por corte con piezas, columnas = tallas usadas. */
export function sizeTableRows(b: SizeBreakdown | null | undefined): {
  sizes: GarmentSize[];
  rows: Array<{ fit: GarmentFit; label: string; cells: number[]; total: number }>;
  total: number;
} {
  const fits = activeFits(b);
  const sizes = GARMENT_SIZES.filter((s) => fits.some((f) => (b?.[f]?.[s] ?? 0) > 0));
  return {
    sizes,
    rows: fits.map((f) => ({
      fit: f,
      label: FIT_LABELS[f],
      cells: sizes.map((s) => b?.[f]?.[s] ?? 0),
      total: fitTotal(b, f),
    })),
    total: sizeBreakdownTotal(b),
  };
}
