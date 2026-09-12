import type { SupplierLocation } from "@/types";

/** Etiqueta legible del alcance de un proveedor. */
export const LOCATION_LABELS: Record<SupplierLocation, string> = {
  nacional: "Nacional",
  local: "Local",
  internacional: "Internacional",
};

/** Clases de color por alcance, para la pill de ubicación en la hoja de materiales. */
export const LOCATION_BADGE_CLASSES: Record<SupplierLocation, string> = {
  local:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  nacional:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  internacional:
    "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
};
