import type { GarmentColors, VehiclePart } from "@/lib/mockups/types";
import type { VehicleGarment } from "@/lib/mockups/vehicles";
import { createBicycleModel } from "./BicycleModel";
import type { GarmentModel } from "./garmentModel";
import { loadGlbModel } from "./GlbModel";

/**
 * Modelo 3D de cada vehículo (Rotulaciones). Carro, minivan, pickup y camión
 * son GLB (`GlbModel.ts`); la bicicleta sigue siendo procedural.
 */
export async function loadVehicleModel(garment: VehicleGarment, colors: GarmentColors, part?: VehiclePart): Promise<GarmentModel> {
  if (garment === "bicycle") return createBicycleModel(colors);
  return loadGlbModel(garment, colors, part);
}
