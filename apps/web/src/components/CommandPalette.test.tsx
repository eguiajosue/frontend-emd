import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Package, ClipboardList } from "lucide-react";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import type { Order } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let canManageOperations = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageOperations }),
}));

vi.mock("@/hooks/useVisibleNavItems", () => ({
  useVisibleNavItems: () => [
    { title: "Pedidos", group: "Operación", url: "/dashboard/orders", icon: Package, unreadCount: 0 },
    {
      title: "Hoja de Materiales",
      group: "Compras y clientes",
      url: "/dashboard/hoja-materiales",
      icon: ClipboardList,
      unreadCount: 0,
    },
  ],
}));

const orders = [
  { id: 42, description: "Letrero luminoso", clientNameOverride: "Cruz" } as Order,
];
vi.mock("@/hooks/useOrders", () => ({ useOrders: () => ({ data: orders }) }));

beforeEach(() => {
  push.mockReset();
  canManageOperations = true;
});

describe("CommandPalette", () => {
  it("se abre desde el botón de buscar (evento global) y lista las pantallas del menú del rol", () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.getByRole("option", { name: /Pedidos/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Hoja de Materiales/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Configuración/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Nuevo pedido/ })).toBeInTheDocument();
  });

  it("al escribir filtra pantallas y busca pedidos", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.type(screen.getByPlaceholderText(/Buscar pantalla/), "hoja");
    expect(screen.getByRole("option", { name: /Hoja de Materiales/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Pedidos/ })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/Buscar pantalla/));
    await userEvent.type(screen.getByPlaceholderText(/Buscar pantalla/), "cruz");
    await userEvent.click(screen.getByRole("option", { name: /#42/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/orders?openOrderId=42");
  });

  it("sin permiso de gestión no ofrece crear pedidos", () => {
    canManageOperations = false;
    render(<CommandPalette />);
    act(() => openCommandPalette());
    expect(screen.queryByRole("option", { name: /Nuevo pedido/ })).not.toBeInTheDocument();
  });
});

describe("CommandPalette teclado", () => {
  it("abierta desde el botón, se puede escribir y Enter va al primer resultado", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.keyboard("hoja");
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/dashboard/hoja-materiales");
  });
});
