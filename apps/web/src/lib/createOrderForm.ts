import { addDays, format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";

/**
 * Lógica pura del alta de pedido (ver `CreateOrderDialog`): defaults
 * recordados, orden de las áreas, atajos de fecha, franjas de hora y el
 * resumen vivo del footer. Sin React, para poder testearla aparte.
 */

/* ------------------------------ Memoria local ----------------------------- */

/**
 * Memoria por navegador (no por servidor) para jornadas de muchos pedidos
 * seguidos: últimos clientes usados (chips "Recientes") y últimos valores de
 * diseño/área (default visible y editable, nunca autocompletado en silencio).
 */
export const RECENT_CLIENTS_KEY = "emd:recentClientIds";
export const LAST_DEFAULTS_KEY = "emd:lastOrderDefaults";
export const MAX_RECENT_CLIENTS = 6;

export interface LastOrderDefaults {
  requiresDesign: boolean;
  area?: string;
}

const PRODUCTION_AREA_VALUES: readonly string[] = PRODUCTION_AREA_OPTIONS.map((a) => a.value);

export function readRecentClientIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CLIENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export function pushRecentClientId(id: number) {
  if (typeof window === "undefined") return;
  try {
    const next = [id, ...readRecentClientIds().filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENT_CLIENTS
    );
    window.localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage puede fallar (modo privado, cuota): no es crítico.
  }
}

/**
 * Último diseño/área usados, saneados: un JSON corrupto o parcial no puede
 * abrir el formulario en "Sin diseño" (el default de negocio es con diseño),
 * y un área que no es de producción (ej. el viejo "diseno") se descarta.
 */
export function readLastOrderDefaults(): LastOrderDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_DEFAULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.requiresDesign !== "boolean") return null;
    return {
      requiresDesign: parsed.requiresDesign,
      area:
        typeof parsed.area === "string" && PRODUCTION_AREA_VALUES.includes(parsed.area)
          ? parsed.area
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeLastOrderDefaults(defaults: LastOrderDefaults) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Ídem: no crítico si falla.
  }
}

/* --------------------------------- Áreas --------------------------------- */

/**
 * Nueva selección de áreas preservando el ORDEN en que se eligieron: la
 * primera es la principal (destino sin diseño / producción principal con
 * diseño). `ToggleGroup` devuelve los valores en orden de render, así que se
 * reordena contra la selección anterior.
 */
export function mergeAreaSelection(prev: string[], next: string[]): string[] {
  return prev.filter((a) => next.includes(a)).concat(next.filter((a) => !prev.includes(a)));
}

/* ------------------------------ Fecha y hora ----------------------------- */

export const DATE_FORMAT = "yyyy-MM-dd";

export const DELIVERY_PRESETS = [
  { key: "today", label: "Hoy", days: 0 },
  { key: "tomorrow", label: "Mañana", days: 1 },
  { key: "in3", label: "En 3 días", days: 3 },
  { key: "in7", label: "En 1 semana", days: 7 },
] as const;

export type DeliveryPresetKey = (typeof DELIVERY_PRESETS)[number]["key"];

export function presetDate(days: number, today: Date): string {
  return format(addDays(today, days), DATE_FORMAT);
}

/** Atajo que corresponde a una fecha "yyyy-MM-dd", o `null` si es una fecha a medida. */
export function presetForDate(date: string, today: Date): DeliveryPresetKey | null {
  if (!date) return null;
  const match = DELIVERY_PRESETS.find((p) => presetDate(p.days, today) === date);
  return match?.key ?? null;
}

export function parseDeliveryDate(date: string): Date | undefined {
  if (!date) return undefined;
  const parsed = parse(date, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** "lun 20 oct" */
export function shortDateLabel(date: string): string {
  const d = parseDeliveryDate(date);
  return d ? format(d, "EEE d MMM", { locale: es }) : "";
}

/** "lunes 20 de octubre" */
export function longDateLabel(date: string): string {
  const d = parseDeliveryDate(date);
  return d ? format(d, "EEEE d 'de' MMMM", { locale: es }) : "";
}

/**
 * Horas de entrega cada 15 minutos, las 24 h ("HH:mm"). Reemplaza al
 * `input type="time"` nativo, que se muestra en inglés/AM-PM según el
 * navegador; el Select de Radix permite tipear para saltar ("18" → 18:00).
 */
export const DELIVERY_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

/* ---------------------------- Resumen del footer -------------------------- */

export interface OrderSummaryInput {
  clientLabel: string;
  requiresDesign: boolean;
  /** Etiqueta de la asignación con diseño ("Cualquier diseñador" o el nombre). */
  designerLabel?: string;
  /** Etiquetas de las áreas, la principal primero. */
  areaLabels: string[];
  productCount: number;
  unitCount: number;
  deliveryDate: string;
  deliveryTime: string;
}

/** Partes del resumen vivo del footer, en orden; el componente las une con " · ". */
export function buildOrderSummary(input: OrderSummaryInput): string[] {
  const parts: string[] = [];
  if (input.clientLabel) parts.push(input.clientLabel);

  if (input.requiresDesign) {
    parts.push(input.designerLabel ? `Con diseño (${input.designerLabel})` : "Con diseño");
  } else if (input.areaLabels.length > 0) {
    const [first, ...rest] = input.areaLabels;
    parts.push(`Directo a ${first}${rest.length ? ` + ${rest.length}` : ""}`);
  }

  if (input.productCount > 0) {
    parts.push(
      `${input.productCount} ${input.productCount === 1 ? "producto" : "productos"}, ${
        input.unitCount
      } u.`
    );
  }

  if (input.deliveryDate) {
    const date = shortDateLabel(input.deliveryDate);
    if (date) parts.push(`Entrega ${date}${input.deliveryTime ? `, ${input.deliveryTime}` : ""}`);
  }
  return parts;
}

/* --------------------------------- Límites -------------------------------- */

/** Límites del DTO (`create-order.dto.ts`). */
export const MAX_PRODUCT_LINES = 100;
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_QUANTITY = 99_999;

/** Texto libre (cliente o producto) recortado al largo que acepta el backend. */
export function clampName(value: string): string {
  return value.trim().slice(0, MAX_NAME_LENGTH);
}

/* ---------------------------- Repetir un pedido --------------------------- */

/**
 * Lo que se reutiliza de un pedido anterior del cliente al tocar "Usar como
 * base" (o "Repetir pedido" en el detalle). Se repite EL PEDIDO —qué se pide,
 * descripción, ruta de diseño/producción y hoja de materiales—, nunca la
 * fecha de entrega ni el archivo del cliente: un cliente que encarga
 * "Figuras" de vinil sobre coroplast para cada evento repite el pedido, pero
 * las figuras (y la fecha) son otras cada vez.
 */
export interface RepeatPrefill {
  sourceOrderId: number;
  requiresDesign: boolean;
  /** Áreas de producción, la principal primero. Sólo áreas que siguen existiendo. */
  areas: string[];
  assignedUserId?: number;
  description: string;
  products: Array<{ customName: string; quantity: number }>;
}

interface RepeatSource {
  id: number;
  requiresDesign?: boolean;
  productionArea?: string | null;
  area?: string | null;
  areaTasks?: Array<{ area: string }>;
  assignedUserId?: number | null;
  description?: string | null;
  orderProducts?: Array<{ customName?: string | null; quantity: number }>;
}

export function buildRepeatPrefill(order: RepeatSource): RepeatPrefill {
  const requiresDesign = Boolean(order.requiresDesign);
  // La principal va primero: `productionArea` (o, sin diseño, el área en la
  // que arrancó) y después el resto de las tareas, sin repetir ni Diseño.
  const candidates = [
    order.productionArea,
    ...(order.areaTasks ?? []).map((t) => t.area),
    requiresDesign ? null : order.area,
  ];
  const areas = candidates.filter(
    (a, i): a is string =>
      typeof a === "string" && PRODUCTION_AREA_VALUES.includes(a) && candidates.indexOf(a) === i
  );

  const products: RepeatPrefill["products"] = [];
  for (const op of order.orderProducts ?? []) {
    const customName = clampName(op.customName ?? "");
    if (!customName || products.length >= MAX_PRODUCT_LINES) continue;
    const quantity = Math.min(Math.max(Math.trunc(op.quantity) || 1, 1), MAX_QUANTITY);
    const existing = products.find((p) => p.customName.toLowerCase() === customName.toLowerCase());
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
    else products.push({ customName, quantity });
  }

  return {
    sourceOrderId: order.id,
    requiresDesign,
    areas,
    assignedUserId: order.assignedUserId ?? undefined,
    description: (order.description ?? "").slice(0, MAX_DESCRIPTION_LENGTH),
    products,
  };
}

/** "Figuras ×20 · Playeras ×10 · +2 más": resumen corto de lo que se pidió. */
export function describeOrderProducts(
  products: Array<{ customName?: string | null; quantity: number }> | undefined,
  max = 2
): string {
  const named = (products ?? []).filter((p) => p.customName?.trim());
  if (named.length === 0) return "Sin productos";
  const shown = named.slice(0, max).map((p) => `${p.customName!.trim()} ×${p.quantity}`);
  const rest = named.length - shown.length;
  return rest > 0 ? `${shown.join(" · ")} · +${rest} más` : shown.join(" · ");
}

/** Línea de la hoja de materiales que se copia al pedido nuevo. */
export interface RepeatMaterial {
  key: string;
  materialId: number;
  quantity: number;
  description: string;
  supplierId?: number;
  unitName?: string;
}

export function toRepeatMaterials(
  items: Array<{
    id: number;
    materialId: number;
    quantity: number;
    description: string;
    supplierId?: number | null;
    material?: { name: string; unit?: { name: string } | null } | null;
  }>
): RepeatMaterial[] {
  return items
    .filter((item) => item.materialId > 0 && item.quantity > 0)
    .map((item) => ({
      key: `material-${item.id}`,
      materialId: item.materialId,
      quantity: item.quantity,
      description: (item.description?.trim() || item.material?.name || "Material").slice(0, 200),
      supplierId: item.supplierId ?? undefined,
      unitName: item.material?.unit?.name ?? undefined,
    }));
}
