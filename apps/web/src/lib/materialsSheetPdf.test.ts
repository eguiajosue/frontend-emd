import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types";

const doc = {
  setFontSize: vi.fn(),
  text: vi.fn(),
  save: vi.fn(),
  addImage: vi.fn(),
  getImageProperties: vi.fn(() => ({ width: 1023, height: 258, fileType: "PNG" })),
  internal: { pageSize: { getWidth: () => 210 } },
};
const autoTable = vi.fn();
vi.mock("jspdf", () => ({
  default: function jsPDF() {
    return doc;
  },
}));
vi.mock("jspdf-autotable", () => ({ default: (...args: unknown[]) => autoTable(...args) }));

import { downloadMaterialsSheetPdf } from "./materialsSheetPdf";

const NEGRO = "data:image/png;base64,NEGRO";
const base = { id: 9, clientNameOverride: "Escuela Madero" } as Order;
const madero = { ...base, branch: { id: 1, name: "Punto Madero" } } as Order;

beforeEach(() => {
  Object.values(doc).forEach((fn) => typeof fn === "function" && "mockClear" in fn && (fn as ReturnType<typeof vi.fn>).mockClear());
  autoTable.mockClear();
});

describe("downloadMaterialsSheetPdf · logo de la sucursal", () => {
  it("incrusta el logo de FONDO CLARO arriba a la derecha, con su proporción", async () => {
    await downloadMaterialsSheetPdf(madero, [], { branchLogoOnLight: NEGRO });
    expect(doc.addImage).toHaveBeenCalledTimes(1);
    const [src, format, x, y, w, h] = doc.addImage.mock.calls[0] as unknown as [string, string, number, number, number, number];
    expect(src).toBe(NEGRO);
    expect(format).toBe("PNG");
    expect(w / h).toBeCloseTo(1023 / 258, 2);
    expect(h).toBeLessThanOrEqual(12);
    // Pegado al margen derecho (A4 = 210 mm, margen 14).
    expect(x + w).toBeCloseTo(196, 5);
    expect(y).toBe(12);
    expect(doc.text).toHaveBeenCalledWith("Sucursal: Punto Madero", 14, 44);
    expect(doc.save).toHaveBeenCalledWith("hoja-materiales-pedido-9.pdf");
  });

  it("sin logo cargado, el PDF sigue saliendo con el nombre de la sucursal", async () => {
    await downloadMaterialsSheetPdf(madero, []);
    expect(doc.addImage).not.toHaveBeenCalled();
    expect(doc.text).toHaveBeenCalledWith("Sucursal: Punto Madero", 14, 44);
  });

  it("un pedido de la matriz no lleva logo ni línea de sucursal", async () => {
    await downloadMaterialsSheetPdf(base, [], { branchLogoOnLight: NEGRO });
    expect(doc.addImage).not.toHaveBeenCalled();
    expect(doc.text).not.toHaveBeenCalledWith(expect.stringContaining("Sucursal"), expect.anything(), expect.anything());
    expect(autoTable.mock.calls[0][1]).toMatchObject({ startY: 44 });
  });

  it("un logo que jsPDF no puede leer no impide el PDF", async () => {
    doc.addImage.mockImplementationOnce(() => {
      throw new Error("formato");
    });
    await downloadMaterialsSheetPdf(madero, [], { branchLogoOnLight: NEGRO });
    expect(doc.save).toHaveBeenCalled();
  });
});
