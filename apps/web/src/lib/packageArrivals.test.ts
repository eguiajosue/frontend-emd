import { describe, expect, it } from "vitest";
import {
  arrivalFromAssigned,
  arrivalFromNewOrder,
  arrivalPriority,
  arrivalTimeline,
  BATCH_THRESHOLD,
  demoArrival,
  enqueueArrival,
  PRIORITY_STYLE,
  takeNextStep,
  topPriority,
} from "./packageArrivals";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const HOUR = 3_600_000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();

describe("avisos del socket → llegadas", () => {
  it("newOrderNotification del área usa orderId; el del admin (id + createdBy) no es un paquete", () => {
    const area = arrivalFromNewOrder({ orderId: 55, area: "bordado", description: "x", deliveryDate: null }, NOW);
    expect(area).toMatchObject({ orderId: 55, area: "bordado", source: "area", changes: false });
    expect(arrivalFromNewOrder({ id: 55, clientName: "Ana", createdBy: "Rita" }, NOW)).toBeNull();
  });

  it("newAssignedOrderNotification es un paquete, salvo el montaje enviado (va a Recepción)", () => {
    expect(arrivalFromAssigned({ orderId: "12", area: "dtf", clientName: "Ana" }, NOW)).toMatchObject({
      orderId: 12,
      source: "assigned",
      clientName: "Ana",
    });
    expect(arrivalFromAssigned({ orderId: 12, reason: "design_montage_sent" }, NOW)).toBeNull();
    expect(arrivalFromAssigned({ orderId: "abc" }, NOW)).toBeNull();
  });

  it("el cliente pidió cambios (Diseño) se marca como cambios", () => {
    const a = arrivalFromAssigned({ orderId: 3, area: "diseno", description: "El cliente pidió cambios sobre el montaje" }, NOW);
    expect(a?.changes).toBe(true);
  });
});

describe("prioridad por fecha de entrega", () => {
  it("vencido, en riesgo (<48 h), a tiempo y sin fecha", () => {
    expect(arrivalPriority({ deliveryDate: iso(-HOUR), changes: false }, NOW)).toBe("overdue");
    expect(arrivalPriority({ deliveryDate: iso(20 * HOUR), changes: false }, NOW)).toBe("at_risk");
    expect(arrivalPriority({ deliveryDate: iso(5 * 24 * HOUR), changes: false }, NOW)).toBe("calm");
    expect(arrivalPriority({ deliveryDate: null, changes: false }, NOW)).toBe("calm");
  });

  it("cambios solicitados gana sobre el plazo", () => {
    expect(arrivalPriority({ deliveryDate: iso(-HOUR), changes: true }, NOW)).toBe("changes");
  });

  it("cada prioridad tiene su color y su animación", () => {
    expect(new Set(Object.values(PRIORITY_STYLE).map((s) => s.color)).size).toBe(4);
    expect(PRIORITY_STYLE.overdue.shake && PRIORITY_STYLE.overdue.pulse).toBe(true);
    expect(PRIORITY_STYLE.calm.float).toBe(true);
    expect(PRIORITY_STYLE.overdue.dropDuration).toBeLessThan(PRIORITY_STYLE.at_risk.dropDuration);
    expect(PRIORITY_STYLE.at_risk.dropDuration).toBeLessThan(PRIORITY_STYLE.calm.dropDuration);
  });

  it("la caja grande toma la prioridad más urgente", () => {
    expect(topPriority(["calm", "at_risk", "overdue"])).toBe("overdue");
    expect(topPriority(["calm", "changes", "at_risk"])).toBe("changes");
    expect(topPriority([])).toBe("calm");
  });

  it("cada paquete dura unos 4 s y los pasos van en orden", () => {
    for (const p of ["overdue", "at_risk", "calm", "changes"] as const) {
      const t = arrivalTimeline(p);
      expect(t.land).toBeLessThan(t.open);
      expect(t.open).toBeLessThan(t.sheet);
      expect(t.sheet).toBeLessThan(t.fly);
      expect(t.fly).toBeLessThan(t.done);
      expect(t.done).toBeGreaterThan(3000);
      expect(t.done).toBeLessThan(4800);
    }
  });
});

describe("cola", () => {
  const make = (orderId: number, area = "bordado", at = NOW) => demoArrival({ orderId, area }, at);

  it("de a uno mientras haya pocos", () => {
    const queue = [make(1), make(2)];
    const { step, rest } = takeNextStep(queue);
    expect(step?.kind).toBe("single");
    expect(step?.arrivals.map((a) => a.orderId)).toEqual([1]);
    expect(rest.map((a) => a.orderId)).toEqual([2]);
  });

  it(`con más de ${BATCH_THRESHOLD} en cola, una sola caja con todos`, () => {
    const queue = [1, 2, 3, 4].map((id) => make(id));
    const { step, rest } = takeNextStep(queue);
    expect(step?.kind).toBe("batch");
    expect(step?.arrivals).toHaveLength(4);
    expect(rest).toEqual([]);
  });

  it(`exactamente ${BATCH_THRESHOLD} todavía van de a uno`, () => {
    const { step } = takeNextStep([1, 2, 3].map((id) => make(id)));
    expect(step?.kind).toBe("single");
  });

  it("cola vacía: nada", () => {
    expect(takeNextStep([])).toEqual({ step: null, rest: [] });
  });

  it("el mismo pedido/área avisado dos veces seguidas es un solo paquete", () => {
    let queue = enqueueArrival([], make(7, "dtf", NOW));
    queue = enqueueArrival(queue, make(7, "dtf", NOW + 2000));
    expect(queue).toHaveLength(1);
    queue = enqueueArrival(queue, make(7, "bordado", NOW + 2000));
    queue = enqueueArrival(queue, make(7, "dtf", NOW + 60_000));
    expect(queue).toHaveLength(3);
  });
});
