import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { roles: ["superuser"] } },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

const DEFAULT_PREFS = { favorites: [] as string[], order: [] as string[], hidden: [] as string[], expanded: false };
const nav = vi.hoisted(() => ({
  prefs: { favorites: [] as string[], order: [] as string[], hidden: [] as string[], expanded: false },
  pathname: "/dashboard/orders",
  toggleFavorite: vi.fn(),
  setHidden: vi.fn(),
  setExpanded: vi.fn(),
}));

vi.mock("@/hooks/useNavPreferences", () => ({
  useNavPreferences: () => ({
    prefs: nav.prefs,
    expanded: nav.prefs.expanded,
    toggleFavorite: nav.toggleFavorite,
    setHidden: nav.setHidden,
    setExpanded: nav.setExpanded,
  }),
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
  nav.prefs = { ...DEFAULT_PREFS };
  nav.pathname = "/dashboard/orders";
  vi.clearAllMocks();
  localStorage.clear();
});

function renderSidebar(defaultOpen = true) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe("AppSidebar con preferencias de barra (favoritos, ocultos, expandida)", () => {
  it("pinta Favoritos primero, en el orden del usuario, sin duplicarlos en su grupo", () => {
    nav.prefs = { ...nav.prefs, favorites: ["/dashboard/clientes", "/dashboard/calendario"] };
    renderSidebar();
    const nav_ = screen.getByRole("navigation", { name: "Secciones" });
    const lists = within(nav_).getAllByRole("list");
    expect(lists[0]).toHaveAccessibleName("Favoritos");
    expect(within(lists[0]).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Clientes",
      "Calendario",
    ]);
    expect(within(nav_).getAllByRole("link", { name: "Clientes" })).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "Compras y clientes" })).queryByRole("link", { name: "Clientes" })
    ).not.toBeInTheDocument();
  });

  it("sin favoritos no hay sección Favoritos", () => {
    renderSidebar();
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument();
  });

  it("no pinta los ocultos y respeta el orden propio del grupo", () => {
    nav.prefs = {
      ...nav.prefs,
      hidden: ["/dashboard/historial"],
      order: ["/dashboard/ayuda", "/dashboard/chat"],
    };
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Historial" })).not.toBeInTheDocument();
    const equipo = screen.getByRole("list", { name: "Equipo" });
    expect(within(equipo).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Ayuda",
      "Chat interno",
      "Notificaciones",
    ]);
  });

  it("el botón Expandir guarda la preferencia (barra con títulos)", () => {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Expandir barra lateral" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(nav.setExpanded).toHaveBeenCalledWith(true);
  });

  it("expandida: muestra títulos, grupos plegables y el botón para contraer", () => {
    nav.prefs = { ...nav.prefs, expanded: true };
    renderSidebar();
    expect(screen.getByText("Clientes")).toBeVisible();
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Contraer barra lateral" }));
    expect(nav.setExpanded).toHaveBeenCalledWith(false);

    const header = screen.getByRole("button", { name: "Administración" });
    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(JSON.parse(localStorage.getItem("emd:nav-collapsed-groups") ?? "[]")).toEqual(["Administración"]);
  });

  it("expandida: la estrella de la fila fija el ítem", () => {
    nav.prefs = { ...nav.prefs, expanded: true, favorites: ["/dashboard/chat"] };
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Agregar a favoritos: Clientes" }));
    expect(nav.toggleFavorite).toHaveBeenCalledWith("/dashboard/clientes");
    expect(screen.getByRole("button", { name: "Quitar de favoritos: Chat interno" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("clic derecho abre el menú del ítem: favoritos y ocultar", () => {
    renderSidebar();
    const item = screen.getByRole("link", { name: "Clientes" }).closest("li")!;
    fireEvent.contextMenu(item);
    fireEvent.click(screen.getByRole("menuitem", { name: "Agregar a favoritos" }));
    expect(nav.toggleFavorite).toHaveBeenCalledWith("/dashboard/clientes");

    fireEvent.contextMenu(item);
    fireEvent.click(screen.getByRole("menuitem", { name: "Ocultar de la barra" }));
    expect(nav.setHidden).toHaveBeenCalledWith("/dashboard/clientes", true);

    fireEvent.contextMenu(item);
    expect(screen.getByRole("menuitem", { name: "Personalizar barra" })).toHaveAttribute(
      "href",
      "/dashboard/configuracion#barra-lateral"
    );
  });

  it("R2: con Rendimiento oculto, su pantalla no marca Panel General por prefijo", () => {
    nav.prefs = { ...nav.prefs, hidden: ["/dashboard/admin/rendimiento"] };
    nav.pathname = "/dashboard/admin/rendimiento";
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Rendimiento" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Panel General" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("R16: sin preferencias, mismos grupos y orden que el menú de siempre", () => {
    renderSidebar();
    const sections = within(screen.getByRole("navigation", { name: "Secciones" })).getAllByRole("list");
    expect(sections.map((ul) => ul.getAttribute("aria-label"))).toEqual([
      "Operación",
      "Compras y clientes",
      "Equipo",
      "Administración",
    ]);
    expect(within(sections[0]).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Inicio",
      "Panel General",
      "Pedidos",
      "Mockups",
      "Cotizaciones",
      "Calendario",
      "Coordinación",
      "Historial",
    ]);
  });
});
