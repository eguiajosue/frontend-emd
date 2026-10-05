import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import { SidebarPreferencesSection } from "./SidebarPreferencesSection";

type Prefs = { favorites: string[]; order: string[]; hidden: string[]; expanded: boolean };
const DEFAULT: Prefs = { favorites: [], order: [], hidden: [], expanded: false };

const nav = vi.hoisted(() => ({
  prefs: { favorites: [], order: [], hidden: [], expanded: false } as Prefs,
  isCustomized: false,
  toggleFavorite: vi.fn(),
  setHidden: vi.fn(),
  setExpanded: vi.fn(),
  reorderFavorites: vi.fn(),
  reorderGroup: vi.fn(),
  reset: vi.fn(),
  /** `onDragEnd` de cada lista arrastrable, por nombre de la lista. */
  dragEnd: {} as Record<string, (e: DragEndEvent) => void>,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { roles: ["recepcion"] } } }),
}));
vi.mock("@/hooks/useChat", () => ({ useChatUnreadCount: () => 0 }));
vi.mock("@/hooks/useNotifications", () => ({ useUnreadNotificationsCount: () => ({ count: 0 }) }));
vi.mock("@/hooks/useNavPreferences", () => ({
  useNavPreferences: () => ({ ...nav, expanded: nav.prefs.expanded }),
}));

// Arrastrar de verdad necesita medidas de layout que jsdom no tiene: se
// captura el `onDragEnd` de cada lista y se llama como lo haría dnd-kit.
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      const Ctx = actual.DndContext;
      return (
        <Ctx {...props}>
          <CaptureDragEnd onDragEnd={props.onDragEnd} />
          {props.children}
        </Ctx>
      );
    },
  };
});

function CaptureDragEnd({ onDragEnd }: { onDragEnd?: (e: DragEndEvent) => void }) {
  return <span data-capture ref={(el) => {
    const label = el?.parentElement?.querySelector("ul")?.getAttribute("aria-label");
    if (label && onDragEnd) nav.dragEnd[label] = onDragEnd;
  }} />;
}

const drag = (list: string, from: string, to: string) =>
  nav.dragEnd[list]({ active: { id: from }, over: { id: to } } as unknown as DragEndEvent);

afterEach(() => {
  nav.prefs = { ...DEFAULT };
  nav.isCustomized = false;
  nav.dragEnd = {};
  vi.clearAllMocks();
});

const rowTitles = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("span.truncate")?.textContent);

describe("Configuración › Barra lateral", () => {
  it("lista cada grupo visible para el rol, con su orden propio", () => {
    nav.prefs = { ...nav.prefs, order: ["/dashboard/ayuda"] };
    render(<SidebarPreferencesSection />);
    expect(screen.getByText("Barra lateral")).toBeInTheDocument();
    expect(rowTitles(screen.getByRole("list", { name: "Equipo" }))).toEqual([
      "Ayuda",
      "Chat interno",
      "Notificaciones",
    ]);
    // Recepción no ve Administración.
    expect(screen.queryByRole("list", { name: "Administración" })).not.toBeInTheDocument();
    expect(screen.getByText(/Marca con la estrella/)).toBeInTheDocument();
  });

  it("la estrella fija un ítem; los favoritos se listan en su orden", () => {
    nav.prefs = { ...nav.prefs, favorites: ["/dashboard/clientes", "/dashboard/calendario"] };
    render(<SidebarPreferencesSection />);
    expect(rowTitles(screen.getByRole("list", { name: "Favoritos" }))).toEqual(["Clientes", "Calendario"]);

    const operacion = screen.getByRole("list", { name: "Operación" });
    fireEvent.click(within(operacion).getByRole("button", { name: "Agregar a favoritos: Pedidos" }));
    expect(nav.toggleFavorite).toHaveBeenCalledWith("/dashboard/orders");
    expect(
      within(operacion).getByRole("button", { name: "Quitar de favoritos: Calendario" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("el ojo oculta y vuelve a mostrar", () => {
    nav.prefs = { ...nav.prefs, hidden: ["/dashboard/historial"] };
    render(<SidebarPreferencesSection />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar de la barra: Clientes" }));
    expect(nav.setHidden).toHaveBeenCalledWith("/dashboard/clientes", true);
    const show = screen.getByRole("button", { name: "Mostrar en la barra: Historial" });
    expect(show).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(show);
    expect(nav.setHidden).toHaveBeenCalledWith("/dashboard/historial", false);
  });

  it("arrastrar reordena favoritos y grupos", () => {
    nav.prefs = { ...nav.prefs, favorites: ["/dashboard/clientes", "/dashboard/calendario"] };
    render(<SidebarPreferencesSection />);
    drag("Favoritos", "/dashboard/calendario", "/dashboard/clientes");
    expect(nav.reorderFavorites).toHaveBeenCalledWith(["/dashboard/calendario", "/dashboard/clientes"]);

    drag("Equipo", "/dashboard/chat", "/dashboard/ayuda");
    expect(nav.reorderGroup).toHaveBeenCalledWith([
      "/dashboard/notificaciones",
      "/dashboard/ayuda",
      "/dashboard/chat",
    ]);

    // Soltar sobre sí mismo o fuera de la lista no guarda nada.
    drag("Equipo", "/dashboard/chat", "/dashboard/chat");
    nav.dragEnd.Equipo({ active: { id: "/dashboard/chat" }, over: null } as unknown as DragEndEvent);
    expect(nav.reorderGroup).toHaveBeenCalledTimes(1);
  });

  it("el switch de títulos guarda la barra expandida", () => {
    render(<SidebarPreferencesSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar títulos (barra expandida)" }));
    expect(nav.setExpanded).toHaveBeenCalledWith(true);
  });

  it("Restablecer: deshabilitado sin cambios; con cambios vuelve al menú por defecto", () => {
    const { rerender } = render(<SidebarPreferencesSection />);
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled();
    nav.isCustomized = true;
    rerender(<SidebarPreferencesSection />);
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    expect(nav.reset).toHaveBeenCalled();
  });
});
