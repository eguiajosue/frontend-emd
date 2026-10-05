import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileTabBar } from "./MobileTabBar";

// Estado mutable leído por los mocks de abajo — `vi.mock` se hoistea sobre
// los imports, así que un `const`/`let` normal caería en temporal dead zone;
// `vi.hoisted` sube esta inicialización con el mock.
const mocks = vi.hoisted(() => ({
  roles: ["admin"] as string[],
  pathname: "/dashboard/orders",
  navPrefs: { favorites: [], order: [], hidden: [], expanded: false } as {
    favorites: string[];
    order: string[];
    hidden: string[];
    expanded: boolean;
  },
}));

vi.mock("@/hooks/useNavPreferences", () => ({
  useNavPreferences: () => ({ prefs: mocks.navPrefs }),
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
  ThemeToggle: () => null,
}));

/**
 * `MobileMoreSheet` (montado dentro de `MobileTabBar`) reutiliza
 * `ConfiguracionLink`/`InstallAppButton` de `app-sidebar.tsx`, que llaman a
 * `useSidebar()` de verdad — de ahí el `SidebarProvider` real aquí en vez de
 * mockear `@/components/ui/sidebar` como antes (ese mock desapareció junto
 * con `setOpenMobile`, que `MobileTabBar` ya no usa).
 */
function renderBar() {
  return render(
    <SidebarProvider>
      <MobileTabBar />
    </SidebarProvider>
  );
}

afterEach(() => {
  mocks.navPrefs = { favorites: [], order: [], hidden: [], expanded: false };
});

describe("MobileTabBar con preferencias de barra", () => {
  it("favoritos del usuario primero en los tabs, en su orden", () => {
    mocks.roles = ["recepcion"];
    mocks.pathname = "/dashboard/orders";
    mocks.navPrefs = { ...mocks.navPrefs, favorites: ["/dashboard/clientes", "/dashboard/calendario"] };
    renderBar();

    const tabs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));
    expect(tabs).toEqual(["Clientes", "Calendario", "Inicio", "Pedidos"]);
  });

  it("los ocultos no ocupan tab (entra el siguiente por prioridad) pero siguen en Más", () => {
    mocks.roles = ["recepcion"];
    mocks.pathname = "/dashboard/inicio";
    mocks.navPrefs = { ...mocks.navPrefs, hidden: ["/dashboard/orders"] };
    renderBar();

    expect(screen.queryByRole("link", { name: "Pedidos" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificaciones" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hoja de Materiales" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Más opciones" }));
    const more = screen.getByRole("navigation", { name: "Más opciones de navegación" });
    expect(within(more).getByRole("link", { name: "Pedidos" })).toBeInTheDocument();
  });

  it("R2: un oculto activo no marca otro tab por prefijo", () => {
    mocks.roles = ["superuser"];
    mocks.pathname = "/dashboard/admin/rendimiento";
    mocks.navPrefs = { ...mocks.navPrefs, hidden: ["/dashboard/admin/rendimiento"] };
    renderBar();
    expect(screen.getByRole("link", { name: "Panel General" })).not.toHaveAttribute("aria-current");
  });
});
