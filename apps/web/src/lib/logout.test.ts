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
});

describe("logout vacía la cola offline", () => {
  it("las mutaciones pendientes no pasan al siguiente usuario del equipo", async () => {
    vi.resetModules();
    const clear = vi.fn(async () => undefined);
    vi.doMock("@/lib/offlineQueue", () => ({ clearPendingMutations: clear }));
    vi.doMock("next-auth/react", () => ({ signOut: vi.fn(async () => undefined) }));
    vi.stubGlobal("caches", undefined);
    const { logout: freshLogout } = await import("./logout");
    await freshLogout();
    expect(clear).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/lib/offlineQueue");
    vi.doUnmock("next-auth/react");
  });
});
