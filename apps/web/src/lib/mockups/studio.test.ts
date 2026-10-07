import { describe, expect, it, vi } from "vitest";
import type { DesignPlacement, Garment } from "./types";

const placements: Record<"tshirt" | "cap", DesignPlacement> = {
  tshirt: { position: [0, 0.1, 0.2], normal: [0, 0, 1], scale: 0.3, rotation: 0 },
  cap: { position: [0, 0.05, 0.1], normal: [0, 0, 1], scale: 0.1, rotation: 0 },
};
vi.mock("@/lib/mockups/presets", () => ({
  defaultPlacement: (garment: Garment) => ({ ...placements[garment as "tshirt" | "cap"] }),
  PLACEMENT_PRESETS: { tshirt: [], cap: [] },
  applyPreset: vi.fn(),
}));

import {
  buildMockupPayload,
  createLayer,
  exceedsMockupLimit,
  initialMockupConfig,
  mockupFilename,
  normalizeHexColor,
  switchGarment,
  garmentHasSizes,
} from "./studio";
import { DEFAULT_COLORS, MAX_MOCKUP_BYTES } from "./types";

const design = { name: "logo", dataUrl: "data:image/png;base64,AAA", aspect: 2 };

describe("studio helpers", () => {
  it("un diseño nuevo arranca en la posición inicial de la prenda", () => {
    const layer = createLayer(design, "cap", "l1");
    expect(layer).toMatchObject({ id: "l1", name: "logo", aspect: 2, placement: placements.cap });
  });

  it("cambiar de prenda conserva los diseños y los regresa a la posición inicial", () => {
    const config = {
      ...initialMockupConfig("tshirt"),
      layers: [
        { ...createLayer(design, "tshirt", "a"), placement: { ...placements.tshirt, scale: 0.9, rotation: 1 } },
        createLayer(design, "tshirt", "b"),
      ],
    };
    const next = switchGarment(config, "cap");
    expect(next.garment).toBe("cap");
    expect(next.colors).toEqual(DEFAULT_COLORS.cap);
    expect(next.layers.map((l) => l.id)).toEqual(["a", "b"]);
    expect(next.layers.every((l) => l.placement.scale === placements.cap.scale && l.placement.rotation === 0)).toBe(
      true
    );
    expect(switchGarment(next, "cap")).toBe(next);
  });

  it("cambiar de prenda conserva las tallas; termo y taza no las usan ni las guardan", () => {
    const sizes = { general: { M: 3, L: 2 } };
    const config = { ...initialMockupConfig("tshirt"), sizes };
    const cap = switchGarment(config, "cap");
    expect(cap.sizes).toEqual(sizes);
    expect(switchGarment(initialMockupConfig("tshirt"), "cap")).not.toHaveProperty("sizes");

    expect(garmentHasSizes("tshirt")).toBe(true);
    expect(garmentHasSizes("termo")).toBe(false);
    expect(garmentHasSizes("taza")).toBe(false);

    const taza = switchGarment(config, "taza");
    expect(taza.sizes).toEqual(sizes);
    const payload = buildMockupPayload({ image: { dataUrl: "data:image/png;base64,B", width: 1, height: 1 }, config: taza });
    expect(payload.config).not.toHaveProperty("sizes");
    // Y al volver a una prenda, las tallas siguen ahí.
    expect(switchGarment(taza, "tshirt").sizes).toEqual(sizes);
  });

  it("normaliza colores hex escritos a mano", () => {
    expect(normalizeHexColor("FFF")).toBe("#ffffff");
    expect(normalizeHexColor(" #1F2A44 ")).toBe("#1f2a44");
    expect(normalizeHexColor("rojo")).toBeNull();
  });

  it("nombre del archivo con prenda y fecha", () => {
    expect(mockupFilename("tshirt", new Date(2026, 9, 5))).toBe("mockup-playera-2026-10-05.png");
    expect(mockupFilename("cap", new Date(2026, 0, 9))).toBe("mockup-gorra-2026-01-09.png");
  });

  it("arma el cuerpo del POST y detecta cuando pasa del tope del backend", () => {
    const config = initialMockupConfig("tshirt");
    const payload = buildMockupPayload({
      image: { dataUrl: "data:image/png;base64,BBB", width: 1600, height: 800 },
      config,
    });
    expect(payload).toEqual({ garment: "tshirt", imageDataUrl: "data:image/png;base64,BBB", config });
    expect(exceedsMockupLimit(payload)).toBe(false);
    expect(exceedsMockupLimit({ ...payload, imageDataUrl: "x".repeat(MAX_MOCKUP_BYTES) })).toBe(true);
  });
});
