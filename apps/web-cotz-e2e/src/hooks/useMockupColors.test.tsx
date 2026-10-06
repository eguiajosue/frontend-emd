import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const KEY = ["userPreferences"] as const;
const prefs = vi.hoisted(() => ({
  client: null as unknown as import("@tanstack/react-query").QueryClient,
  update: vi.fn(),
}));
// La caché y el PATCH de verdad los maneja useUserPreferences (lane B): aquí
// basta con leer la caché y registrar qué se manda.
vi.mock("@/hooks/useUserPreferences", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    PREFERENCES_QUERY_KEY: ["userPreferences"],
    useUserPreferences: () => {
      const { data } = useQuery({ queryKey: ["userPreferences"], queryFn: () => ({}), enabled: false });
      return { preferences: data, updatePreferences: prefs.update };
    },
  };
});
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import { useMockupColors } from "./useMockupColors";

function setup(mockupColors: unknown) {
  const client = new QueryClient();
  client.setQueryData(KEY, { themePreference: null, mockupColors });
  prefs.client = client;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMockupColors(), { wrapper });
}

beforeEach(() => {
  toastError.mockReset();
  prefs.update.mockReset();
  // Como el hook real: escribe en la caché (optimista) y responde con las preferencias.
  prefs.update.mockImplementation(async (partial: Record<string, unknown>) => {
    const next = { ...(prefs.client.getQueryData(KEY) as object), ...partial };
    prefs.client.setQueryData(KEY, next);
    return next;
  });
});

describe("useMockupColors", () => {
  it("lee las preferencias del usuario: favoritos primero", () => {
    const { result } = setup({ favorites: ["#bbbbbb"], custom: ["#aaaaaa", "#bbbbbb"] });
    expect(result.current.entries).toEqual([
      { value: "#bbbbbb", favorite: true },
      { value: "#aaaaaa", favorite: false },
    ]);
  });

  it("sin preferencia (null) arranca vacío y agregar manda el objeto completo", async () => {
    const { result } = setup(null);
    expect(result.current.entries).toEqual([]);
    let ok = false;
    await act(async () => {
      ok = await result.current.addColor("1F2A44");
    });
    expect(ok).toBe(true);
    expect(prefs.update).toHaveBeenCalledWith({ mockupColors: { favorites: [], custom: ["#1f2a44"] } });
    await waitFor(() => expect(result.current.entries).toEqual([{ value: "#1f2a44", favorite: false }]));
  });

  it("dos cambios seguidos parten del último estado (no se pisan)", async () => {
    const { result } = setup({ favorites: [], custom: ["#aaaaaa"] });
    await act(async () => {
      await result.current.addColor("#bbbbbb");
      await result.current.toggleFavorite("#aaaaaa");
    });
    expect(prefs.update).toHaveBeenLastCalledWith({
      mockupColors: { favorites: ["#aaaaaa"], custom: ["#bbbbbb", "#aaaaaa"] },
    });
    await act(async () => {
      await result.current.removeColor("#aaaaaa");
    });
    expect(prefs.update).toHaveBeenLastCalledWith({ mockupColors: { favorites: [], custom: ["#bbbbbb"] } });
  });

  it("un color inválido o repetido no manda nada", async () => {
    const { result } = setup({ favorites: [], custom: ["#aaaaaa"] });
    await act(async () => {
      expect(await result.current.addColor("rojo")).toBe(false);
      expect(await result.current.addColor("#AAAAAA")).toBe(true);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(prefs.update).not.toHaveBeenCalled();
  });

  it("si el guardado falla avisa con false", async () => {
    prefs.update.mockResolvedValueOnce(undefined);
    const { result } = setup({ favorites: [], custom: [] });
    let ok = true;
    await act(async () => {
      ok = await result.current.addColor("#123456");
    });
    expect(ok).toBe(false);
  });
});
