import {
  Hammer,
  Layers,
  Scissors,
  PenTool,
  Zap,
  Printer,
  type LucideIcon,
} from "lucide-react";

/**
 * Áreas de producción a las que puede pertenecer un pedido (`Order.area`).
 * El `value` coincide textualmente con lo que espera el backend (POST/PATCH
 * /orders) y con el nombre de rol operativo correspondiente.
 */
export const AREA_OPTIONS = [
  { value: "taller", label: "Taller" },
  { value: "dtf", label: "DTF" },
  { value: "bordado", label: "Bordado" },
  { value: "diseno", label: "Diseño" },
  { value: "laser", label: "Láser" },
  { value: "impresiones", label: "Impresiones" },
] as const;

export type AreaValue = (typeof AREA_OPTIONS)[number]["value"];

/**
 * Áreas válidas como DESTINO de producción (`Order.productionArea`): todas
 * menos "Diseño", que no es un destino final sino la etapa previa opcional.
 */
export const PRODUCTION_AREA_OPTIONS = AREA_OPTIONS.filter((a) => a.value !== "diseno");

const AREA_LABELS: Record<string, string> = Object.fromEntries(
  AREA_OPTIONS.map((a) => [a.value, a.label])
);

/** Etiqueta legible de un área; devuelve el valor crudo si no se reconoce. */
export function getAreaLabel(area?: string | null): string {
  if (!area) return "Sin área";
  return AREA_LABELS[area] ?? area;
}

/** Ícono lucide-react distintivo por área, para usar junto al texto del área. */
export const AREA_ICONS: Record<AreaValue, LucideIcon> = {
  taller: Hammer,
  dtf: Layers,
  bordado: Scissors,
  diseno: PenTool,
  laser: Zap,
  impresiones: Printer,
};

/** Ícono de un área; `null` si no se reconoce (área libre/legado). */
export function getAreaIcon(area?: string | null): LucideIcon | null {
  if (!area) return null;
  return AREA_ICONS[area as AreaValue] ?? null;
}
