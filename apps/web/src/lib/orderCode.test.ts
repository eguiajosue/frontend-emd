import { describe, expect, it } from "vitest";
import { formatOrderCode, matchesOrderCode, parseOrderCode } from "./orderCode";

describe("código de pedido", () => {
  it("formatea con prefijo EMD-P y 4 dígitos", () => {
    expect(formatOrderCode(42)).toBe("EMD-P0042");
    expect(formatOrderCode(12345)).toBe("EMD-P12345");
  });

  it("entiende el código escrito de varias formas", () => {
    for (const text of ["EMD-P0042", "emd-p42", "EMD_P0042", "emd p 42", "P42", "p0042", "#42", "42"]) {
      expect(parseOrderCode(text)).toBe(42);
    }
    expect(parseOrderCode("pedido 42")).toBeNull();
    expect(parseOrderCode("EMD-P")).toBeNull();
    expect(parseOrderCode("0")).toBeNull();
  });

  it("busca por código exacto o prefijo del código", () => {
    expect(matchesOrderCode("EMD-P0042", 42)).toBe(true);
    expect(matchesOrderCode("emd-p00", 42)).toBe(true);
    expect(matchesOrderCode("43", 42)).toBe(false);
    expect(matchesOrderCode("", 42)).toBe(false);
  });
});
