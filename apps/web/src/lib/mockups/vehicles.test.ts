import { describe, expect, it } from "vitest";
import { enabledGarmentsIn, GARMENTS, isGarmentEnabled } from "./garments";
import { PLACEMENT_PRESETS, defaultPlacement, presetsFor } from "./presets";
import { initialMockupConfig, mockupFilename, switchGarment, switchVehiclePart, garmentHasSizes, buildMockupPayload, colorFieldsFor } from "./studio";
import { configFromTemplate } from "./templates";
import { DEFAULT_COLORS, GARMENT_LABELS } from "./types";
import { GARMENT_CATEGORIES, VEHICLE_GARMENTS, garmentCategory, isVehicle, vehiclePartOf, zInPart } from "./vehicles";

describe("categorías y registro de vehículos", () => {
  it("hay dos categorías: Prendas y Rotulaciones", () => {
    expect(GARMENT_CATEGORIES.map((c) => c.label)).toEqual(["Prendas", "Rotulaciones"]);
  });

  it("los cinco vehículos están habilitados, con etiqueta en español, en Rotulaciones", () => {
    expect(VEHICLE_GARMENTS).toEqual(["car", "minivan", "pickup", "trailer", "bicycle"]);
    expect(enabledGarmentsIn("rotulaciones").map((g) => g.label)).toEqual(["Carro", "Minivan", "Pickup", "Tráiler", "Bicicleta"]);
    expect(enabledGarmentsIn("prendas").map((g) => g.id)).toEqual(["tshirt", "cap", "termo", "taza"]);
    for (const v of VEHICLE_GARMENTS) {
      expect(isGarmentEnabled(v)).toBe(true);
      expect(isVehicle(v)).toBe(true);
      expect(garmentCategory(v)).toBe("rotulaciones");
      expect(GARMENTS[v].label).toBe(GARMENT_LABELS[v]);
      expect(DEFAULT_COLORS[v].body).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(isVehicle("tshirt")).toBe(false);
  });

  it("sin tallas ni láser en los vehículos", () => {
    for (const v of VEHICLE_GARMENTS) expect(garmentHasSizes(v)).toBe(false);
    expect(garmentHasSizes("tshirt")).toBe(true);
  });
});

describe("presets de vehículos", () => {
  it.each(VEHICLE_GARMENTS)("%s: ids únicos, normal unitaria y nombres en español", (v) => {
    const list = PLACEMENT_PRESETS[v];
    expect(list.length).toBeGreaterThan(3);
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    for (const p of list) {
      expect(Math.hypot(...p.placement.normal)).toBeCloseTo(1, 1);
      expect(p.placement.scale).toBeGreaterThan(0);
    }
  });

  it("el carro trae puertas, costados, cofre, techo y cajuela", () => {
    const labels = PLACEMENT_PRESETS.car.map((p) => p.label);
    for (const l of ["Puerta izquierda", "Puerta derecha", "Cofre", "Techo", "Cajuela"]) expect(labels).toContain(l);
  });

  it("la pickup trae caja – lateral y compuerta; el tráiler, caja y cabina", () => {
    expect(PLACEMENT_PRESETS.pickup.map((p) => p.label)).toEqual(expect.arrayContaining(["Caja – lateral izquierdo", "Caja – compuerta"]));
    expect(PLACEMENT_PRESETS.trailer.map((p) => p.label)).toEqual(
      expect.arrayContaining(["Caja – lateral izquierdo", "Caja – puerta trasera", "Cabina – puerta izquierda", "Cabina – cofre"]),
    );
  });

  it("izquierda es +X y derecha es -X", () => {
    for (const v of ["car", "pickup"] as const) {
      expect(PLACEMENT_PRESETS[v].find((p) => p.id === "puerta-izquierda")!.placement.normal[0]).toBeGreaterThan(0.9);
      expect(PLACEMENT_PRESETS[v].find((p) => p.id === "puerta-derecha")!.placement.normal[0]).toBeLessThan(-0.9);
    }
  });

  it("el tráiler filtra los presets por parte y su diseño inicial cambia", () => {
    expect(presetsFor("trailer", "cab").every((p) => p.id.startsWith("cabina"))).toBe(true);
    expect(presetsFor("trailer", "box").some((p) => p.id === "caja-frente")).toBe(true);
    expect(presetsFor("trailer", "full").some((p) => p.id === "caja-frente")).toBe(false);
    expect(defaultPlacement("trailer", "cab").position[2]).toBeGreaterThan(0.14);
    expect(defaultPlacement("trailer", "box").position[2]).toBeLessThan(0.14);
  });
});

describe("tráiler: parte rotulada", () => {
  it("arranca completo y sólo el tráiler guarda vehiclePart", () => {
    expect(initialMockupConfig("trailer").vehiclePart).toBe("full");
    expect(initialMockupConfig("car")).not.toHaveProperty("vehiclePart");
    expect(vehiclePartOf({ garment: "car" })).toBeUndefined();
    expect(vehiclePartOf({ garment: "trailer" })).toBe("full");
    expect(switchGarment(initialMockupConfig("trailer"), "car")).not.toHaveProperty("vehiclePart");
  });

  it("al pasar a cabina, los diseños de la caja vuelven a la cabina; los que se ven se quedan", () => {
    const base = initialMockupConfig("trailer");
    const onBox = { id: "a", name: "a", dataUrl: "x", aspect: 1, placement: defaultPlacement("trailer", "box") };
    const onCab = { id: "b", name: "b", dataUrl: "x", aspect: 1, placement: defaultPlacement("trailer", "cab") };
    const cfg = { ...base, layers: [onBox, onCab] };
    const cab = switchVehiclePart(cfg, "cab");
    expect(cab.vehiclePart).toBe("cab");
    expect(cab.layers[1].placement).toEqual(onCab.placement);
    expect(zInPart(cab.layers[0].placement.position[2], "cab")).toBe(true);
    expect(switchVehiclePart(cfg, "full")).toBe(cfg);
    expect(switchVehiclePart(initialMockupConfig("car"), "cab").vehiclePart).toBeUndefined();
  });

  it("los campos de color siguen a la parte", () => {
    expect(colorFieldsFor("trailer", "full").map((f) => f.part)).toEqual(["body", "mesh"]);
    expect(colorFieldsFor("trailer", "cab").map((f) => f.part)).toEqual(["body"]);
    expect(colorFieldsFor("trailer", "box").map((f) => f.part)).toEqual(["mesh"]);
  });

  it("nombres de archivo y cuerpo para el backend", () => {
    const d = new Date(2026, 9, 7);
    expect(mockupFilename("trailer", d, "all", "cab")).toBe("mockup-trailer-cabina-2026-10-07.png");
    expect(mockupFilename("car", d, "left")).toBe("mockup-carro-2026-10-07-lado-izquierdo.png");
    expect(mockupFilename("pickup", d, "back")).toBe("mockup-pickup-2026-10-07-atras.png");
    expect(mockupFilename("bicycle", d, "top")).toBe("mockup-bicicleta-2026-10-07-arriba.png");
    expect(mockupFilename("tshirt", d, "back")).toBe("mockup-playera-2026-10-07-espalda.png");
    const payload = buildMockupPayload({ image: { dataUrl: "d", width: 1, height: 1 }, config: { ...initialMockupConfig("trailer"), vehiclePart: "box", sizes: { general: { S: 1 } } } });
    expect(payload.garment).toBe("trailer");
    expect(payload.config.vehiclePart).toBe("box");
    expect(payload.config).not.toHaveProperty("sizes");
    const car = buildMockupPayload({ image: { dataUrl: "d", width: 1, height: 1 }, config: initialMockupConfig("car") });
    expect(car.config).not.toHaveProperty("vehiclePart");
  });

  it("las plantillas conservan la parte (completo si falta)", () => {
    const r = configFromTemplate({ garment: "trailer", config: { garment: "trailer", colors: {}, layers: [], vehiclePart: "box" } });
    expect(r.ok && r.config.vehiclePart).toBe("box");
    const d = configFromTemplate({ garment: "trailer", config: { garment: "trailer", colors: {}, layers: [] } });
    expect(d.ok && d.config.vehiclePart).toBe("full");
    const c = configFromTemplate({ garment: "car", config: { garment: "car", colors: {}, layers: [] } });
    expect(c.ok && c.config).not.toHaveProperty("vehiclePart");
  });
});
