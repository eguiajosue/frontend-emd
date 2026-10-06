import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoffStrip } from "./OrderHandoff";
import { buildOrderHandoff } from "@/lib/orderHandoff";
import type { Order, OrderAreaTask } from "@/types";

const order = (statusName: string, extra: Partial<Order> = {}): Order =>
  ({
    id: 1,
    statusId: 1,
    status: { id: 1, name: statusName },
    description: "",
    creationDate: "",
    deliveredAt: null,
    requiresDesign: true,
    ...extra,
  }) as unknown as Order;

const task = (id: number, area: string, status: OrderAreaTask["status"]): OrderAreaTask =>
  ({ id, orderId: 1, area, status, createdAt: "" }) as OrderAreaTask;

/** La tira renderizada, etapa por etapa. */
function stages() {
  return screen.getByRole("list").querySelectorAll("li > span");
}

describe("HandoffStrip", () => {
  it("dibuja la cadena completa cuando el pedido pasa por diseño", () => {
    render(<HandoffStrip handoff={buildOrderHandoff(order("en diseño"), [])} />);
    const labels = [...stages()].map((el) => el.textContent);
    expect(labels).toEqual([
      "Recepción",
      "Diseño",
      "Autorización",
      "Producción",
      "Entrega",
    ]);
  });

  it("dice de quién es el trabajo y cuál es el paso siguiente", () => {
    // Es la razón de ser del componente: el badge de estado dice "esperando
    // autorización" pero no dice que la pelota la tiene Recepción.
    render(
      <HandoffStrip handoff={buildOrderHandoff(order("esperando autorización"), [])} />,
    );
    // La etapa encendida en la tira.
    expect(screen.getByTitle(/^Autorización:/)).toHaveTextContent("Autorización");
    // Y debajo, quién la tiene y qué falta. "Recepción" aparece varias veces
    // (es también la primera etapa), así que se busca la frase entera.
    expect(screen.getByText(/Ahora en/).closest("p")).toHaveTextContent(
      "Ahora en Autorización · Recepción",
    );
    expect(
      screen.getByText(/Recepción registra la respuesta del cliente/),
    ).toBeInTheDocument();
  });

  it("un pedido cancelado corta la cadena y no propone un paso siguiente", () => {
    render(<HandoffStrip handoff={buildOrderHandoff(order("cancelado", { statusId: 10 }), [])} />);
    expect(screen.getByText("El pedido está cancelado.")).toBeInTheDocument();
    expect(screen.queryByText(/Ahora en/)).toBeNull();
  });

  it("sin diseño la cadena es más corta", () => {
    render(
      <HandoffStrip
        handoff={buildOrderHandoff(order("pendiente", { requiresDesign: false }), [
          task(1, "laser", "pendiente"),
        ])}
      />,
    );
    const labels = [...stages()].map((el) => el.textContent);
    expect(labels).toEqual(["Recepción", "Producción", "Entrega"]);
  });

  it("nombra el área destino cuando la producción está esperando la autorización", () => {
    render(
      <HandoffStrip
        handoff={buildOrderHandoff(order("en diseño", { productionArea: "bordado" }), [])}
      />,
    );
    // El detalle va en el `title` para no cargar la tira de texto.
    expect(screen.getByTitle(/Producción: Bordado/)).toBeInTheDocument();
  });
});
