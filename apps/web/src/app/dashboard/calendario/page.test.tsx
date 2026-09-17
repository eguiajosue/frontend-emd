import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarioPage from "./page";
import type { Order } from "@/types";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageOperations: true, isSessionLoading: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: () => ({ data: [] }),
}));

const buildOrder = (id: number, area: string | null): Order =>
  ({
    id,
    description: `Pedido ${id}`,
    deliveryDate: "2026-05-10T00:00:00.000Z",
    area,
  }) as Order;

const orders: Order[] = [
  buildOrder(1, "taller"),
  buildOrder(2, "diseno"),
  buildOrder(3, null),
];

vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => ({ data: orders, isPending: false, isError: false, refetch: vi.fn() }),
}));

// El resto de las vistas del calendario (grillas, sheets, diálogos) no son el
// objeto de este test — se reemplazan por un stub que expone qué `orders` le
// llegaron después de filtrar, que es lo que se quiere verificar acá: que
// `AreaFilterBar` filtra tanto `events` como `orders` (antes sólo eventos).
vi.mock("@/components/calendar/TeamCalendar", () => ({
  TeamCalendar: ({ orders: visibleOrders }: { orders: Order[] }) => (
    <div data-testid="team-calendar">
      {visibleOrders.map((o) => (
        <span key={o.id}>{`orden-${o.id}`}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/components/calendar/TimeGridCalendar", () => ({ TimeGridCalendar: () => null }));
vi.mock("@/components/calendar/mobile/MobileMonthList", () => ({ MobileMonthList: () => null }));
vi.mock("@/components/calendar/mobile/MobileDayWeekView", () => ({ MobileDayWeekView: () => null }));
vi.mock("@/components/calendar/UpcomingEventsSheet", () => ({ UpcomingEventsSheet: () => null }));
vi.mock("@/components/calendar/CalendarEventDialog", () => ({ CalendarEventDialog: () => null }));
vi.mock("@/components/calendar/CalendarTasksList", () => ({ CalendarTasksList: () => null }));
vi.mock("@/components/orders/OrderDetailDialog", () => ({ OrderDetailDialog: () => null }));

describe("CalendarioPage - filtro de área también sobre pedidos", () => {
  it("con 'Todas', muestra los pedidos de toda área (incluido sin área)", () => {
    render(<CalendarioPage />);

    const calendar = screen.getByTestId("team-calendar");
    expect(calendar).toHaveTextContent("orden-1");
    expect(calendar).toHaveTextContent("orden-2");
    expect(calendar).toHaveTextContent("orden-3");
  });

  it("al elegir un área específica, sólo deja los pedidos de esa área (antes se mostraban todos igual)", async () => {
    render(<CalendarioPage />);

    await userEvent.click(screen.getByRole("tab", { name: /Taller/i }));

    const calendar = screen.getByTestId("team-calendar");
    expect(calendar).toHaveTextContent("orden-1");
    expect(calendar).not.toHaveTextContent("orden-2");
    expect(calendar).not.toHaveTextContent("orden-3");
  });
});
