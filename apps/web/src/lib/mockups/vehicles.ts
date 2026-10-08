import type { Garment, MockupConfig, VehiclePart } from "./types";

/**
 * Rotulaciones (vinil sobre vehículos): qué productos del estudio son
 * vehículos, las categorías del selector y la parte del tráiler que se rotula.
 * Sin dependencias del 3D ni de React: lo usan el registro de prendas, los
 * presets, el estudio y la lámina de exportación.
 */

/** Vehículos del estudio, en el orden en que se muestran. */
export const VEHICLE_GARMENTS = ["car", "minivan", "pickup", "trailer", "bicycle"] as const satisfies readonly Garment[];

export type VehicleGarment = (typeof VEHICLE_GARMENTS)[number];

export function isVehicle(value: unknown): value is VehicleGarment {
  return typeof value === "string" && (VEHICLE_GARMENTS as readonly string[]).includes(value);
}

/** Categorías del selector de producto del estudio. */
export type GarmentCategory = "prendas" | "rotulaciones";

export const GARMENT_CATEGORIES: { id: GarmentCategory; label: string }[] = [
  { id: "prendas", label: "Prendas" },
  { id: "rotulaciones", label: "Rotulaciones" },
];

export function garmentCategory(garment: Garment): GarmentCategory {
  return isVehicle(garment) ? "rotulaciones" : "prendas";
}

/* --------------------------------- Tráiler -------------------------------- */

export const VEHICLE_PARTS = ["full", "cab", "box"] as const satisfies readonly VehiclePart[];

/** Etiquetas del control segmentado del tráiler. */
export const VEHICLE_PART_LABELS: Record<VehiclePart, string> = {
  full: "Completo",
  cab: "Solo cabina",
  box: "Solo caja",
};

export function isVehiclePart(value: unknown): value is VehiclePart {
  return typeof value === "string" && (VEHICLE_PARTS as readonly string[]).includes(value);
}

/** Parte del tráiler del mockup ("full" si no dice); undefined para los demás productos. */
export function vehiclePartOf(config: Pick<MockupConfig, "garment" | "vehiclePart">): VehiclePart | undefined {
  if (config.garment !== "trailer") return undefined;
  return isVehiclePart(config.vehiclePart) ? config.vehiclePart : "full";
}

/** ¿Este producto tiene control de "parte" (sólo el tráiler)? */
export function hasVehicleParts(garment: Garment): boolean {
  return garment === "trailer";
}

/**
 * Zonas (en z, el largo del camión, unidades de escena) de la cabina y de la
 * caja. Un diseño con `position.z` fuera de la parte visible se manda al
 * diseño por defecto de esa parte al cambiarla. El corte (0.35) también es
 * por donde `GlbModel.ts` separa las mallas de la cabina de las de la caja.
 */
export const TRAILER_ZONES: Record<Exclude<VehiclePart, "full">, { zMin: number; zMax: number }> = {
  cab: { zMin: 0.35, zMax: 1 },
  box: { zMin: -1, zMax: 0.35 },
};

/** ¿Un punto (z) del tráiler pertenece a la parte indicada? */
export function zInPart(z: number, part: VehiclePart | undefined): boolean {
  if (!part || part === "full") return true;
  const zone = TRAILER_ZONES[part];
  return z >= zone.zMin && z <= zone.zMax;
}
