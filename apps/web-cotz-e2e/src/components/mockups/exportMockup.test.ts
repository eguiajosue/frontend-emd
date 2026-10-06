import { describe, expect, it } from "vitest";
import {
  alphaBounds,
  computeSheetLayout,
  fitScale,
  pickSideView,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  sheetViewsFor,
  unionBounds,
} from "./exportMockup";
import type { Vec3 } from "@/lib/mockups/types";

const at = (normal: Vec3) => ({ placement: { position: [0, 0, 0] as Vec3, normal, scale: 0.1, rotation: 0 } });

describe("computeSheetLayout", () => {
  it("reparte 3 paneles iguales dentro de la lámina, sin encimarse", () => {
    const panels = computeSheetLayout(3, { padding: 32, gap: 16, labelHeight: 40 });
    expect(panels).toHaveLength(3);
    const width = panels[0].width;
    panels.forEach((p, i) => {
      expect(p.width).toBe(width);
      expect(p.x).toBeGreaterThanOrEqual(32);
      expect(p.x + p.width).toBeLessThanOrEqual(SHEET_WIDTH - 32);
      expect(p.y + p.height + 40).toBeLessThanOrEqual(SHEET_HEIGHT - 32);
      expect(p.labelX).toBeCloseTo(p.x + p.width / 2);
      if (i > 0) expect(p.x - (panels[i - 1].x + panels[i - 1].width)).toBe(16);
    });
  });

  it("sin paneles devuelve una lista vacía", () => {
    expect(computeSheetLayout(0)).toEqual([]);
  });
});

describe("vistas de la lámina", () => {
  it("Frente, Espalda y el lado que tenga diseños (izquierdo por defecto)", () => {
    expect(sheetViewsFor([])).toEqual([
      { view: "front", label: "Frente" },
      { view: "back", label: "Espalda" },
      { view: "left", label: "Lado" },
    ]);
    expect(pickSideView([at([-0.97, 0.2, 0])])).toBe("right");
    expect(pickSideView([at([0.97, 0.2, 0])])).toBe("left");
    expect(pickSideView([at([0.97, 0, 0]), at([-0.97, 0, 0])])).toBe("left");
    expect(pickSideView([at([0, 0, 1]), at([-0.9, 0, 0.3])])).toBe("right");
  });
});

describe("recorte de la lámina", () => {
  /** Imagen RGBA de w×h con píxeles opacos en los puntos dados. */
  function image(w: number, h: number, opaque: [number, number][]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of opaque) data[(y * w + x) * 4 + 3] = 255;
    return data;
  }

  it("alphaBounds encuentra la caja de lo visible", () => {
    expect(alphaBounds(image(10, 8, [[2, 3], [6, 5]]), 10, 8)).toEqual({ x: 2, y: 3, width: 5, height: 3 });
    expect(alphaBounds(image(4, 4, []), 4, 4)).toBeNull();
  });

  it("alphaBounds ignora el alfa por debajo del umbral", () => {
    const data = image(4, 4, [[1, 1]]);
    data[(3 * 4 + 3) * 4 + 3] = 3; // casi transparente
    expect(alphaBounds(data, 4, 4, 6)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });

  it("unionBounds junta las cajas e ignora las vacías", () => {
    expect(
      unionBounds([
        { x: 10, y: 5, width: 10, height: 10 },
        null,
        { x: 0, y: 8, width: 5, height: 20 },
      ]),
    ).toEqual({ x: 0, y: 5, width: 20, height: 23 });
    expect(unionBounds([null])).toBeNull();
  });

  it("fitScale mete el contenido sin deformar ni agrandar de más", () => {
    expect(fitScale({ width: 200, height: 100 }, { width: 100, height: 100 })).toBe(0.5);
    expect(fitScale({ width: 100, height: 400 }, { width: 100, height: 100 })).toBe(0.25);
    expect(fitScale({ width: 10, height: 10 }, { width: 100, height: 100 })).toBe(1);
    expect(fitScale({ width: 10, height: 10 }, { width: 100, height: 100 }, 3)).toBe(3);
  });
});
