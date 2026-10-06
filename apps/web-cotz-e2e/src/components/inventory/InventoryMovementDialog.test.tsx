import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryMovementDialog } from "./InventoryMovementDialog";
import type { InventoryItem } from "@/types";

const mutateAsync = vi.fn();

vi.mock("@/hooks/useInventory", () => ({
  useInventoryMutations: () => ({ registerMovement: { mutateAsync, isPending: false } }),
}));

const item: InventoryItem = {
  id: 7,
  area: "bordado",
  name: "Hilo rojo",
  unit: "cono",
  quantity: 10,
  minStock: 3,
  stockStatus: "ok",
};

beforeEach(() => mutateAsync.mockReset().mockResolvedValue({}));

describe("InventoryMovementDialog", () => {
  it("muestra el saldo resultante y registra la salida imputada a un pedido", async () => {
    const onClose = vi.fn();
    render(<InventoryMovementDialog item={item} initialType="SALIDA" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Cantidad que sale/), "4");
    expect(screen.getByText("6 cono")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Pedido/), "#120");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 7,
      payload: { type: "SALIDA", quantity: 4, orderId: 120, note: undefined, unitCost: undefined },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("no deja sacar más de lo que hay", async () => {
    render(<InventoryMovementDialog item={item} initialType="SALIDA" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Cantidad que sale/), "11");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(screen.getByText("No alcanza: hay 10 cono")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("el ajuste fija el stock al conteo físico", async () => {
    render(<InventoryMovementDialog item={item} initialType="AJUSTE" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Cantidad contada/), "8");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ type: "AJUSTE", quantity: 8 }) })
    );
  });
});
