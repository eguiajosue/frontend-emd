import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderQuickStatusChip } from "./OrderQuickStatusChip";
import type { Order } from "@/types";

let sessionRoles: string[] = [];

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { roles: sessionRoles, token: "t" } } }),
}));

vi.mock("@/hooks/useOrders", () => ({
  useMoveOrderStatus: () => ({ move: vi.fn(), isMoving: false }),
}));

const baseOrder: Order = {
  id: 1,
  description: "Pedido de prueba",
  creationDate: "2026-01-01T00:00:00.000Z",
  statusId: 4, // "terminado"
  status: { id: 4, name: "terminado" },
  deliveredAt: null,
};

describe("OrderQuickStatusChip", () => {
  it("recepción sí ve el botón para marcar entregado (terminado -> entregado)", () => {
    sessionRoles = ["recepcion"];
    render(<OrderQuickStatusChip order={baseOrder} />);
    expect(screen.getByRole("button", { name: /marcar entregado/i })).toBeInTheDocument();
  });

  it("producción NO ve un botón para marcar entregado, aunque \"terminado\" sea su etapa", () => {
    // Bug real: producción puede tocar "terminado" (su propia etapa), pero el
    // SIGUIENTE paso del flujo lineal es "entregado", que es de Recepción. Sin
    // el chequeo del estado destino, se ofrecía "Marcar entregado" a
    // producción aunque el backend lo rechazara con 403.
    sessionRoles = ["bordado"];
    render(<OrderQuickStatusChip order={baseOrder} />);
    expect(screen.queryByRole("button", { name: /marcar entregado/i })).toBeNull();
  });

  it("producción sí ve el botón para avanzar dentro de su propio flujo (pendiente -> en proceso)", () => {
    sessionRoles = ["bordado"];
    render(<OrderQuickStatusChip order={{ ...baseOrder, statusId: 1, status: { id: 1, name: "pendiente" } }} />);
    expect(screen.getByRole("button", { name: /marcar en proceso/i })).toBeInTheDocument();
  });
});
