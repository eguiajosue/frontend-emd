import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));

import { useCreateProductPreset } from "./useProductPresets";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  request.mockReset();
});

describe("useCreateProductPreset", () => {
  it("hace POST /order-product-presets {name} y refresca el catálogo", async () => {
    request.mockResolvedValue({ id: 5, name: "Termo", uses: 0 });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateProductPreset(), { wrapper });

    let preset: unknown;
    await act(async () => {
      preset = await result.current.createPreset("Termo");
    });

    expect(request).toHaveBeenCalledWith("order-product-presets", { method: "POST", token: "tok", body: { name: "Termo" } });
    expect(preset).toEqual({ id: 5, name: "Termo", uses: 0 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["orderProductPresets"] });
  });

  it("propaga el error del backend", async () => {
    request.mockRejectedValue(new Error("nombre inválido"));
    const { result } = renderHook(() => useCreateProductPreset(), { wrapper });
    await act(async () => {
      await expect(result.current.createPreset("x")).rejects.toThrow("nombre inválido");
    });
  });
});
