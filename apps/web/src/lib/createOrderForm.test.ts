// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRepeatPrefill,
  buildTemplatePrefill,
  suggestTemplateName,
  describeOrderProducts,
  toRepeatMaterials,
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

  it("las horas de entrega cubren el día entero cada 15 minutos", () => {
    expect(DELIVERY_TIME_SLOTS).toHaveLength(96);
    expect(DELIVERY_TIME_SLOTS[0]).toBe("00:00");
    expect(DELIVERY_TIME_SLOTS.at(-1)).toBe("23:45");
    expect(DELIVERY_TIME_SLOTS).toEqual(expect.arrayContaining(["10:15", "05:30", "22:30"]));
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

describe("combineDateAndTime", () => {
  it("sin hora usa el fin de la jornada (18:00), no medianoche", async () => {
    const { combineDateAndTime } = await import("@/lib/format");
    expect(new Date(combineDateAndTime("2026-10-20")!).getHours()).toBe(18);
    expect(new Date(combineDateAndTime("2026-10-20", "09:15")!).getHours()).toBe(9);
    expect(combineDateAndTime("")).toBeUndefined();
  });
});

describe("buildRepeatPrefill", () => {
  it("copia el pedido (productos, ruta, descripción) y deja afuera Diseño y áreas inexistentes", () => {
    const prefill = buildRepeatPrefill({
      id: 41,
      requiresDesign: true,
      area: "diseno",
      productionArea: "impresiones",
      areaTasks: [{ area: "taller" }, { area: "impresiones" }, { area: "vieja" }],
      assignedUserId: 5,
      description: "Figuras para el festival",
      orderProducts: [
        { customName: " Figuras ", quantity: 20 },
        { customName: "figuras", quantity: 5 },
        { customName: "", quantity: 3 },
      ],
    });
    expect(prefill).toEqual({
      sourceOrderId: 41,
      requiresDesign: true,
      areas: ["impresiones", "taller"],
      assignedUserId: 5,
      description: "Figuras para el festival",
      products: [{ customName: "Figuras", quantity: 25 }],
    });
  });

  it("sin diseño, el área en la que arrancó cuenta como principal", () => {
    const prefill = buildRepeatPrefill({ id: 1, requiresDesign: false, area: "bordado", orderProducts: [] });
    expect(prefill.areas).toEqual(["bordado"]);
    expect(prefill.requiresDesign).toBe(false);
  });
});

describe("describeOrderProducts", () => {
  it("resume los primeros productos y cuenta el resto", () => {
    expect(
      describeOrderProducts([
        { customName: "Figuras", quantity: 20 },
        { customName: "Playeras", quantity: 10 },
        { customName: "Gorras", quantity: 5 },
      ])
    ).toBe("Figuras ×20 · Playeras ×10 · +1 más");
    expect(describeOrderProducts([])).toBe("Sin productos");
  });
});

describe("toRepeatMaterials", () => {
  it("usa el nombre del material si la línea no tiene descripción", () => {
    expect(
      toRepeatMaterials([
        { id: 3, materialId: 12, quantity: 4, description: " ", supplierId: null, material: { name: "Coroplast", unit: { name: "Hoja" } } },
      ])
    ).toEqual([
      { key: "material-3", materialId: 12, quantity: 4, description: "Coroplast", supplierId: undefined, unitName: "Hoja" },
    ]);
  });
});

describe("buildTemplatePrefill", () => {
  it("copia la plantilla, descarta áreas que ya no existen y arma los materiales", () => {
    const prefill = buildTemplatePrefill({
      requiresDesign: false,
      productionAreas: ["impresiones", "diseno", "impresiones", "vieja"],
      description: "Figuras",
      products: [{ customName: "Figuras", quantity: 12 }],
      materials: [{ id: 1, materialId: 12, quantity: 6, description: "Vinil", supplierId: 3 }],
    });
    expect(prefill).toEqual({
      requiresDesign: false,
      areas: ["impresiones"],
      description: "Figuras",
      products: [{ customName: "Figuras", quantity: 12 }],
      materials: [
        { key: "material-1", materialId: 12, quantity: 6, description: "Vinil", supplierId: 3, unitName: undefined },
      ],
    });
  });
});

describe("suggestTemplateName", () => {
  it("usa el primer producto y cuenta el resto", () => {
    expect(suggestTemplateName([{ customName: "Figuras" }])).toBe("Figuras");
    expect(suggestTemplateName([{ customName: "Figuras" }, { customName: "Lona" }])).toBe("Figuras + 1");
    expect(suggestTemplateName([])).toBe("");
  });
});
