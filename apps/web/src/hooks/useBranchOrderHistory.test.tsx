import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));

import { useBranchOrderHistory } from "./useBranchOrderHistory";
import { EMPTY_BRANCH_HISTORY_FILTERS } from "@/lib/branchOrderHistory";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  request.mockReset();
});

describe("useBranchOrderHistory", () => {
  it("pide GET /orders con page/limit y los filtros, y entrega la página normalizada", async () => {
    request.mockResolvedValue({
      data: [
        { id: 1, statusId: 1, creationDate: "2026-09-01T10:00:00.000Z" },
        { id: 2, statusId: 1, creationDate: "2026-09-02T10:00:00.000Z" },
      ],
      meta: { total: 42, page: 2, limit: 20, totalPages: 3 },
    });
    const { result } = renderHook(
      () => useBranchOrderHistory({ ...EMPTY_BRANCH_HISTORY_FILTERS, q: "madero", statusId: 5 }, 2),
      { wrapper }
    );
    await waitFor(() => expect(result.current.orders).toHaveLength(2));

    expect(request).toHaveBeenCalledWith("orders", {
      token: "tok",
      params: { page: 2, limit: 20, q: "madero", statusId: 5 },
    });
    expect(result.current.orders.map((o) => o.id)).toEqual([2, 1]);
    expect(result.current.total).toBe(42);
    expect(result.current.totalPages).toBe(3);
  });

  it("si el backend aún contesta un array plano, igual pagina y filtra aquí", async () => {
    request.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ id: i + 1, statusId: 1, creationDate: new Date(Date.UTC(2026, 8, i + 1)).toISOString() }))
    );
    const { result } = renderHook(() => useBranchOrderHistory(EMPTY_BRANCH_HISTORY_FILTERS, 1), { wrapper });
    await waitFor(() => expect(result.current.orders).toHaveLength(20));
    expect(result.current.total).toBe(30);
    expect(result.current.totalPages).toBe(2);
  });

  it("enabled:false no hace la petición", () => {
    renderHook(() => useBranchOrderHistory(EMPTY_BRANCH_HISTORY_FILTERS, 1, { enabled: false }), { wrapper });
    expect(request).not.toHaveBeenCalled();
  });
});
