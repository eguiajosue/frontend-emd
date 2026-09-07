import { describe, expect, it } from "vitest";
import { buildOrderHandoff } from "./orderHandoff";
import type { Order, OrderAreaTask } from "@/types";

const order = (statusId: number, name: string, extra: Partial<Order> = {}): Order =>
  ({
    id: 1,
    statusId,
    status: { id: statusId, name },
    description: "",
    creationDate: "",
    deliveredAt: null,
    requiresDesign: true,
    ...extra,
  }) as unknown as Order;

const task = (
  id: number,
  area: string,
  status: OrderAreaTask["status"],
  assignee = "Ana",
): OrderAreaTask =>
  ({
    id,
    orderId: 1,
    area,
    status,
    createdAt: "",
    assignedUser: { id: 2, firstName: assignee, lastName: "", username: "a" },
  }) as unknown as OrderAreaTask;

/** Invariante del componente: siempre hay exactamente una etapa encendida. */
function currentCount(stages: { state: string }[]): number {
  return stages.filter((s) => s.state === "current").length;
}

describe("buildOrderHandoff", () => {
  it("siempre enciende exactamente una etapa", () => {
    const casos = [
      buildOrderHandoff(order(1, "pendiente"), []),
      buildOrderHandoff(order(6, "en diseño"), []),
      buildOrderHandoff(order(7, "esperando autorización"), []),
      buildOrderHandoff(order(9, "autorizado"), [task(1, "dtf", "pendiente")]),
      buildOrderHandoff(order(4, "terminado"), [task(1, "dtf", "terminado")]),
      buildOrderHandoff(order(5, "entregado"), [task(1, "dtf", "terminado")]),
      buildOrderHandoff(order(10, "cancelado"), []),
      buildOrderHandoff(order(1, "pendiente", { requiresDesign: false }), []),
    ];
    casos.forEach((handoff) => expect(currentCount(handoff.stages)).toBe(1));
  });

  it("un pedido que ya pasó por diseño no vuelve a Recepción", () => {
    // Regresión: con `requiresDesign` y estado "terminado", el nombre del
    // estado no es de diseño, así que se marcaba Recepción como etapa actual y
    // se proponía "pasarlo a Diseño" con el trabajo de producción ya hecho.
    const handoff = buildOrderHandoff(order(4, "terminado"), [
      task(1, "dtf", "terminado"),
    ]);
    expect(handoff.current.key).toBe("entrega");
    expect(handoff.nextStep).toContain("entrega");
  });

  it("marca Producción bloqueada sólo si el área destino ya está definida", () => {
    const sinArea = buildOrderHandoff(order(6, "en diseño"), []);
    expect(sinArea.stages.find((s) => s.key === "produccion")?.state).toBe("pending");

    const conArea = buildOrderHandoff(
      order(6, "en diseño", { productionArea: "bordado" }),
      [],
    );
    const produccion = conArea.stages.find((s) => s.key === "produccion");
    expect(produccion?.state).toBe("blocked");
    expect(produccion?.detail).toContain("Bordado");
  });

  it("esperando autorización el trabajo es de Recepción, no de Diseño", () => {
    // El badge de estado dice "esperando autorización" y el área sigue siendo
    // Diseño, pero quien tiene que hacer algo es Recepción.
    const handoff = buildOrderHandoff(order(7, "esperando autorización"), []);
    expect(handoff.current.key).toBe("autorizacion");
    expect(handoff.holderLabel).toBe("Recepción");
  });

  it("no repite a la misma persona cuando tiene dos áreas", () => {
    const handoff = buildOrderHandoff(order(9, "autorizado"), [
      task(1, "dtf", "pendiente", "Ana"),
      task(2, "bordado", "pendiente", "Ana"),
    ]);
    expect(handoff.holderLabel).toBe("Ana");
  });

  it("sin diseño la cadena no muestra Diseño ni Autorización", () => {
    const handoff = buildOrderHandoff(order(1, "pendiente", { requiresDesign: false }), [
      task(1, "laser", "pendiente"),
    ]);
    expect(handoff.stages.map((s) => s.key)).toEqual([
      "recepcion",
      "produccion",
      "entrega",
    ]);
  });

  it("un pedido cancelado lo dice y no propone un paso siguiente", () => {
    const handoff = buildOrderHandoff(order(10, "cancelado"), []);
    expect(handoff.cancelled).toBe(true);
    expect(handoff.nextStep).toContain("cancelado");
  });
});
