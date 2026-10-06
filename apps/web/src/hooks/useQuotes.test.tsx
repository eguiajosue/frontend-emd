import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Quote } from "@/lib/quotes/types";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));

import { ApiError } from "@/lib/api";
import { applyQuotePatch, quoteKeys, useQuoteMutations, useQuotes } from "./useQuotes";

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: 1,
  clientId: null,
  clientName: "DDN",
  description: "Cotización",
  stage: "por_enviar",
  status: "lista",
  comment: null,
  priorityDate: null,
  sentAt: null,
  orderId: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  createdBy: null,
  ...over,
});

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  request.mockReset();
});

describe("useQuotes", () => {
  it("lista sin filtros pide GET /quotes; con filtros manda los params", async () => {
    request.mockResolvedValue([quote()]);
    const { result } = renderHook(() => useQuotes(), { wrapper });
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));
    expect(request).toHaveBeenCalledWith("quotes", { token: "tok", params: undefined });

    renderHook(() => useQuotes({ stage: "enviada", status: "aceptada", q: " ofis " }), { wrapper });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("quotes", {
        token: "tok",
        params: { stage: "enviada", status: "aceptada", q: "ofis" },
      })
    );
  });
});

describe("useQuoteMutations", () => {
  function seed(list: Quote[]) {
    client.setQueryData(quoteKeys.list(), list);
    return renderHook(() => useQuoteMutations(), { wrapper });
  }
  const cached = () => client.getQueryData<Quote[]>(quoteKeys.list())!;

  it("cambio de subestado optimista (y mueve de etapa) antes de que responda el backend", async () => {
    let resolve!: (q: Quote) => void;
    request.mockImplementation((path: string, opts: { method?: string }) =>
      opts.method === "PATCH" ? new Promise<Quote>((r) => (resolve = r)) : Promise.resolve([])
    );
    const { result } = seed([quote()]);
    act(() => result.current.update.mutate({ id: 1, payload: { status: "aceptada" } }));
    await waitFor(() => expect(cached()[0]).toMatchObject({ stage: "enviada", status: "aceptada" }));
    expect(request).toHaveBeenCalledWith("quotes/1", { token: "tok", method: "PATCH", body: { status: "aceptada" } });
    await act(async () => resolve(quote({ stage: "enviada", status: "aceptada", sentAt: "2026-10-05T10:00:00.000Z" })));
  });

  it("si el backend rechaza, vuelve a como estaba", async () => {
    request.mockImplementation((_path: string, opts: { method?: string }) =>
      opts.method === "PATCH" ? Promise.reject(new ApiError("No", 400)) : new Promise(() => {})
    );
    const { result } = seed([quote()]);
    await act(async () => {
      await result.current.update.mutateAsync({ id: 1, payload: { stage: "enviada" } }).catch(() => {});
    });
    expect(cached()[0]).toMatchObject({ stage: "por_enviar", status: "lista" });
  });

  it("alta, alta en bloque, borrar y ligar pedido pegan a sus endpoints", async () => {
    request.mockImplementation((path: string, opts: { method?: string; body?: unknown }) => {
      if (path === "quotes/bulk") return Promise.resolve([quote({ id: 2 }), quote({ id: 3 })]);
      if (path === "quotes/1/link-order") return Promise.resolve(quote({ status: "aceptada", stage: "enviada", orderId: 77 }));
      if (opts.method === "DELETE") return Promise.resolve(undefined);
      if (opts.method === "POST") return Promise.resolve(quote({ id: 9 }));
      return new Promise(() => {});
    });
    const { result } = seed([quote(), quote({ id: 5 })]);
    await act(async () => {
      await result.current.create.mutateAsync({ clientName: "A", description: "x" });
      await result.current.bulkCreate.mutateAsync([{ clientName: "B", description: "y" }]);
    });
    expect(request).toHaveBeenCalledWith("quotes", { token: "tok", method: "POST", body: { clientName: "A", description: "x" } });
    expect(request).toHaveBeenCalledWith("quotes/bulk", {
      token: "tok",
      method: "POST",
      body: { items: [{ clientName: "B", description: "y" }] },
    });

    client.setQueryData(quoteKeys.list(), [quote(), quote({ id: 5 })]);
    await act(async () => {
      await result.current.linkOrder.mutateAsync({ id: 1, orderId: 77 });
    });
    expect(request).toHaveBeenCalledWith("quotes/1/link-order", { token: "tok", method: "POST", body: { orderId: 77 } });
    expect(cached()[0].orderId).toBe(77);

    act(() => result.current.remove.mutate(5));
    await waitFor(() => expect(cached().map((q) => q.id)).toEqual([1]));
    expect(request).toHaveBeenCalledWith("quotes/5", { token: "tok", method: "DELETE" });
  });
});

describe("applyQuotePatch", () => {
  it("sólo etapa: subestado por defecto; misma etapa: lo conserva; comentario vacío = null", () => {
    expect(applyQuotePatch(quote({ status: "info" }), { stage: "enviada" })).toMatchObject({
      stage: "enviada",
      status: "esperando_respuesta",
    });
    expect(applyQuotePatch(quote({ status: "info" }), { stage: "por_enviar" }).status).toBe("info");
    expect(applyQuotePatch(quote({ comment: "x" }), { comment: "  " }).comment).toBeNull();
  });
});
