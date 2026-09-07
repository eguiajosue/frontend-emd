import { describe, expect, it } from "vitest";
import { areaTaskToMove, canApplyOrderMove } from "./orderMove";
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

describe("areaTaskToMove", () => {
  it("elige la tarea del área de quien mira", () => {
    // Regresión: el tablero ubica el pedido por ESTA tarea, así que arrastrar
    // la tarjeta tiene que escribir acá y no en `Order.statusId` — escribir el
    // pedido devolvía 200 sin mover nada y la tarjeta volvía a su columna.
    const o = order([task(1, "dtf", "terminado"), task(2, "bordado", "pendiente")]);
    expect(areaTaskToMove(o, ["bordado"])?.id).toBe(2);
  });

  it("sin área propia, sólo mueve si hay una única tarea", () => {
    expect(areaTaskToMove(order([task(1, "dtf", "pendiente")]), [])?.id).toBe(1);
    const dos = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(areaTaskToMove(dos, [])).toBeNull();
  });

  it("un pedido sin tareas de área no tiene tarea que mover", () => {
    expect(areaTaskToMove(order(), ["bordado"])).toBeNull();
  });
});

describe("canApplyOrderMove", () => {
  it("permite mover a un estado de producción cuando hay tarea del área", () => {
    const o = order([task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 3, ["bordado"])).toBe(true);
  });

  it("bloquea el destino que la tarea ya tiene", () => {
    const o = order([task(2, "bordado", "en_proceso")]);
    expect(canApplyOrderMove(o, 3, ["bordado"])).toBe(false);
  });

  it("bloquea cuando hay varias áreas y ninguna es la de quien mira", () => {
    // Recepción arrastrando un pedido que trabajan dos áreas: no hay forma de
    // saber cuál avanzar, así que no se acepta el drop en vez de escribir el
    // estado del pedido y desincronizar las tareas.
    const o = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 3, [])).toBe(false);
  });

  it("entregado y cancelado se aplican siempre a nivel pedido", () => {
    const o = order([task(1, "dtf", "pendiente"), task(2, "bordado", "pendiente")]);
    expect(canApplyOrderMove(o, 5, [])).toBe(true);
    expect(canApplyOrderMove(o, 10, [])).toBe(true);
  });

  it("un pedido sin tareas se mueve por el estado del pedido", () => {
    expect(canApplyOrderMove(order(), 3, ["bordado"])).toBe(true);
  });
});
