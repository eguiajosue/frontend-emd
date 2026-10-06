import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryItemDialog } from "./InventoryItemDialog";
import type { InventoryItem } from "@/types";

const updateMutate = vi.fn();
const createMutate = vi.fn();

vi.mock("@/hooks/useInventory", () => ({
  useInventoryMutations: () => ({
    create: { mutateAsync: createMutate },
    update: { mutateAsync: updateMutate },
  }),
}));
vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  CATALOG_STALE_TIME: 0,
}));

const item: InventoryItem = {
  id: 7,
  area: "bordado",
  name: "Hilo rojo",
  unit: "cono",
  quantity: 10,
  stockStatus: "ok",
  barcode: "EMD-000007",
};

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

function renderDialog(props: Partial<Parameters<typeof InventoryItemDialog>[0]> = {}) {
  return render(
    <InventoryItemDialog
      open
      onClose={vi.fn()}
      item={item}
      areas={["bordado"]}
      knownCategories={[]}
      knownUnits={[]}
      {...props}
    />
  );
}

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue(item);
  createMutate.mockReset().mockResolvedValue(item);
});

describe("InventoryItemDialog · código de barras", () => {
  it("muestra el código actual y no lo manda si no cambió", async () => {
    renderDialog();
    expect(screen.getByRole("textbox", { name: "Código de barras" })).toHaveValue("EMD-000007");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(updateMutate.mock.calls[0][0].payload).not.toHaveProperty("barcode");
  });

  it("liga el código del fabricante y muestra el 409 en el campo", async () => {
    updateMutate.mockRejectedValue(httpError(409, "Ese código ya está asignado a Tinta cyan"));
    renderDialog();
    const field = screen.getByRole("textbox", { name: "Código de barras" });
    await userEvent.clear(field);
    await userEvent.type(field, " 7501234567890 ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(updateMutate).toHaveBeenCalledWith({
      id: 7,
      payload: expect.objectContaining({ barcode: "7501234567890" }),
    });
    expect(await screen.findByText("Ese código ya está asignado a Tinta cyan")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("“Usar automático” vuelve al EMD- del artículo (se manda null)", async () => {
    renderDialog({ item: { ...item, barcode: "7501234567890" } });
    await userEvent.click(screen.getByRole("button", { name: /Usar automático/ }));
    expect(screen.getByRole("textbox", { name: "Código de barras" })).toHaveValue("EMD-000007");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(updateMutate.mock.calls[0][0].payload).toMatchObject({ barcode: null });
  });

  it("valida antes de mandar: EMD-<número> ajeno está reservado", async () => {
    renderDialog();
    const field = screen.getByRole("textbox", { name: "Código de barras" });
    await userEvent.clear(field);
    await userEvent.type(field, "EMD-000999");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/los asigna el sistema/)).toBeInTheDocument();
  });

  it("muestra el 400 de formato del backend en el campo", async () => {
    updateMutate.mockRejectedValue(
      httpError(400, "El código de barras sólo admite letras sin acentos, números, espacios y símbolos ASCII")
    );
    renderDialog();
    const field = screen.getByRole("textbox", { name: "Código de barras" });
    await userEvent.clear(field);
    await userEvent.type(field, "ABC-123");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/sólo admite letras sin acentos/)).toBeInTheDocument();
  });

  it("alta desde un escaneo: el código viene cargado y se manda", async () => {
    renderDialog({ item: null, initialBarcode: "7501234567890" });
    expect(screen.getByRole("textbox", { name: "Código de barras" })).toHaveValue("7501234567890");
    await userEvent.type(screen.getByLabelText(/Artículo/), "Tinta magenta");
    await userEvent.type(screen.getByRole("combobox", { name: /Unidad/ }), "litro{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));
    expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ barcode: "7501234567890", name: "Tinta magenta" }));
  });
});
