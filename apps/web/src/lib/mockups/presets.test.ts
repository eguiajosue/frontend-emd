import { describe, expect, it } from "vitest";
import { applyPreset, defaultPlacement, findPreset, PLACEMENT_PRESETS } from "./presets";
import type { DesignLayer, Garment, MockupView } from "./types";

const GARMENTS: Garment[] = ["tshirt", "cap"];
const VIEWS: MockupView[] = ["front", "back", "left", "right"];

const layer: DesignLayer = {
  id: "capa-1",
  name: "logo.png",
  dataUrl: "data:image/png;base64,AAAA",
  aspect: 2,
  placement: { position: [1, 2, 3], normal: [0, 0, 1], scale: 0.3, rotation: 0.5 },
};

describe("PLACEMENT_PRESETS", () => {
  it("cubre las dos prendas con las posiciones acordadas", () => {
    expect(PLACEMENT_PRESETS.tshirt.map((p) => p.id)).toEqual([
      "centro-frente",
      "pecho-izquierdo",
      "pecho-derecho",
      "espalda-alta",
      "centro-espalda",
      "manga-izquierda",
      "manga-derecha",
    ]);
    expect(PLACEMENT_PRESETS.cap.map((p) => p.id)).toEqual(["frente", "lateral-izquierdo", "lateral-derecho", "atras"]);
  });

  it.each(GARMENTS)("%s: ids únicos, etiqueta, vista válida, números finitos y normal unitaria", (garment) => {
    const presets = PLACEMENT_PRESETS[garment];
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const p of presets) {
      expect(p.label.trim()).not.toBe("");
      expect(VIEWS).toContain(p.view);
      const { position, normal, scale } = p.placement;
      expect(position).toHaveLength(3);
      expect(normal).toHaveLength(3);
      [...position, ...normal, scale].forEach((v) => expect(Number.isFinite(v)).toBe(true));
      expect(scale).toBeGreaterThan(0);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 2);
    }
  });

  it("izquierda/derecha son espejo en X y miran a su lado (izquierda de quien la usa = +X)", () => {
    const pairs: [Garment, string, string][] = [
      ["tshirt", "pecho-izquierdo", "pecho-derecho"],
      ["tshirt", "manga-izquierda", "manga-derecha"],
      ["cap", "lateral-izquierdo", "lateral-derecho"],
    ];
    for (const [g, left, right] of pairs) {
      const l = findPreset(g, left)!.placement;
      const r = findPreset(g, right)!.placement;
      expect(l.position[0]).toBeGreaterThan(0);
      expect(r.position[0]).toBeLessThan(0);
      expect(l.position[0]).toBeCloseTo(-r.position[0], 2);
      expect(l.position[1]).toBeCloseTo(r.position[1], 2);
    }
    expect(findPreset("tshirt", "manga-izquierda")!.view).toBe("left");
    expect(findPreset("tshirt", "manga-derecha")!.view).toBe("right");
  });

  it("los presets de espalda miran hacia atrás y los de frente hacia adelante", () => {
    for (const g of GARMENTS) {
      for (const p of PLACEMENT_PRESETS[g]) {
        if (p.view === "front") expect(p.placement.normal[2]).toBeGreaterThan(0.5);
        if (p.view === "back") expect(p.placement.normal[2]).toBeLessThan(-0.5);
      }
    }
  });
});

describe("defaultPlacement", () => {
  it.each(GARMENTS)("%s: usa el primer preset, sin giro, en una copia", (garment) => {
    const first = PLACEMENT_PRESETS[garment][0];
    const placement = defaultPlacement(garment);
    expect(placement).toEqual({ ...first.placement, rotation: 0 });
    placement.position[0] = 99;
    placement.normal[0] = 99;
    expect(PLACEMENT_PRESETS[garment][0].placement.position[0]).not.toBe(99);
    expect(PLACEMENT_PRESETS[garment][0].placement.normal[0]).not.toBe(99);
  });
});

describe("applyPreset", () => {
  it("mueve la capa al preset con su tamaño estándar y giro 0, sin mutar la original", () => {
    const preset = findPreset("tshirt", "pecho-izquierdo")!;
    const before = structuredClone(layer);
    const next = applyPreset(layer, preset);
    expect(next).not.toBe(layer);
    expect(layer).toEqual(before);
    expect(next).toMatchObject({ id: layer.id, name: layer.name, dataUrl: layer.dataUrl, aspect: layer.aspect });
    expect(next.placement).toEqual({
      position: preset.placement.position,
      normal: preset.placement.normal,
      scale: preset.placement.scale,
      rotation: 0,
    });
    expect(next.placement.position).not.toBe(preset.placement.position);
  });

  it("respeta el giro del preset cuando lo trae", () => {
    const preset = { ...PLACEMENT_PRESETS.cap[0], placement: { ...PLACEMENT_PRESETS.cap[0].placement, rotation: 0.3 } };
    expect(applyPreset(layer, preset).placement.rotation).toBe(0.3);
  });
});

describe("findPreset", () => {
  it("busca dentro de la prenda", () => {
    expect(findPreset("cap", "frente")?.label).toBe("Frente");
    expect(findPreset("tshirt", "frente")).toBeUndefined();
  });
});
