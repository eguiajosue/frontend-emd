import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileTabBar } from "./MobileTabBar";

// Estado mutable leído por los mocks de abajo — `vi.mock` se hoistea sobre
// los imports, así que un `const`/`let` normal caería en temporal dead zone;
// `vi.hoisted` sube esta inicialización con el mock.
const mocks = vi.hoisted(() => ({
  roles: ["admin"] as string[],
  pathname: "/dashboard/orders",
  setOpenMobile: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { roles: mocks.roles } } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/hooks/useChat", () => ({
  useChatUnreadCount: () => 0,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => ({ count: 0 }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ setOpenMobile: mocks.setOpenMobile }),
}));

describe("MobileTabBar", () => {
  beforeEach(() => {
    mocks.setOpenMobile.mockClear();
  });

  it("admin/superuser: Panel General, Pedidos, Chat interno, Notificaciones + Más", () => {
    mocks.roles = ["superuser"];
    mocks.pathname = "/dashboard/orders";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Panel General" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat interno" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificaciones" })).toBeInTheDocument();
    // Ni Historial ni Rendimiento entran en los primeros 4 para este rol.
    expect(screen.queryByRole("link", { name: "Historial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rendimiento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeInTheDocument();
  });

  it("recepción: Pedidos, Chat interno, Notificaciones, Historial + Más", () => {
    mocks.roles = ["recepcion"];
    mocks.pathname = "/dashboard/orders";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat interno" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificaciones" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historial" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Panel General" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeInTheDocument();
  });

  it("rol operativo (taller): Tareas asignadas, Chat interno, Notificaciones, Ayuda + Más", () => {
    mocks.roles = ["taller"];
    mocks.pathname = "/dashboard/orders";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Tareas asignadas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat interno" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificaciones" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayuda" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Panel General" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeInTheDocument();
  });

  it("resalta el tab activo por match exacto de ruta", () => {
    mocks.roles = ["superuser"];
    mocks.pathname = "/dashboard/admin";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Panel General" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Pedidos" })).not.toHaveAttribute("aria-current");
  });

  it("no confunde /dashboard/admin con /dashboard/admin/rendimiento (sin match por prefijo)", () => {
    mocks.roles = ["superuser"];
    mocks.pathname = "/dashboard/admin/rendimiento";
    render(<MobileTabBar />);

    // "Rendimiento" ni siquiera es uno de los 4 tabs principales para este
    // rol, así que si algo quedara marcado activo sería un falso positivo
    // por prefijo — no debe pasar.
    expect(screen.getByRole("link", { name: "Panel General" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it('el tab "Más" abre el Sheet completo del menú', () => {
    mocks.roles = ["superuser"];
    mocks.pathname = "/dashboard/orders";
    render(<MobileTabBar />);

    fireEvent.click(screen.getByRole("button", { name: "Más opciones" }));
    expect(mocks.setOpenMobile).toHaveBeenCalledWith(true);
  });
});
