// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DELIVERY_TIME_SLOTS,
  LAST_DEFAULTS_KEY,
  buildOrderSummary,
  clampName,
  mergeAreaSelection,
  presetDate,
  presetForDate,
  readLastOrderDefaults,
} from "./createOrderForm";

const TODAY = new Date(2026, 9, 3); // 3 oct 2026

describe("createOrderForm", () => {
  beforeEach(() => window.localStorage.clear());

  it("conserva el orden de elección de las áreas (la primera es la principal)", () => {
    expect(mergeAreaSelection([], ["dtf"])).toEqual(["dtf"]);
    // ToggleGroup devuelve en orden de render; se respeta el de elección.
    expect(mergeAreaSelection(["dtf"], ["taller", "dtf"])).toEqual(["dtf", "taller"]);
    // Quitar la principal: la siguiente pasa a serlo.
    expect(mergeAreaSelection(["dtf", "taller"], ["taller"])).toEqual(["taller"]);
  });

  it("reconoce los atajos de fecha y deja las fechas a medida como null", () => {
    expect(presetDate(1, TODAY)).toBe("2026-10-04");
    expect(presetForDate("2026-10-03", TODAY)).toBe("today");
    expect(presetForDate("2026-10-10", TODAY)).toBe("in7");
    expect(presetForDate("2026-10-20", TODAY)).toBeNull();
    expect(presetForDate("", TODAY)).toBeNull();
  });

  it("las franjas de hora van de 06:00 a 22:00 cada 30 minutos", () => {
    expect(DELIVERY_TIME_SLOTS[0]).toBe("06:00");
    expect(DELIVERY_TIME_SLOTS.at(-1)).toBe("22:00");
    expect(DELIVERY_TIME_SLOTS).toContain("18:30");
  });

  it("sanea los defaults recordados", () => {
    window.localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify({ requiresDesign: false, area: "bordado" }));
    expect(readLastOrderDefaults()).toEqual({ requiresDesign: false, area: "bordado" });
    window.localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify({ requiresDesign: true, area: "diseno" }));
    expect(readLastOrderDefaults()).toEqual({ requiresDesign: true, area: undefined });
    window.localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify({ area: "taller" }));
    expect(readLastOrderDefaults()).toBeNull();
    window.localStorage.setItem(LAST_DEFAULTS_KEY, "{roto");
    expect(readLastOrderDefaults()).toBeNull();
  });

  it("arma el resumen vivo del footer", () => {
    expect(
      buildOrderSummary({
        clientLabel: "Laura Méndez",
        requiresDesign: true,
        designerLabel: "Cualquier diseñador",
        areaLabels: [],
        productCount: 2,
        unitCount: 51,
        deliveryDate: "2026-10-20",
        deliveryTime: "18:00",
      })
    ).toEqual(["Laura Méndez", "Con diseño (Cualquier diseñador)", "2 productos, 51 u.", "Entrega mar 20 oct, 18:00"]);
    expect(
      buildOrderSummary({
        clientLabel: "",
        requiresDesign: false,
        areaLabels: ["DTF", "Taller"],
        productCount: 1,
        unitCount: 5,
        deliveryDate: "",
        deliveryTime: "",
      })
    ).toEqual(["Directo a DTF + 1", "1 producto, 5 u."]);
  });

  it("recorta los nombres libres al largo que acepta el backend", () => {
    expect(clampName("  hola  ")).toBe("hola");
    expect(clampName("x".repeat(250))).toHaveLength(200);
  });
});
