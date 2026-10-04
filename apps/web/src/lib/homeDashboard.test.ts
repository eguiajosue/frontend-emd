import { describe, expect, it } from "vitest";
import {
  attentionText,
  dueText,
  groupByPriority,
  homeKindsFor,
  prioritizeDesign,
  prioritizeProduction,
  relativeTo,
} from "./homeDashboard";
import type { DesignWorkItem, ProductionWorkItem } from "@/types";

const NOW = Date.parse("2026-10-03T18:00:00Z");
const H = 3_600_000;
const iso = (hours: number) => new Date(NOW + hours * H).toISOString();

const prod = (taskId: number, overrides: Partial<ProductionWorkItem> = {}): ProductionWorkItem => ({
  id: 100 + taskId,
  clientName: "Luis García",
  description: "",
  products: [],
  deliveryDate: iso(24 * 5),
  creationDate: iso(-24),
  statusName: "pendiente",
  key: `task-${taskId}`,
  taskId,
  area: "taller",
  status: "pendiente",
  mine: false,
  assignee: null,
  startedAt: null,
  availableSince: iso(-10),
  ...overrides,
});

const design = (id: number, overrides: Partial<DesignWorkItem> = {}): DesignWorkItem => ({
  id,
  clientName: "Luis García",
  description: "",
  products: [],
  deliveryDate: iso(24 * 5),
  creationDate: iso(-24),
  statusName: "en diseño",
  key: `design-${id}`,
  status: "en diseño",
  mine: false,
  assignee: null,
  designStartedAt: null,
  designStartedByName: null,
  round: 0,
  lastSentAt: null,
  lastFeedbackAt: null,
  availableSince: iso(-24),
  areas: [],
  ...overrides,
});

describe("prioritizeProduction", () => {
  it("primero lo vencido y lo que vence pronto; después lo sin empezar; al final lo en curso", () => {
    const list = prioritizeProduction(
      [
        prod(1, { status: "en_proceso" }),
        prod(2, { status: "pendiente", deliveryDate: null }),
        prod(3, { status: "pendiente", deliveryDate: iso(24 * 3) }),
        prod(4, { status: "en_proceso", deliveryDate: iso(-5) }),
        prod(5, { status: "pendiente", deliveryDate: iso(-1) }),
        prod(6, { status: "en_proceso", deliveryDate: iso(20) }),
      ],
      NOW
    );
    expect(list.map((p) => [p.item.taskId, p.priority])).toEqual([
      [4, "overdue"],
      [5, "overdue"],
      [6, "due_soon"],
      [3, "not_started"],
      [2, "not_started"],
      [1, "in_progress"],
    ]);
  });

  it("a igual plazo, el que espera hace más va primero", () => {
    const list = prioritizeProduction(
      [prod(1, { deliveryDate: null, availableSince: iso(-2) }), prod(2, { deliveryDate: null, availableSince: iso(-30) })],
      NOW
    );
    expect(list.map((p) => p.item.taskId)).toEqual([2, 1]);
  });
});

describe("prioritizeDesign", () => {
  it("vencidos, cambios del cliente, por vencer, nuevos sin abrir y en curso", () => {
    const list = prioritizeDesign(
      [
        design(1, { designStartedAt: iso(-3) }),
        design(2),
        design(3, { status: "cambios solicitados", designStartedAt: iso(-40) }),
        design(4, { deliveryDate: iso(10) }),
        design(5, { deliveryDate: iso(-2), status: "cambios solicitados" }),
      ],
      NOW
    );
    expect(list.map((p) => [p.item.id, p.priority])).toEqual([
      [5, "overdue"],
      [3, "changes"],
      [4, "due_soon"],
      [2, "not_started"],
      [1, "in_progress"],
    ]);
    expect(groupByPriority(list).map((g) => [g.priority, g.items.length])).toEqual([
      ["overdue", 1],
      ["changes", 1],
      ["due_soon", 1],
      ["not_started", 1],
      ["in_progress", 1],
    ]);
  });
});

describe("textos", () => {
  it("tiempo relativo en español", () => {
    expect(relativeTo(iso(-3), NOW)).toBe("hace 3 horas");
    expect(relativeTo(iso(48), NOW)).toBe("en 2 días");
    expect(relativeTo(iso(0), NOW)).toBe("ahora");
    expect(relativeTo(null, NOW)).toBe("");
  });

  it("plazo de un trabajo", () => {
    expect(dueText(iso(-3), NOW)).toBe("Vencido hace 3 horas");
    expect(dueText(iso(20), NOW)).toBe("Vence en 20 horas");
    expect(dueText(iso(24 * 5), NOW)).toBe("Entrega en 5 días");
    expect(dueText(null, NOW)).toBe("Sin fecha de entrega");
  });

  it("motivo de atención con la acción sugerida", () => {
    expect(attentionText("waiting_client", iso(-72), NOW)).toBe(
      "Montaje enviado hace 3 días: conviene llamar al cliente"
    );
    expect(attentionText("at_risk_not_started", iso(20), NOW)).toBe("Vence en 20 horas y nadie lo empezó");
    expect(attentionText("no_date", null, NOW)).toBe("Sin fecha de entrega: acordarla con el cliente");
  });
});

describe("homeKindsFor", () => {
  it("Recepción/admin: control general; áreas: el suyo (Diseño y/o Producción)", () => {
    expect(homeKindsFor(["recepcion"])).toEqual(["reception"]);
    expect(homeKindsFor(["admin"])).toEqual(["reception"]);
    expect(homeKindsFor(["recepcion", "taller"])).toEqual(["reception"]);
    expect(homeKindsFor(["diseno"])).toEqual(["design"]);
    expect(homeKindsFor(["taller", "dtf"])).toEqual(["production"]);
    expect(homeKindsFor(["diseno", "bordado"])).toEqual(["design", "production"]);
    expect(homeKindsFor([])).toEqual([]);
  });
});
