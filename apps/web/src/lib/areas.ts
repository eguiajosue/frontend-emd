import {
  Box,
  Brush,
  Flame,
  Hammer,
  Layers,
  Package,
  Paintbrush,
  PenTool,
  Printer,
  Scissors,
  Shirt,
  Stamp,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Area } from "@emd/types";
import { findArea, getAreaCatalog } from "@emd/business/src/areas";

/**
 * Áreas de trabajo en la Web. El catálogo vive en `@emd/business` (store
 * alimentado por `GET /areas`, ver `AreaCatalogSync`); aquí se suma lo que es
 * sólo de la Web: los íconos de lucide y los colores de `data-area`.
 */
export {
  DESIGN_AREA,
  EMBROIDERY_AREA,
  areaOptions,
  findArea,
  formatAreaList,
  getAreaLabel,
  isDesignArea,
  productionAreaOptions,
  productionAreaSlugs,
  productionAreasOf,
  type AreaOption,
} from "@emd/business/src/areas";

/**
 * Íconos que puede usar un área (`Area.icon` guarda el nombre). Un nombre que
 * no está aquí se muestra sin ícono.
 */
export const AREA_ICON_REGISTRY: Record<string, LucideIcon> = {
  Hammer,
  Layers,
  Scissors,
  PenTool,
  Zap,
  Printer,
  Box,
  Brush,
  Flame,
  Package,
  Paintbrush,
  Shirt,
  Stamp,
  Wrench,
};

/** Ícono de un área; `null` si no se reconoce (área libre/legado). */
export function getAreaIcon(area?: string | null): LucideIcon | null {
  const icon = findArea(area)?.icon;
  return icon ? (AREA_ICON_REGISTRY[icon] ?? null) : null;
}

/* ------------------------------------------------------------------------ */
/* Colores por área                                                          */
/* ------------------------------------------------------------------------ */

type Hsl = [number, number, number];
type Rgb = [number, number, number];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_SLUG = /^[a-z0-9-]+$/;

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb([h, s, l]: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: Rgb): number {
  const c = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [1, 1, 1];
/** Lienzo del tema oscuro (≈ #121214). */
const DARK_CANVAS: Rgb = [0.07, 0.07, 0.08];

const hsl = ([h, s, l]: Hsl) => `${h} ${s}% ${l}%`;

/**
 * Tonos de un área a partir de su color base: `--tone` es el color pleno
 * (franjas, puntos) y `--tone-ink` el texto legible sobre su tinte, en claro y
 * en oscuro. El texto se oscurece (o aclara) hasta tener contraste suficiente,
 * así cualquier color que se elija para un área nueva queda legible.
 */
export function areaTones(color: string): {
  light: { tone: string; ink: string };
  dark: { tone: string; ink: string };
} | null {
  if (!HEX_COLOR.test(color)) return null;
  const [h, s, l] = hexToHsl(color);
  const inkSat = Math.min(85, s + 5);
  let inkLight = 36;
  while (inkLight > 15 && contrast(hslToRgb([h, inkSat, inkLight]), WHITE) < 6.5) inkLight--;
  const darkInkSat = Math.min(90, s + 10);
  let darkInkLight = 74;
  while (darkInkLight < 92 && contrast(hslToRgb([h, darkInkSat, darkInkLight]), DARK_CANVAS) < 11) darkInkLight++;
  return {
    light: { tone: hsl([h, s, l]), ink: hsl([h, inkSat, inkLight]) },
    dark: { tone: hsl([h, Math.min(90, s), Math.min(72, l + 7)]), ink: hsl([h, darkInkSat, darkInkLight]) },
  };
}

/**
 * Reglas CSS de `data-area="<slug>"` para todo el catálogo (las inyecta
 * `AreaCatalogSync`). Un área sin color válido usa el gris por defecto de
 * `globals.css`.
 */
export function areaToneCss(areas: readonly Area[] = getAreaCatalog()): string {
  const light: string[] = [];
  const dark: string[] = [];
  for (const area of areas) {
    if (!SAFE_SLUG.test(area.slug)) continue;
    const tones = areaTones(area.color);
    if (!tones) continue;
    light.push(`[data-area="${area.slug}"]{--tone:${tones.light.tone};--tone-ink:${tones.light.ink}}`);
    dark.push(`.dark [data-area="${area.slug}"]{--tone:${tones.dark.tone};--tone-ink:${tones.dark.ink}}`);
  }
  return [...light, ...dark].join("\n");
}
