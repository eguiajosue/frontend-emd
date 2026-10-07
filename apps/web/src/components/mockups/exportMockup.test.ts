import { describe, expect, it } from "vitest";
import {
  alphaBounds,
  computeRowsLayout,
  computeSheetLayout,
  DOWNLOAD_VIEW_OPTIONS,
  downloadViewOptions,
  sheetPlanFor,
  vehicleSheetPlan,
  vehicleSingleViewSize,
  fitScale,
  pickSideView,
  selectSheetViews,
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

import { sizeTableLayout } from "./exportMockup";

describe("sizeTableLayout (tallas en la lámina)", () => {
  it("sin tallas no agrega alto (mockups viejos)", () => {
    expect(sizeTableLayout(null, 1600).height).toBe(0);
    expect(sizeTableLayout({}, 1600).height).toBe(0);
  });

  it("arma encabezado, filas y total", () => {
    const l = sizeTableLayout({ general: { S: 5, M: 2 }, mujer: { S: 3 } }, 1600);
    expect(l.height).toBeGreaterThan(0);
    expect(l.header).toEqual(["Corte", "S", "M", "Total"]);
    expect(l.rows).toEqual([
      ["General", "5", "2", "7"],
      ["Mujer", "3", "–", "3"],
      ["Total", "", "", "10 pzas"],
    ]);
  });
});

describe("selectSheetViews", () => {
  const layers = [{ placement: { position: [0.3, 0, 0], normal: [1, 0, 0], scale: 0.2, rotation: 0 } as unknown as never }];

  it("sin elegir, devuelve las tres vistas de la lámina", () => {
    expect(selectSheetViews(layers).map((v) => v.label)).toEqual(["Frente", "Espalda", "Lado"]);
    expect(selectSheetViews(layers, "all")).toHaveLength(3);
  });

  it("una vista elegida devuelve sólo esa", () => {
    expect(selectSheetViews(layers, "front")).toEqual([{ view: "front", label: "Frente" }]);
    expect(selectSheetViews(layers, "back")).toEqual([{ view: "back", label: "Espalda" }]);
  });

  it("el lado usa la vista con diseños (no siempre la izquierda)", () => {
    const [side] = selectSheetViews(layers, "side");
    expect(side.label).toBe("Lado");
    expect(side.view).toBe(sheetViewsFor(layers)[2].view);
  });
});

describe("vehículos: vistas y lámina", () => {
  const left = { placement: { position: [0, 0, 0], normal: [1, 0, 0], scale: 1, rotation: 0 } } as never;
  const roof = { placement: { position: [0, 0, 0], normal: [0, 1, 0], scale: 1, rotation: 0 } } as never;

  it("lámina: Frente, Atrás y los dos lados; Arriba sólo con diseños en techo o cofre", () => {
    expect(sheetViewsFor([], "car").map((v) => v.label)).toEqual(["Frente", "Atrás", "Lado izquierdo", "Lado derecho"]);
    expect(sheetViewsFor([left], "pickup")).toHaveLength(4);
    expect(sheetViewsFor([roof], "car").map((v) => v.view)).toEqual(["front", "back", "left", "right", "top"]);
    // Las prendas no cambian.
    expect(sheetViewsFor([], "tshirt").map((v) => v.label)).toEqual(["Frente", "Espalda", "Lado"]);
  });

  it("descarga de una vista y menú por producto", () => {
    expect(selectSheetViews([], "left", "car")).toEqual([{ view: "left", label: "Lado izquierdo" }]);
    expect(selectSheetViews([], "top", "bicycle")).toEqual([{ view: "top", label: "Arriba" }]);
    expect(selectSheetViews([], "back", "trailer")[0].label).toBe("Atrás");
    expect(selectSheetViews([left], "side", "car")[0].view).toBe("left");
    expect(selectSheetViews([], "back", "tshirt")[0].label).toBe("Espalda");
    expect(downloadViewOptions("car").map((o) => o.key)).toEqual(["all", "front", "back", "left", "right", "top"]);
    expect(downloadViewOptions("tshirt").map((o) => o.key)).toEqual(["all", "front", "back", "side"]);
    expect(downloadViewOptions()).toBe(DOWNLOAD_VIEW_OPTIONS);
  });

  it("computeRowsLayout reparte filas sin encimar paneles ni salirse de la lámina", () => {
    const panels = computeRowsLayout({ rows: [3, 2], rowWeights: [0.55, 0.45], width: 1600, height: 960 });
    expect(panels).toHaveLength(5);
    for (const p of panels) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(1600);
      expect(p.y + p.height).toBeLessThan(960);
      expect(p.width).toBeGreaterThan(100);
    }
    expect(panels[3].y).toBeGreaterThan(panels[0].y + panels[0].height);
    expect(panels[3].width).toBeGreaterThan(panels[0].width);
    expect(computeRowsLayout({ rows: [] })).toEqual([]);
  });

  it("el tráiler completo usa una fila por costado; los demás, dos filas", () => {
    const four = sheetViewsFor([], "trailer");
    expect(vehicleSheetPlan("trailer", "full", four).rows).toEqual([2, 1, 1]);
    expect(vehicleSheetPlan("trailer", "cab", four).rows).toEqual([2, 2]);
    expect(vehicleSheetPlan("car", undefined, sheetViewsFor([roof], "car")).rows).toEqual([3, 2]);
    expect(vehicleSingleViewSize("car", undefined, "left").width).toBeGreaterThan(vehicleSingleViewSize("car", undefined, "front").width);
    expect(sheetPlanFor("tshirt", [], "front", undefined)).toMatchObject({ width: 900, height: 900 });
    expect(sheetPlanFor("car", four, "all", undefined).rows).toEqual([2, 2]);
  });

  it("selectSheetViews de prendas conserva el comportamiento anterior", () => {
    expect(selectSheetViews([], "all").map((v) => v.label)).toEqual(["Frente", "Espalda", "Lado"]);
    expect(selectSheetViews([], "side")[0].label).toBe("Lado");
  });
});
