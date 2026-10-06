import { PLACEMENT_PRESETS } from "./presets";
import {
  DEFAULT_COLORS,
  GARMENT_LABELS,
  type FabricPatternKind,
  type Garment,
  type GarmentColors,
  type GarmentOptions,
  type PlacementPreset,
} from "./types";

/**
 * Registro de prendas del estudio de mockups (docs/plans/sidebar-y-mockups-v2.md).
 *
 * Cada prenda dice de dónde sale su 3D, qué partes se pintan, qué ajustes
 * propios tiene y sus posiciones predeterminadas. La sudadera y la camisa de
 * vestir ya están aquí, pero ocultas: sus modelos 3D los descarga el usuario
 * (CC0/CC-BY) y hasta entonces `ENABLED_GARMENTS` sólo deja playera y gorra.
 *
 * Para habilitar una prenda nueva: poner su GLB en `public/models/`, llenar
 * `model`, sus presets en `presets.ts`, cargarla en `mockupScene.ts`
 * (`loadGarment`) y agregarla a `ENABLED_GARMENTS`.
 */

/**
 * ÚNICA lista de prendas habilitadas (decisión R11): la usan el selector del
 * estudio, al aplicar plantillas y los armadores de cuerpos que van al backend
 * (`buildMockupPayload`, `buildTemplatePayload`). El backend tiene su par en
 * `src/common/mockup-validation.ts` (`ORDER_MOCKUP_GARMENTS`): al habilitar una
 * prenda se amplían las dos en el mismo release.
 */
export const ENABLED_GARMENTS = ["tshirt", "cap"] as const satisfies readonly Garment[];

export type EnabledGarment = (typeof ENABLED_GARMENTS)[number];

/** Todas las prendas que conoce el contrato, en el orden en que se muestran. */
export const ALL_GARMENTS = ["tshirt", "cap", "hoodie", "dress-shirt"] as const satisfies readonly Garment[];

export type ColorPart = keyof GarmentColors;

/** Ajustes que admite cada prenda (lo que la UI mostrará cuando se habilite). */
export interface GarmentOptionSpec {
  /** Con / sin bolsa canguro. */
  pocket?: boolean;
  /** Largos de manga disponibles. */
  sleeves?: ("long" | "short")[];
  /** Tipos de tela. */
  patterns?: FabricPatternKind[];
  /** Color de botones editable. */
  buttonColor?: boolean;
}

export type GarmentModelSource =
  /** GLB en `public/` (ruta absoluta del sitio). */
  | { kind: "glb"; url: string }
  /** Geometría construida por código. */
  | { kind: "procedural" };

export interface GarmentDefinition {
  id: Garment;
  label: string;
  /** Modelo comercial de referencia (texto de apoyo en el selector). */
  referenceModel: string;
  /** null = todavía no hay modelo 3D (la prenda no se puede mostrar). */
  model: GarmentModelSource | null;
  /** Partes con color propio, en el orden en que se muestran. */
  colorParts: { part: ColorPart; label: string }[];
  defaultColors: GarmentColors;
  options: GarmentOptionSpec;
  defaultOptions?: GarmentOptions;
  presets: PlacementPreset[];
}

export const GARMENTS: Record<Garment, GarmentDefinition> = {
  tshirt: {
    id: "tshirt",
    label: GARMENT_LABELS.tshirt,
    referenceModel: "Gildan 5000",
    model: { kind: "glb", url: "/models/tshirt.glb" },
    colorParts: [{ part: "body", label: "Color de la prenda" }],
    defaultColors: DEFAULT_COLORS.tshirt,
    options: {},
    presets: PLACEMENT_PRESETS.tshirt,
  },
  cap: {
    id: "cap",
    label: GARMENT_LABELS.cap,
    referenceModel: "Richardson 112",
    model: { kind: "procedural" },
    colorParts: [
      { part: "body", label: "Frente" },
      { part: "mesh", label: "Malla" },
      { part: "visor", label: "Visera" },
    ],
    defaultColors: DEFAULT_COLORS.cap,
    options: {},
    presets: PLACEMENT_PRESETS.cap,
  },
  hoodie: {
    id: "hoodie",
    label: GARMENT_LABELS.hoodie,
    referenceModel: "Gildan 18500",
    model: null,
    colorParts: [{ part: "body", label: "Color de la prenda" }],
    defaultColors: DEFAULT_COLORS.hoodie,
    options: { pocket: true },
    defaultOptions: { pocket: true },
    presets: PLACEMENT_PRESETS.hoodie,
  },
  "dress-shirt": {
    id: "dress-shirt",
    label: GARMENT_LABELS["dress-shirt"],
    referenceModel: "Camisa Oxford",
    model: null,
    colorParts: [{ part: "body", label: "Color de la tela" }],
    defaultColors: DEFAULT_COLORS["dress-shirt"],
    options: { sleeves: ["long", "short"], patterns: ["plain", "stripes", "plaid"], buttonColor: true },
    defaultOptions: {
      sleeve: "long",
      pattern: { kind: "plain", colors: [DEFAULT_COLORS["dress-shirt"].body] },
      buttonColor: "#f5f5f4",
    },
    presets: PLACEMENT_PRESETS["dress-shirt"],
  },
};

export function isGarment(value: unknown): value is Garment {
  return typeof value === "string" && (ALL_GARMENTS as readonly string[]).includes(value);
}

/** ¿Se puede usar en el estudio hoy? (prenda conocida y habilitada). */
export function isGarmentEnabled(value: unknown): value is EnabledGarment {
  return typeof value === "string" && (ENABLED_GARMENTS as readonly string[]).includes(value);
}

/** Error al armar un cuerpo para el backend con una prenda no habilitada. */
export class GarmentNotEnabledError extends Error {
  constructor(garment: string) {
    super(`La prenda «${garmentLabel(garment)}» todavía no está disponible.`);
    this.name = "GarmentNotEnabledError";
  }
}

/** Para los armadores de payload: sólo prendas de `ENABLED_GARMENTS`. */
export function assertGarmentEnabled(value: unknown): asserts value is EnabledGarment {
  if (!isGarmentEnabled(value)) throw new GarmentNotEnabledError(typeof value === "string" ? value : "");
}

export function getGarment(id: Garment): GarmentDefinition {
  return GARMENTS[id];
}

/** Prendas que muestra el selector. */
export function enabledGarments(): GarmentDefinition[] {
  return ENABLED_GARMENTS.map((id) => GARMENTS[id]);
}

/** Nombre para mostrar de cualquier valor de prenda (incluso uno desconocido). */
export function garmentLabel(value: string): string {
  return isGarment(value) ? GARMENTS[value].label : "Prenda desconocida";
}

/** Copia de los ajustes iniciales de la prenda (undefined si no tiene). */
export function defaultGarmentOptions(id: Garment): GarmentOptions | undefined {
  const options = GARMENTS[id].defaultOptions;
  if (!options) return undefined;
  return {
    ...options,
    ...(options.pattern ? { pattern: { ...options.pattern, colors: [...options.pattern.colors] } } : {}),
  };
}
