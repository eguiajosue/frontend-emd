/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeImageFile,
  isAllowedUploadMime,
  UPLOAD_FILE_MAX_BYTES,
} from "./fileInput";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("normalizeImageFile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() })
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: BlobCallback) => {
        callback(new Blob(["contenido-comprimido"], { type: "image/jpeg" }));
      }
    );
  });

  it("deja pasar un PDF sin tocarlo", async () => {
    const pdf = makeFile("hoja.pdf", "application/pdf", 1024);
    const result = await normalizeImageFile(pdf);
    expect(result).toBe(pdf);
  });

  it("deja pasar un JPEG ya válido y liviano sin recomprimir", async () => {
    const jpeg = makeFile("foto.jpg", "image/jpeg", 1024);
    const result = await normalizeImageFile(jpeg);
    expect(result).toBe(jpeg);
  });

  it("convierte un HEIC de la cámara de iOS a JPEG dentro del límite", async () => {
    // Las fotos HEIC de iOS suelen pesar más que el límite de 5MB.
    const heic = makeFile("IMG_0001.HEIC", "image/heic", UPLOAD_FILE_MAX_BYTES + 1_000_000);
    const result = await normalizeImageFile(heic);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("image/jpeg");
    expect(isAllowedUploadMime(result!.type)).toBe(true);
  });

  it("recomprime un JPEG que supera el límite de tamaño", async () => {
    const jpegPesado = makeFile("foto.jpg", "image/jpeg", UPLOAD_FILE_MAX_BYTES + 1_000_000);
    const result = await normalizeImageFile(jpegPesado);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("image/jpeg");
  });

  it("devuelve null si el navegador no puede decodificar el archivo", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("formato no soportado"))
    );
    const heic = makeFile("IMG_0002.HEIC", "image/heic", 2_000_000);
    const result = await normalizeImageFile(heic);
    expect(result).toBeNull();
  });
});
