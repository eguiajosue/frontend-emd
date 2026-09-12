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

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

vi.mock("@/components/BugReportDialog", () => ({
  BugReportDialog: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
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

describe("AppSidebar", () => {
  it("muestra Clientes a un usuario con rol superuser", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Clientes/i })).toBeInTheDocument();
  });

  it("en el panel expandido de escritorio muestra la fila de marca EMD HUB", () => {
    renderSidebar(true);
    expect(screen.getByText("EMD HUB")).toBeInTheDocument();
  });

  it("en el rail colapsado, el ítem activo lleva la barra de acento en el borde izquierdo", () => {
    // Pedidos (/dashboard/orders) es el activo: coincide con el pathname mockeado arriba.
    const { container } = renderSidebar(false);
    const accentBar = container.querySelector('[class*="w-[3px]"]');
    expect(accentBar).toBeInTheDocument();
  });

  it("el chevron de colapsar/expandir no se renderiza en móvil", () => {
    useIsMobileMock.mockReturnValue(true);
    renderSidebar();
    expect(
      screen.queryByRole("button", { name: /Colapsar menú|Expandir menú/ })
    ).not.toBeInTheDocument();
  });

  it("el chevron de colapsar/expandir sí se renderiza en escritorio", () => {
    renderSidebar(true);
    expect(
      screen.getByRole("button", { name: /Colapsar menú|Expandir menú/ })
    ).toBeInTheDocument();
  });

  it("no renderiza nada en móvil (el rail/drawer deja de existir; la navegación móvil vive en MobileTabBar/MobileMoreSheet)", () => {
    useIsMobileMock.mockReturnValue(true);
    const { container } = renderSidebar();
    // El wrapper de `SidebarProvider` siempre se monta (contexto); lo que se
    // verifica es que `AppSidebar` no le agrega nada adentro.
    const providerWrapper = container.querySelector(".group\\/sidebar-wrapper");
    expect(providerWrapper).toBeEmptyDOMElement();
    expect(screen.queryByText("EMD HUB")).not.toBeInTheDocument();
  });
});
