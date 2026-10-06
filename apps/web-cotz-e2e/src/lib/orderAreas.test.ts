import { describe, expect, it } from "vitest";
import { orderAreaTags } from "./orderAreas";
import type { Order, OrderAreaTask } from "@/types";

const order = (statusName: string, extra: Partial<Order> = {}): Order =>
  ({
    id: 1,
    statusId: 1,
    status: { id: 1, name: statusName },
    description: "",
    creationDate: "",
    deliveredAt: null,
    ...extra,
  }) as unknown as Order;

const task = (id: number, area: string): OrderAreaTask =>
  ({ id, orderId: 1, area, status: "pendiente", createdAt: "" }) as OrderAreaTask;

describe("orderAreaTags", () => {
  it("mientras está en diseño la etiqueta es Diseño, aunque el destino ya esté elegido", () => {
    const o = order("en diseño", {
      area: "diseno",
      productionArea: "bordado",
      areaTasks: [task(1, "bordado")],
    });
    expect(orderAreaTags(o)).toEqual(["diseno"]);
  });

  it("al autorizarse cae la etiqueta de Diseño y entran las áreas que producen", () => {
    const o = order("autorizado", {
      area: "diseno",
      areaTasks: [task(1, "bordado"), task(2, "dtf")],
    });
    expect(orderAreaTags(o)).toEqual(["bordado", "dtf"]);
  });

  it("muestra TODAS las áreas, no sólo la primera", () => {
    // Regresión: la tarjeta pintaba `order.area`, un campo singular anterior al
    // modelo multi-área, así que un pedido de Bordado + DTF mostraba una sola.
    const o = order("en proceso", {
      area: "bordado",
      areaTasks: [task(1, "bordado"), task(2, "dtf"), task(3, "laser")],
    });
    expect(orderAreaTags(o)).toEqual(["bordado", "dtf", "laser"]);
  });

  it("no repite un área que aparece dos veces", () => {
    const o = order("en proceso", { areaTasks: [task(1, "dtf"), task(2, "dtf")] });
    expect(orderAreaTags(o)).toEqual(["dtf"]);
  });

  it("sin tareas cae al área del pedido", () => {
    expect(orderAreaTags(order("pendiente", { area: "laser" }))).toEqual(["laser"]);
  });

  it("autorizado sin tareas cae al área destino, no a Diseño", () => {
    const o = order("autorizado", { area: "diseno", productionArea: "taller" });
    expect(orderAreaTags(o)).toEqual(["taller"]);
  });

  it("un pedido sin área no inventa etiquetas", () => {
    expect(orderAreaTags(order("pendiente"))).toEqual([]);
  });
});
