import { describe, expect, it } from "vitest";
import {
  compareByUrgency,
  formatCountdown,
  formatElapsed,
  getDeadlineState,
  getOrderAreas,
  getTaskProgress,
} from "./orderDeadline";
import type { Order } from "@/types";

const NOW = new Date("2026-10-02T12:00:00.000Z").getTime();
const H = 3_600_000;

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    statusId: 1,
    description: "x",
    creationDate: new Date(NOW - 10 * H).toISOString(),
    deliveredAt: null,
    ...overrides,
  } as Order;
}

describe("getDeadlineState", () => {
  it("a tiempo con más de 48h", () => {
    const s = getDeadlineState(order({ deliveryDate: new Date(NOW + 72 * H).toISOString() }), NOW);
    expect(s.tone).toBe("on_time");
    expect(s.remainingMs).toBe(72 * H);
    expect(s.elapsedMs).toBe(10 * H);
  });

  it("en riesgo con menos de 48h", () => {
    expect(getDeadlineState(order({ deliveryDate: new Date(NOW + 5 * H).toISOString() }), NOW).tone).toBe("at_risk");
  });

  it("vencido si la fecha ya pasó", () => {
    expect(getDeadlineState(order({ deliveryDate: new Date(NOW - H).toISOString() }), NOW).tone).toBe("overdue");
  });

  it("sin fecha", () => {
    expect(getDeadlineState(order({ deliveryDate: null }), NOW).tone).toBe("no_date");
  });

  it("terminado/entregado/cancelado no corren reloj aunque estén vencidos", () => {
    const past = new Date(NOW - H).toISOString();
    expect(getDeadlineState(order({ statusId: 4, deliveryDate: past }), NOW).tone).toBe("finished");
    expect(getDeadlineState(order({ statusId: 5, deliveryDate: past }), NOW).tone).toBe("delivered");
    expect(getDeadlineState(order({ statusId: 10, deliveryDate: past }), NOW).tone).toBe("cancelled");
  });
});

describe("formatos", () => {
  it("countdown sin segundos", () => {
    expect(formatCountdown(4 * 24 * H + 2 * H + 40 * 60_000 + 28_000)).toBe("4D 2H 40M");
    expect(formatCountdown(5 * H + 12 * 60_000)).toBe("5H 12M");
    expect(formatCountdown(42 * 60_000)).toBe("42M");
    expect(formatCountdown(-(26 * H))).toBe("1D 2H 0M");
  });

  it("transcurrido compacto", () => {
    expect(formatElapsed(3 * 24 * H + 4 * H)).toBe("3d 4h");
    expect(formatElapsed(8 * 60_000)).toBe("8m");
  });
});

describe("compareByUrgency", () => {
  it("vencidos primero, luego el plazo más corto, sin fecha y cerrados al final", () => {
    const states = [
      getDeadlineState(order({ statusId: 4 }), NOW),
      getDeadlineState(order({ deliveryDate: null }), NOW),
      getDeadlineState(order({ deliveryDate: new Date(NOW + 100 * H).toISOString() }), NOW),
      getDeadlineState(order({ deliveryDate: new Date(NOW + 60 * H).toISOString() }), NOW),
      getDeadlineState(order({ deliveryDate: new Date(NOW - H).toISOString() }), NOW),
    ].sort(compareByUrgency);
    expect(states.map((s) => s.tone)).toEqual(["overdue", "on_time", "on_time", "no_date", "finished"]);
    expect(states[1].remainingMs).toBe(60 * H);
  });
});

describe("tareas y áreas", () => {
  it("cuenta tareas terminadas sobre el total", () => {
    const o = order({
      areaTasks: [
        { id: 1, orderId: 1, area: "dtf", status: "terminado", createdAt: "" },
        { id: 2, orderId: 1, area: "bordado", status: "en_proceso", createdAt: "" },
      ],
    });
    expect(getTaskProgress(o)).toEqual({ done: 1, total: 2 });
    expect(getOrderAreas(o)).toEqual(["dtf", "bordado"]);
  });

  it("sin tareas usa el área destino", () => {
    expect(getOrderAreas(order({ productionArea: "laser", area: "diseno" }))).toEqual(["laser"]);
    expect(getOrderAreas(order())).toEqual([]);
  });
});
