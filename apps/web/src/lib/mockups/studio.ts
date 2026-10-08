import {
  ALL_GARMENTS,
  GARMENTS,
  assertGarmentEnabled,
  defaultGarmentOptions,
  type ColorPart,
} from "@/lib/mockups/garments";
import { defaultPlacement } from "@/lib/mockups/presets";
import { hasVehicleParts, isVehicle, vehiclePartOf, zInPart } from "@/lib/mockups/vehicles";
import {
  DEFAULT_COLORS,
  GARMENT_LABELS,
  MAX_MOCKUP_BYTES,
  type CreateOrderMockupPayload,
  type DesignLayer,
  type DownloadViewKey,
  type Garment,
  type MockupConfig,
  type MockupExport,
  type VehiclePart,
} from "@/lib/mockups/types";
import type { ImportedDesign } from "@/lib/mockups/importDesign";

/**
 * Lógica pura del panel del estudio de mockups (sin React ni 3D), para que
 * las reglas se prueben solas: alta/baja de diseños, cambio de prenda,
 * nombre del archivo y armado del cuerpo que se guarda en el pedido.
 */

/** Lo que devuelve el estudio al "Adjuntar": la lámina y la configuración. */
export interface MockupStudioResult {
  image: MockupExport;
  config: MockupConfig;
}

/** Modelo de referencia de cada prenda (texto de apoyo en el selector). */
export const GARMENT_MODELS = Object.fromEntries(
  ALL_GARMENTS.map((g) => [g, GARMENTS[g].referenceModel])
) as Record<Garment, string>;

/** Colores rápidos de prenda más pedidos. */
export const QUICK_SWATCHES: { label: string; value: string }[] = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Negro", value: "#111111" },
  { label: "Marino", value: "#1f2a44" },
  { label: "Gris jaspe", value: "#b9bcc0" },
  { label: "Rojo", value: "#c8102e" },
];

export type { ColorPart };

/** Qué partes de la prenda llevan color propio, con su etiqueta. */
export const COLOR_FIELDS = Object.fromEntries(
  ALL_GARMENTS.map((g) => [g, GARMENTS[g].colorParts])
) as Record<Garment, { part: ColorPart; label: string }[]>;

/** Campos de color que se muestran: el tráiler sólo pide el de la parte que se ve. */
export function colorFieldsFor(garment: Garment, part?: VehiclePart): { part: ColorPart; label: string }[] {
  const fields = COLOR_FIELDS[garment];
  if (garment !== "trailer" || !part || part === "full") return fields;
  return fields.filter((f) => (part === "cab" ? f.part === "body" : f.part === "mesh"));
}

export function initialMockupConfig(garment: Garment = "tshirt"): MockupConfig {
  const options = defaultGarmentOptions(garment);
  return {
    garment,
    colors: { ...DEFAULT_COLORS[garment] },
    layers: [],
    ...(hasVehicleParts(garment) ? { vehiclePart: "full" as const } : {}),
    ...(options ? { options } : {}),
  };
}

let layerSeq = 0;
export function newLayerId(): string {
  layerSeq += 1;
  return `layer-${Date.now().toString(36)}-${layerSeq}`;
}

export function createLayer(design: ImportedDesign, garment: Garment, id = newLayerId(), part?: VehiclePart): DesignLayer {
  return {
    id,
    name: design.name,
    dataUrl: design.dataUrl,
    aspect: design.aspect,
    placement: defaultPlacement(garment, part),
  };
}

/**
 * Cambia de prenda sin preguntar: los diseños se quedan, pero cada uno vuelve
 * a la posición inicial de la prenda nueva (las coordenadas de una no sirven en
 * la otra). Los colores de la gorra arrancan de sus valores por defecto.
 */
export function switchGarment(config: MockupConfig, garment: Garment): MockupConfig {
  if (config.garment === garment) return config;
  // Los ajustes propios (bolsa, manga, patrón…) son de cada prenda: no viajan.
  const options = defaultGarmentOptions(garment);
  return {
    garment,
    colors: { ...DEFAULT_COLORS[garment] },
    layers: config.layers.map((layer) => ({ ...layer, placement: defaultPlacement(garment, hasVehicleParts(garment) ? "full" : undefined) })),
    // Las tallas son del pedido, no de la prenda: sobreviven al cambio (si la
    // prenda nueva no las usa, sólo se ocultan y no se guardan).
    ...(config.sizes !== undefined ? { sizes: config.sizes } : {}),
    ...(hasVehicleParts(garment) ? { vehiclePart: "full" as const } : {}),
    ...(options ? { options } : {}),
  };
}

/**
 * Cambia la parte del tráiler que se rotula (completo / cabina / caja). Los
 * diseños que quedan sobre una parte que ya no se ve vuelven a la posición
 * inicial de la parte nueva; los que siguen a la vista no se mueven.
 */
export function switchVehiclePart(config: MockupConfig, part: VehiclePart): MockupConfig {
  if (!hasVehicleParts(config.garment) || vehiclePartOf(config) === part) return config;
  return {
    ...config,
    vehiclePart: part,
    layers: config.layers.map((layer) =>
      zInPart(layer.placement.position[2], part) ? layer : { ...layer, placement: defaultPlacement(config.garment, part) }
    ),
  };
}

/** Productos que no son prenda (termo, taza, mousepad y vehículos): no llevan tabla de tallas. */
const GARMENTS_WITHOUT_SIZES: readonly Garment[] = ["termo", "taza", "mousepad"];

/** ¿Esta prenda se pide por tallas? (el panel y la tabla impresa sólo salen si sí). */
export function garmentHasSizes(garment: Garment): boolean {
  return !GARMENTS_WITHOUT_SIZES.includes(garment) && !isVehicle(garment);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Acepta "fff", "#FFF", "ffffff"… y devuelve `#rrggbb` en minúsculas, o null. */
export function normalizeHexColor(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return isHexColor(value) ? value : null;
}

/** `mockup-playera-2026-10-05.png` (fecha local). */
const VIEW_FILENAME_SUFFIX: Record<DownloadViewKey, string> = {
  all: "",
  front: "-frente",
  back: "-espalda",
  side: "-lado",
  left: "-lado-izquierdo",
  right: "-lado-derecho",
  top: "-arriba",
};

/** Sufijo del archivo según la vista; en vehículos "back" es "atrás", no "espalda". */
function viewSuffix(garment: Garment, only: DownloadViewKey): string {
  return isVehicle(garment) && only === "back" ? "-atras" : VIEW_FILENAME_SUFFIX[only];
}

const PART_FILENAME_SUFFIX: Record<VehiclePart, string> = { full: "", cab: "-cabina", box: "-caja" };

export function mockupFilename(garment: Garment, date = new Date(), only: DownloadViewKey = "all", part?: VehiclePart): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const slug = GARMENT_LABELS[garment]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const partSuffix = garment === "trailer" && part ? PART_FILENAME_SUFFIX[part] : "";
  return `mockup-${slug}${partSuffix}-${day}${viewSuffix(garment, only)}.png`;
}

export function buildMockupPayload(result: MockupStudioResult): CreateOrderMockupPayload {
  assertGarmentEnabled(result.config.garment);
  // Tallas "escondidas" de una prenda anterior no se guardan en un termo, taza o mousepad.
  const config = { ...result.config };
  if (!garmentHasSizes(config.garment)) delete config.sizes;
  // La parte sólo la lleva el tráiler (el backend rechaza `vehiclePart` en los demás).
  if (config.garment === "trailer") config.vehiclePart = vehiclePartOf(config);
  else delete config.vehiclePart;
  return {
    garment: result.config.garment,
    imageDataUrl: result.image.dataUrl,
    config,
  };
}

/** Tamaño aproximado del cuerpo JSON que se manda al backend. */
export function payloadBytes(payload: CreateOrderMockupPayload): number {
  return JSON.stringify(payload).length;
}

/** El backend rechaza más de MAX_MOCKUP_BYTES (R1): se avisa antes de mandar. */
export function exceedsMockupLimit(payload: CreateOrderMockupPayload): boolean {
  return payloadBytes(payload) > MAX_MOCKUP_BYTES;
}

export const MOCKUP_TOO_LARGE_MESSAGE =
  "El mockup pesa demasiado para guardarse (máximo 8 MB). Quita algún diseño o usa archivos más ligeros.";
