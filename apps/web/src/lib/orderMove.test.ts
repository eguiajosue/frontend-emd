import { describe, expect, it } from "vitest";
import { areaTasksToMove, canApplyOrderMove } from "./orderMove";
import type { Order, OrderAreaTask } from "@/types";

const task = (id: number, area: string, status: OrderAreaTask["status"]): OrderAreaTask =>
  ({ id, orderId: 7, area, status, createdAt: "" }) as OrderAreaTask;

const order = (tasks: OrderAreaTask[] = []): Order =>
  ({
    id: 7,
    statusId: 9,
    status: { id: 9, name: "autorizado" },
    description: "",
    creationDate: "",
    deliveredAt: null,
    areaTasks: tasks,
  }) as unknown as Order;

const worker = (...areas: string[]) => ({ areas, isManager: false });
const manager = { areas: [], isManager: true };

describe("areaTasksToMove", () => {
  it("quien trabaja un área mueve la suya", () => {
    // Regresión: el tablero ubica el pedido por ESTA tarea, así que cambiar el
    // estado tiene que escribir acá y no en `Order.statusId` — escribir el
    // pedido devolvía 200 y la tarjeta se quedaba en su columna.
    const o = order([task(1, "dtf", "terminado"), task(2, "bordado", "pendiente")]);
    expect(areaTasksToMove(o, worker("bordado")).map((t) => t.id)).toEqual([2]);
  });

  it("recepción mueve todas: el pedido entero cambia de estado", () => {
    const o = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(areaTasksToMove(o, manager).map((t) => t.id)).toEqual([1, 2]);
  });

  it("sin área propia ni permiso de coordinación, sólo si no hay ambigüedad", () => {
    const una = order([task(1, "dtf", "pendiente")]);
    expect(areaTasksToMove(una, worker()).map((t) => t.id)).toEqual([1]);
    const dos = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(areaTasksToMove(dos, worker())).toEqual([]);
  });

  it("un pedido sin tareas de área no tiene tarea que mover", () => {
    expect(areaTasksToMove(order(), worker("bordado"))).toEqual([]);
  });
});

describe("canApplyOrderMove", () => {
  it("permite mover a un estado de producción cuando hay tarea del área", () => {
    const o = order([task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 3, worker("bordado"))).toBe(true);
  });

  it("bloquea el destino que la tarea ya tiene", () => {
    const o = order([task(2, "bordado", "en_proceso")]);
    expect(canApplyOrderMove(o, 3, worker("bordado"))).toBe(false);
  });

  it("recepción puede mover aunque una de las dos áreas ya esté ahí", () => {
    const o = order([task(1, "dtf", "en_proceso"), task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 3, manager)).toBe(true);
  });

  it("bloquea cuando todas las tareas ya están en el destino", () => {
    const o = order([task(1, "dtf", "terminado"), task(2, "bordado", "terminado")]);
    expect(canApplyOrderMove(o, 4, manager)).toBe(false);
  });

  it("entregado y cancelado se aplican siempre a nivel pedido", () => {
    const o = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 5, manager)).toBe(true);
    expect(canApplyOrderMove(o, 10, manager)).toBe(true);
  });

  it("un pedido sin tareas se mueve por el estado del pedido", () => {
    expect(canApplyOrderMove(order(), 3, worker("bordado"))).toBe(true);
  });
});
