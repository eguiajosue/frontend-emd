import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const useEntityList = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useEntity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useEntity")>()),
  useEntityList: (...args: unknown[]) => useEntityList(...args),
}));

import { useOrders } from "./useOrders";

beforeEach(() => useEntityList.mockReset().mockReturnValue({ data: [] }));

describe("useOrders · origen", () => {
  it("sin origen pide GET /orders sin parámetros (misma clave de caché de siempre)", () => {
    renderHook(() => useOrders());
    expect(useEntityList).toHaveBeenCalledWith("orders", { enabled: undefined, params: undefined });
  });

  it("Matriz → origin=matriz", () => {
    renderHook(() => useOrders({ origin: "matriz" }));
    expect(useEntityList).toHaveBeenCalledWith("orders", { enabled: undefined, params: { origin: "matriz" } });
  });

  it("Todas las sucursales → origin=sucursal", () => {
    renderHook(() => useOrders({ origin: "sucursal" }));
    expect(useEntityList).toHaveBeenCalledWith("orders", { enabled: undefined, params: { origin: "sucursal" } });
  });

  it("una sucursal → branchId=N (número)", () => {
    renderHook(() => useOrders({ origin: "2" }));
    expect(useEntityList).toHaveBeenCalledWith("orders", { enabled: undefined, params: { branchId: 2 } });
  });
});
