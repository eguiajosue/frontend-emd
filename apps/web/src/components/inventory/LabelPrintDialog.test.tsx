import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelPrintDialog } from "./LabelPrintDialog";
import type { InventoryItem } from "@/types";

const printHtmlDocument = vi.fn();
vi.mock("@/lib/barcode/printFrame", () => ({
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

const hilo: InventoryItem = {
  id: 7,
  area: "bordado",
  name: "Hilo poliéster rojo 1147",
  unit: "cono",
  quantity: 10,
  stockStatus: "ok",
  barcode: "EMD-000007",
};
const tinta: InventoryItem = {
  id: 9,
  area: "impresiones",
  name: "Tinta cyan",
  unit: "litro",
  quantity: 2,
  stockStatus: "ok",
  barcode: "7501234567890",
};

beforeEach(() => printHtmlDocument.mockReset().mockResolvedValue(undefined));

describe("LabelPrintDialog", () => {
  it("la vista previa muestra empresa, artículo, departamento, barras y el código legible", async () => {
    render(<LabelPrintDialog items={[hilo]} onClose={vi.fn()} />);
    const preview = await screen.findByTestId("label-preview");
    expect(preview).toHaveAccessibleName(/Hilo poliéster rojo 1147, código EMD-000007/);
    expect(within(preview).getByText("Propiedad de: EMD HUB")).toBeInTheDocument();
    expect(within(preview).getByText("Hilo poliéster rojo 1147")).toBeInTheDocument();
    expect(within(preview).getByText("BORDADO")).toBeInTheDocument();
    expect(within(preview).getByText("EMD-000007")).toBeInTheDocument();
    expect(preview.querySelector("svg path")?.getAttribute("d")).toMatch(/^M0 0h2v100h-2z/);
  });

  it("imprime el lote con N copias de cada una", async () => {
    render(<LabelPrintDialog items={[hilo, tinta]} onClose={vi.fn()} />);
    expect(await screen.findAllByTestId("label-preview")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Imprimir 2 etiquetas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Una copia más" }));
    await userEvent.click(screen.getByRole("button", { name: "Una copia más" }));
    expect(screen.getByText("6 etiquetas en total")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const html: string = printHtmlDocument.mock.calls[0][0];
    expect(html).toContain("@page{size:80mm 35mm;margin:0}");
    expect(html.match(/class="page"/g)).toHaveLength(6);
    expect(html).toContain("7501234567890");
    expect(html).toContain("Tinta cyan");
  });

  it("sin artículos no se abre", () => {
    render(<LabelPrintDialog items={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
