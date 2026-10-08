import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersJobWall } from "./OrdersJobWall";
import { OrderStepProvider } from "@/hooks/useOrderStep";
import type { Order, OrderAreaTask } from "@/types";

const patch = vi.fn().mockResolvedValue({});
vi.mock("@/lib/offlineMutation", () => ({ patchStatusChange: (...a: unknown[]) => patch(...a) }));
const writeOrderStatus = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useOrders", () => ({ writeOrderStatus: (...a: unknown[]) => writeOrderStatus(...a) }));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "t" }));
vi.mock("@/hooks/useAreaSupplies", () => ({ invalidateSupplyData: vi.fn() }));
let roles = ["bordado"];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ roles, isAdmin: false, canManageOperations: roles.includes("recepcion") }),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

const H = 3_600_000;
const task = (id: number, status: OrderAreaTask["status"]): OrderAreaTask => ({
  id: id * 10,
  orderId: id,
  area: "bordado",
  status,
  createdAt: "",
});
function order(id: number, hoursToDue: number, status: OrderAreaTask["status"] = "pendiente"): Order {
  return {
    id,
    statusId: 9,
    status: { id: 9, name: "autorizado" },
    description: `Trabajo ${id}`,
    clientNameOverride: `Cliente ${id}`,
    creationDate: new Date(Date.now() - 24 * H).toISOString(),
    deliveryDate: new Date(Date.now() + hoursToDue * H).toISOString(),
    deliveredAt: null,
    areaTasks: [task(id, status)],
  } as Order;
}

function setup(orders: Order[]) {
  const client = new QueryClient();
  const onOpen = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <OrderStepProvider>
        <OrdersJobWall orders={orders} timeFormat="24h" onOpenOrder={onOpen} />
      </OrderStepProvider>
    </QueryClientProvider>
  );
  return { onOpen };
}

const card = (id: number) => document.querySelector<HTMLElement>(`[data-order-card="${id}"]`)!;

beforeEach(() => {
  roles = ["bordado"];
  patch.mockClear();
  writeOrderStatus.mockClear();
  toastSuccess.mockClear();
});

describe("siguiente paso en las tarjetas", () => {
  it("muestra la etapa, a quién le toca y el botón con el verbo", () => {
    setup([order(1, 50), order(2, 20, "en_proceso")]);
    expect(within(card(1)).getByRole("list", { name: "Etapas del pedido" })).toBeInTheDocument();
    expect(within(card(1)).getByText("Te toca")).toBeInTheDocument();
    expect(within(card(1)).getByRole("button", { name: "Empezar producción · pedido #1" })).toBeInTheDocument();
    expect(within(card(2)).getByRole("button", { name: "Marcar terminado · pedido #2" })).toBeInTheDocument();
  });

  it("un clic cambia al instante y el aviso trae Deshacer", async () => {
    const { onOpen } = setup([order(1, 50)]);
    await userEvent.click(screen.getByRole("button", { name: "Empezar producción · pedido #1" }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith("orders/1/area-tasks/10/status", { status: "en_proceso" }, "t");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const [message, options] = toastSuccess.mock.calls[0];
    expect(message).toBe("Pedido #1 → en proceso");
    expect(options.action.label).toBe("Deshacer");

    patch.mockClear();
    await act(async () => options.action.onClick());
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("orders/1/area-tasks/10/status", { status: "pendiente" }, "t")
    );
  });

  it("Recepción entrega un pedido terminado (estado del pedido, no de la tarea)", async () => {
    roles = ["recepcion"];
    setup([order(1, 50, "terminado")]);
    await userEvent.click(screen.getByRole("button", { name: "Entregar · pedido #1" }));
    expect(writeOrderStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 5, "t");
  });
});

describe("atajos de teclado", () => {
  it("flechas eligen, Enter da el paso y Z lo deshace", async () => {
    setup([order(1, 50), order(2, 10)]);
    // Orden por urgencia: #2 primero.
    await userEvent.keyboard("{ArrowRight}");
    expect(card(2)).toHaveAttribute("aria-current", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(card(1)).toHaveAttribute("aria-current", "true");
    expect(card(2)).not.toHaveAttribute("aria-current");

    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("orders/1/area-tasks/10/status", { status: "en_proceso" }, "t")
    );
    patch.mockClear();
    await userEvent.keyboard("z");
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("orders/1/area-tasks/10/status", { status: "pendiente" }, "t")
    );
  });

  it("O abre el detalle del elegido", async () => {
    const { onOpen } = setup([order(1, 50)]);
    await userEvent.keyboard("{ArrowRight}o");
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("/ busca por número y ? muestra la ayuda", async () => {
    setup([order(1, 50), order(7, 10)]);
    await userEvent.keyboard("/");
    const input = await screen.findByRole("textbox", { name: "Número de pedido" });
    await userEvent.type(input, "1{Enter}");
    await waitFor(() => expect(card(1)).toHaveAttribute("aria-current", "true"));

    await userEvent.keyboard("?");
    expect(await screen.findByRole("heading", { name: "Atajos de teclado" })).toBeInTheDocument();
    // Con la ayuda abierta las flechas no mueven la selección.
    await userEvent.keyboard("{ArrowLeft}");
    expect(card(1)).toHaveAttribute("aria-current", "true");
  });

  it("no hace nada mientras se escribe en un campo", async () => {
    setup([order(1, 50)]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(card(1)).not.toHaveAttribute("aria-current");
    input.remove();
  });
});
