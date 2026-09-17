import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderMaterialsSection } from "./OrderMaterialsSection";
import type { Order, OrderMaterialItem } from "@/types";

const removeMutateAsync = vi.fn();
let items: OrderMaterialItem[] = [];
let isLoading = false;
let isError = false;

vi.mock("@/hooks/useOrderMaterials", () => ({
  useOrderMaterials: () => ({
    items,
    isLoading,
    isError,
    remove: { mutateAsync: removeMutateAsync, isPending: false },
  }),
}));

let canManageOperations = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageOperations }),
}));

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  CATALOG_STALE_TIME: 5 * 60_000,
}));

const downloadMock = vi.fn();
vi.mock("@/lib/materialsSheetPdf", () => ({
  downloadMaterialsSheetPdf: (...args: unknown[]) => downloadMock(...args),
}));

const order: Order = {
  id: 7,
  description: "Letrero luminoso",
  statusId: 1,
  creationDate: "2026-09-01T00:00:00.000Z",
} as Order;

beforeEach(() => {
  items = [];
  isLoading = false;
  isError = false;
  canManageOperations = true;
  removeMutateAsync.mockReset();
  removeMutateAsync.mockResolvedValue({ success: true });
  downloadMock.mockReset();
});

describe("OrderMaterialsSection", () => {
  it("muestra el estado vacío cuando no hay materiales cargados", () => {
    render(<OrderMaterialsSection order={order} />);
    expect(screen.getByText("Todavía no se cargó ningún material.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descargar PDF/i })).not.toBeInTheDocument();
  });

  it("no muestra nada si el endpoint todavía no está disponible (isError)", () => {
    isError = true;
    const { container } = render(<OrderMaterialsSection order={order} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista las líneas cargadas con proveedor y ubicación en vivo", () => {
    items = [
      {
        id: 1,
        orderId: 7,
        materialId: 1,
        quantity: 4,
        description: "Hoja de PVC de 6mm",
        supplierId: 10,
        supplier: { id: 10, name: "Plásticos del Norte", location: "nacional" },
      },
    ];
    render(<OrderMaterialsSection order={order} />);

    expect(screen.getByText(/Hoja de PVC de 6mm/)).toBeInTheDocument();
    expect(screen.getByText("4×")).toBeInTheDocument();
    expect(screen.getByText("Plásticos del Norte")).toBeInTheDocument();
    expect(screen.getByText("Nacional")).toBeInTheDocument();
  });

  it("muestra la unidad del material", () => {
    items = [
      {
        id: 1,
        orderId: 7,
        materialId: 1,
        quantity: 4,
        description: "Hoja de PVC de 6mm",
        material: { id: 1, name: "PVC", unit: { name: "Hoja" } },
      },
    ];
    render(<OrderMaterialsSection order={order} />);

    expect(screen.getByText("(Hoja)")).toBeInTheDocument();
  });

  it("oculta agregar/editar/quitar cuando el usuario no puede administrar operaciones", () => {
    canManageOperations = false;
    items = [
      {
        id: 1,
        orderId: 7,
        materialId: 1,
        quantity: 4,
        description: "Hoja de PVC de 6mm",
      },
    ];
    render(<OrderMaterialsSection order={order} />);

    expect(screen.queryByRole("button", { name: /Agregar material/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Quitar")).not.toBeInTheDocument();
  });

  it("pide confirmación antes de quitar una línea y llama a remove al confirmar", async () => {
    items = [
      {
        id: 1,
        orderId: 7,
        materialId: 1,
        quantity: 4,
        description: "Hoja de PVC de 6mm",
      },
    ];
    render(<OrderMaterialsSection order={order} />);

    await userEvent.click(screen.getByTitle("Quitar"));
    await userEvent.click(await screen.findByRole("button", { name: /^Eliminar$/i }));

    expect(removeMutateAsync).toHaveBeenCalledWith(1);
  });

  it("descarga el PDF con los materiales ya cargados", async () => {
    items = [
      {
        id: 1,
        orderId: 7,
        materialId: 1,
        quantity: 4,
        description: "Hoja de PVC de 6mm",
      },
    ];
    render(<OrderMaterialsSection order={order} />);

    await userEvent.click(screen.getByRole("button", { name: /Descargar PDF/i }));

    expect(downloadMock).toHaveBeenCalledWith(order, items);
  });
});
