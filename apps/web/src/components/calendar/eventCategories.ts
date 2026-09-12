import type { CalendarEventCategory } from "@/types";

/**
 * Categoría de un evento: define su color de píldora en el calendario y si
 * lleva seguimiento de estado (pendiente/en_proceso/terminado). Una junta,
 * por ejemplo, es sólo informativa — pasa o no pasa, no tiene "en proceso" —
 * así que no muestra la franja de estado ("cuticle") ni el ciclo de avance.
 */
export interface CategoryMeta {
  label: string;
  /** Fondo + texto suaves para la píldora del evento (mes/semana/día/próximos). */
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
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    swatchClass: "bg-orange-400",
    tracksStatus: true,
  },
  visita: {
    label: "Visita a cliente",
    pillClasses: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    swatchClass: "bg-blue-400",
    tracksStatus: true,
  },
  entrega: {
    label: "Entrega",
    pillClasses: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    swatchClass: "bg-teal-400",
    tracksStatus: true,
  },
  junta: {
    label: "Junta / Reunión",
    pillClasses:
      "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    swatchClass: "bg-purple-400",
    tracksStatus: false,
  },
  otro: {
    label: "Otro",
    pillClasses: "bg-muted text-muted-foreground",
    swatchClass: "bg-muted-foreground/60",
    tracksStatus: true,
  },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value: value as CalendarEventCategory,
  ...meta,
}));
