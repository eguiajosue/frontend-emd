import { describe, expect, it } from "vitest";
import {
  ALL_GARMENTS,
  ENABLED_GARMENTS,
  GARMENTS,
  GarmentNotEnabledError,
  assertGarmentEnabled,
  defaultGarmentOptions,
  enabledGarments,
  garmentLabel,
  isGarment,
  isGarmentEnabled,
  isLaserEngraved,
} from "./garments";
import { PLACEMENT_PRESETS, defaultPlacement, findPreset } from "./presets";
import { buildMockupPayload, initialMockupConfig, mockupFilename, switchGarment } from "./studio";
import { DEFAULT_COLORS, GARMENT_LABELS, RAW_STEEL_HEX, isRawSteel, type MockupConfig } from "./types";

describe("registro de prendas", () => {
  it("playera, gorra, termo y taza están habilitadas; sudadera y camisa siguen ocultas", () => {
    expect(ENABLED_GARMENTS).toEqual(["tshirt", "cap", "termo", "taza"]);
    expect(enabledGarments().map((g) => g.label)).toEqual(["Playera", "Gorra", "Termo", "Taza"]);
    expect(isGarmentEnabled("termo")).toBe(true);
    expect(isGarmentEnabled("taza")).toBe(true);
    expect(isGarmentEnabled("hoodie")).toBe(false);
    expect(isGarmentEnabled("dress-shirt")).toBe(false);
    expect(isGarmentEnabled("cap")).toBe(true);
    expect(isGarment("dress-shirt")).toBe(true);
    expect(isGarment("pantalón")).toBe(false);
  });

  it("cada prenda declara etiqueta, colores, partes y modelo coherentes", () => {
    for (const id of ALL_GARMENTS) {
      const g = GARMENTS[id];
      expect(g.id).toBe(id);
      expect(g.label).toBe(GARMENT_LABELS[id]);
      expect(g.defaultColors).toEqual(DEFAULT_COLORS[id]);
      for (const { part } of g.colorParts) expect(g.defaultColors[part], `${id}.${part}`).toMatch(/^#[0-9a-f]{6}$/);
      // Lo habilitado tiene modelo y presets; lo oculto todavía no.
      if (isGarmentEnabled(id)) {
        expect(g.model).not.toBeNull();
        expect(g.presets.length).toBeGreaterThan(0);
      } else {
        expect(g.model).toBeNull();
      }
    }
    expect(garmentLabel("hoodie")).toBe("Sudadera");
    expect(garmentLabel("???")).toBe("Prenda desconocida");
  });

  it("ajustes iniciales: bolsa de la sudadera, manga/patrón/botones de la camisa (copias)", () => {
    expect(defaultGarmentOptions("tshirt")).toBeUndefined();
    expect(defaultGarmentOptions("hoodie")).toEqual({ pocket: true });
    const a = defaultGarmentOptions("dress-shirt")!;
    expect(a).toMatchObject({ sleeve: "long", pattern: { kind: "plain" }, buttonColor: "#f5f5f4" });
    a.pattern!.colors.push("#000000");
    expect(defaultGarmentOptions("dress-shirt")!.pattern!.colors).toEqual(["#ffffff"]);
  });
});

describe("termo y taza", () => {
  it("son procedurales, con sus presets y acabado propio (láser / impresión)", () => {
    expect(GARMENTS.termo.model).toEqual({ kind: "procedural" });
    expect(GARMENTS.taza.model).toEqual({ kind: "procedural" });
    expect(isLaserEngraved("termo")).toBe(true);
    expect(isLaserEngraved("taza")).toBe(false);
    expect(isLaserEngraved("tshirt")).toBe(false);
    expect(PLACEMENT_PRESETS.termo.map((p) => p.label)).toEqual(["Frente", "Reverso"]);
    expect(PLACEMENT_PRESETS.taza.map((p) => p.label)).toEqual(["Frente", "Reverso", "Alrededor"]);
  });

  it("acero natural se reconoce sin importar mayúsculas", () => {
    expect(isRawSteel(RAW_STEEL_HEX.toUpperCase())).toBe(true);
    expect(isRawSteel(DEFAULT_COLORS.termo.body)).toBe(false);
    expect(isRawSteel(undefined)).toBe(false);
  });

  it("se adjuntan al pedido y dan nombre de archivo", () => {
    const config = initialMockupConfig("termo");
    expect(config.options).toBeUndefined();
    const payload = buildMockupPayload({ image: { dataUrl: "data:image/png;base64,AA", width: 1, height: 1 }, config });
    expect(payload.garment).toBe("termo");
    expect(mockupFilename("taza", new Date(2026, 9, 5))).toBe("mockup-taza-2026-10-05.png");
  });

  it("una config vieja de playera sigue igual (sin `engrave`)", () => {
    const old: MockupConfig = { garment: "tshirt", colors: { body: "#ffffff" }, layers: [] };
    expect(switchGarment(old, "tshirt")).toBe(old);
  });
});

describe("el tipo ampliado no rompe lo existente", () => {
  it("presets y posición inicial de prendas sin modelo caen en la playera", () => {
    expect(PLACEMENT_PRESETS.hoodie).toEqual([]);
    expect(defaultPlacement("hoodie")).toEqual(defaultPlacement("tshirt"));
    expect(findPreset("dress-shirt", "centro-frente")).toBeUndefined();
  });

  it("config inicial y cambio de prenda llevan sus ajustes y no arrastran los de otra", () => {
    expect(initialMockupConfig("tshirt")).toEqual({ garment: "tshirt", colors: { body: "#ffffff" }, layers: [] });
    const shirt = initialMockupConfig("dress-shirt");
    expect(shirt.options?.sleeve).toBe("long");
    const back = switchGarment(shirt, "cap");
    expect(back.options).toBeUndefined();
    expect(back.colors).toEqual(DEFAULT_COLORS.cap);
    expect(switchGarment(back, "hoodie").options).toEqual({ pocket: true });
  });

  it("los cuerpos para el backend sólo aceptan prendas habilitadas (lista única)", () => {
    const config: MockupConfig = { garment: "hoodie", colors: { body: "#ffffff" }, layers: [] };
    const image = { dataUrl: "data:image/png;base64,AA", width: 1, height: 1 };
    expect(() => buildMockupPayload({ image, config })).toThrow(GarmentNotEnabledError);
    expect(() => assertGarmentEnabled("cap")).not.toThrow();
    expect(buildMockupPayload({ image, config: { ...config, garment: "cap" } }).garment).toBe("cap");
  });

  it("nombre de archivo sin espacios ni acentos", () => {
    const date = new Date(2026, 9, 5);
    expect(mockupFilename("dress-shirt", date)).toBe("mockup-camisa-de-vestir-2026-10-05.png");
    expect(mockupFilename("tshirt", date)).toBe("mockup-playera-2026-10-05.png");
  });
});
