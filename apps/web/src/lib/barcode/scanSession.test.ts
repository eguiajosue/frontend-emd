import { describe, expect, it } from "vitest";
import { classifyScanError, oppositeMovement, parseScanQuantity, pushLogEntry, scanDelta, type ScanLogEntry } from "./scanSession";

describe("scanSession", () => {
  it("deshacer usa el movimiento contrario", () => {
    expect(oppositeMovement("ENTRADA")).toBe("SALIDA");
    expect(oppositeMovement("SALIDA")).toBe("ENTRADA");
    expect(scanDelta("ENTRADA", 2)).toBe(2);
    expect(scanDelta("SALIDA", 2)).toBe(-2);
  });

  it("clasifica las respuestas del backend", () => {
    expect(classifyScanError({ status: 404, message: "No hay ningún artículo con el código X" })).toBe("unknown");
    expect(classifyScanError({ status: 400, message: "Stock insuficiente: hay 0 cono" })).toBe("stock");
    expect(classifyScanError({ status: 400, message: "Código de barras inválido: ñ" })).toBe("invalid");
    expect(classifyScanError({ status: 500, message: "x" })).toBe("other");
    expect(classifyScanError(undefined)).toBe("other");
  });

  it("cantidad por escaneo: positiva, con punto o coma decimal", () => {
    expect(parseScanQuantity("1")).toBe(1);
    expect(parseScanQuantity("2,5")).toBe(2.5);
    expect(parseScanQuantity("0")).toBeNull();
    expect(parseScanQuantity("")).toBeNull();
    expect(parseScanQuantity("abc")).toBeNull();
  });

  it("el registro guarda lo más reciente primero y con tope", () => {
    const entry = (id: number) => ({ id }) as ScanLogEntry;
    let log: ScanLogEntry[] = [];
    for (let i = 1; i <= 5; i++) log = pushLogEntry(log, entry(i), 3);
    expect(log.map((e) => e.id)).toEqual([5, 4, 3]);
  });
});
