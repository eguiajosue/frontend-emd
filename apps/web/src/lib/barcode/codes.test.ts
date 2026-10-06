import { describe, expect, it } from "vitest";
import {
  barcodePatchValue,
  defaultBarcode,
  isBarcodeError,
  itemBarcode,
  normalizeScannedCode,
  validateCustomBarcode,
} from "./codes";

describe("códigos de barras", () => {
  it("el automático es EMD- + id con ceros", () => {
    expect(defaultBarcode(1)).toBe("EMD-000001");
    expect(defaultBarcode(123)).toBe("EMD-000123");
    expect(defaultBarcode(1234567)).toBe("EMD-1234567");
    expect(itemBarcode({ id: 7, barcode: null })).toBe("EMD-000007");
    expect(itemBarcode({ id: 7, barcode: "7501234567890" })).toBe("7501234567890");
  });

  it("valida como el backend: 3–64 ASCII imprimible, recortado", () => {
    expect(validateCustomBarcode("  7501234567890 ")).toEqual({ ok: true, code: "7501234567890" });
    expect(validateCustomBarcode("AB")).toMatchObject({ ok: false });
    expect(validateCustomBarcode("X".repeat(65))).toMatchObject({ ok: false });
    expect(validateCustomBarcode("Árbol-1")).toMatchObject({ ok: false });
    expect(validateCustomBarcode("A B/C#1")).toEqual({ ok: true, code: "A B/C#1" });
  });

  it("EMD-<número> está reservado salvo el del propio artículo", () => {
    expect(validateCustomBarcode("EMD-000999")).toMatchObject({ ok: false });
    expect(validateCustomBarcode("EMD-000999", 5)).toMatchObject({ ok: false });
    expect(validateCustomBarcode("EMD-000005", 5)).toEqual({ ok: true, code: "EMD-000005" });
    expect(validateCustomBarcode("EMD-ABC")).toEqual({ ok: true, code: "EMD-ABC" });
  });

  it("limpia lo que entrega el lector", () => {
    expect(normalizeScannedCode("\u0002EMD-000001\r\n")).toBe("EMD-000001");
    expect(normalizeScannedCode("  12 ")).toBeNull();
    expect(normalizeScannedCode("ñandú")).toBeNull();
  });

  it("PATCH: sin cambio no se manda; vacío o el automático = null", () => {
    const item = { id: 3, barcode: "EMD-000003" };
    expect(barcodePatchValue("EMD-000003", item)).toBeUndefined();
    expect(barcodePatchValue("", item)).toBeNull();
    expect(barcodePatchValue(" 750123 ", item)).toBe("750123");
    const custom = { id: 3, barcode: "750123" };
    expect(barcodePatchValue("EMD-000003", custom)).toBeNull();
    expect(barcodePatchValue("", custom)).toBeNull();
    // Alta: vacío = automático (no se manda).
    expect(barcodePatchValue("", null)).toBeUndefined();
    expect(barcodePatchValue("ABC", null)).toBe("ABC");
  });

  it("reconoce los errores del backend que son del campo código", () => {
    expect(isBarcodeError({ status: 409, message: "Ese código ya está asignado a Hilo rojo" })).toBe(true);
    expect(isBarcodeError({ status: 409, message: "Ya hay un artículo con ese código (SKU) en este departamento" })).toBe(false);
    expect(isBarcodeError({ status: 400, message: "El código de barras debe tener entre 3 y 64 caracteres" })).toBe(true);
    expect(
      isBarcodeError({ status: 400, message: "Los códigos EMD-<número> los asigna el sistema; deja el campo vacío" })
    ).toBe(true);
    expect(isBarcodeError({ status: 400, message: "El nombre es requerido" })).toBe(false);
    expect(isBarcodeError(null)).toBe(false);
  });
});
