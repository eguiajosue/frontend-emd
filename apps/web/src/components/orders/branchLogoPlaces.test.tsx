import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrdersJobWall } from "./OrdersJobWall";
import { OrderCard } from "./OrderCard";
import { OrderDetailHeader } from "./detail/OrderDetailHeader";
import { TvTaskCard } from "@/components/tasks/tv/TvTaskCard";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TicketContent } from "@/components/tasks/tv/TicketContent";
import { UpcomingDeliveries } from "@/components/admin/UpcomingDeliveries";
import type { MyTask, Order } from "@/types";
import type { TvTask } from "@/lib/tvBoard";

/**
 * El logo de la sucursal en CADA lugar donde se pinta un pedido: la lista y el
 * tablero de Pedidos, el detalle, las tarjetas de tarea, la tele y el ticket de
 * llegada. Los hooks de datos van simulados; lo que se prueba es QUÉ variante
 * (clara/oscura) se elige en cada fondo y que un pedido de la matriz no lleva logo.
 */

const NEGRO = "data:image/png;base64,NEGRO";
const BLANCO = "data:image/png;base64,BLANCO";

const logos = vi.hoisted(() => ({ value: undefined as undefined | { logoOnLight: string | null; logoOnDark: string | null } }));
vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: (id: number) => (id === 1 ? logos.value : undefined),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/components/orders/OrderQuickStatusChip", () => ({ OrderQuickStatusChip: () => null }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canManageOperations: false }) }));
vi.mock("@/hooks/useCalendarTasks", () => ({ useCalendarTasks: () => ({ data: [] }) }));
vi.mock("@/hooks/useOrders", () => ({ useDeleteOrder: () => ({ deleteOrder: vi.fn(), isDeleting: false }) }));

const MADERO = { id: 1, name: "Punto Madero" };
const H = 3_600_000;

function order(id: number, branch: typeof MADERO | null): Order {
  return {
    id,
    statusId: 1,
    status: { id: 1, name: "pendiente" },
    description: `Trabajo ${id}`,
    clientNameOverride: `Cliente ${id}`,
    creationDate: new Date(Date.now() - 24 * H).toISOString(),
    deliveryDate: new Date(Date.now() + 100 * H).toISOString(),
    deliveredAt: null,
    branchId: branch?.id ?? null,
    branch,
  } as unknown as Order;
}

function setLogos(both = true) {
  logos.value = both ? { logoOnLight: NEGRO, logoOnDark: BLANCO } : undefined;
}

describe("Pedidos: lista (muro) y tablero", () => {
  it("la tarjeta de la lista lleva el logo junto al cliente, con las dos versiones según el tema", () => {
    setLogos();
    render(<OrdersJobWall orders={[order(1, MADERO)]} timeFormat="24h" onOpenOrder={vi.fn()} />);
    const logo = screen.getByTestId("branch-logo");
    expect(logo).toHaveAttribute("data-surface", "auto");
    const imgs = within(logo).getAllByAltText("Punto Madero");
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual([NEGRO, BLANCO]);
    // Junto al nombre del cliente, no perdido en el pie.
    expect(logo.parentElement).toHaveTextContent("Cliente 1");
  });

  it("un pedido de la matriz no lleva logo ni badge", () => {
    setLogos();
    render(<OrdersJobWall orders={[order(2, null)]} timeFormat="24h" onOpenOrder={vi.fn()} />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("branch-badge")).not.toBeInTheDocument();
  });

  it("sin logo cargado, la tarjeta cae al badge con el nombre", () => {
    setLogos(false);
    render(<OrdersJobWall orders={[order(1, MADERO)]} timeFormat="24h" onOpenOrder={vi.fn()} />);
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Punto Madero");
  });

  it("la tarjeta del tablero (cuadrícula) también", () => {
    setLogos();
    render(<OrderCard order={order(1, MADERO)} onOpen={vi.fn()} />);
    expect(within(screen.getByTestId("branch-logo")).getAllByAltText("Punto Madero")).toHaveLength(2);
  });
});

describe("Detalle del pedido", () => {
  const permissions = { canEdit: false, canDelete: false } as never;

  it("el encabezado muestra el logo grande junto al número y el cliente", () => {
    setLogos();
    render(<OrderDetailHeader order={order(5, MADERO)} permissions={permissions} onEdit={vi.fn()} onDeleted={vi.fn()} />);
    const logo = screen.getByTestId("branch-logo");
    expect(logo.querySelector("img")).toHaveClass("h-12");
    expect(logo.querySelector("img")).toHaveAttribute("loading", "eager");
  });

  it("un pedido de la matriz no lleva logo en el encabezado", () => {
    setLogos();
    render(<OrderDetailHeader order={order(5, null)} permissions={permissions} onEdit={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
  });
});

function myTask(branch: typeof MADERO | null): MyTask {
  return {
    key: "task-1",
    kind: "production",
    area: "bordado",
    taskId: 1,
    status: "pendiente",
    mine: false,
    assignee: null,
    startedAt: null,
    order: {
      id: 111,
      description: "Mandiles",
      deliveryDate: new Date(Date.now() + 40 * H).toISOString(),
      creationDate: new Date(Date.now() - 3 * H).toISOString(),
      statusId: 9,
      clientNameOverride: "Escuela Madero",
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      branch,
    },
  } as unknown as MyTask;
}
const state = { tone: "on_time", remainingMs: 40 * H, elapsedMs: 3 * H } as const;

describe("Tareas de producción", () => {
  it("la tarjeta de la bandeja lleva el logo (tema claro/oscuro)", () => {
    setLogos();
    render(
      <TaskCard task={myTask(MADERO)} state={state} timeFormat="24h" onOpen={vi.fn()} onAdvance={vi.fn()} busy={false} />
    );
    expect(within(screen.getByTestId("branch-logo")).getAllByAltText("Punto Madero")).toHaveLength(2);
  });

  it("la bandeja de un pedido de la matriz no lleva logo", () => {
    setLogos();
    render(<TaskCard task={myTask(null)} state={state} timeFormat="24h" onOpen={vi.fn()} onAdvance={vi.fn()} busy={false} />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
  });

  it("la tarjeta del Modo TV (fondo oscuro) usa SIEMPRE el logo blanco", () => {
    setLogos();
    render(
      <ul>
        <TvTaskCard
          task={myTask(MADERO) as TvTask}
          state={state}
          now={Date.now()}
          timeFormat="24h"
          onOpen={vi.fn()}
          onAdvance={vi.fn()}
          busy={false}
          hidden={false}
          highlight={null}
          reduced
        />
      </ul>
    );
    const logo = screen.getByTestId("branch-logo");
    expect(logo).toHaveAttribute("data-surface", "dark");
    const imgs = within(logo).getAllByAltText("Punto Madero");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", BLANCO);
  });

  it("la tele sin logo cargado muestra el nombre en un badge claro", () => {
    setLogos(false);
    render(
      <ul>
        <TvTaskCard
          task={myTask(MADERO) as TvTask}
          state={state}
          now={Date.now()}
          timeFormat="24h"
          onOpen={vi.fn()}
          onAdvance={vi.fn()}
          busy={false}
          hidden={false}
          highlight={null}
          reduced
        />
      </ul>
    );
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Punto Madero");
    expect(screen.getByTestId("branch-badge")).toHaveClass("text-white/90");
  });
});

describe("Ticket de llegada (Modo TV)", () => {
  const arrival = (branch: typeof MADERO | null) => ({
    id: "a1",
    orderId: 111,
    clientName: "Escuela Madero",
    area: "bordado",
    deliveryDate: null,
    priority: "calm" as const,
    branch,
  });

  it("el ticket es papel claro: lleva el logo NEGRO, aunque la tele sea oscura", () => {
    setLogos();
    render(<TicketContent arrival={arrival(MADERO)} compact={false} timeFormat="24h" />);
    const logo = screen.getByTestId("branch-logo");
    expect(logo).toHaveAttribute("data-surface", "light");
    expect(within(logo).getByAltText("Punto Madero")).toHaveAttribute("src", NEGRO);
    expect(within(logo).getByAltText("Punto Madero")).toHaveAttribute("loading", "eager");
    expect(screen.queryByText("SUCURSAL")).not.toBeInTheDocument();
  });

  it("sin logo, el ticket pone una fila SUCURSAL con el nombre", () => {
    setLogos(false);
    render(<TicketContent arrival={arrival(MADERO)} compact={false} timeFormat="24h" />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
    expect(screen.getByText("SUCURSAL")).toBeInTheDocument();
    expect(screen.getByText("Punto Madero")).toBeInTheDocument();
  });

  it("un pedido de la matriz no lleva nada de sucursal", () => {
    setLogos();
    render(<TicketContent arrival={arrival(null)} compact timeFormat="24h" />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
    expect(screen.queryByText("SUCURSAL")).not.toBeInTheDocument();
  });
});

describe("Listas del panel", () => {
  it("Próximas entregas muestra el logo del pedido de sucursal", () => {
    setLogos();
    render(<UpcomingDeliveries orders={[order(1, MADERO), order(2, null)]} onSelectOrder={vi.fn()} />);
    expect(screen.getAllByTestId("branch-logo")).toHaveLength(1);
  });
});
