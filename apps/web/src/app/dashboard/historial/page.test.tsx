import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistorialPage from "./page";

const historyMock = vi.fn();
vi.mock("@/hooks/useOrders", () => ({
  useOrderHistoryList: (...args: unknown[]) => historyMock(...args),
  downloadOrdersExport: vi.fn(),
}));
vi.mock("@/hooks/useEntity", () => ({
  CATALOG_STALE_TIME: 0,
  useAuthToken: () => "token",
  useEntityList: () => ({ data: [{ id: 4, first_name: "Ana", last_name: "Pérez" }] }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canManageOperations: false }) }));
vi.mock("@/components/orders/OrderDetailDialog", () => ({ OrderDetailDialog: () => null }));

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

describe("HistorialPage filtros", () => {
  it("filtra por cliente, muestra el vacío propio y «Limpiar filtros» vuelve a todo", async () => {
    render(<HistorialPage />);
    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por cliente" }));
    await userEvent.click(await screen.findByText("Ana Pérez"));
    expect(lastFilters()).toMatchObject({ clientId: 4 });
    expect(screen.getByText("Ningún pedido coincide con la búsqueda")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpiar filtros" })[0]);
    expect(lastFilters()).toEqual({});
  });
});
