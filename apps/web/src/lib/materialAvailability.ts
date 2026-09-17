import type { MaterialAvailability } from "@/types";

/** Etiqueta legible de la disponibilidad de una línea de la hoja de materiales. */
export const AVAILABILITY_LABELS: Record<MaterialAvailability, string> = {
  disponible: "Disponible",
  parcial: "Disponible parcialmente",
  por_comprar: "Por comprar",
  agotado: "Agotado",
  no_requerido: "No requerido",
};

/** Clases de color por disponibilidad, para la pill de la hoja de materiales. */
export const AVAILABILITY_BADGE_CLASSES: Record<MaterialAvailability, string> = {
  disponible:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  parcial:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  por_comprar:
    "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  agotado:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  no_requerido:
    "border-border bg-muted text-muted-foreground",
};

export const AVAILABILITY_OPTIONS: { value: MaterialAvailability; label: string }[] = (
  Object.keys(AVAILABILITY_LABELS) as MaterialAvailability[]
).map((value) => ({ value, label: AVAILABILITY_LABELS[value] }));
