import { Briefcase, type LucideIcon } from "lucide-react";
import { AREA_ICONS, AREA_OPTIONS } from "@/lib/areas";
import type {
  RestockRequestStatus,
  RestockRequestUrgency,
  InventoryArea,
  InventoryItem,
  InventoryMovementType,
  InventoryStockStatus,
} from "@/types";

/**
 * Departamentos con inventario propio: las 6 áreas operativas más Recepción
 * (papelería, empaques, consumibles de oficina). Mismo orden y valores que
 * `INVENTORY_AREAS` en el backend.
 */
export const INVENTORY_AREA_OPTIONS: { value: InventoryArea; label: string }[] = [
  ...AREA_OPTIONS.map((a) => ({ value: a.value, label: a.label })),
  { value: "recepcion", label: "Recepción" },
];

const LABELS = Object.fromEntries(INVENTORY_AREA_OPTIONS.map((a) => [a.value, a.label]));

export function inventoryAreaLabel(area: string): string {
  return LABELS[area] ?? area;
}

export function inventoryAreaIcon(area: string): LucideIcon {
  return area === "recepcion" ? Briefcase : (AREA_ICONS[area as keyof typeof AREA_ICONS] ?? Briefcase);
}

/** Pill semántica de cada estado de stock (design system: sólo pills tintadas). */
export const STOCK_STATUS_META: Record<InventoryStockStatus, { label: string; className: string }> = {
  ok: {
    label: "Disponible",
    className:
      "border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  low: {
    label: "Bajo stock",
    className:
      "border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  out: {
    label: "Agotado",
    className: "border-transparent bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  },
};

export const MOVEMENT_TYPE_META: Record<
  InventoryMovementType,
  { label: string; verb: string; className: string }
> = {
  ENTRADA: {
    label: "Entrada",
    verb: "Registrar entrada",
    className: "border-transparent bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  },
  SALIDA: {
    label: "Salida",
    verb: "Registrar salida",
    className:
      "border-transparent bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  AJUSTE: {
    label: "Ajuste",
    verb: "Ajustar por conteo",
    className:
      "border-transparent bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
};

const quantityFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

/** Cantidad con la unidad tal cual se cargó en el artículo (ej. "12.5 cono"). */
export function formatQuantity(value: number, unit?: string | null): string {
  const n = quantityFormat.format(value);
  return unit ? `${n} ${unit}` : n;
}

/** Cantidad con signo para el kardex: "+5", "−2.5". */
export function formatDelta(value: number): string {
  if (value > 0) return `+${quantityFormat.format(value)}`;
  if (value < 0) return `−${quantityFormat.format(Math.abs(value))}`;
  return "0";
}

/** Tope del backend por cantidad (movimiento, línea de insumo, aviso de reabasto): arriba de esto responde 400. */
export const MAX_QUANTITY = 999999;

/**
 * Stock que resulta de aplicar un movimiento, para la vista previa del
 * diálogo. `null` si la cantidad no es válida o la salida excede el stock.
 */
export function projectedBalance(
  current: number,
  type: InventoryMovementType,
  quantity: number
): number | null {
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return null;
  if (type === "AJUSTE") return quantity;
  if (quantity === 0) return null;
  if (type === "ENTRADA") return current + quantity;
  return quantity > current ? null : current - quantity;
}

export interface InventorySummary {
  items: number;
  low: number;
  out: number;
  /** Suma de quantity × unitCost de los artículos con costo cargado. */
  value: number;
  /** Artículos sin costo: el valor total no los incluye. */
  withoutCost: number;
}

export function summarizeInventory(items: InventoryItem[]): InventorySummary {
  return items.reduce<InventorySummary>(
    (acc, item) => {
      acc.items += 1;
      if (item.stockStatus === "low") acc.low += 1;
      if (item.stockStatus === "out") acc.out += 1;
      if (item.unitCost == null) acc.withoutCost += 1;
      else acc.value += item.quantity * item.unitCost;
      return acc;
    },
    { items: 0, low: 0, out: 0, value: 0, withoutCost: 0 }
  );
}

/** Lo que hay que reponer primero: agotados, después bajo stock; luego por nombre. */
const STATUS_ORDER: Record<InventoryStockStatus, number> = { out: 0, low: 1, ok: 2 };

export function sortByUrgency(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort(
    (a, b) =>
      STATUS_ORDER[a.stockStatus] - STATUS_ORDER[b.stockStatus] ||
      a.name.localeCompare(b.name, "es")
  );
}

/** Estados de una solicitud de reabasto, en el orden del flujo. */
export const RESTOCK_STATUS_META: Record<RestockRequestStatus, { label: string; className: string }> = {
  PENDIENTE: {
    label: "Pendiente",
    className:
      "border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  EN_CAMINO: {
    label: "En camino",
    className: "border-transparent bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  },
  COMPRADO: {
    label: "Comprado",
    className:
      "border-transparent bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
  RESUELTO: {
    label: "Resuelto",
    className:
      "border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
};

export const RESTOCK_STATUSES = Object.keys(RESTOCK_STATUS_META) as RestockRequestStatus[];

export const RESTOCK_URGENCY_LABEL: Record<RestockRequestUrgency, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
};

/** Origen de un movimiento en la bitácora. */
export const MOVEMENT_SOURCE_LABEL: Record<string, string> = {
  recepcion: "Recepción",
  area: "Área",
  scan: "Escáner",
  inicial: "Stock inicial",
  orden: "Hoja de materiales",
};
