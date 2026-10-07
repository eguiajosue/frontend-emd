import { describe, expect, it } from "vitest";
import {
  DEFAULT_LASER_SETTINGS,
  engravedRatio,
  laserMask,
  laserSettings,
  maskToRgba,
  type PixelBuffer,
} from "./laserEngrave";

/** Imagen de prueba: cada píxel es [r, g, b, a]. */
function img(width: number, height: number, px: (x: number, y: number) => [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(px(x, y), (y * width + x) * 4);
  return { width, height, data };
}

const gray = (v: number): [number, number, number, number] => [v, v, v, 255];

describe("laserMask · umbral", () => {
  it("graba lo más oscuro que el umbral y deja lo claro", () => {
    const src = img(4, 1, (x) => gray([0, 100, 160, 255][x]));
    expect([...laserMask(src, { threshold: 128, invert: false, dither: false })]).toEqual([255, 255, 0, 0]);
    expect([...laserMask(src, { threshold: 170, invert: false, dither: false })]).toEqual([255, 255, 255, 0]);
  });

  it("usa luminancia: rojo puro es oscuro, amarillo es claro", () => {
    const src = img(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [255, 255, 0, 255]));
    expect([...laserMask(src, DEFAULT_LASER_SETTINGS)]).toEqual([255, 0]);
  });

  it("invertir graba lo claro", () => {
    const src = img(3, 1, (x) => gray([0, 100, 240][x]));
    expect([...laserMask(src, { threshold: 128, invert: true, dither: false })]).toEqual([0, 0, 255]);
  });

  it("lo transparente nunca se graba, ni invertido", () => {
    const src = img(2, 1, (x) => (x === 0 ? [0, 0, 0, 0] : [0, 0, 0, 255]));
    expect([...laserMask(src, { threshold: 128, invert: false, dither: false })]).toEqual([0, 255]);
    expect([...laserMask(src, { threshold: 128, invert: true, dither: false })]).toEqual([0, 0]);
  });

  it("no modifica la imagen original (proceso reversible)", () => {
    const src = img(8, 8, (x, y) => gray((x * 32 + y * 4) % 256));
    const copy = new Uint8ClampedArray(src.data);
    laserMask(src, { threshold: 90, invert: true, dither: true });
    expect(src.data).toEqual(copy);
  });
});

describe("laserMask · difuminado Floyd–Steinberg", () => {
  const ramp = img(64, 16, (x) => gray(Math.round((x / 63) * 255)));

  it("es determinista", () => {
    const s = { threshold: 128, invert: false, dither: true };
    expect(laserMask(ramp, s)).toEqual(laserMask(ramp, s));
  });

  it("un gris medio queda ~50 % grabado, en patrón (no bloque)", () => {
    const mid = img(32, 32, () => gray(128));
    const mask = laserMask(mid, { threshold: 128, invert: false, dither: true });
    expect(engravedRatio(mask)).toBeGreaterThan(0.4);
    expect(engravedRatio(mask)).toBeLessThan(0.6);
    // Vecinos alternan: no es todo blanco ni todo negro en una fila.
    const row = [...mask.slice(0, 32)];
    expect(new Set(row).size).toBe(2);
  });

  it("la densidad sigue al degradado (más oscuro → más grabado)", () => {
    const mask = laserMask(ramp, { threshold: 128, invert: false, dither: true });
    const col = (x0: number, x1: number) => {
      let on = 0;
      let n = 0;
      for (let y = 0; y < 16; y++) for (let x = x0; x < x1; x++, n++) if (mask[y * 64 + x]) on++;
      return on / n;
    };
    expect(col(0, 16)).toBeGreaterThan(col(24, 40));
    expect(col(24, 40)).toBeGreaterThan(col(48, 64));
  });

  it("blanco y negro puros no cambian con difuminado", () => {
    const bw = img(4, 1, (x) => gray(x < 2 ? 0 : 255));
    expect([...laserMask(bw, { threshold: 128, invert: false, dither: true })]).toEqual([255, 255, 0, 0]);
  });
});

describe("utilidades", () => {
  it("laserSettings normaliza valores raros o ausentes", () => {
    expect(laserSettings(undefined)).toEqual(DEFAULT_LASER_SETTINGS);
    expect(laserSettings({ threshold: 999, invert: true })).toEqual({ threshold: 255, invert: true, dither: false });
    expect(laserSettings({ threshold: Number.NaN })).toEqual(DEFAULT_LASER_SETTINGS);
  });

  it("maskToRgba: blanco con alfa = máscara", () => {
    expect([...maskToRgba(new Uint8Array([255, 0]))]).toEqual([255, 255, 255, 255, 255, 255, 255, 0]);
  });
});
