import type { Area } from "@emd/types";

/**
 * Catálogo de áreas de trabajo (`GET /areas`, ver backend docs/areas.md).
 *
 * Las áreas ya no están fijas en el código: se leen del backend. Para que la
 * primera pintura no espere a la red, el catálogo arranca con las seis áreas
 * de siempre (`DEFAULT_AREAS`) y se reemplaza en cuanto llega la respuesta
 * (`setAreaCatalog`). Es un store sin React para que lo usen por igual
 * funciones puras, la Web y Mobile; en React se lee con `useSyncExternalStore`
 * sobre `subscribeAreaCatalog` / `getAreaCatalog`.
 */

/**
 * Diseño es la fase previa al circuito de producción y sigue siendo especial:
 * nunca es destino de producción. Su slug no cambia.
 */
export const DESIGN_AREA = "diseno";

/**
 * Bordado tiene etapas previas a producción (digitalizado → pruebas). Las
 * etapas configurables por área llegan después; mientras, el slug queda fijo.
 */
export const EMBROIDERY_AREA = "bordado";

const defaults = (
  slug: string,
  name: string,
  icon: string,
  color: string,
  sortOrder: number,
  isDesign = false,
): Area => ({
  id: sortOrder / 10,
  slug,
  name,
  icon,
  color,
  isDesign,
  isProductionDestination: !isDesign,
  hasInventory: true,
  generalViewEnabled: true,
  inventoryCategories: [],
  inventoryUnits: [],
  sortOrder,
  active: true,
});

/** Las seis áreas sembradas por el backend: catálogo inicial y de respaldo. */
export const DEFAULT_AREAS: readonly Area[] = [
  defaults("taller", "Taller", "Hammer", "#c5d629", 10),
  defaults("dtf", "DTF", "Layers", "#30b7cf", 20),
  defaults("bordado", "Bordado", "Scissors", "#e24091", 30),
  defaults("diseno", "Diseño", "PenTool", "#6659c0", 40, true),
  defaults("laser", "Láser", "Zap", "#f68a1e", 50),
  defaults("impresiones", "Impresiones", "Printer", "#3583e9", 60),
];

let catalog: readonly Area[] = DEFAULT_AREAS;
const listeners = new Set<() => void>();

/** Catálogo actual (activas y desactivadas, en orden). Referencia estable entre cambios. */
export function getAreaCatalog(): readonly Area[] {
  return catalog;
}

/** Reemplaza el catálogo y avisa a los suscriptores. Ignora listas vacías o inválidas. */
export function setAreaCatalog(areas: readonly Area[] | null | undefined) {
  if (!Array.isArray(areas) || areas.length === 0) return;
  const next = [...areas].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (JSON.stringify(next) === JSON.stringify(catalog)) return;
  catalog = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAreaCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Sólo para tests: vuelve al catálogo por defecto. */
export function resetAreaCatalog() {
  catalog = DEFAULT_AREAS;
  listeners.forEach((listener) => listener());
}

export function findArea(slug: string | null | undefined): Area | undefined {
  if (!slug) return undefined;
  return catalog.find((area) => area.slug === slug);
}

/** Nombre visible de un área ("Láser"); el slug crudo si no está en el catálogo. */
export function getAreaLabel(area?: string | null): string {
  if (!area) return "Sin área";
  return findArea(area)?.name ?? area;
}

/** Nombres visibles de varias áreas, separados por coma. */
export function formatAreaList(areas: readonly string[] | null | undefined, empty = "sin área asignada"): string {
  if (!areas || areas.length === 0) return empty;
  return areas.map(getAreaLabel).join(", ");
}

export interface AreaOption {
  value: string;
  label: string;
}

/** Áreas activas para un selector (Diseño incluido). */
export function areaOptions(): AreaOption[] {
  return catalog.filter((a) => a.active).map((a) => ({ value: a.slug, label: a.name }));
}

/** Áreas activas que pueden ser destino de producción (nunca Diseño). */
export function productionAreaOptions(): AreaOption[] {
  return catalog
    .filter((a) => a.active && a.isProductionDestination && !a.isDesign)
    .map((a) => ({ value: a.slug, label: a.name }));
}

/** Slugs de las áreas activas de producción. */
export function productionAreaSlugs(): string[] {
  return productionAreaOptions().map((a) => a.value);
}

/** Áreas activas con inventario propio. */
export function inventoryAreaSlugs(): string[] {
  return catalog.filter((a) => a.active && a.hasInventory).map((a) => a.slug);
}

/** Si el slug es el área de Diseño (por catálogo o por el slug fijo). */
export function isDesignArea(area: string | null | undefined): boolean {
  if (!area) return false;
  return area === DESIGN_AREA || findArea(area)?.isDesign === true;
}

/** Áreas de PRODUCCIÓN de una lista de áreas: todas menos Diseño. */
export function productionAreasOf(areas: readonly string[] | null | undefined): string[] {
  return (areas ?? []).filter((area) => !isDesignArea(area));
}

/** Roles y áreas de una sesión: lo que decide qué ve y qué puede hacer cada quien. */
export interface SessionAccess {
  roles: string[];
  areas: string[];
}

/**
 * Roles que tenían las áreas antes de separarlas de los roles. Sólo sirven
 * para leer sesiones guardadas antes del cambio (`normalizeSessionAccess`).
 */
const LEGACY_AREA_ROLES = ["taller", "dtf", "bordado", "diseno", "laser", "impresiones"];

/**
 * Completa una sesión guardada antes de separar áreas y roles: traía las
 * áreas dentro de `roles` y no tenía `areas`.
 */
export function normalizeSessionAccess(session: {
  roles?: string[] | null;
  areas?: string[] | null;
}): SessionAccess {
  const roles = session.roles ?? [];
  if (Array.isArray(session.areas)) return { roles, areas: session.areas };
  return {
    roles: roles.filter((role) => !LEGACY_AREA_ROLES.includes(role)),
    areas: roles.filter((role) => LEGACY_AREA_ROLES.includes(role)),
  };
}
