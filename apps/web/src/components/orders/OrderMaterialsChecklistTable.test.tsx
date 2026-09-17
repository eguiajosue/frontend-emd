import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderMaterialsChecklistTable } from "./OrderMaterialsChecklistTable";
import type { OrderMaterialItem } from "@/types";

const updateMutateAsync = vi.fn();
const removeMutateAsync = vi.fn();
let items: OrderMaterialItem[] = [];
let isLoading = false;
let isError = false;

vi.mock("@/hooks/useOrderMaterials", () => ({
  useOrderMaterials: () => ({
    items,
    isLoading,
    isError,
    update: { mutateAsync: updateMutateAsync, isPending: false },
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

beforeEach(() => {
  items = [];
  isLoading = false;
  isError = false;
  canManageOperations = true;
  updateMutateAsync.mockReset();
  updateMutateAsync.mockResolvedValue(undefined);
  removeMutateAsync.mockReset();
  removeMutateAsync.mockResolvedValue({ success: true });
});

describe("OrderMaterialsChecklistTable", () => {
  it("muestra el estado vacío cuando no hay materiales cargados", () => {
    render(<OrderMaterialsChecklistTable orderId={7} />);
    expect(screen.getByText("Todavía no se cargó ningún material.")).toBeInTheDocument();
  });

  it("lista las líneas con precio y el total en $0.00 si nada está comprado", () => {
    items = [
      { id: 1, orderId: 7, materialId: 1, quantity: 2, description: "PVC 6mm", price: 150, purchased: false },
      { id: 2, orderId: 7, materialId: 2, quantity: 1, description: "Vinil", price: 300, purchased: false },
    ];
    render(<OrderMaterialsChecklistTable orderId={7} />);

    expect(screen.getByText(/PVC 6mm/)).toBeInTheDocument();
    expect(screen.getByText(/Vinil/)).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("al tildar un material, suma su precio al total", async () => {
    items = [
      { id: 1, orderId: 7, materialId: 1, quantity: 2, description: "PVC 6mm", price: 150, purchased: false },
    ];
    render(<OrderMaterialsChecklistTable orderId={7} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(updateMutateAsync).toHaveBeenCalledWith({ itemId: 1, payload: { purchased: true } });
  });

  it("una línea comprada se muestra tachada", () => {
    items = [
      { id: 1, orderId: 7, materialId: 1, quantity: 2, description: "PVC 6mm", price: 150, purchased: true },
    ];
    render(<OrderMaterialsChecklistTable orderId={7} />);

    expect(screen.getByText(/PVC 6mm/)).toHaveClass("line-through");
  });

  it("oculta agregar/editar/quitar y las casillas cuando el usuario no puede administrar operaciones", () => {
    canManageOperations = false;
    items = [
      { id: 1, orderId: 7, materialId: 1, quantity: 2, description: "PVC 6mm", price: 150, purchased: false },
    ];
    render(<OrderMaterialsChecklistTable orderId={7} />);

    expect(screen.queryByRole("button", { name: /Agregar material/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Quitar")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("pide confirmación antes de quitar una línea y llama a remove al confirmar", async () => {
    items = [
      { id: 1, orderId: 7, materialId: 1, quantity: 2, description: "PVC 6mm", price: 150, purchased: false },
    ];
    render(<OrderMaterialsChecklistTable orderId={7} />);

    await userEvent.click(screen.getByTitle("Quitar"));
    await userEvent.click(await screen.findByRole("button", { name: /^Eliminar$/i }));

    expect(removeMutateAsync).toHaveBeenCalledWith(1);
  });
});
