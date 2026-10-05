import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NAV_SAVE_DEBOUNCE_MS, useNavPreferences } from "./useNavPreferences";
import { PREFERENCES_QUERY_KEY, type UserPreferences } from "./useUserPreferences";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { roles: ["recepcion"] } } }) }));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({ request: requestMock }));

const BASE: UserPreferences = {
  themePreference: null,
  accentColor: null,
  languagePreference: null,
  navPreferences: null,
};

function setup(initial: UserPreferences = BASE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(PREFERENCES_QUERY_KEY, initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNavPreferences(), { wrapper });
  return { client, ...hook };
}

const cached = (client: QueryClient) =>
  client.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY)?.navPreferences;

beforeEach(() => {
  vi.useFakeTimers();
  // React Query avisa a los componentes con setTimeout(0); con timers falsos
  // se haría esperar: aquí, en el mismo tick.
  notifyManager.setScheduler((cb) => cb());
  requestMock.mockReset();
  // El backend devuelve lo que se mandó.
  requestMock.mockImplementation(async (_url: string, opts: { body: Partial<UserPreferences> }) => ({
    ...BASE,
    ...opts.body,
  }));
});

afterEach(() => {
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
  vi.useRealTimers();
  localStorage.clear();
});

describe("useNavPreferences", () => {
  it("sin preferencias guardadas → valores por defecto", () => {
    const { result } = setup();
    expect(result.current.prefs).toEqual({ favorites: [], order: {}, hidden: [], expanded: false });
    expect(result.current.isCustomized).toBe(false);
    expect(result.current.expanded).toBe(false);
  });

  it("cambio optimista inmediato y un solo PATCH (con debounce) con el último valor", async () => {
    const { result, client } = setup();
    act(() => result.current.toggleFavorite("/dashboard/clientes"));
    expect(result.current.prefs.favorites).toEqual(["/dashboard/clientes"]);
    act(() => result.current.toggleFavorite("/dashboard/calendario"));
    act(() => result.current.setExpanded(true));
    expect(result.current.expanded).toBe(true);
    expect(requestMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NAV_SAVE_DEBOUNCE_MS);
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith("users/me/preferences", {
      method: "PATCH",
      token: "tok",
      body: {
        navPreferences: {
          favorites: ["/dashboard/clientes", "/dashboard/calendario"],
          order: {},
          hidden: [],
          expanded: true,
        },
      },
    });
    expect(cached(client)?.expanded).toBe(true);
    expect(localStorage.getItem("emd:nav-expanded")).toBe("1");
  });

  it("ocultar, reordenar favoritos y grupo", async () => {
    const { result } = setup({
      ...BASE,
      navPreferences: { favorites: ["/a", "/b"], order: {}, hidden: [], expanded: false },
    });
    act(() => result.current.reorderFavorites(["/b", "/a"]));
    act(() => result.current.reorderGroup("Equipo", ["/y", "/x"]));
    act(() => result.current.setHidden("/a", true));
    expect(result.current.prefs).toEqual({
      favorites: ["/b"],
      order: { Equipo: ["/y", "/x"] },
      hidden: ["/a"],
      expanded: false,
    });
    expect(result.current.isCustomized).toBe(true);
  });

  it("Restablecer manda navPreferences: null", async () => {
    const { result, client } = setup({
      ...BASE,
      navPreferences: { favorites: ["/a"], order: {}, hidden: [], expanded: true },
    });
    act(() => result.current.reset());
    expect(cached(client)).toBeNull();
    expect(result.current.prefs.favorites).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NAV_SAVE_DEBOUNCE_MS);
    });
    expect(requestMock.mock.calls[0][1].body).toEqual({ navPreferences: null });
  });

  it("una respuesta vieja no pisa un cambio más nuevo todavía pendiente", async () => {
    let resolveFirst: (v: UserPreferences) => void = () => {};
    requestMock.mockImplementationOnce(
      () => new Promise<UserPreferences>((resolve) => (resolveFirst = resolve))
    );
    const { result, client } = setup();
    act(() => result.current.toggleFavorite("/a"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NAV_SAVE_DEBOUNCE_MS);
    });
    act(() => result.current.toggleFavorite("/b"));
    await act(async () => {
      resolveFirst({ ...BASE, navPreferences: { favorites: ["/a"], order: {}, hidden: [], expanded: false } });
    });
    expect(cached(client)?.favorites).toEqual(["/a", "/b"]);
  });

  it("si el PATCH falla, recarga las preferencias reales", async () => {
    requestMock.mockRejectedValueOnce(new Error("500"));
    const { result, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    act(() => result.current.toggleFavorite("/a"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NAV_SAVE_DEBOUNCE_MS);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PREFERENCES_QUERY_KEY });
  });

  it("al desmontar manda lo pendiente sin esperar el debounce", async () => {
    const { result, unmount } = setup();
    act(() => result.current.setHidden("/a", true));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][1].body.navPreferences.hidden).toEqual(["/a"]);
  });
});
