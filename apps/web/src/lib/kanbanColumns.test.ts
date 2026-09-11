import { describe, expect, it } from "vitest";
import {
  buildDesignColumns,
  buildProductionColumns,
  effectiveProductionStatusId,
  splitDesignAndProduction,
} from "./kanbanColumns";
import type { Order, Status } from "@/types";

function makeOrder(partial: Partial<Order> & { id: number }): Order {
  return {
    statusId: 1,
    description: "",
    creationDate: "2026-01-01T00:00:00.000Z",
    deliveredAt: null,
    ...partial,
  } as Order;
}

const STATUSES: Status[] = [
  { id: 1, name: "pendiente" },
  { id: 6, name: "en diseño" },
  { id: 7, name: "esperando autorización" },
  { id: 8, name: "cambios solicitados" },
  { id: 9, name: "autorizado" },
] as Status[];

describe("buildProductionColumns", () => {
  it("muestra siempre las 5 columnas de producción y ninguna de diseño", () => {
    const columns = buildProductionColumns([]);
    expect(columns.map((c) => c.label)).toEqual([
      "pendiente",
      "en proceso",
      "terminado",
      "entregado",
      "cancelado",
    ]);
  });

  it("no crea columnas para estados del circuito de diseño", () => {
    // Regresión: sembrar el tablero con todos los estados presentes mezclaba
    // 'en diseño' entre las columnas de producción.
    const columns = buildProductionColumns([
      makeOrder({ id: 1, statusId: 6, status: { id: 6, name: "en diseño" } as Status }),
    ]);
    expect(columns).toHaveLength(5);
    expect(columns.every((c) => c.orders.length === 0)).toBe(true);
  });

  it("ubica un pedido autorizado en 'pendiente' del área que lo va a producir", () => {
    const order = makeOrder({
      id: 2,
      statusId: 9,
      status: { id: 9, name: "autorizado" } as Status,
      areaTasks: [{ id: 1, orderId: 2, area: "bordado", status: "pendiente", createdAt: "" }],
    });
    expect(effectiveProductionStatusId(order, ["bordado"])).toBe(1);
    const pendiente = buildProductionColumns([order], ["bordado"])[0];
    expect(pendiente.orders.map((o) => o.id)).toEqual([2]);
  });

  it("usa la tarea del área de quien mira, no la más avanzada", () => {
    const order = makeOrder({
      id: 3,
      statusId: 9,
      status: { id: 9, name: "autorizado" } as Status,
      areaTasks: [
        { id: 1, orderId: 3, area: "dtf", status: "terminado", createdAt: "" },
        { id: 2, orderId: 3, area: "bordado", status: "en_proceso", createdAt: "" },
      ],
    });
    expect(effectiveProductionStatusId(order, ["bordado"])).toBe(3);
    // Sin área propia (recepción/admin) manda la MENOS avanzada: el pedido no
    // está listo hasta que terminan todas.
    expect(effectiveProductionStatusId(order, [])).toBe(3);
  });

  it("entregado y cancelado ganan sobre cualquier tarea de área", () => {
    const order = makeOrder({
      id: 4,
      statusId: 5,
      areaTasks: [{ id: 1, orderId: 4, area: "dtf", status: "pendiente", createdAt: "" }],
    });
    expect(effectiveProductionStatusId(order, ["dtf"])).toBe(5);
  });
});

describe("buildDesignColumns", () => {
  it("muestra las etapas activas del circuito de diseño, sin 'autorizado'", () => {
    // Autorizar ARCHIVA el pedido para Diseño: su trabajo terminó, así que no
    // hay columna "autorizado" en este tablero (sigue visible en la Lista).
    const columns = buildDesignColumns([], STATUSES);
    expect(columns.map((c) => c.label)).toEqual([
      "pendiente",
      "en diseño",
      "esperando autorización",
      "cambios solicitados",
    ]);
    expect(columns.map((c) => c.statusId)).toEqual([1, 6, 7, 8]);
  });

  it("un pedido autorizado no entra en ninguna columna del tablero de diseño", () => {
    const order = makeOrder({
      id: 8,
      statusId: 9,
      status: { id: 9, name: "autorizado" } as Status,
      archivedAt: "2026-01-02T00:00:00.000Z",
    });
    const columns = buildDesignColumns([order], STATUSES);
    expect(columns.every((c) => c.orders.length === 0)).toBe(true);
  });

  it("resuelve el id desde los propios pedidos si el catálogo no cargó", () => {
    const order = makeOrder({
      id: 5,
      statusId: 42,
      status: { id: 42, name: "en diseño" } as Status,
    });
    const columns = buildDesignColumns([order], []);
    const enDiseno = columns.find((c) => c.label === "en diseño");
    expect(enDiseno?.statusId).toBe(42);
    expect(enDiseno?.orders.map((o) => o.id)).toEqual([5]);
  });
});

describe("splitDesignAndProduction", () => {
  it("un pedido autorizado sale del tablero de Diseño y queda sólo en producción", () => {
    const order = makeOrder({
      id: 6,
      statusId: 9,
      status: { id: 9, name: "autorizado" } as Status,
      archivedAt: "2026-01-02T00:00:00.000Z",
    });
    const { design, production } = splitDesignAndProduction([order]);
    expect(design).toHaveLength(0);
    expect(production.map((o) => o.id)).toEqual([6]);
  });

  it("un pedido en diseño NO llega a producción", () => {
    const order = makeOrder({
      id: 7,
      statusId: 6,
      status: { id: 6, name: "en diseño" } as Status,
    });
    const { design, production } = splitDesignAndProduction([order]);
    expect(design).toHaveLength(1);
    expect(production).toHaveLength(0);
  });
});
