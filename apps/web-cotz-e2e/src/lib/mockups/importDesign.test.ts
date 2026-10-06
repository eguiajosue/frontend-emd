/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesignImportError,
  designFromDataUrl,
  importDesignFile,
  importDesignFromUrl,
  isDesignFile,
  makeLogoThumbnail,
} from "./importDesign";
import { LOGO_THUMBNAIL_PX, MAX_DESIGN_PX } from "./types";

let nextSize = { width: 2048, height: 1024 };
let failDecode = false;
const loadedSrcs: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "";
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  set src(value: string) {
    loadedSrcs.push(value);
    setTimeout(() => {
      if (failDecode) {
        this.onerror?.();
        return;
      }
      this.naturalWidth = nextSize.width;
      this.naturalHeight = nextSize.height;
      this.onload?.();
    }, 0);
  }
}

let ctx: {
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
};
let canvasSizes: { width: number; height: number }[];
const toDataURL = vi.fn();

beforeEach(() => {
  nextSize = { width: 2048, height: 1024 };
  failDecode = false;
  loadedSrcs.length = 0;
  canvasSizes = [];
  vi.stubGlobal("Image", FakeImage);
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    canvasSizes.push({ width: this.width, height: this.height });
    return ctx as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"]);
  toDataURL.mockReset();
  toDataURL.mockReturnValue("data:image/png;base64,AAAA");
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = (name: string, type: string, content = "x") => new File([content], name, { type });

describe("importDesignFile", () => {
  it("reduce un PNG grande a MAX_DESIGN_PX por su lado mayor, en PNG y sin rellenar fondo", async () => {
    const result = await importDesignFile(file("logo-cliente.png", "image/png"));
    expect(canvasSizes[0]).toEqual({ width: MAX_DESIGN_PX, height: MAX_DESIGN_PX / 2 });
    expect(result).toEqual({ name: "logo-cliente", dataUrl: "data:image/png;base64,AAAA", aspect: 2 });
    expect(toDataURL).toHaveBeenCalledWith("image/png");
    // La transparencia se conserva: se limpia, nunca se pinta un fondo.
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("no agranda una imagen chica", async () => {
    nextSize = { width: 300, height: 600 };
    const result = await importDesignFile(file("chico.jpg", "image/jpeg"));
    expect(canvasSizes[0]).toEqual({ width: 300, height: 600 });
    expect(result.aspect).toBe(0.5);
  });

  it("acepta WEBP", async () => {
    nextSize = { width: 800, height: 800 };
    await expect(importDesignFile(file("arte.webp", "image/webp"))).resolves.toMatchObject({ aspect: 1 });
  });

  it("rasteriza un SVG al tamaño máximo (es vectorial)", async () => {
    nextSize = { width: 100, height: 50 };
    const result = await importDesignFile(file("vector.svg", "image/svg+xml", "<svg/>"));
    expect(canvasSizes[0]).toEqual({ width: MAX_DESIGN_PX, height: MAX_DESIGN_PX / 2 });
    expect(result.name).toBe("vector");
  });

  it("un SVG sin tamaño intrínseco usa su viewBox", async () => {
    nextSize = { width: 0, height: 0 };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"></svg>';
    const result = await importDesignFile(file("sin-tamano.svg", "", svg));
    expect(canvasSizes[0]).toEqual({ width: MAX_DESIGN_PX, height: Math.round(MAX_DESIGN_PX / 3) });
    expect(result.aspect).toBeCloseTo(3, 1);
  });

  it("rechaza tipos que no son diseño con un mensaje en español", async () => {
    await expect(importDesignFile(file("hoja.pdf", "application/pdf"))).rejects.toThrow(
      "«hoja.pdf» no es un diseño compatible. Usa PNG, JPG, SVG o WEBP."
    );
    await expect(importDesignFile(file("hoja.pdf", "application/pdf"))).rejects.toBeInstanceOf(DesignImportError);
  });

  it("rechaza un archivo que el navegador no puede leer", async () => {
    failDecode = true;
    await expect(importDesignFile(file("roto.png", "image/png"))).rejects.toThrow(
      "No se pudo leer «roto.png». Revisa que la imagen no esté dañada."
    );
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("isDesignFile", () => {
  it("reconoce por tipo o, si no viene, por extensión", () => {
    expect(isDesignFile(file("a.png", "image/png"))).toBe(true);
    expect(isDesignFile(file("a.svg", ""))).toBe(true);
    expect(isDesignFile(file("a.gif", "image/gif"))).toBe(false);
    expect(isDesignFile(file("a.txt", ""))).toBe(false);
  });
});

describe("biblioteca: banderas, logos y miniaturas", () => {
  it("una bandera se baja de /flags y se rasteriza como cualquier SVG", async () => {
    nextSize = { width: 640, height: 480 };
    const fetchMock = vi.fn(async () => new Response("<svg/>", { status: 200, headers: { "content-type": "image/svg+xml" } }));
    vi.stubGlobal("fetch", fetchMock);
    const design = await importDesignFromUrl("/flags/4x3/mx.svg", "Bandera de México");
    expect(fetchMock).toHaveBeenCalledWith("/flags/4x3/mx.svg");
    expect(design).toEqual({ name: "Bandera de México", dataUrl: "data:image/png;base64,AAAA", aspect: 4 / 3 });
    // SVG: se lleva al máximo por su lado mayor.
    expect(canvasSizes.at(-1)).toEqual({ width: MAX_DESIGN_PX, height: 768 });
  });

  it("si la bandera no baja, el error es claro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(importDesignFromUrl("/flags/4x3/zz.svg", "Bandera de Nada")).rejects.toThrow(
      "No se pudo cargar «Bandera de Nada»."
    );
  });

  it("un logo ya reducido sólo se mide (no se vuelve a codificar)", async () => {
    nextSize = { width: 300, height: 100 };
    const design = await designFromDataUrl("Colegio", "data:image/png;base64,LOGO");
    expect(design).toEqual({ name: "Colegio", dataUrl: "data:image/png;base64,LOGO", aspect: 3 });
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it("miniatura de logo: ≤ 160 px y se achica hasta pesar ≤ 24 KB", async () => {
    nextSize = { width: 1024, height: 512 };
    expect(await makeLogoThumbnail("data:image/png;base64,LOGO")).toBe("data:image/png;base64,AAAA");
    expect(canvasSizes.at(-1)).toEqual({ width: LOGO_THUMBNAIL_PX, height: 80 });

    const heavy = `data:image/png;base64,${"A".repeat(40_000)}`;
    toDataURL.mockReturnValueOnce(heavy).mockReturnValueOnce("data:image/png;base64,BBBB");
    canvasSizes = [];
    expect(await makeLogoThumbnail("data:image/png;base64,LOGO")).toBe("data:image/png;base64,BBBB");
    expect(canvasSizes.map((c) => c.width)).toEqual([160, 128]);

    toDataURL.mockReturnValue(heavy);
    await expect(makeLogoThumbnail("data:image/png;base64,LOGO")).rejects.toBeInstanceOf(DesignImportError);
  });
});
