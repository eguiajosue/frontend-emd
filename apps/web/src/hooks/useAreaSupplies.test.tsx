import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ApiError } from "@/lib/api";
import {
  AREA_SUPPLIES_KEY,
  showSupplyWarnings,
  useAreaSupplies,
  useDiscountPendingSupplies,
} from "./useAreaSupplies";
import { useAreaTasks } from "./useAreaTasks";
import { useAdvanceMyTask } from "./useMyTasks";
import { queryKeys } from "@/lib/queryKeys";
import type { MyTask } from "@/types";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  request.mockReset();
  Object.values(toast).forEach((fn) => fn.mockReset());
});

describe("useAreaSupplies", () => {
  it("un 403 no se reintenta y no avisa (silentError)", async () => {
    request.mockRejectedValue(new ApiError("Forbidden", 403));
    const { result } = renderHook(() => useAreaSupplies(5), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const query = client.getQueryCache().find({ queryKey: [...AREA_SUPPLIES_KEY, 5] });
    const retry = query!.options.retry as (count: number, error: unknown) => boolean;
    expect(retry(0, new ApiError("Forbidden", 403))).toBe(false);
    expect(retry(0, new ApiError("Boom", 500))).toBe(true);
    expect(query!.meta).toMatchObject({ silentError: true });
  });

  it("un 404 se absorbe como 'sin hoja'", async () => {
    request.mockRejectedValue(new ApiError("No", 404));
    const { result } = renderHook(() => useAreaSupplies(5), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ areas: [], movements: [] }));
  });

  it("con enabled=false (sucursal) no pide nada", async () => {
    renderHook(() => useAreaSupplies(5, false), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(request).not.toHaveBeenCalled();
  });
});

describe("descontar pendientes", () => {
  it("POST al área, refresca hoja e inventario y avisa", async () => {
    request.mockResolvedValue({ areas: [{ area: "bordado", pendingDiscount: false, supply: null }], movements: [] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDiscountPendingSupplies(110), { wrapper });
    await act(() => result.current.mutateAsync("bordado"));

    expect(request).toHaveBeenCalledWith("orders/110/area-supplies/bordado/discount-pending", {
      token: "tok",
      method: "POST",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: AREA_SUPPLIES_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.all("inventory") });
    expect(toast.success).toHaveBeenCalled();
  });

  it("si todavía no alcanza avisa con una advertencia; si falla muestra el mensaje del backend", async () => {
    request.mockResolvedValueOnce({
      areas: [{ area: "bordado", pendingDiscount: true, supply: null }],
      movements: [],
    });
    const { result } = renderHook(() => useDiscountPendingSupplies(110), { wrapper });
    await act(() => result.current.mutateAsync("bordado"));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("falta existencia"));

    request.mockRejectedValueOnce(new ApiError("Sólo Recepción", 400));
    await act(() => result.current.mutateAsync("bordado").catch(() => undefined));
    expect(toast.error).toHaveBeenCalledWith("Sólo Recepción");
  });
});

describe("terminar tareas refresca inventario y hoja de materiales", () => {
  it("useAdvanceMyTask", async () => {
    request.mockResolvedValue({ supplyWarnings: ["Hilo: faltan 3 cono"] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAdvanceMyTask(), { wrapper });
    const task = { key: "k", taskId: 9, area: "bordado", order: { id: 110 } } as unknown as MyTask;
    act(() => result.current.advance(task, "terminado"));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.all("inventory") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: AREA_SUPPLIES_KEY });
    expect(toast.warning).toHaveBeenCalledWith("Hilo: faltan 3 cono");
  });

  it("useAreaTasks.setStatus: invalida y, si falla, muestra el mensaje del backend", async () => {
    request.mockResolvedValue([]);
    const { result } = renderHook(() => useAreaTasks(110), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    request.mockResolvedValueOnce({});
    await act(() => result.current.setStatus.mutateAsync({ taskId: 1, status: "terminado" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.all("inventory") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: AREA_SUPPLIES_KEY });

    request.mockRejectedValueOnce(new ApiError("La tarea ya no existe", 400));
    await act(() => result.current.setStatus.mutateAsync({ taskId: 1, status: "terminado" }).catch(() => undefined));
    expect(toast.error).toHaveBeenCalledWith("La tarea ya no existe");
  });
});

describe("showSupplyWarnings", () => {
  it("ignora respuestas sin avisos", () => {
    showSupplyWarnings({});
    showSupplyWarnings(null);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
