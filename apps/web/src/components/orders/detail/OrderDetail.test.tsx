import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderProgressPanel } from "./OrderProgressPanel";
import { OrderDetailsSection } from "./OrderDetailsSection";
import { getOrderDetailPermissions, type OrderDetailViewer } from "@/lib/orderDetail";
import type { Order, OrderAreaTask } from "@/types";

let tasks: OrderAreaTask[] = [];
vi.mock("@/hooks/useAreaTasks", () => ({ useAreaTasks: () => ({ tasks }) }));
vi.mock("@/hooks/usePendingSync", () => ({ usePendingSync: () => false }));

const move = vi.fn();
const forceFinish = vi.fn();
vi.mock("@/hooks/useOrders", () => ({
  useMoveOrderStatus: () => ({ move, isMoving: false }),
  useForceFinishOrder: () => ({ forceFinish, isForcing: false }),
}));

const update = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [{ id: 7, firstName: "Ana", lastName: "Ruiz", username: "ana" }] }),
  useEntityMutations: () => ({ update, isMutating: false }),
}));
vi.mock("@/components/orders/OrderAttendance", () => ({ OrderAttendance: () => null }));

const order = (statusId: number, name: string, extra: Partial<Order> = {}): Order =>
  ({
    id: 16,
    statusId,
    status: { id: statusId, name },
    description: "Lona 3x2",
    creationDate: new Date().toISOString(),
    deliveryDate: new Date(2026, 9, 3, 21, 30).toISOString(),
    deliveredAt: null,
    requiresDesign: false,
    orderProducts: [{ quantity: 2, customName: "Lona" }],
    ...extra,
  }) as unknown as Order;

const recepcion: OrderDetailViewer = { roles: ["recepcion"], isAdmin: false, canManageOperations: true };
const dtf: OrderDetailViewer = { roles: ["dtf"], isAdmin: false, canManageOperations: false };

function renderPanel(o: Order, viewer: OrderDetailViewer, onGoToSection = vi.fn()) {
  render(
    <OrderProgressPanel
      order={o}
      viewer={viewer}
      permissions={getOrderDetailPermissions(o, viewer)}
      onGoToSection={onGoToSection}
    />
  );
  return onGoToSection;
}

beforeEach(() => {
  tasks = [];
  move.mockReset();
  forceFinish.mockReset();
  update.mockClear();
});

describe("OrderProgressPanel", () => {
  it("no repite 'Recepción · Recepción' y ya no ofrece 'Pasar a Diseño'", () => {
    renderPanel(order(1, "pendiente", { requiresDesign: true }), recepcion);
    expect(screen.getByText(/Ahora en/).textContent).toBe("Ahora en Recepción");
    expect(screen.queryByRole("button", { name: /Pasar a Diseño/ })).not.toBeInTheDocument();
  });

  it("autorizado con áreas trabajando: recepción puede forzar 'listo para entregar' con confirmación", async () => {
    tasks = [
      { id: 1, orderId: 16, area: "dtf", status: "terminado" } as OrderAreaTask,
      { id: 2, orderId: 16, area: "bordado", status: "pendiente" } as OrderAreaTask,
    ];
    const o = order(7, "autorizado", { requiresDesign: true });
    renderPanel(o, recepcion);
    await userEvent.click(screen.getByRole("button", { name: "Cambiar estado" }));
    await userEvent.click(screen.getByRole("button", { name: /terminado/i }));
    expect(forceFinish).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("Bordado todavía no terminó");
    await userEvent.click(within(confirm).getByRole("button", { name: "Marcar listo" }));
    expect(forceFinish).toHaveBeenCalledWith(o, tasks);
    expect(move).not.toHaveBeenCalled();
  });

  it("un área ve su siguiente paso como botón y el estado sin menú", async () => {
    tasks = [{ id: 1, orderId: 16, area: "dtf", status: "en_proceso" } as OrderAreaTask];
    const o = order(3, "en proceso");
    renderPanel(o, dtf);
    expect(screen.queryByRole("button", { name: "Cambiar estado" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Marcar terminado" }));
    // Con las tareas de área: es lo que lee el tablero de producción.
    expect(move).toHaveBeenCalledWith({ ...o, areaTasks: tasks }, 4);
  });

  it("sin acción para el usuario se dice a quién se espera", () => {
    renderPanel(order(21, "en diseño", { requiresDesign: true }), dtf);
    expect(screen.getByText(/^Sigue:/)).toBeInTheDocument();
  });

  it("cancelar desde el menú de estado pide confirmación", async () => {
    tasks = [{ id: 1, orderId: 16, area: "dtf", status: "en_proceso" } as OrderAreaTask];
    const o = order(3, "en proceso");
    renderPanel(o, recepcion);
    await userEvent.click(screen.getByRole("button", { name: "Cambiar estado" }));
    await userEvent.click(screen.getByRole("button", { name: /Cancelar pedido/ }));
    expect(move).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar pedido" }));
    expect(move).toHaveBeenCalledWith({ ...o, areaTasks: tasks }, 10);
  });

  it("producción sin áreas: el botón lleva a la sección", async () => {
    const go = renderPanel(order(3, "en proceso"), recepcion);
    await userEvent.click(screen.getByRole("button", { name: /Definir áreas/ }));
    expect(go).toHaveBeenCalledWith("areas");
  });
});

describe("OrderDetailsSection", () => {
  function renderDetails(viewer: OrderDetailViewer) {
    const o = order(3, "en proceso");
    let editing = false;
    const onEditingChange = vi.fn((next: boolean) => {
      editing = next;
      rerender();
    });
    const ui = () => (
      <OrderDetailsSection
        order={o}
        permissions={getOrderDetailPermissions(o, viewer)}
        editing={editing}
        onEditingChange={onEditingChange}
      />
    );
    const { rerender: rr } = render(ui());
    const rerender = () => rr(ui());
    return { o, onEditingChange };
  }

  it("se lee por defecto: sin inputs ni 'Guardar'", () => {
    renderDetails(recepcion);
    expect(screen.getByText("Lona 3x2")).toBeInTheDocument();
    expect(screen.getByText("× 2")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
  });

  it("un área no puede editar", () => {
    renderDetails(dtf);
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
  });

  it("Editar abre el formulario (sin 'Área actual') y guarda con la fecha local", async () => {
    const { o } = renderDetails(recepcion);
    await userEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(screen.queryByText(/Área/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de entrega")).toHaveValue("2026-10-03");
    await userEvent.selectOptions(screen.getByLabelText("Asignado a"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(update).toHaveBeenCalledWith(o.id, {
      description: "Lona 3x2",
      deliveryDate: new Date(2026, 9, 3, 21, 30).toISOString(),
      assignedUserId: 7,
    });
  });
});
