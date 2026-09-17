import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrdersFilterBar, EMPTY_ORDERS_FILTERS } from "./OrdersFilterBar";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, User } from "@/types";

vi.mock("@/hooks/usePermissions");
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const clients: Client[] = [];
const users: User[] = [];

function mockPermissions(roles: string[]) {
  vi.mocked(usePermissions).mockReturnValue({
    roles,
    isAdmin: false,
    canManageOperations: roles.includes("recepcion"),
    canManageUsers: false,
    isSessionLoading: false,
    session: null,
  } as unknown as ReturnType<typeof usePermissions>);
}

describe("OrdersFilterBar - Sólo mis pedidos (Recepción)", () => {
  it("un usuario de recepción ve el switch 'Sólo mis pedidos'", async () => {
    mockPermissions(["recepcion"]);
    render(<OrdersFilterBar clients={clients} users={users} filters={EMPTY_ORDERS_FILTERS} onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    expect(screen.getByLabelText("Sólo mis pedidos")).toBeInTheDocument();
  });

  it("un rol operativo (sin recepción) no ve el switch", async () => {
    mockPermissions(["taller"]);
    render(<OrdersFilterBar clients={clients} users={users} filters={EMPTY_ORDERS_FILTERS} onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    expect(screen.queryByLabelText("Sólo mis pedidos")).not.toBeInTheDocument();
  });

  it("al activarlo, avisa el cambio y aparece el chip 'Mis pedidos'", async () => {
    mockPermissions(["recepcion"]);
    const onChange = vi.fn();
    render(<OrdersFilterBar clients={clients} users={users} filters={EMPTY_ORDERS_FILTERS} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    await userEvent.click(screen.getByLabelText("Sólo mis pedidos"));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDERS_FILTERS, createdByMe: true });
  });

  it("con createdByMe activo, muestra el chip 'Mis pedidos' en el trigger", () => {
    mockPermissions(["recepcion"]);
    render(
      <OrdersFilterBar
        clients={clients}
        users={users}
        filters={{ ...EMPTY_ORDERS_FILTERS, createdByMe: true }}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /filtros/i })).toHaveTextContent("1");
  });
});
