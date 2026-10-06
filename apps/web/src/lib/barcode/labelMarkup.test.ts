import { describe, expect, it } from "vitest";
import { barsToPath, encodeCode128 } from "./code128";
import { buildLabelPrintDocument, clampCopies, escapeHtml, renderLabelHtml } from "./labelMarkup";

describe("Code 128", () => {
  it("codifica con jsbarcode: EMD-000123 = 123 módulos, empieza y termina en barra", async () => {
    const { bits, modules } = await encodeCode128("EMD-000123");
    expect(modules).toBe(123);
    expect(bits).toMatch(/^1[01]+1$/);
  });

  it("barsToPath agrupa las rachas de barras", () => {
    expect(barsToPath("1101001", 10)).toBe("M0 0h2v10h-2zM3 0h1v10h-1zM6 0h1v10h-1z");
    expect(barsToPath("000")).toBe("");
  });
});

describe("renderLabelHtml", () => {
  it("lleva empresa, artículo, departamento, barras y código legible", async () => {
    const { bits } = await encodeCode128("EMD-000123");
    const html = renderLabelHtml({ name: "Hilo poliéster rojo", areaLabel: "Bordado", code: "EMD-000123", bits });
    expect(html).toContain("Propiedad de: EMD HUB");
    expect(html).toContain("Hilo poliéster rojo");
    expect(html).toContain("BORDADO");
    expect(html).toContain(">EMD-000123</p>");
    expect(html).toContain('viewBox="0 0 123 100"');
    expect(html).toContain("width:80mm;height:35mm");
  });

  it("escapa el texto (los nombres los escribe la gente)", () => {
    const html = renderLabelHtml({ name: '<img src=x onerror="alert(1)">', areaLabel: "DTF", code: "A&B", bits: "101" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("A&amp;B");
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});

describe("buildLabelPrintDocument", () => {
  it("página del tamaño de la etiqueta, sin márgenes, una por hoja y N copias", () => {
    const doc = buildLabelPrintDocument(["<i>A</i>", "<i>B</i>"], { copies: 3 });
    expect(doc).toContain("@page{size:80mm 35mm;margin:0}");
    expect(doc.match(/class="page"/g)).toHaveLength(6);
    expect(doc.indexOf("<i>A</i>")).toBeLessThan(doc.indexOf("<i>B</i>"));
    expect(doc).toContain("break-after:page");
  });

  it("las copias van de 1 a 99", () => {
    expect(clampCopies(0)).toBe(1);
    expect(clampCopies(2.7)).toBe(2);
    expect(clampCopies(500)).toBe(99);
    expect(clampCopies(NaN)).toBe(1);
  });
});
