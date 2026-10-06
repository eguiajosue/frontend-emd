import { describe, expect, it } from "vitest";
import { GarmentNotEnabledError } from "./garments";
import {
  buildTemplatePayload,
  cleanTemplateName,
  configFromTemplate,
  dataUrlBytes,
  suggestTemplateName,
  thumbnailFits,
  unsupportedGarmentMessage,
} from "./templates";
import { MAX_TEMPLATE_THUMBNAIL_BYTES, type MockupConfig } from "./types";

const layer = {
  id: "l1",
  name: "logo",
  dataUrl: "data:image/png;base64,AAA",
  aspect: 2,
  placement: { position: [0, 0.1, 0.2], normal: [0, 0, 1], scale: 0.2, rotation: 0.5 },
};

describe("aplicar plantilla", () => {
  it("devuelve la config con ids nuevos y colores completos", () => {
    const result = configFromTemplate({
      garment: "cap",
      config: { garment: "cap", colors: { body: "#FF0000" }, layers: [layer] } as unknown as MockupConfig,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.garment).toBe("cap");
    expect(result.config.colors).toEqual({ body: "#ff0000", mesh: "#ffffff", visor: "#1f2937" });
    expect(result.config.layers).toHaveLength(1);
    expect(result.config.layers[0]).toMatchObject({ name: "logo", aspect: 2, placement: layer.placement });
    expect(result.config.layers[0].id).not.toBe("l1");
  });

  it("descarta diseños dañados", () => {
    const result = configFromTemplate({
      config: {
        garment: "tshirt",
        colors: { body: "#ffffff" },
        layers: [layer, { ...layer, dataUrl: "http://x" }, { ...layer, placement: { position: [1, 2] } }, null],
      } as unknown as MockupConfig,
    });
    expect(result.ok && result.config.layers).toHaveLength(1);
  });

  it("una prenda que todavía no está habilitada da un mensaje claro", () => {
    const result = configFromTemplate({ garment: "hoodie", config: { garment: "hoodie", colors: { body: "#000000" }, layers: [] } });
    expect(result).toEqual({ ok: false, message: unsupportedGarmentMessage("hoodie") });
    expect(unsupportedGarmentMessage("hoodie")).toMatch(/sudadera, que todavía no está disponible/);
    expect(configFromTemplate({ garment: "zapato", config: {} }).ok).toBe(false);
  });
});

describe("guardar plantilla", () => {
  const config: MockupConfig = { garment: "tshirt", colors: { body: "#ffffff" }, layers: [layer as never] };

  it("nombre sugerido y limpio", () => {
    expect(suggestTemplateName(config)).toBe("Playera · logo");
    expect(suggestTemplateName({ ...config, layers: [] })).toBe("Playera");
    expect(cleanTemplateName("  Uniforme   escolar ")).toBe("Uniforme escolar");
    expect(cleanTemplateName("   ")).toBeNull();
    expect(cleanTemplateName("x".repeat(200))).toHaveLength(80);
  });

  it("la miniatura debe pesar ≤ 96 KB", () => {
    expect(MAX_TEMPLATE_THUMBNAIL_BYTES).toBe(96 * 1024);
    expect(dataUrlBytes("data:image/png;base64,QUJD")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,QUI=")).toBe(2);
    expect(thumbnailFits({ dataUrl: `data:image/jpeg;base64,${"A".repeat(1000)}` })).toBe(true);
    expect(thumbnailFits({ dataUrl: `data:image/jpeg;base64,${"A".repeat(140_000)}` })).toBe(false);
  });

  it("el cuerpo del POST lleva prenda, config y miniatura; sólo prendas habilitadas", () => {
    expect(buildTemplatePayload("Uniforme", config, { dataUrl: "data:image/jpeg;base64,T" })).toEqual({
      name: "Uniforme",
      garment: "tshirt",
      config,
      thumbnailDataUrl: "data:image/jpeg;base64,T",
    });
    expect(() => buildTemplatePayload("x", { ...config, garment: "dress-shirt" }, { dataUrl: "" })).toThrow(
      GarmentNotEnabledError
    );
  });
});
