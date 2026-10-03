import type { CalendarEventCategory } from "@/types";

/**
 * Categoría de un evento: define su color de píldora en el calendario y si
 * lleva seguimiento de estado (pendiente/en_proceso/terminado). Una junta,
 * por ejemplo, es sólo informativa — pasa o no pasa, no tiene "en proceso" —
 * así que no muestra la franja de estado ("cuticle") ni el ciclo de avance.
 */
export interface CategoryMeta {
  label: string;
  /** Píldora tintada: texto del color + fondo del mismo color al ~10% (mes/próximos/popover). */
  pillClasses: string;
  /** Punto sólido para el selector de categoría del formulario. */
  swatchClass: string;
  /** Si es `false`, la categoría no lleva franja de estado ni ciclo pendiente→en_proceso→terminado. */
  tracksStatus: boolean;
}

export const CATEGORY_META: Record<CalendarEventCategory, CategoryMeta> = {
  instalacion: {
    label: "Instalación",
    pillClasses:
      "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
    swatchClass: "bg-orange-400",
    tracksStatus: true,
  },
  visita: {
    label: "Visita a cliente",
    pillClasses: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    swatchClass: "bg-blue-400",
    tracksStatus: true,
  },
  entrega: {
    label: "Entrega",
    pillClasses: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
    swatchClass: "bg-teal-400",
    tracksStatus: true,
  },
  junta: {
    label: "Junta / Reunión",
    pillClasses:
      "bg-purple-500/10 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
    swatchClass: "bg-purple-400",
    tracksStatus: false,
  },
  compras: {
    label: "Compra de materiales",
    pillClasses:
      "bg-amber-500/10 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    swatchClass: "bg-amber-400",
    tracksStatus: true,
  },
  otro: {
    label: "Otro",
    pillClasses: "bg-muted text-foreground/75",
    swatchClass: "bg-muted-foreground/60",
    tracksStatus: true,
  },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value: value as CalendarEventCategory,
  ...meta,
}));
