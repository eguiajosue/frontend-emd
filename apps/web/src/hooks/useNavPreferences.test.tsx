import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EXPANDED_STORAGE_KEY, useNavPreferences } from "./useNavPreferences";
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

function setup(initial: UserPreferences | null = BASE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (initial) client.setQueryData(PREFERENCES_QUERY_KEY, initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNavPreferences(), { wrapper });
  const cached = () => client.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY)?.navPreferences;
  return { client, cached, ...hook };
}

/** Cuerpos de los PATCH mandados, en orden. */
const sentBodies = () =>
  requestMock.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([, o]) => o.body);

beforeEach(() => {
  requestMock.mockReset();
  // El backend devuelve lo que se mandó.
  requestMock.mockImplementation(async (_url: string, opts?: { body?: Partial<UserPreferences> }) => ({
    ...BASE,
    ...opts?.body,
  }));
});

afterEach(() => localStorage.clear());

describe("useNavPreferences", () => {
  it("sin preferencias guardadas → valores por defecto", () => {
    const { result } = setup();
    expect(result.current.prefs).toEqual({ favorites: [], order: [], hidden: [], expanded: false });
    expect(result.current.isCustomized).toBe(false);
    expect(result.current.expanded).toBe(false);
  });

  it("cada cambio se ve al instante y manda el objeto completo (cuatro llaves)", async () => {
    const { result, cached } = setup();
    act(() => result.current.toggleFavorite("/dashboard/clientes"));
    await waitFor(() => expect(result.current.prefs.favorites).toEqual(["/dashboard/clientes"]));
    act(() => result.current.setExpanded(true));
    await waitFor(() => expect(result.current.expanded).toBe(true));

    await waitFor(() => expect(sentBodies()).toHaveLength(2));
    expect(sentBodies()).toEqual([
      { navPreferences: { favorites: ["/dashboard/clientes"], order: [], hidden: [], expanded: false } },
      { navPreferences: { favorites: ["/dashboard/clientes"], order: [], hidden: [], expanded: true } },
    ]);
    expect(cached()?.expanded).toBe(true);
    expect(localStorage.getItem(EXPANDED_STORAGE_KEY)).toBe("1");
  });

  it("clics rápidos se acumulan sobre el valor más nuevo (no sobre uno viejo)", async () => {
    const { result, cached } = setup();
    act(() => {
      result.current.toggleFavorite("/a");
      result.current.toggleFavorite("/b");
      result.current.setHidden("/c", true);
    });
    await waitFor(() => expect(sentBodies()).toHaveLength(3));
    await waitFor(() =>
      expect(cached()).toEqual({ favorites: ["/a", "/b"], order: [], hidden: ["/c"], expanded: false })
    );
  });

  it("ocultar, reordenar favoritos y grupo", async () => {
    const { result } = setup({
      ...BASE,
      navPreferences: { favorites: ["/a", "/b"], order: ["/z"], hidden: [], expanded: false },
    });
    expect(result.current.isCustomized).toBe(true);
    act(() => result.current.reorderFavorites(["/b", "/a"]));
    act(() => result.current.reorderGroup(["/y", "/x"]));
    act(() => result.current.setHidden("/a", true));
    await waitFor(() =>
      expect(result.current.prefs).toEqual({
        favorites: ["/b"],
        order: ["/z", "/y", "/x"],
        hidden: ["/a"],
        expanded: false,
      })
    );
  });

  it("Restablecer manda navPreferences: null", async () => {
    const { result, cached } = setup({
      ...BASE,
      navPreferences: { favorites: ["/a"], order: [], hidden: [], expanded: true },
    });
    act(() => result.current.reset());
    await waitFor(() => expect(cached()).toBeNull());
    expect(result.current.prefs.favorites).toEqual([]);
    await waitFor(() => expect(sentBodies()).toEqual([{ navPreferences: null }]));
    expect(localStorage.getItem(EXPANDED_STORAGE_KEY)).toBe("0");
  });

  it("R13: antes de que lleguen las preferencias usa la copia local de 'expandida'", async () => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, "1");
    requestMock.mockImplementation(() => new Promise(() => {}));
    const { result } = setup(null);
    await waitFor(() => expect(result.current.expanded).toBe(true));
    expect(result.current.isReady).toBe(false);
  });

  it("R13: al llegar, manda el valor del servidor y se actualiza la copia local", async () => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, "1");
    const { result } = setup({ ...BASE, navPreferences: null });
    expect(result.current.expanded).toBe(false);
    await waitFor(() => expect(localStorage.getItem(EXPANDED_STORAGE_KEY)).toBe("0"));
  });
});
