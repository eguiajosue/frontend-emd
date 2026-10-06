import { dataUrlBytes } from "@/lib/mockups/dataUrl";
import { assertGarmentEnabled, garmentLabel, isGarmentEnabled } from "@/lib/mockups/garments";
import { newLayerId, normalizeHexColor } from "@/lib/mockups/studio";
import {
  DEFAULT_COLORS,
  MAX_TEMPLATE_THUMBNAIL_BYTES,
  type CreateMockupTemplatePayload,
  type DesignLayer,
  type GarmentColors,
  type MockupConfig,
  type MockupExport,
  type Vec3,
} from "@/lib/mockups/types";

/**
 * Plantillas de mockup (compartidas por la empresa): reglas puras para
 * guardarlas y aplicarlas.
 */

export const TEMPLATE_NAME_MAX = 80;

export type TemplateApplyResult =
  | { ok: true; config: MockupConfig }
  | { ok: false; message: string };

/** Mensaje cuando la plantilla es de una prenda que el estudio no muestra todavía. */
export function unsupportedGarmentMessage(garment: string): string {
  return `Esta plantilla es de ${garmentLabel(garment).toLowerCase()}, que todavía no está disponible en el estudio. Podrás usarla cuando se habilite esa prenda.`;
}

/** Nombre sugerido al guardar: "Playera · logo-cliente". */
export function suggestTemplateName(config: MockupConfig): string {
  const base = garmentLabel(config.garment);
  const first = config.layers[0]?.name?.trim();
  return (first ? `${base} · ${first}` : base).slice(0, TEMPLATE_NAME_MAX);
}

/** Nombre limpio para mandar (sin espacios de más, con tope); null si queda vacío. */
export function cleanTemplateName(name: string): string | null {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, TEMPLATE_NAME_MAX);
  return clean || null;
}

export { dataUrlBytes };

export function thumbnailFits(image: Pick<MockupExport, "dataUrl">): boolean {
  return dataUrlBytes(image.dataUrl) <= MAX_TEMPLATE_THUMBNAIL_BYTES;
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function cleanLayer(raw: unknown): DesignLayer | null {
  if (!raw || typeof raw !== "object") return null;
  const layer = raw as Partial<DesignLayer>;
  const placement = layer.placement;
  if (typeof layer.dataUrl !== "string" || !layer.dataUrl.startsWith("data:image/")) return null;
  if (!placement || !isVec3(placement.position) || !isVec3(placement.normal)) return null;
  const aspect = typeof layer.aspect === "number" && layer.aspect > 0 ? layer.aspect : 1;
  return {
    // Id nuevo: aplicar dos veces la misma plantilla no repite ids.
    id: newLayerId(),
    name: typeof layer.name === "string" && layer.name.trim() ? layer.name : "Diseño",
    dataUrl: layer.dataUrl,
    aspect,
    placement: {
      position: [...placement.position],
      normal: [...placement.normal],
      scale: typeof placement.scale === "number" && placement.scale > 0 ? placement.scale : 0.1,
      rotation: typeof placement.rotation === "number" && Number.isFinite(placement.rotation) ? placement.rotation : 0,
    },
  };
}

/**
 * Config lista para el estudio a partir de la guardada en la plantilla:
 * revisa que la prenda esté habilitada, completa colores faltantes con los
 * de la prenda y descarta diseños dañados.
 */
export function configFromTemplate(template: { garment?: unknown; config?: unknown }): TemplateApplyResult {
  const raw = (template.config && typeof template.config === "object" ? template.config : {}) as Partial<MockupConfig>;
  const garment = raw.garment ?? template.garment;
  if (!isGarmentEnabled(garment)) {
    return { ok: false, message: unsupportedGarmentMessage(typeof garment === "string" ? garment : "") };
  }
  const defaults = DEFAULT_COLORS[garment];
  const colors: GarmentColors = { ...defaults };
  const rawColors = (raw.colors ?? {}) as Partial<GarmentColors>;
  for (const part of Object.keys(defaults) as (keyof GarmentColors)[]) {
    const value = typeof rawColors[part] === "string" ? normalizeHexColor(rawColors[part]!) : null;
    if (value) colors[part] = value;
  }
  const layers = (Array.isArray(raw.layers) ? raw.layers : []).map(cleanLayer).filter((l): l is DesignLayer => !!l);
  return {
    ok: true,
    config: {
      garment,
      colors,
      layers,
      ...(raw.options && typeof raw.options === "object" ? { options: raw.options } : {}),
    },
  };
}

/** Cuerpo de `POST /mockup-templates` (sólo prendas habilitadas, R11). */
export function buildTemplatePayload(
  name: string,
  config: MockupConfig,
  thumbnail: Pick<MockupExport, "dataUrl">
): CreateMockupTemplatePayload {
  assertGarmentEnabled(config.garment);
  return { name, garment: config.garment, config, thumbnailDataUrl: thumbnail.dataUrl };
}
