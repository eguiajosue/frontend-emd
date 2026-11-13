import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMyAvatar } from "./useMyAvatar";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "7", roles: [] } } }) }));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({ request: requestMock }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMyAvatar(), { wrapper });
}

beforeEach(() => {
  requestMock.mockReset();
  // Solo responde la ruta propia: `auth/profile` es de admin y falla (403) para el resto.
  requestMock.mockImplementation((endpoint: string, options?: { method?: string }) => {
    if (endpoint !== "users/me/avatar") return Promise.reject(new Error("403"));
    return Promise.resolve({ avatarSeed: options?.method === "PATCH" ? "abc123" : "old" });
  });
});

describe("useMyAvatar", () => {
  it("lee la semilla guardada del perfil y el id de la sesión", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.user.avatarSeed).toBe("old"));
    expect(result.current.user.id).toBe("7");
  });

  it("reroll guarda por PATCH y muestra la semilla nueva sin recargar", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.user.avatarSeed).toBe("old"));
    act(() => result.current.reroll());
    await waitFor(() => expect(result.current.user.avatarSeed).toBe("abc123"));
    expect(requestMock).toHaveBeenCalledWith("users/me/avatar", { method: "PATCH", token: "tok" });
  });

  it("un segundo reroll mientras hay uno en curso no lanza otra petición", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.user.avatarSeed).toBe("old"));
    act(() => {
      result.current.reroll();
      result.current.reroll();
    });
    await waitFor(() => expect(result.current.user.avatarSeed).toBe("abc123"));
    const patches = requestMock.mock.calls.filter(([, options]) => options?.method === "PATCH");
    expect(patches).toHaveLength(1);
  });
});
