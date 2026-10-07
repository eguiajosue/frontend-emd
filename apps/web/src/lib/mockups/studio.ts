import {
  ALL_GARMENTS,
  GARMENTS,
  assertGarmentEnabled,
  defaultGarmentOptions,
  type ColorPart,
} from "@/lib/mockups/garments";
import { defaultPlacement } from "@/lib/mockups/presets";
import {
  DEFAULT_COLORS,
  GARMENT_LABELS,
  MAX_MOCKUP_BYTES,
  type CreateOrderMockupPayload,
  type DesignLayer,
  type Garment,
  type MockupConfig,
  type MockupExport,
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

export function initialMockupConfig(garment: Garment = "tshirt"): MockupConfig {
  const options = defaultGarmentOptions(garment);
  return { garment, colors: { ...DEFAULT_COLORS[garment] }, layers: [], ...(options ? { options } : {}) };
}

let layerSeq = 0;
export function newLayerId(): string {
  layerSeq += 1;
  return `layer-${Date.now().toString(36)}-${layerSeq}`;
}

export function createLayer(design: ImportedDesign, garment: Garment, id = newLayerId()): DesignLayer {
  return {
    id,
    name: design.name,
    dataUrl: design.dataUrl,
    aspect: design.aspect,
    placement: defaultPlacement(garment),
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
    layers: config.layers.map((layer) => ({ ...layer, placement: defaultPlacement(garment) })),
    // Las tallas son del pedido, no de la prenda: sobreviven al cambio (si la
    // prenda nueva no las usa, sólo se ocultan y no se guardan).
    ...(config.sizes !== undefined ? { sizes: config.sizes } : {}),
    ...(options ? { options } : {}),
  };
}

/** Productos que no son prenda: no llevan tabla de tallas. */
const GARMENTS_WITHOUT_SIZES: readonly Garment[] = ["termo", "taza"];

/** ¿Esta prenda se pide por tallas? (el panel y la tabla impresa sólo salen si sí). */
export function garmentHasSizes(garment: Garment): boolean {
  return !GARMENTS_WITHOUT_SIZES.includes(garment);
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
export function mockupFilename(garment: Garment, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const slug = GARMENT_LABELS[garment]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  return `mockup-${slug}-${day}.png`;
}

export function buildMockupPayload(result: MockupStudioResult): CreateOrderMockupPayload {
  assertGarmentEnabled(result.config.garment);
  // Tallas "escondidas" de una prenda anterior no se guardan en un termo o taza.
  const config = { ...result.config };
  if (!garmentHasSizes(config.garment)) delete config.sizes;
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
