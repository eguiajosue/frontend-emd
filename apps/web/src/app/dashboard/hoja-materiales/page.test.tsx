import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HojaMaterialesPage from "./page";
import type { Order } from "@/types";

let orders: Order[] = [];

vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => ({ data: orders, isPending: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useOrderMaterials", () => ({
  useOrderMaterials: () => ({
    items: [],
    isLoading: false,
    isError: false,
    update: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageOperations: true }),
}));

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  CATALOG_STALE_TIME: 5 * 60_000,
}));

function buildOrder(id: number, statusId: number, overrides: Partial<Order> = {}): Order {
  return {
    id,
    description: `Pedido ${id}`,
    statusId,
    creationDate: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as Order;
}

beforeEach(() => {
  orders = [
    buildOrder(1, 1, { clientNameOverride: "Cliente Uno" }),
    buildOrder(2, 5, { clientNameOverride: "Entregado" }), // 5 = entregado
    buildOrder(3, 10, { clientNameOverride: "Cancelado" }), // 10 = cancelado
  ];
});

describe("HojaMaterialesPage", () => {
  it("sólo lista pedidos activos (ni entregados ni cancelados)", () => {
    render(<HojaMaterialesPage />);

    expect(screen.getByText(/Pedido #1/)).toBeInTheDocument();
    expect(screen.queryByText(/Pedido #2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pedido #3/)).not.toBeInTheDocument();
  });

  it("filtra por texto de búsqueda (cliente o número de pedido)", async () => {
    orders.push(buildOrder(4, 1, { clientNameOverride: "Cruz Treviño" }));
    render(<HojaMaterialesPage />);

    await userEvent.type(
      screen.getByPlaceholderText(/Buscar por pedido o cliente/i),
      "Treviño"
    );

    expect(screen.queryByText(/Pedido #1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pedido #4/)).toBeInTheDocument();
  });

  it("al hacer click en un pedido, se despliega su checklist de materiales", async () => {
    render(<HojaMaterialesPage />);

    await userEvent.click(screen.getByRole("button", { name: /Pedido #1/i }));

    expect(screen.getByText("Todavía no se cargó ningún material.")).toBeInTheDocument();
  });

  it("sin pedidos activos, muestra el estado vacío", () => {
    orders = [buildOrder(2, 5)];
    render(<HojaMaterialesPage />);

    expect(screen.getByText("No hay pedidos activos en este momento.")).toBeInTheDocument();
  });
});
