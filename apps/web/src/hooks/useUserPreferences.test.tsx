import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PREFERENCES_QUERY_KEY, useUserPreferences, type UserPreferences } from "./useUserPreferences";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { roles: ["recepcion"] } } }) }));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({ request: requestMock }));

const BASE: UserPreferences = { themePreference: "light", accentColor: null, languagePreference: null };

/** Promesas controladas a mano: cada PATCH queda colgado hasta resolverlo. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(PREFERENCES_QUERY_KEY, BASE);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useUserPreferences(), { wrapper });
  const cached = () => client.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY);
  return { client, cached, ...hook };
}

beforeEach(() => requestMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("useUserPreferences (R5: optimista y en serie)", () => {
  it("el cambio se ve en la caché antes de que responda el backend", async () => {
    const d = deferred<UserPreferences>();
    requestMock.mockReturnValueOnce(d.promise);
    const { result, cached } = setup();
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.updatePreferences({ themePreference: "dark" });
    });
    await waitFor(() => expect(cached()?.themePreference).toBe("dark"));
    expect(requestMock).toHaveBeenCalledWith("users/me/preferences", {
      method: "PATCH",
      token: "tok",
      body: { themePreference: "dark" },
    });
    await act(async () => {
      d.resolve({ ...BASE, themePreference: "dark" });
      await done;
    });
    expect(cached()?.themePreference).toBe("dark");
  });

  it("si falla, vuelve al valor anterior", async () => {
    requestMock.mockRejectedValueOnce(new Error("500"));
    const { result, cached } = setup();
    await act(async () => {
      await result.current.updatePreferences({ themePreference: "dark" });
    });
    expect(cached()?.themePreference).toBe("light");
  });

  it("los PATCH van de uno en uno y una respuesta vieja no pisa el cambio más nuevo", async () => {
    const first = deferred<UserPreferences>();
    const second = deferred<UserPreferences>();
    requestMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, cached } = setup();

    let p1: Promise<unknown> = Promise.resolve();
    let p2: Promise<unknown> = Promise.resolve();
    act(() => {
      p1 = result.current.updatePreferences({ navPreferences: { favorites: ["/a"], order: [], hidden: [], expanded: false } });
    });
    act(() => {
      p2 = result.current.updatePreferences({
        navPreferences: { favorites: ["/a", "/b"], order: [], hidden: [], expanded: false },
      });
    });
    await waitFor(() => expect(cached()?.navPreferences?.favorites).toEqual(["/a", "/b"]));
    // El segundo espera a que termine el primero.
    expect(requestMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({ ...BASE, navPreferences: { favorites: ["/a"], order: [], hidden: [], expanded: false } });
      await p1;
    });
    // La respuesta del primero es más vieja que lo que ya se ve: no se aplica.
    expect(cached()?.navPreferences?.favorites).toEqual(["/a", "/b"]);
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve({ ...BASE, navPreferences: { favorites: ["/a", "/b"], order: [], hidden: [], expanded: false } });
      await p2;
    });
    expect(cached()?.navPreferences?.favorites).toEqual(["/a", "/b"]);
  });
});
