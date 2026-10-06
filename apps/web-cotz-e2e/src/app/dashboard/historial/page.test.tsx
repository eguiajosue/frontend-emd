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
