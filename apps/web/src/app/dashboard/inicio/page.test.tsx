import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InicioPage from "./page";
import type { DesignDashboard, ProductionDashboard, ReceptionDashboard } from "@/types";

const mocks = vi.hoisted(() => ({
  roles: [] as string[],
  reception: undefined as unknown,
  design: undefined as unknown,
  production: undefined as unknown,
  advance: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    roles: mocks.roles,
    session: { user: { first_name: "Rita" } },
    isSessionLoading: false,
  }),
}));

const query = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  updatedAt: Date.now(),
  refetch: vi.fn(),
});
vi.mock("@/hooks/useDashboard", () => ({
  useReceptionDashboard: () => query(mocks.reception),
  useDesignDashboard: () => query(mocks.design),
  useProductionDashboard: () => query(mocks.production),
}));

vi.mock("@/hooks/useMyTasks", () => ({
  useAdvanceMyTask: () => ({ advance: mocks.advance, pendingKey: null }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [
      { id: 1, type: "order_assigned", title: "Nuevo pedido en el área", body: "Pedido #12", read: false, createdAt: new Date().toISOString() },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/components/orders/OrderDetailDialog", () => ({
  OrderDetailDialog: ({ orderId }: { orderId: number | null }) =>
    orderId ? <div data-testid="order-detail">Pedido {orderId}</div> : null,
}));

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="chart" /> }));

const H = 3_600_000;
const iso = (hours: number) => new Date(Date.now() + hours * H).toISOString();
const ref = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  clientName: "Luis García",
  description: "",
  products: [{ customName: "Figuras", quantity: 12 }],
  deliveryDate: iso(24 * 5),
  creationDate: iso(-24),
  statusName: "pendiente",
  ...extra,
});

const RECEPTION: ReceptionDashboard = {
  generatedAt: iso(0),
  dayStart: iso(-10),
  totals: { active: 12, inDesign: 3, waitingClient: 2, inProduction: 6, ready: 1, noDate: 1 },
  deadlines: { overdue: 2, atRisk: 3, onTime: 5, noDate: 1 },
  today: { created: 4, delivered: 2, tasksCompleted: 7, designsApproved: 1 },
  areas: [
    { area: "diseno", pending: 1, inProgress: 2, doneToday: 1, overdue: 0, atRisk: 1, oldestWaitingSince: iso(-30), upcoming: 0, changesRequested: 1, waitingClient: 2, people: ["Ana"], health: "warning" },
    { area: "taller", pending: 2, inProgress: 1, doneToday: 3, overdue: 1, atRisk: 0, oldestWaitingSince: iso(-5), upcoming: 2, people: ["Beto"], health: "critical" },
  ],
  attention: [
    { ...ref(7), reason: "overdue", since: iso(-3), area: "taller" },
    { ...ref(8), reason: "waiting_client", since: iso(-72), area: "diseno" },
  ],
  attentionTotal: 2,
  throughput: Array.from({ length: 7 }, (_, i) => ({ day: iso(-24 * (6 - i)), created: i, delivered: 1 })),
  clientsDue: [
    { clientId: 3, clientName: "Colegio Monterrey", lastOrderAt: iso(-24 * 31), nextExpectedAt: iso(-24), medianDays: 30, topProduct: "Figuras", ordersAnalyzed: 6 },
  ],
  alerts: {
    lowStock: 1,
    outOfStock: 1,
    lowStockItems: [
      { id: 1, name: "Hilo rojo", area: "bordado", unit: "cono", quantity: 0, minStock: 3, stockStatus: "out" },
    ],
    purchasesDue: 2,
  },
};

const PRODUCTION: ProductionDashboard = {
  generatedAt: iso(0),
  dayStart: iso(-10),
  areas: ["taller"],
  counters: { overdue: 1, atRisk: 0, notStarted: 2, inProgress: 1, doneToday: 3, upcoming: 1 },
  items: [
    { ...ref(10, { products: [{ customName: "Letrero", quantity: 1 }] }), key: "task-1", taskId: 1, area: "taller", status: "en_proceso", mine: true, assignee: { id: 5, name: "Beto" }, startedAt: iso(-2), availableSince: iso(-20) },
    { ...ref(11, { deliveryDate: iso(-4), products: [{ customName: "Lona", quantity: 2 }] }), key: "task-2", taskId: 2, area: "taller", status: "pendiente", mine: false, assignee: null, startedAt: null, availableSince: iso(-30) },
    { ...ref(12, { deliveryDate: null, products: [{ customName: "Acrílico", quantity: 3 }] }), key: "task-3", taskId: 3, area: "taller", status: "pendiente", mine: false, assignee: null, startedAt: null, availableSince: iso(-1) },
  ],
  upcoming: [{ ...ref(20), area: "taller", designStatus: "en diseño" }],
  team: [{ name: "Beto", inProgress: 1 }],
  events: [],
};

const DESIGN: DesignDashboard = {
  generatedAt: iso(0),
  dayStart: iso(-10),
  counters: { changesRequested: 1, notStarted: 1, inProgress: 1, waitingClient: 1, overdue: 0, atRisk: 0, approvedToday: 1, approvedWeek: 4 },
  items: [
    { ...ref(30), key: "design-30", status: "en diseño", mine: false, assignee: null, designStartedAt: null, designStartedByName: null, round: 0, lastSentAt: null, lastFeedbackAt: null, availableSince: iso(-5), areas: ["impresiones"] },
    { ...ref(31), key: "design-31", status: "cambios solicitados", mine: true, assignee: { id: 9, name: "Ana" }, designStartedAt: iso(-50), designStartedByName: "Ana", round: 1, lastSentAt: iso(-40), lastFeedbackAt: iso(-3), availableSince: iso(-3), areas: [] },
    { ...ref(32), key: "design-32", status: "en diseño", mine: true, assignee: { id: 9, name: "Ana" }, designStartedAt: iso(-2), designStartedByName: "Ana", round: 0, lastSentAt: null, lastFeedbackAt: null, availableSince: iso(-10), areas: [] },
  ],
  waitingClient: [
    { ...ref(33), key: "design-33", status: "esperando autorización", mine: false, assignee: null, designStartedAt: iso(-90), designStartedByName: "Ana", round: 1, lastSentAt: iso(-60), lastFeedbackAt: null, availableSince: iso(-90), areas: [] },
  ],
  team: [
    { userId: 9, name: "Ana", active: 2, inProgress: 2 },
    { userId: null, name: "Sin tomar", active: 1, inProgress: 0 },
  ],
  rounds: { avgToApproval: 1.5, approvedLast30: 6, manyRounds: 0 },
};

beforeEach(() => {
  mocks.roles = [];
  mocks.reception = RECEPTION;
  mocks.design = DESIGN;
  mocks.production = PRODUCTION;
  mocks.advance.mockReset();
  window.localStorage.clear();
});

describe("Inicio de Recepción", () => {
  it("números clave con acceso a sus listas, atención con la acción sugerida y áreas en vivo", async () => {
    mocks.roles = ["recepcion"];
    render(<InicioPage />);

    expect(screen.getByText(/12 pedidos activos · 2 vencidos · 3 por vencer · 1 listo para entregar/)).toBeInTheDocument();
    expect(screen.getByText("En vivo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vencidos\s*2/ })).toHaveAttribute("href", "/dashboard/orders?plazo=overdue");

    const attention = screen.getByRole("region", { name: /Requiere atención/ });
    expect(within(attention).getByText(/Montaje enviado hace 3 días: conviene llamar al cliente/)).toBeInTheDocument();
    await userEvent.click(within(attention).getAllByRole("button", { name: "Abrir" })[0]);
    expect(screen.getByTestId("order-detail")).toHaveTextContent("Pedido 7");

    const areas = screen.getByRole("region", { name: /Áreas en vivo/ });
    expect(within(areas).getByText("Con vencidos")).toBeInTheDocument();
    expect(within(areas).getByText("+2 llegan de Diseño")).toBeInTheDocument();
    expect(within(areas).getByText("Trabajando: Beto")).toBeInTheDocument();

    const due = screen.getByRole("region", { name: /Clientes por pedir/ });
    expect(within(due).getByText(/Pide cada ~30 días/)).toBeInTheDocument();
    expect(within(due).getByRole("link", { name: "Nuevo pedido para Colegio Monterrey" })).toHaveAttribute(
      "href",
      "/dashboard/orders?new=1&newFor=3"
    );

    const alerts = screen.getByRole("region", { name: "Alertas" });
    expect(within(alerts).getByText("Hilo rojo")).toBeInTheDocument();
    expect(within(alerts).getByText(/2 compras de materiales pendientes/)).toBeInTheDocument();
  });

  it("sin pendientes: lo dice en vez de mostrar una lista vacía", () => {
    mocks.roles = ["admin"];
    mocks.reception = { ...RECEPTION, attention: [], attentionTotal: 0, clientsDue: [] };
    render(<InicioPage />);
    expect(screen.getByText(/Todo en orden/)).toBeInTheDocument();
  });
});

describe("Inicio de Producción", () => {
  it("ordena por prioridad (vencido, sin empezar, en curso) y la acción avanza la tarea", async () => {
    mocks.roles = ["taller"];
    render(<InicioPage />);

    const next = screen.getByRole("region", { name: /Siguiente trabajo/ });
    expect(within(next).getByText("Lona ×2")).toBeInTheDocument();
    expect(within(next).getByText(/^Vencido hace 4 horas/)).toBeInTheDocument();
    await userEvent.click(within(next).getByRole("button", { name: "Tomar y empezar" }));
    expect(mocks.advance).toHaveBeenCalledWith(expect.objectContaining({ taskId: 2, kind: "production" }), "en_proceso");

    const queue = screen.getByRole("region", { name: /Tu lista por prioridad/ });
    expect(within(queue).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Vencidos1",
      "Sin empezar1",
      "En curso1",
    ]);
    await userEvent.click(within(queue).getByRole("button", { name: "Terminar: pedido #10" }));
    expect(mocks.advance).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 1 }), "terminado");

    expect(screen.getByRole("region", { name: /Llegan de Diseño/ })).toBeInTheDocument();
    expect(screen.getByText("Nuevo pedido en el área")).toBeInTheDocument();
  });
});

describe("Inicio de Diseño", () => {
  it("cambios del cliente antes que lo nuevo; esperando al cliente y equipo al costado", () => {
    mocks.roles = ["diseno"];
    render(<InicioPage />);

    const next = screen.getByRole("region", { name: /Siguiente diseño/ });
    expect(within(next).getByRole("button", { name: "Ver cambios" })).toBeInTheDocument();

    const queue = screen.getByRole("region", { name: /Tu bandeja por prioridad/ });
    expect(within(queue).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Cambios del cliente1",
      "Sin empezar1",
      "En curso1",
    ]);
    expect(within(screen.getByRole("region", { name: /Esperando al cliente/ })).getByText(/Ronda 1 enviada hace 2 días/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Equipo" })).getByText("Sin tomar")).toBeInTheDocument();
    expect(screen.getByText(/rondas en promedio hasta autorizar/)).toBeInTheDocument();
  });
});

describe("Inicio con Diseño y Producción", () => {
  it("permite elegir cuál ver y lo recuerda", async () => {
    mocks.roles = ["diseno", "bordado"];
    const { unmount } = render(<InicioPage />);
    expect(screen.getByRole("region", { name: /Siguiente diseño/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Producción" }));
    expect(screen.getByRole("region", { name: /Siguiente trabajo/ })).toBeInTheDocument();
    unmount();

    render(<InicioPage />);
    expect(screen.getByRole("region", { name: /Siguiente trabajo/ })).toBeInTheDocument();
  });
});
