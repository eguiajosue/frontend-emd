import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { roles: ["superuser"] } },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/orders",
}));

vi.mock("@/hooks/useChat", () => ({
  useChatUnreadCount: () => 0,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => ({ count: 0 }),
}));

vi.mock("@/components/SidebarOrderViews", () => ({
  SidebarOrderViews: () => null,
  useOrderViewCounts: () => ({ overdue: 0 }),
}));
vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

vi.mock("@/components/BugReportDialog", () => ({
  BugReportDialog: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
  ThemeRailSwitch: () => null,
}));

// `SidebarProvider` decide "collapsed" vs. "móvil" con este hook; mockearlo
// deja simular ambos casos sin depender de `window.innerWidth` en jsdom.
const useIsMobileMock = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

afterEach(() => {
  useIsMobileMock.mockReturnValue(false);
});

function renderSidebar(defaultOpen = true) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe("AppSidebar (riel flotante de escritorio)", () => {
  it("muestra Clientes a un usuario con rol superuser (ícono con nombre accesible)", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Clientes/i })).toBeInTheDocument();
  });

  it("marca el ítem activo con aria-current y su indicador tinta", () => {
    // Pedidos (/dashboard/orders) coincide con el pathname mockeado arriba.
    const { container } = renderSidebar();
    const active = screen.getByRole("link", { name: "Pedidos" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(container.querySelector('[class*="bg-sidebar-primary"]')).toBeInTheDocument();
  });

  it("separa los grupos del menú en listas con su nombre", () => {
    renderSidebar();
    expect(screen.getByRole("list", { name: "Operación" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Administración" })).toBeInTheDocument();
  });

  it("tiene Configuración y Cerrar sesión al pie", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("no renderiza nada en móvil (la navegación móvil vive en MobileTabBar/MobileMoreSheet)", () => {
    useIsMobileMock.mockReturnValue(true);
    const { container } = renderSidebar();
    // El wrapper de `SidebarProvider` siempre se monta (contexto); lo que se
    // verifica es que `AppSidebar` no le agrega nada adentro.
    const providerWrapper = container.querySelector(".group\\/sidebar-wrapper");
    expect(providerWrapper).toBeEmptyDOMElement();
  });
});
