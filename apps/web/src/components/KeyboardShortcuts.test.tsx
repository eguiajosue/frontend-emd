import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Package } from "lucide-react";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { roles: ["recepcion"] } } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canManageOperations: true }) }));
vi.mock("@/hooks/useVisibleNavItems", () => ({
  useVisibleNavItems: () => [
    { title: "Pedidos", group: "Operación", url: "/dashboard/orders", icon: Package, unreadCount: 0 },
  ],
}));

beforeEach(() => push.mockReset());

describe("KeyboardShortcuts", () => {
  it("g luego p va a Pedidos", async () => {
    render(<KeyboardShortcuts />);
    await userEvent.keyboard("gp");
    expect(push).toHaveBeenCalledWith("/dashboard/orders");
  });

  it("no navega a pantallas fuera del menú del rol", async () => {
    render(<KeyboardShortcuts />);
    await userEvent.keyboard("gc");
    expect(push).not.toHaveBeenCalled();
  });

  it("mientras se escribe, las letras no son atajos", async () => {
    render(
      <>
        <input aria-label="campo" />
        <KeyboardShortcuts />
      </>
    );
    await userEvent.type(screen.getByLabelText("campo"), "gp?");
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("? abre la lista de atajos del rol", async () => {
    render(<KeyboardShortcuts />);
    await userEvent.keyboard("?");
    const dialog = screen.getByRole("dialog", { name: "Atajos de teclado" });
    expect(dialog).toHaveTextContent("Pedidos");
    expect(dialog).toHaveTextContent("Nuevo pedido");
    expect(dialog).not.toHaveTextContent("Clientes");
  });
});
