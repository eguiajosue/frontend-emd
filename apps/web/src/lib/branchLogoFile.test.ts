// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkLogoFile, contrastWarning, LOGO_MAX_BYTES, LOGO_MAX_DIMENSION } from "./branchLogoFile";

/** jsdom no decodifica imágenes: el `Image` de mentira "carga" con las medidas que se le pidan. */
function stubImage(width: number, height: number, fail = false) {
  class FakeImage {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

const file = (type: string, bytes = 100, name = "logo") => new File([new Uint8Array(bytes)], name, { type });

// Sin `canvas` en jsdom: el muestreo de contraste se salta (se prueba aparte con píxeles).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkLogoFile", () => {
  it("acepta PNG, JPEG y WebP dentro de los límites", async () => {
    stubImage(1023, 258);
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      const result = await checkLogoFile(file(type), "onLight");
      expect(result).toMatchObject({ ok: true, width: 1023, height: 258 });
      if (result.ok) expect(result.dataUrl).toMatch(/^data:/);
    }
  });

  it("rechaza SVG (puede traer scripts) y cualquier otro tipo", async () => {
    stubImage(10, 10);
    const svg = await checkLogoFile(file("image/svg+xml"), "onLight");
    expect(svg).toEqual({ ok: false, error: expect.stringContaining("SVG") });
    const gif = await checkLogoFile(file("image/gif"), "onLight");
    expect(gif).toEqual({ ok: false, error: "El logo debe ser PNG, JPEG o WebP." });
    const pdf = await checkLogoFile(file("application/pdf"), "onLight");
    expect(pdf.ok).toBe(false);
  });

  it("rechaza más de 400 KB", async () => {
    stubImage(10, 10);
    const ok = await checkLogoFile(file("image/png", LOGO_MAX_BYTES), "onLight");
    expect(ok.ok).toBe(true);
    const grande = await checkLogoFile(file("image/png", LOGO_MAX_BYTES + 1), "onLight");
    expect(grande).toEqual({ ok: false, error: expect.stringContaining("máximo es 400 KB") });
  });

  it("rechaza más de 2000×2000 px (en cualquiera de los dos lados)", async () => {
    stubImage(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION);
    expect((await checkLogoFile(file("image/png"), "onLight")).ok).toBe(true);
    stubImage(LOGO_MAX_DIMENSION + 1, 100);
    expect(await checkLogoFile(file("image/png"), "onLight")).toEqual({
      ok: false,
      error: expect.stringContaining("2000×2000"),
    });
    stubImage(100, LOGO_MAX_DIMENSION + 1);
    expect((await checkLogoFile(file("image/png"), "onDark")).ok).toBe(false);
  });

  it("rechaza un archivo que no se puede decodificar", async () => {
    stubImage(0, 0, true);
    expect(await checkLogoFile(file("image/png"), "onLight")).toEqual({
      ok: false,
      error: expect.stringContaining("No se pudo leer la imagen"),
    });
  });
});

/** Píxeles RGBA de un cuadro uniforme. */
const pixels = (n: number, rgba: [number, number, number, number]) =>
  new Uint8ClampedArray(Array.from({ length: n }, () => rgba).flat());

describe("contrastWarning (avisos, no errores)", () => {
  it("avisa de una imagen casi toda transparente", () => {
    expect(contrastWarning(pixels(100, [0, 0, 0, 0]), "onLight")).toMatch(/transparente/);
  });

  it("avisa de un logo claro para fondos claros y de uno oscuro para fondos oscuros", () => {
    expect(contrastWarning(pixels(100, [255, 255, 255, 255]), "onLight")).toMatch(/muy claro/);
    expect(contrastWarning(pixels(100, [0, 0, 0, 255]), "onDark")).toMatch(/muy oscuro/);
  });

  it("no avisa con el logo correcto en cada variante", () => {
    expect(contrastWarning(pixels(100, [0, 0, 0, 255]), "onLight")).toBeNull();
    expect(contrastWarning(pixels(100, [255, 255, 255, 255]), "onDark")).toBeNull();
  });
});
