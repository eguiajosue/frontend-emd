import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Package, ClipboardList, Building2, ListTodo } from "lucide-react";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import type { Order } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let canManageOperations = true;
let isBranch = false;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageOperations, isBranch }),
}));

let hiddenNavUrls: string[] = [];
let extraNavItems: { title: string; group: string; url: string; icon: typeof Package; unreadCount: number }[] = [];
vi.mock("@/hooks/useVisibleNavItems", () => ({
  useVisibleNavItems: () => [
    ...extraNavItems,
    { title: "Pedidos", group: "Operación", url: "/dashboard/orders", icon: Package, unreadCount: 0 },
    {
      title: "Hoja de Materiales",
      group: "Compras y clientes",
      url: "/dashboard/hoja-materiales",
      icon: ClipboardList,
      unreadCount: 0,
    },
    { title: "Clientes", group: "Compras y clientes", url: "/dashboard/clientes", icon: Building2, unreadCount: 0 },
  ].filter((item) => !hiddenNavUrls.includes(item.url)),
}));

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));
vi.mock("@/hooks/useUserPreferences", () => ({ useUserPreferences: () => ({ updatePreferences: vi.fn() }) }));
vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [{ id: 7, first_name: "Ana", last_name: "Ríos", phone: "555" }] }),
}));

vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: (id: number) => (id === 1 ? { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" } : undefined),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));

const orders = [
  { id: 42, description: "Letrero luminoso", clientNameOverride: "Cruz" } as Order,
  { id: 43, description: "Lonas", clientNameOverride: "Madero", branchId: 1, branch: { id: 1, name: "Punto Madero" } } as Order,
];
vi.mock("@/hooks/useOrders", () => ({ useOrders: () => ({ data: orders }) }));

beforeEach(() => {
  localStorage.clear();
  push.mockReset();
  canManageOperations = true;
  isBranch = false;
  extraNavItems = [];
  hiddenNavUrls = [];
});

describe("CommandPalette", () => {
  it("sucursal: ve 'Nuevo pedido' (como el atajo N) y 'Nuevo cliente' (los suyos), pero no el Modo TV", () => {
    canManageOperations = false;
    isBranch = true;
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.getByRole("option", { name: /Nuevo pedido/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Modo TV/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Nuevo cliente/ })).toBeInTheDocument();
  });

  it("sin acceso a Clientes en el menú (ej. otro rol operativo) no ofrece 'Nuevo cliente'", () => {
    canManageOperations = false;
    isBranch = true;
    hiddenNavUrls = ["/dashboard/clientes"];
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.queryByRole("option", { name: /Nuevo cliente/ })).not.toBeInTheDocument();
  });

  it("sucursal: la paleta no lista Inventario (sólo lo que trae su menú)", () => {
    canManageOperations = false;
    isBranch = true;
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.queryByRole("option", { name: /Inventario/ })).not.toBeInTheDocument();
  });

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

describe("CommandPalette fase 3", () => {
  it("recuerda el último destino y lo ofrece en Recientes", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.keyboard("hoja{Enter}");

    act(() => openCommandPalette());
    const recent = screen.getByRole("group", { name: "Recientes" });
    expect(recent).toHaveTextContent("Hoja de Materiales");
  });

  it("las acciones también se encuentran escribiendo", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.keyboard("tema");
    expect(screen.getByRole("option", { name: /Cambiar a modo oscuro/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Nuevo pedido/ })).not.toBeInTheDocument();
  });

  it("busca clientes y lleva a sus pedidos", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.keyboard("ríos");
    await userEvent.click(screen.getByRole("option", { name: /Ana Ríos/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/orders?clientId=7");
  });

  it("modo TV y nuevo cliente son deep-links", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.click(screen.getByRole("option", { name: /Modo TV/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/orders?tv=1");

    act(() => openCommandPalette());
    await userEvent.click(screen.getByRole("option", { name: /Nuevo cliente/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/clientes?new=1");
  });

  it("con Tareas asignadas en el menú ofrece el Modo TV de tareas", async () => {
    extraNavItems = [
      { title: "Tareas asignadas", group: "Operación", url: "/dashboard/tareas", icon: ListTodo, unreadCount: 0 },
    ];
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.click(screen.getByRole("option", { name: /Modo TV de tareas/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/tareas?tv=1");
  });

  it("sin Tareas asignadas no ofrece el Modo TV de tareas", () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    expect(screen.queryByRole("option", { name: /Modo TV de tareas/ })).not.toBeInTheDocument();
  });
});

describe("CommandPalette · logo de la sucursal", () => {
  it("el resultado de búsqueda de un pedido de sucursal lleva su logo", async () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());
    await userEvent.type(screen.getByPlaceholderText(/Buscar pantalla/), "o");
    const sucursal = await screen.findByRole("option", { name: /#43/ });
    expect(within(sucursal).getByTestId("branch-logo")).toBeInTheDocument();
    expect(within(screen.getByRole("option", { name: /#42/ })).queryByTestId("branch-logo")).not.toBeInTheDocument();
  });
});
