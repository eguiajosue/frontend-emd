import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn(async () => undefined) }));

import { PRIVATE_CACHE_NAMES, clearPrivateCaches, logout } from "./logout";

describe("logout purga las cachés privadas del service worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("borra emd-live-data y emd-dashboard", async () => {
    const del = vi.fn<(name: string) => Promise<boolean>>(async () => true);
    vi.stubGlobal("caches", { delete: del });
    await clearPrivateCaches();
    expect(del.mock.calls.map((c) => c[0]).sort()).toEqual([...PRIVATE_CACHE_NAMES].sort());
  });

  it("logout() borra las cachés aunque signOut falle y no rompe sin Cache API", async () => {
    const del = vi.fn<(name: string) => Promise<boolean>>(async () => true);
    vi.stubGlobal("caches", { delete: del });
    const { signOut } = await import("next-auth/react");
    vi.mocked(signOut).mockRejectedValueOnce(new Error("red"));
    await expect(logout()).rejects.toThrow("red");
    expect(del).toHaveBeenCalledWith("emd-live-data");

    vi.stubGlobal("caches", undefined);
    await expect(clearPrivateCaches()).resolves.toBeUndefined();
  });

  it("logout() borra los borradores de Nuevo pedido de este navegador", async () => {
    const store = new Map<string, string>([
      ["emd:orderDraft:v1:7", "{}"],
      ["emd:branchEmployee:v1:9", "{}"],
      ["emd:recentClientIds", "[1]"],
    ]);
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("window", {
      location: { href: "" },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
    await logout();
    expect([...store.keys()]).toEqual(["emd:recentClientIds"]);
  });
});
