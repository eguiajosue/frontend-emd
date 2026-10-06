import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HojaMaterialesPage from "./page";
import type { Order } from "@/types";

let orders: Order[] = [];
const reorderMock = vi.fn();
let canManageOperations = true;

vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => ({ data: orders, isPending: false, isError: false, refetch: vi.fn() }),
  useReorderMaterialsPriority: () => ({ reorder: reorderMock, isReordering: false }),
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
  usePermissions: () => ({ canManageOperations }),
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
  reorderMock.mockReset();
  canManageOperations = true;
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

    await userEvent.click(screen.getByRole("button", { name: /^Pedido #1/i }));

    expect(screen.getByText("Todavía no se cargó ningún material.")).toBeInTheDocument();
  });

  it("sin pedidos activos, muestra el estado vacío", () => {
    orders = [buildOrder(2, 5)];
    render(<HojaMaterialesPage />);

    expect(screen.getByText("No hay pedidos activos en este momento.")).toBeInTheDocument();
  });

  it("ordena por materialsPriority (los sin prioridad van al final, por id)", () => {
    orders = [
      buildOrder(10, 1, { materialsPriority: 1 }),
      buildOrder(20, 1, { materialsPriority: null }),
      buildOrder(30, 1, { materialsPriority: 0 }),
    ];
    render(<HojaMaterialesPage />);

    const names = screen.getAllByText(/^Pedido #\d+$/).map((el) => el.textContent);
    expect(names).toEqual(["Pedido #30", "Pedido #10", "Pedido #20"]);
  });

  it("muestra el asa de arrastre cuando se puede administrar y no hay búsqueda", () => {
    orders = [buildOrder(1, 1), buildOrder(2, 1)];
    render(<HojaMaterialesPage />);

    expect(screen.getAllByLabelText(/Arrastrar para cambiar la prioridad/i)).toHaveLength(2);
  });

  it("oculta el asa de arrastre mientras hay una búsqueda activa", async () => {
    orders = [buildOrder(1, 1, { clientNameOverride: "Cliente Uno" }), buildOrder(2, 1)];
    render(<HojaMaterialesPage />);

    await userEvent.type(screen.getByPlaceholderText(/Buscar por pedido o cliente/i), "Uno");

    expect(screen.queryByLabelText(/Arrastrar para cambiar la prioridad/i)).not.toBeInTheDocument();
  });

  it("oculta el asa de arrastre si el usuario no puede administrar operaciones", () => {
    canManageOperations = false;
    orders = [buildOrder(1, 1), buildOrder(2, 1)];
    render(<HojaMaterialesPage />);

    expect(screen.queryByLabelText(/Arrastrar para cambiar la prioridad/i)).not.toBeInTheDocument();
  });
});
