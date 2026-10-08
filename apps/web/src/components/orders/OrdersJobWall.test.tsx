import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrdersJobWall } from "./OrdersJobWall";
import type { Order } from "@/types";

const H = 3_600_000;

function order(id: number, hoursToDue: number | null, overrides: Partial<Order> = {}): Order {
  return {
    id,
    statusId: 1,
    description: `Trabajo ${id}`,
    clientNameOverride: `Cliente ${id}`,
    creationDate: new Date(Date.now() - 24 * H).toISOString(),
    deliveryDate: hoursToDue == null ? null : new Date(Date.now() + hoursToDue * H).toISOString(),
    deliveredAt: null,
    ...overrides,
  } as Order;
}

let orders: Order[];
beforeEach(() => {
  orders = [order(1, 200), order(2, -5), order(3, 10), order(4, null)];
});

function cardIds() {
  return screen
    .getAllByRole("button", { name: /Ver detalle del pedido/ })
    .map((b) => b.getAttribute("aria-label")!.match(/#(\d+)/)![1]);
}

describe("OrdersJobWall", () => {
  it("ordena por urgencia: vencido, en riesgo, a tiempo, sin fecha", () => {
    render(<OrdersJobWall orders={orders} timeFormat="24h" onOpenOrder={vi.fn()} />);
    expect(cardIds()).toEqual(["2", "3", "1", "4"]);
  });

  it("la franja de conteos filtra por plazo y se desactiva al volver a tocarla", async () => {
    render(<OrdersJobWall orders={orders} timeFormat="24h" onOpenOrder={vi.fn()} />);
    const kpis = screen.getByRole("radiogroup", { name: "Filtrar por plazo" });
    const overdue = within(kpis).getByRole("radio", { name: /Vencido/ });

    await userEvent.click(overdue);
    expect(overdue).toHaveAttribute("aria-checked", "true");
    expect(cardIds()).toEqual(["2"]);

    await userEvent.click(overdue);
    expect(cardIds()).toHaveLength(4);
  });

  it("click en la tarjeta abre el detalle", async () => {
    const onOpen = vi.fn();
    render(<OrdersJobWall orders={orders} timeFormat="24h" onOpenOrder={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /pedido #3/ }));
    expect(onOpen).toHaveBeenCalledWith(3);
  });

  it("con selección habilitada, la casilla no abre el detalle", async () => {
    const onOpen = vi.fn();
    const onSelected = vi.fn();
    render(
      <OrdersJobWall
        orders={orders}
        timeFormat="24h"
        onOpenOrder={onOpen}
        selectable
        onSelectedChange={onSelected}
      />
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Seleccionar pedido #1" }));
    expect(onSelected).toHaveBeenCalledWith(1, true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("modo TV abre a pantalla completa, oculta entregados y se cierra con Esc", async () => {
    orders.push(order(5, 10, { statusId: 5 }));
    render(<OrdersJobWall orders={orders} timeFormat="24h" onOpenOrder={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Modo TV/ }));
    const tv = screen.getByRole("dialog", { name: "Pedidos en curso" });
    expect(within(tv).queryByRole("button", { name: /pedido #5/ })).not.toBeInTheDocument();
    expect(within(tv).getByRole("button", { name: /pedido #2/ })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
