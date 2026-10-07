import type { AreaSupply } from "@/types";

/** Cantidad legible: sin ceros de más (el backend manda Decimal como string). */
export function formatSupplyQuantity(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

/** "12 playeras negras" / "Film DTF 2 m". El cliente guarda la cantidad aparte de la descripción. */
export function describeSupplyLine(line: AreaSupply["lines"][number], source: AreaSupply["source"]): string {
  const qty = formatSupplyQuantity(line.quantity);
  if (source === "cliente") return line.description ? `${qty} × ${line.description}` : qty;
  const unit = line.inventoryItem?.unit;
  return `${line.description} ${qty}${unit ? ` ${unit}` : ""}`;
}

/**
 * Resumen de una línea para tarjetas: "Insumos: del cliente — 12 × playeras"
 * o "Insumos: nuestros — Film DTF 2 m, Tinta blanca 1". `null` si el área no
 * tiene hoja (pedidos anteriores).
 */
export function supplySummary(supply: AreaSupply | null | undefined): { origin: string; detail: string } | null {
  if (!supply) return null;
  return {
    origin: supply.source === "cliente" ? "del cliente" : "nuestros",
    detail: supply.lines.map((line) => describeSupplyLine(line, supply.source)).join(", "),
  };
}

/** Borrador de la hoja de un área mientras Recepción la captura. */
export interface SupplyDraftLine {
  key: string;
  inventoryItemId?: number;
  description: string;
  /** Texto del input; se valida al guardar. */
  quantity: string;
}

export interface SupplyDraft {
  source: AreaSupply["source"] | null;
  lines: SupplyDraftLine[];
}

export type SupplyDrafts = Record<string, SupplyDraft>;

export function emptyDrafts(areas: string[]): SupplyDrafts {
  return Object.fromEntries(areas.map((area) => [area, { source: null, lines: [] } as SupplyDraft]));
}

const lineQuantity = (line: SupplyDraftLine) => Number(line.quantity.replace(",", "."));

/** Una línea válida tiene cantidad > 0 y (artículo de inventario o descripción). */
function lineValid(line: SupplyDraftLine): boolean {
  const q = lineQuantity(line);
  return Number.isFinite(q) && q > 0 && (line.inventoryItemId !== undefined || line.description.trim() !== "");
}

/**
 * ¿Se puede guardar? Cada área necesita origen; "nosotros" pide al menos un
 * insumo; "cliente" admite una sola línea opcional de descripción + cantidad
 * (si se escribe algo tiene que ser válida).
 */
export function draftsComplete(drafts: SupplyDrafts, areas: string[]): boolean {
  return areas.every((area) => {
    const d = drafts[area];
    if (!d?.source) return false;
    if (d.source === "nosotros") return d.lines.length > 0 && d.lines.every(lineValid);
    return d.lines.every(lineValid);
  });
}

export function draftsToInput(drafts: SupplyDrafts, areas: string[]) {
  return areas.map((area) => {
    const d = drafts[area];
    return {
      area,
      source: d.source as AreaSupply["source"],
      lines: d.lines.map((line) => ({
        ...(line.inventoryItemId !== undefined && { inventoryItemId: line.inventoryItemId }),
        ...(line.description.trim() && { description: line.description.trim() }),
        quantity: lineQuantity(line),
      })),
    };
  });
}
