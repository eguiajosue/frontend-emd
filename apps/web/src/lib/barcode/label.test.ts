import { describe, expect, it } from "vitest";
import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  QUIET_ZONE_MODULES,
  computeLabelLayout,
  dotMm,
  fitBarcodeModules,
  fitText,
  maxCharsForWidth,
  mmToPx,
  pxToMm,
  truncateText,
} from "./label";

describe("conversión de unidades", () => {
  it("mm ↔ px a 96 dpi y puntos de la térmica a 203 dpi", () => {
    expect(mmToPx(25.4)).toBeCloseTo(96);
    expect(mmToPx(80)).toBeCloseTo(302.36, 1);
    expect(pxToMm(mmToPx(35))).toBeCloseTo(35);
    expect(dotMm()).toBeCloseTo(0.1251, 3);
    expect(mmToPx(10, 203)).toBeCloseTo(79.92, 1);
  });
});

describe("fitBarcodeModules", () => {
  it("el módulo es un múltiplo exacto de puntos y todo cabe con márgenes blancos", () => {
    // EMD-000123 en Code 128 = 123 módulos.
    const fit = fitBarcodeModules(123, 78);
    expect(fit.dotsPerModule).toBe(4);
    expect(fit.moduleMm).toBeCloseTo(4 * dotMm(), 6);
    expect((123 + QUIET_ZONE_MODULES * 2) * fit.moduleMm).toBeLessThanOrEqual(78);
    expect(fit.barsWidthMm).toBeCloseTo(123 * fit.moduleMm);
    expect(fit.readable).toBe(true);
  });

  it("no pasa de 4 puntos (≈ 0.5 mm) por módulo aunque sobre lugar", () => {
    expect(fitBarcodeModules(35, 78).dotsPerModule).toBe(4);
  });

  it("un código larguísimo se comprime al ancho y avisa que no se leerá bien", () => {
    const fit = fitBarcodeModules(739, 78);
    expect((739 + 20) * fit.moduleMm).toBeLessThanOrEqual(78 + 1e-9);
    expect(fit.readable).toBe(false);
  });
});

describe("texto", () => {
  it("truncateText recorta con … y respeta emoji", () => {
    expect(truncateText("Hilo rojo", 20)).toBe("Hilo rojo");
    expect(truncateText("Hilo poliéster rojo", 10)).toBe("Hilo poli…");
    expect(truncateText("  muchos   espacios ", 50)).toBe("muchos espacios");
    expect(truncateText("🧵🧵🧵🧵", 3)).toBe("🧵🧵…");
    expect(truncateText("abc", 0)).toBe("");
  });

  it("maxCharsForWidth es conservador", () => {
    expect(maxCharsForWidth(75, 3.5)).toBe(38);
    expect(maxCharsForWidth(0, 3)).toBe(0);
  });

  it("fitText: corto = letra grande; largo = letra más chica; larguísimo = recortado", () => {
    const opts = { maxFontMm: 3.9, minFontMm: 2.6 };
    expect(fitText("Hilo rojo", 75, opts)).toEqual({ text: "Hilo rojo", fontMm: 3.9, truncated: false });
    const medium = fitText("Hilo poliéster 40 rojo 1147 Madeira Classic", 75, opts);
    expect(medium.truncated).toBe(false);
    expect(medium.fontMm).toBeLessThan(3.9);
    expect(medium.fontMm).toBeGreaterThanOrEqual(2.6);
    const long = fitText("x ".repeat(80), 75, opts);
    expect(long.truncated).toBe(true);
    expect(long.text.endsWith("…")).toBe(true);
    expect(long.fontMm).toBe(2.6);
  });
});

describe("computeLabelLayout", () => {
  const layout = computeLabelLayout();
  const boxes = [layout.company, layout.area, layout.title, layout.barcode, layout.code];

  it("80 × 35 mm y todo dentro de la etiqueta", () => {
    expect(layout.widthMm).toBe(LABEL_WIDTH_MM);
    expect(layout.heightMm).toBe(LABEL_HEIGHT_MM);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(LABEL_WIDTH_MM + 1e-9);
      expect(b.y + b.height).toBeLessThanOrEqual(LABEL_HEIGHT_MM + 1e-9);
    }
  });

  it("de arriba abajo: empresa/departamento, artículo, barras, código; sin encimarse", () => {
    expect(layout.company.y).toBe(layout.area.y);
    expect(layout.company.x + layout.company.width).toBeLessThanOrEqual(layout.area.x);
    expect(layout.title.y).toBeGreaterThanOrEqual(layout.company.y + layout.company.height);
    expect(layout.barcode.y).toBeGreaterThanOrEqual(layout.title.y + layout.title.height);
    expect(layout.code.y).toBeGreaterThanOrEqual(layout.barcode.y + layout.barcode.height);
  });

  it("las barras se quedan con buena parte del alto (≥ 15 mm)", () => {
    expect(layout.barcode.height).toBeGreaterThanOrEqual(15);
  });
});
