import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileMoreSheet } from "./MobileMoreSheet";

const mocks = vi.hoisted(() => ({
  roles: ["superuser"] as string[],
  pathname: "/dashboard/orders",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { roles: mocks.roles, first_name: "Ana", last_name: "Gómez", username: "ana" },
    },
  }),
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

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

vi.mock("@/components/BugReportDialog", () => ({
  BugReportDialog: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle-stub" />,
}));

function renderSheet() {
  return render(
    <SidebarProvider>
      <MobileMoreSheet open onOpenChange={() => {}} />
    </SidebarProvider>
  );
}

describe("MobileMoreSheet", () => {
  it("muestra la tarjeta de identidad: avatar, nombre completo, rol y username", () => {
    mocks.roles = ["superuser"];
    renderSheet();

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText(/Superusuario/)).toBeInTheDocument();
    expect(screen.getByText(/@ana/)).toBeInTheDocument();
    // Iniciales del avatar (fallback), mismo criterio que `app-sidebar.tsx`.
    expect(screen.getByText("AN")).toBeInTheDocument();
  });

  it("para superuser: no duplica un tab principal (Chat interno) y sí incluye lo que queda fuera de los 4 principales (Rendimiento, Historial)", () => {
    mocks.roles = ["superuser"];
    renderSheet();

    // Chat interno, Panel General, Pedidos y Notificaciones son los 4 tabs
    // principales de `MobileTabBar` para este rol — no deben repetirse acá.
    expect(screen.queryByRole("link", { name: "Chat interno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Panel General" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pedidos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Notificaciones" })).not.toBeInTheDocument();

    // El resto del menú completo sí debe estar disponible acá.
    expect(screen.getByRole("link", { name: "Rendimiento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historial" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayuda" })).toBeInTheDocument();
  });

  it("para rol operativo (taller): los 4 tabs principales no se repiten acá; Ayuda queda en el sheet", () => {
    // Menú operativo: Tareas asignadas, Inventario, Chat interno,
    // Notificaciones, Ayuda. Los 4 primeros por prioridad son los tabs de
    // `MobileTabBar`; sólo Ayuda queda "remanente" para el sheet.
    mocks.roles = ["taller"];
    renderSheet();

    expect(screen.queryByRole("link", { name: "Tareas asignadas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chat interno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Notificaciones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inventario" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayuda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeInTheDocument();
  });

  it("incluye Configuración, tema y Cerrar sesión", () => {
    mocks.roles = ["superuser"];
    renderSheet();

    expect(screen.getByRole("link", { name: /Configuración/i })).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle-stub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
