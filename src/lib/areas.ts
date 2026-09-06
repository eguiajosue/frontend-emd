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

const AREA_LABELS: Record<string, string> = Object.fromEntries(
  AREA_OPTIONS.map((a) => [a.value, a.label])
);

/** Etiqueta legible de un área; devuelve el valor crudo si no se reconoce. */
export function getAreaLabel(area?: string | null): string {
  if (!area) return "Sin área";
  return AREA_LABELS[area] ?? area;
}
