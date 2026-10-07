import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const session = vi.hoisted(() => ({
  value: { data: null, status: "loading" } as { data: unknown; status: string },
}));
vi.mock("next-auth/react", () => ({ useSession: () => session.value }));

import { useVisibleNavGroups } from "./useVisibleNavItems";

const withRoles = (roles: string[]) => ({ data: { user: { roles } }, status: "authenticated" });

beforeEach(() => {
  session.value = { data: null, status: "loading" };
});

describe("useVisibleNavGroups", () => {
  it("mientras carga la sesión no pinta ningún menú (no se sabe el rol)", () => {
    const { result } = renderHook(() => useVisibleNavGroups());
    expect(result.current).toEqual([]);
  });

  it("sucursal: sólo su menú (sin 'Nuevo pedido' ni Inventario), sin pasar nunca por el completo", () => {
    session.value = withRoles(["sucursal"]);
    const { result } = renderHook(() => useVisibleNavGroups());
    expect(result.current.flatMap((g) => g.items.map((i) => i.title))).toEqual([
      "Mis pedidos",
      "Historial",
      "Clientes",
      "Mockups",
    ]);
  });

  it("recepción ve el menú completo con Cotizaciones", () => {
    session.value = withRoles(["recepcion"]);
    const { result } = renderHook(() => useVisibleNavGroups());
    expect(result.current.flatMap((g) => g.items.map((i) => i.title))).toContain("Cotizaciones");
  });
});
