import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistorialPage from "./page";

const historyMock = vi.fn();
vi.mock("@/hooks/useOrders", () => ({
  useOrderHistoryList: (...args: unknown[]) => historyMock(...args),
  downloadOrdersExport: vi.fn(),
}));
vi.mock("@/hooks/useEntity", () => ({
  useAuthToken: () => "token",
  useEntityList: () => ({ data: [{ id: 4, first_name: "Ana", last_name: "Pérez" }] }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canManageOperations: false }) }));
vi.mock("@/components/orders/OrderDetailDialog", () => ({ OrderDetailDialog: () => null }));
vi.mock("@/hooks/useBranches", () => ({
  useBranches: () => ({ data: [{ id: 1, name: "Punto Madero" }, { id: 2, name: "Plaza Norte" }] }),
}));
vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: (id: number) => (id === 1 ? { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" } : undefined),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));

beforeEach(() => {
  historyMock.mockReset();
  historyMock.mockReturnValue({
    orders: [],
    meta: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  });
});

const lastFilters = () => historyMock.mock.calls.at(-1)?.[2];

const historyOrder = (id: number, branch: { id: number; name: string } | null) => ({
  id,
  statusId: 1,
  status: { id: 1, name: "pendiente" },
  description: `Trabajo ${id}`,
  clientNameOverride: `Cliente ${id}`,
  creationDate: "2026-09-01T10:00:00.000Z",
  deliveryDate: "2026-09-20T10:00:00.000Z",
  branchId: branch?.id ?? null,
  branch,
});

describe("HistorialPage filtros", () => {
  it("filtra por cliente y por rango de entrega (día completo)", async () => {
    render(<HistorialPage />);
    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por cliente" }));
    await userEvent.click(await screen.findByText("Ana Pérez"));
    expect(lastFilters()).toMatchObject({ clientId: 4 });

    fireEvent.change(screen.getByLabelText("Entrega desde"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Entrega hasta"), { target: { value: "2026-10-31" } });
    expect(lastFilters()).toMatchObject({
      deliveryFrom: new Date("2026-10-01T00:00:00").toISOString(),
      deliveryTo: new Date("2026-10-31T23:59:59.999").toISOString(),
    });
    expect(screen.getByText("Sin pedidos con estos filtros")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(Object.values(lastFilters()).every((v) => v === undefined)).toBe(true);
  });
});

describe("HistorialPage · origen y logo de la sucursal", () => {
  beforeEach(() => window.history.replaceState(null, "", "/dashboard/historial"));

  it("el filtro Origen manda branchId / origin al backend y se queda en la URL", async () => {
    render(<HistorialPage />);
    expect(lastFilters()).toMatchObject({});
    expect(lastFilters().origin).toBeUndefined();
    expect(lastFilters().branchId).toBeUndefined();

    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    await userEvent.click(screen.getByRole("option", { name: "Matriz" }));
    expect(lastFilters()).toMatchObject({ origin: "matriz" });
    expect(window.location.search).toBe("?origen=matriz");

    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    await userEvent.click(screen.getByRole("option", { name: "Todas las sucursales" }));
    expect(lastFilters()).toMatchObject({ origin: "sucursal" });

    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    await userEvent.click(screen.getByRole("option", { name: "Plaza Norte" }));
    expect(lastFilters()).toMatchObject({ branchId: 2 });
    expect(lastFilters().origin).toBeUndefined();
    expect(window.location.search).toBe("?origen=2");

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(window.location.search).toBe("");
  });

  it("al abrir con ?origen=1 ya viene filtrado por esa sucursal", async () => {
    window.history.replaceState(null, "", "/dashboard/historial?origen=1");
    render(<HistorialPage />);
    expect(await screen.findByRole("combobox", { name: "Origen" })).toHaveTextContent("Punto Madero");
    expect(lastFilters()).toMatchObject({ branchId: 1 });
  });

  it("cada fila de sucursal lleva su logo junto al cliente; la de matriz no", () => {
    historyMock.mockReturnValue({
      orders: [historyOrder(7, { id: 1, name: "Punto Madero" }), historyOrder(8, null)],
      meta: { page: 1, totalPages: 1, total: 2, limit: 20 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    });
    render(<HistorialPage />);
    expect(screen.getAllByTestId("branch-logo")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Ver pedido #7/ })).toContainElement(screen.getByTestId("branch-logo"));
    expect(screen.getByRole("button", { name: /Ver pedido #8/ })).not.toContainElement(screen.getByTestId("branch-logo"));
  });

  it("si el backend ignorara el origen, igual se filtra en el cliente", async () => {
    historyMock.mockReturnValue({
      orders: [historyOrder(7, { id: 1, name: "Punto Madero" }), historyOrder(8, null)],
      meta: { page: 1, totalPages: 1, total: 2, limit: 20 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    });
    render(<HistorialPage />);
    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    await userEvent.click(screen.getByRole("option", { name: "Matriz" }));
    expect(screen.queryByRole("button", { name: /Ver pedido #7/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver pedido #8/ })).toBeInTheDocument();
  });
});
