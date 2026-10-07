import type { GarmentColors, VehiclePart } from "@/lib/mockups/types";
import type { VehicleGarment } from "@/lib/mockups/vehicles";
import { createBicycleModel } from "./BicycleModel";
import { createCarModel } from "./CarModel";
import type { GarmentModel } from "./garmentModel";
import { createMinivanModel } from "./MinivanModel";
import { createPickupModel } from "./PickupModel";
import { createTrailerModel } from "./TrailerModel";

/** Modelo 3D de cada vehículo (Rotulaciones). Todos son procedurales. */
export function createVehicleModel(garment: VehicleGarment, colors: GarmentColors, part?: VehiclePart): GarmentModel {
  switch (garment) {
    case "bicycle":
      return createBicycleModel(colors);
    case "trailer":
      return createTrailerModel(colors, part);
    case "pickup":
      return createPickupModel(colors);
    case "minivan":
      return createMinivanModel(colors);
    case "car":
    default:
      return createCarModel(colors);
  }
}
