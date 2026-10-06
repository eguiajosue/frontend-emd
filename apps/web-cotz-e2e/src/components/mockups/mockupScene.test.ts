import { describe, expect, it, vi } from "vitest";
import { MockupScene } from "./mockupScene";

/**
 * Si la prenda nueva no carga (p. ej. falla la descarga del GLB), la escena
 * sigue mostrando la anterior. Exportar en ese estado guardaría la imagen de
 * una prenda con la configuración de otra: debe fallar con un mensaje claro.
 *
 * Se llama al método con un `this` mínimo: el render real necesita WebGL.
 */
function fakeScene(currentGarment: "tshirt" | "cap", configGarment: "tshirt" | "cap") {
  return {
    disposed: false,
    whenReady: vi.fn().mockResolvedValue(undefined),
    current: { garment: currentGarment },
    config: { garment: configGarment, colors: { body: "#ffffff" }, layers: [] },
    rebuildDirtyDecals: vi.fn(),
    // exportSheet y exportThumbnail comparten este método (privado).
    exportComposite: (MockupScene.prototype as unknown as { exportComposite: unknown }).exportComposite,
  };
}

describe("MockupScene.exportSheet", () => {
  it("no exporta si la prenda mostrada no es la de la configuración", async () => {
    const scene = fakeScene("cap", "tshirt");
    await expect(MockupScene.prototype.exportSheet.call(scene as unknown as MockupScene)).rejects.toThrow(/^El 3D/);
    expect(scene.rebuildDirtyDecals).not.toHaveBeenCalled();
  });

  it("no exporta sin prenda cargada", async () => {
    const scene = { ...fakeScene("tshirt", "tshirt"), current: null };
    await expect(MockupScene.prototype.exportSheet.call(scene as unknown as MockupScene)).rejects.toThrow(/^El 3D/);
  });
});

describe("MockupScene.exportThumbnail", () => {
  it("tiene la misma guarda: sin la prenda de la config no hay miniatura", async () => {
    const scene = fakeScene("cap", "tshirt");
    await expect(MockupScene.prototype.exportThumbnail.call(scene as unknown as MockupScene)).rejects.toThrow(/^El 3D/);
  });
});
