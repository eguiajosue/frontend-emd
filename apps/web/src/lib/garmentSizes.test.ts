import { describe, expect, it } from "vitest";
import {
  activeFits,
  formatSizeBreakdown,
  isGarmentName,
  parseSizeBreakdown,
  setSizeQuantity,
  sizeBreakdownTotal,
  sizeTableRows,
} from "./garmentSizes";

describe("garmentSizes", () => {
  it("parsea descartando datos inválidos y vacíos", () => {
    expect(parseSizeBreakdown(null)).toBeNull();
    expect(parseSizeBreakdown("x")).toBeNull();
    expect(
      parseSizeBreakdown({ general: { S: 5, M: 0, Q: 2, L: -1, XL: 1.5 }, nino: { S: 1 }, mujer: {} })
    ).toEqual({ general: { S: 5 } });
  });

  it("suma totales de varios cortes", () => {
    expect(sizeBreakdownTotal({ general: { M: 5 }, mujer: { S: 3 } })).toBe(8);
    expect(sizeBreakdownTotal(null)).toBe(0);
  });

  it("formatea el resumen", () => {
    expect(formatSizeBreakdown({ general: { S: 5, M: 2, L: 3 } })).toBe("General: 5 S · 2 M · 3 L — 10 pzas");
    expect(formatSizeBreakdown({ general: { M: 1 }, youth: { XS: 2 } })).toBe(
      "General: 1 M | Youth: 2 XS — 3 pzas"
    );
    expect(formatSizeBreakdown(null)).toBe("");
  });

  it("setSizeQuantity pone y borra casillas sin mutar", () => {
    const a = { general: { S: 1 } };
    const b = setSizeQuantity(a, "general", "M", 4);
    expect(b.general).toEqual({ S: 1, M: 4 });
    expect(a.general).toEqual({ S: 1 });
    expect(setSizeQuantity(b, "general", "M", undefined).general).toEqual({ S: 1 });
  });

  it("detecta prendas por nombre", () => {
    expect(isGarmentName("Playeras negras")).toBe(true);
    expect(isGarmentName("Sudadera con capucha")).toBe(true);
    expect(isGarmentName("Lona 2x1")).toBe(false);
  });

  it("arma la tabla de la lámina con sólo tallas usadas", () => {
    const t = sizeTableRows({ general: { S: 5, L: 1 }, mujer: { S: 3 } });
    expect(activeFits({ general: { S: 5 } })).toEqual(["general"]);
    expect(t.sizes).toEqual(["S", "L"]);
    expect(t.rows.map((r) => r.cells)).toEqual([
      [5, 1],
      [3, 0],
    ]);
    expect(t.total).toBe(9);
  });
});
