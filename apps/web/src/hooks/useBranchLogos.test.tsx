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

const permissions = vi.hoisted(() => ({ isBranch: false }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => permissions }));
const myBranch = vi.hoisted(() => ({ branch: undefined as { id: number } | undefined }));
vi.mock("@/hooks/useBranches", () => ({ useMyBranch: () => ({ branch: myBranch.branch }) }));

import { BRANCH_LOGOS_STALE_TIME, useBranchLogoMutations, useBranchLogos } from "./useBranchLogos";

const LOGOS = [
  { branchId: 1, name: "Punto Madero", logoOnLight: "data:image/png;base64,A", logoOnDark: "data:image/png;base64,B", updatedAt: "2026-10-01T00:00:00.000Z" },
  { branchId: 2, name: "Plaza Norte", logoOnLight: null, logoOnDark: null, updatedAt: null },
];

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  request.mockReset();
  permissions.isBranch = false;
  myBranch.branch = undefined;
});

describe("useBranchLogos", () => {
  it("pide GET /branches/logos una sola vez y lo comparte entre consumidores", async () => {
    request.mockResolvedValue(LOGOS);
    const a = renderHook(() => useBranchLogos(), { wrapper });
    const b = renderHook(() => useBranchLogos(), { wrapper });
    await waitFor(() => expect(a.result.current.logos).toHaveLength(2));
    await waitFor(() => expect(b.result.current.logos).toHaveLength(2));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("branches/logos", { token: "tok" });
    expect(a.result.current.getLogos(1)?.logoOnLight).toBe("data:image/png;base64,A");
    expect(a.result.current.getLogos(99)).toBeUndefined();
    expect(a.result.current.getLogos(null)).toBeUndefined();
  });

  it("los logos se cachean ~10 minutos", () => {
    expect(BRANCH_LOGOS_STALE_TIME).toBe(10 * 60_000);
  });

  it("una cuenta de sucursal sólo ve el logo de la SUYA", async () => {
    permissions.isBranch = true;
    myBranch.branch = { id: 1 };
    request.mockResolvedValue(LOGOS);
    const { result } = renderHook(() => useBranchLogos(), { wrapper });
    await waitFor(() => expect(result.current.logos).toHaveLength(1));
    expect(result.current.getLogos(1)).toBeDefined();
    expect(result.current.getLogos(2)).toBeUndefined();
  });

  it("mientras no se sabe cuál es su sucursal, la cuenta de sucursal no ve ninguno", async () => {
    permissions.isBranch = true;
    request.mockResolvedValue(LOGOS);
    const { result } = renderHook(() => useBranchLogos(), { wrapper });
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current.logos).toEqual([]);
  });
});

describe("useBranchLogoMutations", () => {
  it("PUT con el data URL y refresca los logos al terminar", async () => {
    request.mockResolvedValue({ branchId: 1, variant: "onLight", updatedAt: "x" });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useBranchLogoMutations(), { wrapper });
    await act(() =>
      result.current.upload.mutateAsync({ branchId: 1, variant: "onLight", imageDataUrl: "data:image/png;base64,A" })
    );
    expect(request).toHaveBeenCalledWith("branches/1/logo/onLight", {
      method: "PUT",
      token: "tok",
      body: { imageDataUrl: "data:image/png;base64,A" },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["branches"] });
  });

  it("DELETE quita la variante y refresca", async () => {
    request.mockResolvedValue(undefined);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useBranchLogoMutations(), { wrapper });
    await act(() => result.current.remove.mutateAsync({ branchId: 1, variant: "onDark" }));
    expect(request).toHaveBeenCalledWith("branches/1/logo/onDark", { method: "DELETE", token: "tok" });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["branches"] });
  });
});
