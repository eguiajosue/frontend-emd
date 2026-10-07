import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Order } from "@/types";

const history = vi.hoisted(() => ({
  state: {
    orders: [] as unknown[],
    total: 0,
    totalPages: 1,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: () => {},
  },
  calls: [] as { filters: unknown; page: number }[],
}));

vi.mock("@/hooks/useBranchOrderHistory", () => ({
  useBranchOrderHistory: (filters: unknown, page: number) => {
    history.calls.push({ filters, page });
    return history.state;
  },
}));
vi.mock("@/hooks/useEntity", () => ({
  CATALOG_STALE_TIME: 0,
  useEntityList: () => ({ data: [{ id: 1, name: "pendiente" }, { id: 5, name: "entregado" }] }),
}));
vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: () => ({ logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" }),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/components/orders/OrderDetailDialog", () => ({
  OrderDetailDialog: ({ orderId }: { orderId: number | null }) =>
    orderId ? <div role="dialog">Detalle del pedido {orderId}</div> : null,
}));

import BranchHistoryPage from "./page";

const order = (id: number, over: Partial<Order> = {}): Order =>
  ({
    id,
    statusId: 5,
    status: { id: 5, name: "entregado" },
    description: `Sudaderas ${id}`,
    clientNameOverride: `Escuela ${id}`,
    creationDate: "2026-09-04T09:00:00.000Z",
    branchEmployee: { id: 1, name: "Ana López" },
    ...over,
  }) as Order;

beforeEach(() => {
  history.calls = [];
  history.state = { orders: [], total: 0, totalPages: 1, isPending: false, isError: false, isFetching: false, refetch: () => {} };
});

describe("Historial de la sucursal", () => {
  it("lista #, cliente, descripción, empleado y estado; el clic abre el detalle", async () => {
    history.state = { ...history.state, orders: [order(7), order(6)], total: 2 };
    render(<BranchHistoryPage />);

    expect(screen.getByRole("heading", { name: "Historial de pedidos" })).toBeInTheDocument();
    const row = screen.getByRole("button", { name: "Ver pedido #7 de Escuela 7" });
    expect(row).toHaveTextContent("#7");
    expect(row).toHaveTextContent("Sudaderas 7");
    expect(row).toHaveTextContent("Ana López");
    expect(screen.getByTestId("branch-history-summary")).toHaveTextContent("Página 1 de 1 · 2 pedidos");

    await userEvent.click(row);
    expect(screen.getByRole("dialog")).toHaveTextContent("Detalle del pedido 7");
  });

  it("cargando: esqueleto, sin lista ni estado vacío", () => {
    history.state = { ...history.state, isPending: true };
    render(<BranchHistoryPage />);
    expect(screen.getByLabelText("Cargando historial")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Todavía no hay pedidos")).not.toBeInTheDocument();
  });

  it("sin pedidos ni filtros: estado vacío; con filtros: sin resultados y 'Limpiar filtros'", async () => {
    const { unmount } = render(<BranchHistoryPage />);
    expect(screen.getByText("Todavía no hay pedidos")).toBeInTheDocument();
    unmount();

    render(<BranchHistoryPage />);
    await userEvent.type(screen.getByLabelText("Buscar en el historial"), "zzz");
    expect(await screen.findByText("Sin pedidos con estos filtros")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));
    expect(screen.getByText("Todavía no hay pedidos")).toBeInTheDocument();
  });

  it("la búsqueda llega al hook (con respiro) y vuelve a la página 1", async () => {
    history.state = { ...history.state, orders: [order(7)], total: 60, totalPages: 3 };
    render(<BranchHistoryPage />);
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(history.calls.at(-1)?.page).toBe(2);

    await userEvent.type(screen.getByLabelText("Buscar en el historial"), "madero");
    await vi.waitFor(() => expect(history.calls.at(-1)).toMatchObject({ page: 1, filters: { q: "madero" } }));
  });

  it("error: ofrece reintentar", () => {
    history.state = { ...history.state, isError: true };
    render(<BranchHistoryPage />);
    expect(screen.queryByText("Todavía no hay pedidos")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar|Intentar/i })).toBeInTheDocument();
  });

  it("paginación: Anterior deshabilitado en la primera y Siguiente en la última", () => {
    history.state = { ...history.state, orders: [order(7)], total: 21, totalPages: 2 };
    render(<BranchHistoryPage />);
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Siguiente/ })).toBeEnabled();
  });
});

describe("Historial de la sucursal · logo", () => {
  it("cada fila lleva el logo de la sucursal junto al cliente (con el nombre como alt)", () => {
    history.state = {
      ...history.state,
      orders: [order(7, { branch: { id: 1, name: "Punto Madero" } as Order["branch"] }), order(6)],
      total: 2,
    };
    render(<BranchHistoryPage />);
    const logos = screen.getAllByTestId("branch-logo");
    expect(logos).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ver pedido #7 de Escuela 7" })).toContainElement(logos[0]);
    expect(logos[0].querySelector("img")).toHaveAttribute("alt", "Punto Madero");
  });
});
