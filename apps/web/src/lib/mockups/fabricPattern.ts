import { normalizeHexColor } from "@/lib/mockups/studio";
import type { FabricPatternConfig, FabricPatternKind } from "@/lib/mockups/types";

/**
 * Generador de la textura de tela de la camisa de vestir (lisa, a rayas o a
 * cuadros). Infraestructura para cuando llegue el modelo 3D (ver
 * lib/mockups/garments.ts): la UI todavía no lo muestra.
 *
 * La textura es un mosaico que se repite (`RepeatWrapping` en three.js). Todo
 * lo que se pueda calcular sin canvas (normalización y franjas) es puro y se
 * prueba solo.
 */

export const PATTERN_LIMITS = {
  /** Colores: fondo + hasta 5 de raya. */
  maxColors: 6,
  stripeWidth: { min: 1, max: 64, default: 6 },
  spacing: { min: 0, max: 128, default: 14 },
} as const;

const KINDS: readonly FabricPatternKind[] = ["plain", "stripes", "plaid"];

/** Patrón con todos sus valores resueltos y dentro de rango. */
export interface FabricPattern {
  kind: FabricPatternKind;
  /** `colors[0]` = fondo; `colors[1..]` = rayas, en orden. Siempre ≥ 1. */
  colors: string[];
  stripeWidth: number;
  spacing: number;
  direction: "vertical" | "horizontal";
}

function clampInt(value: unknown, { min, max, default: fallback }: { min: number; max: number; default: number }) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

/** Blanco o gris oscuro: lo que más contrasta con `hex`. */
export function contrastColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? "#1f2937" : "#ffffff";
}

/**
 * Valores sueltos (de la UI, de una plantilla vieja…) → patrón válido:
 * tipo conocido, colores hex sin inválidos (con tope), al menos un color de
 * raya cuando hay rayas o cuadros, grosor/separación enteros y en rango.
 */
export function normalizeFabricPattern(
  input: Partial<FabricPatternConfig> | null | undefined,
  baseColor = "#ffffff"
): FabricPattern {
  const kind = input?.kind && KINDS.includes(input.kind) ? input.kind : "plain";
  const colors = (Array.isArray(input?.colors) ? input!.colors : [])
    .map((c) => (typeof c === "string" ? normalizeHexColor(c) : null))
    .filter((c): c is string => c !== null)
    .slice(0, PATTERN_LIMITS.maxColors);
  if (colors.length === 0) colors.push(normalizeHexColor(baseColor) ?? "#ffffff");
  if (kind !== "plain" && colors.length === 1) colors.push(contrastColor(colors[0]));
  return {
    kind,
    colors: kind === "plain" ? [colors[0]] : colors,
    stripeWidth: clampInt(input?.stripeWidth, PATTERN_LIMITS.stripeWidth),
    spacing: clampInt(input?.spacing, PATTERN_LIMITS.spacing),
    direction: input?.direction === "horizontal" ? "horizontal" : "vertical",
  };
}

export interface Stripe {
  /** Inicio a lo largo del eje perpendicular a la raya, en px. */
  offset: number;
  width: number;
  color: string;
}

/**
 * Periodo del mosaico en px: cada color de raya ocupa `stripeWidth +
 * spacing`. Liso = 1 (un solo color).
 */
export function patternPeriod(pattern: FabricPattern): number {
  if (pattern.kind === "plain") return 1;
  const stripeColors = pattern.colors.length - 1;
  return Math.max(1, stripeColors * (pattern.stripeWidth + pattern.spacing));
}

/** Rayas de un periodo, sobre el fondo `colors[0]`. Vacío si es liso. */
export function stripeLayout(pattern: FabricPattern): Stripe[] {
  if (pattern.kind === "plain") return [];
  const step = pattern.stripeWidth + pattern.spacing;
  return pattern.colors.slice(1).map((color, i) => ({ offset: i * step, width: pattern.stripeWidth, color }));
}

/**
 * Tamaño del mosaico: un múltiplo del periodo cercano a `target` (las texturas
 * se ven mejor con lados de unos cientos de px y deben repetir sin costura).
 */
export function tileSize(pattern: FabricPattern, target = 256): number {
  const period = patternPeriod(pattern);
  if (period <= 1) return 4;
  return period * Math.max(1, Math.round(target / period));
}

/** Contexto 2D mínimo que usa `drawFabricPattern` (para probar sin canvas). */
export type PatternContext = Pick<CanvasRenderingContext2D, "fillRect"> & {
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  globalAlpha: number;
};

/**
 * Dibuja el mosaico en `ctx` (`size × size`). Rayas: franjas en la dirección
 * pedida. Cuadros: las mismas franjas en ambas direcciones, las horizontales
 * semitransparentes para que el cruce se vea más oscuro, como en la tela.
 */
export function drawFabricPattern(ctx: PatternContext, pattern: FabricPattern, size: number) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = pattern.colors[0];
  ctx.fillRect(0, 0, size, size);
  if (pattern.kind === "plain") return;

  const period = patternPeriod(pattern);
  const stripes = stripeLayout(pattern);
  const paint = (vertical: boolean, alpha: number) => {
    ctx.globalAlpha = alpha;
    for (let start = 0; start < size; start += period) {
      for (const s of stripes) {
        ctx.fillStyle = s.color;
        if (vertical) ctx.fillRect(start + s.offset, 0, s.width, size);
        else ctx.fillRect(0, start + s.offset, size, s.width);
      }
    }
  };

  if (pattern.kind === "stripes") {
    paint(pattern.direction === "vertical", 1);
  } else {
    paint(true, 1);
    paint(false, 0.55);
  }
  ctx.globalAlpha = 1;
}

/** Canvas con el mosaico listo para usar como textura. */
export function createFabricPatternCanvas(
  input: Partial<FabricPatternConfig> | null | undefined,
  baseColor?: string,
  target = 256
): HTMLCanvasElement {
  const pattern = normalizeFabricPattern(input, baseColor);
  const size = tileSize(pattern, target);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la textura de la tela");
  drawFabricPattern(ctx, pattern, size);
  return canvas;
}

/** Igual que `createFabricPatternCanvas`, como `data:image/png`. */
export function fabricPatternDataUrl(
  input: Partial<FabricPatternConfig> | null | undefined,
  baseColor?: string,
  target?: number
): string {
  return createFabricPatternCanvas(input, baseColor, target).toDataURL("image/png");
}
