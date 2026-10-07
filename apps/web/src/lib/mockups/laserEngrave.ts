/**
 * Grabado láser del termo (lógica pura, sin DOM ni three.js).
 *
 * El láser sólo quema o no quema: el diseño del cliente se reduce a una
 * máscara de alto contraste (blanco y negro). Se convierte a gris, se aplica
 * un umbral (o difuminado Floyd–Steinberg para fotos/degradados) y se puede
 * invertir. La máscara dice dónde se quita la pintura electrostática y queda
 * el acero a la vista; el diseño original (`DesignLayer.dataUrl`) no se toca,
 * así que el proceso es reversible y se vuelve a calcular con otros ajustes.
 */

export interface LaserEngraveSettings {
  /** 0–255: los píxeles más oscuros que esto se graban. */
  threshold: number;
  /** Graba lo claro en vez de lo oscuro (logos blancos). */
  invert: boolean;
  /** Difuminado Floyd–Steinberg en vez de umbral duro. */
  dither: boolean;
}

export const DEFAULT_LASER_SETTINGS: LaserEngraveSettings = { threshold: 128, invert: false, dither: false };

/** Lo mínimo de `ImageData` que se necesita (los tests no tienen canvas). */
export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, 4 bytes por píxel. */
  data: Uint8ClampedArray;
}

/** Normaliza ajustes viejos o incompletos (configs guardadas sin `engrave`). */
export function laserSettings(value?: Partial<LaserEngraveSettings> | null): LaserEngraveSettings {
  const t = Number(value?.threshold);
  return {
    threshold: Number.isFinite(t) ? Math.min(255, Math.max(0, Math.round(t))) : DEFAULT_LASER_SETTINGS.threshold,
    invert: value?.invert === true,
    dither: value?.dither === true,
  };
}

/** Luminancia (Rec. 601) del píxel compuesto sobre blanco. */
function grayOver(data: Uint8ClampedArray, i: number): number {
  const a = data[i + 3] / 255;
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return lum * a + 255 * (1 - a);
}

/**
 * Máscara de grabado: 1 byte por píxel, 255 = se graba, 0 = queda la pintura.
 * Lo transparente nunca se graba (ni invertido): el láser trabaja sólo dentro
 * del arte, no sobre el fondo del PNG.
 */
export function laserMask(src: PixelBuffer, settings: LaserEngraveSettings): Uint8Array {
  const { width, height, data } = src;
  const n = width * height;
  const mask = new Uint8Array(n);
  const gray = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const g = grayOver(data, p * 4);
    gray[p] = settings.invert ? 255 - g : g;
  }
  const t = settings.threshold;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const old = gray[p];
      const on = settings.dither ? old < 128 + (t - 128) * 0.5 : old < t;
      if (data[p * 4 + 3] >= 128) mask[p] = on ? 255 : 0;
      if (!settings.dither) continue;
      // Difusión del error (Floyd–Steinberg, orden de lectura: determinista).
      const err = old - (on ? 0 : 255);
      if (x + 1 < width) gray[p + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) gray[p + width - 1] += (err * 3) / 16;
        gray[p + width] += (err * 5) / 16;
        if (x + 1 < width) gray[p + width + 1] += err / 16;
      }
    }
  }
  return mask;
}

/** Máscara → RGBA blanco con alfa = máscara (lista para `putImageData`). */
export function maskToRgba(mask: Uint8Array, out = new Uint8ClampedArray(mask.length * 4)): Uint8ClampedArray {
  for (let p = 0; p < mask.length; p++) {
    const o = p * 4;
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = mask[p];
  }
  return out;
}

/** Fracción grabada (0–1) de la máscara: sirve para avisos y para los tests. */
export function engravedRatio(mask: Uint8Array): number {
  if (mask.length === 0) return 0;
  let on = 0;
  for (const v of mask) if (v) on++;
  return on / mask.length;
}
