import { MAX_QUANTITY } from "@/lib/inventory";
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

/** Línea en blanco (sin artículo, descripción ni cantidad): se descarta al validar y enviar. */
export function isBlankLine(line: SupplyDraftLine): boolean {
  return line.inventoryItemId === undefined && line.description.trim() === "" && line.quantity.trim() === "";
}

const nonBlank = (lines: SupplyDraftLine[]) => lines.filter((line) => !isBlankLine(line));

/** Una línea válida tiene cantidad > 0 y (artículo de inventario o descripción). */
function lineValid(line: SupplyDraftLine): boolean {
  const q = lineQuantity(line);
  return Number.isFinite(q) && q > 0 && q <= MAX_QUANTITY && (line.inventoryItemId !== undefined || line.description.trim() !== "");
}

/**
 * ¿Se puede guardar? Cada área necesita origen; "nosotros" pide al menos un
 * insumo; "cliente" admite una sola línea opcional de descripción + cantidad
 * (si se escribe algo tiene que ser válida; la línea sembrada en blanco se
 * ignora, y una a medias —sólo descripción o sólo cantidad— sigue siendo inválida).
 */
export function draftsComplete(drafts: SupplyDrafts, areas: string[]): boolean {
  return areas.every((area) => {
    const d = drafts[area];
    if (!d?.source) return false;
    const lines = nonBlank(d.lines);
    if (d.source === "nosotros") return lines.length > 0 && lines.every(lineValid);
    return lines.every(lineValid);
  });
}

export function draftsToInput(drafts: SupplyDrafts, areas: string[]) {
  return areas.map((area) => {
    const d = drafts[area];
    return {
      area,
      source: d.source as AreaSupply["source"],
      lines: nonBlank(d.lines).map((line) => ({
        ...(line.inventoryItemId !== undefined && { inventoryItemId: line.inventoryItemId }),
        ...(line.description.trim() && { description: line.description.trim() }),
        quantity: lineQuantity(line),
      })),
    };
  });
}
