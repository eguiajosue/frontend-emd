import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderMaterialDialog } from "./OrderMaterialDialog";
import type { Material, OrderMaterialItem, Supplier } from "@/types";

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();

vi.mock("@/hooks/useOrderMaterials", () => ({
  useOrderMaterials: () => ({
    create: { mutateAsync: createMutateAsync },
    update: { mutateAsync: updateMutateAsync },
  }),
}));

const materials: Material[] = [
  {
    id: 1,
    name: "PVC",
    measure: "6mm",
    color: "Blanco",
    areas: [],
    supplierId: 10,
  } as Material,
  {
    id: 2,
    name: "Acrílico",
    measure: "3mm",
    areas: [],
  } as Material,
];

const suppliers: Supplier[] = [
  { id: 10, name: "Plásticos del Norte", location: "nacional" } as Supplier,
  { id: 11, name: "Importadora ACME", location: "internacional" } as Supplier,
];

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: (entity: string) => ({
    data: entity === "materials" ? materials : suppliers,
  }),
  CATALOG_STALE_TIME: 5 * 60_000,
}));

beforeEach(() => {
  createMutateAsync.mockReset();
  createMutateAsync.mockResolvedValue({ id: 1 });
  updateMutateAsync.mockReset();
  updateMutateAsync.mockResolvedValue({ id: 1 });
});

describe("OrderMaterialDialog", () => {
  it("no deja agregar sin elegir un material", async () => {
    render(<OrderMaterialDialog open onClose={() => {}} orderId={1} />);

    await userEvent.click(screen.getByRole("button", { name: /^Agregar$/i }));

    expect(await screen.findByText("Elegí un material")).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it("autocompleta la descripción y el proveedor preferido al elegir un material", async () => {
    render(<OrderMaterialDialog open onClose={() => {}} orderId={1} />);

    await userEvent.click(screen.getByLabelText(/^Material/i));
    await userEvent.click(await screen.findByRole("option", { name: /PVC/i }));

    expect(screen.getByDisplayValue("PVC 6mm Blanco")).toBeInTheDocument();
    expect(screen.getByText(/Plásticos del Norte/i)).toBeInTheDocument();
    expect(screen.getByText("Nacional")).toBeInTheDocument();
  });

  it("agrega la línea con el payload esperado", async () => {
    render(<OrderMaterialDialog open onClose={() => {}} orderId={1} />);

    await userEvent.click(screen.getByLabelText(/^Material/i));
    await userEvent.click(await screen.findByRole("option", { name: /PVC/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Agregar$/i }));

    expect(createMutateAsync).toHaveBeenCalledWith({
      materialId: 1,
      quantity: 1,
      description: "PVC 6mm Blanco",
      supplierId: 10,
      availability: "disponible",
    });
  });

  it("en modo edición, precarga los datos de la línea y manda un update", async () => {
    const item: OrderMaterialItem = {
      id: 5,
      orderId: 1,
      materialId: 2,
      quantity: 3,
      description: "Acrílico 3mm transparente",
      supplierId: 11,
    };
    render(<OrderMaterialDialog open onClose={() => {}} orderId={1} item={item} />);

    expect(screen.getByDisplayValue("Acrílico 3mm transparente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Material/i)).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    // El backend no acepta reasignar el material de una línea ya cargada
    // (UpdateOrderMaterialItemDto no tiene `materialId`): no se manda.
    expect(updateMutateAsync).toHaveBeenCalledWith({
      itemId: 5,
      payload: {
        quantity: 3,
        description: "Acrílico 3mm transparente",
        supplierId: 11,
        availability: "disponible",
      },
    });
  });

  it("manda la disponibilidad elegida", async () => {
    render(<OrderMaterialDialog open onClose={() => {}} orderId={1} />);

    await userEvent.click(screen.getByLabelText(/^Material/i));
    await userEvent.click(await screen.findByRole("option", { name: /PVC/i }));
    await userEvent.click(screen.getByLabelText(/^Disponibilidad/i));
    await userEvent.click(await screen.findByRole("option", { name: "Agotado" }));
    await userEvent.click(screen.getByRole("button", { name: /^Agregar$/i }));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ availability: "agotado" })
    );
  });
});
