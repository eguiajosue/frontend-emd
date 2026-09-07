import { describe, expect, it } from "vitest";
import { buildKanbanColumns, splitDesignAndProduction } from "./kanbanColumns";
import type { Order } from "@/types";

/**
 * Los estados del flujo de Diseño se siembran con ids que varían entre
 * entornos, así que acá se usan ids arbitrarios a propósito: lo que los
 * identifica es el NOMBRE que viene en `order.status`.
 */
function order(id: number, statusId: number, statusName?: string): Order {
  return {
    id,
    statusId,
    description: `Pedido ${id}`,
    creationDate: "2026-01-01T00:00:00.000Z",
    ...(statusName ? { status: { id: statusId, name: statusName } } : {}),
  } as Order;
}

describe("buildKanbanColumns", () => {
  it("incluye los pedidos en estados de Diseño, que no están en statusMap", () => {
    // Regresión: armar las columnas desde `statusMap` dejaba estos pedidos
    // fuera del tablero aunque sí aparecieran en la vista de lista.
    const columns = buildKanbanColumns([
      order(1, 6, "en diseño"),
      order(2, 7, "esperando autorización"),
    ]);

    const placed = columns.flatMap((col) => col.orders.map((o) => o.id));
    expect(placed).toEqual(expect.arrayContaining([1, 2]));
  });

  it("no pierde ningún pedido, sea cual sea su estado", () => {
    const orders = [
      order(1, 1, "pendiente"),
      order(2, 3, "en proceso"),
      order(3, 6, "en diseño"),
      order(4, 9, "autorizado"),
      order(5, 99, "estado futuro sin mapear"),
    ];

    const columns = buildKanbanColumns(orders);
    const placed = columns.flatMap((col) => col.orders.map((o) => o.id));

    expect(placed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("usa el nombre que trae el pedido como etiqueta de la columna", () => {
    const columns = buildKanbanColumns([order(1, 6, "en diseño")]);

    expect(columns.find((c) => c.statusId === 6)?.label).toBe("en diseño");
  });

  it("mantiene las columnas de producción aunque estén vacías", () => {
    const columns = buildKanbanColumns([]);

    // El tablero no cambia de forma según haya trabajo o no en cada etapa.
    expect(columns.map((c) => c.statusId)).toEqual([1, 3, 4, 5, 10]);
    expect(columns.every((c) => c.orders.length === 0)).toBe(true);
  });

  it("ordena las columnas por id de estado", () => {
    const columns = buildKanbanColumns([order(1, 6, "en diseño")]);
    const ids = columns.map((c) => c.statusId);

    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("cae al id cuando el pedido no trae nombre ni está en statusMap", () => {
    const columns = buildKanbanColumns([order(1, 77)]);

    expect(columns.find((c) => c.statusId === 77)?.label).toBe("Estado 77");
  });
});

describe("splitDesignAndProduction", () => {
  it("separa los dos circuitos por nombre de estado", () => {
    const { design, production } = splitDesignAndProduction([
      order(1, 6, "en diseño"),
      order(2, 7, "esperando autorización"),
      order(3, 8, "cambios solicitados"),
      order(4, 9, "autorizado"),
      order(5, 3, "en proceso"),
      order(6, 4, "terminado"),
    ]);

    expect(design.map((o) => o.id)).toEqual([1, 2, 3, 4]);
    expect(production.map((o) => o.id)).toEqual([5, 6]);
  });

  it("trata como producción un pedido sin nombre de estado", () => {
    const { design, production } = splitDesignAndProduction([order(1, 3)]);

    expect(design).toHaveLength(0);
    expect(production).toHaveLength(1);
  });
});
