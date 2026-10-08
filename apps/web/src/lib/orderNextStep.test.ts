import { describe, expect, it } from "vitest";
import { getOrderNextStep, type NextStepViewer } from "./orderNextStep";
import type { Order, OrderAreaTask } from "@/types";

const bordado: NextStepViewer = { roles: ["bordado"], isAdmin: false, isManager: false };
const dtf: NextStepViewer = { roles: ["dtf"], isAdmin: false, isManager: false };
const recepcion: NextStepViewer = { roles: ["recepcion"], isAdmin: false, isManager: true };
const diseno: NextStepViewer = { roles: ["diseno"], isAdmin: false, isManager: false };

function task(id: number, area: string, status: OrderAreaTask["status"], extra: Partial<OrderAreaTask> = {}): OrderAreaTask {
  return { id, orderId: 1, area, status, createdAt: "", ...extra };
}

function order(extra: Partial<Order> = {}): Order {
  return { id: 1, statusId: 9, status: { id: 9, name: "autorizado" }, areaTasks: [], ...extra } as Order;
}

const labels = (o: Order, v: NextStepViewer) => {
  const s = getOrderNextStep(o, v);
  return { stage: s.current >= 0 ? s.stages[s.current].label : null, turn: s.turn?.label ?? null, mine: s.turn?.mine ?? null, action: s.action?.label ?? null };
};

describe("siguiente paso de un pedido", () => {
  it("al área que le toca le ofrece el verbo: empezar → terminar", () => {
    const o = order({ areaTasks: [task(1, "bordado", "pendiente")] });
    expect(labels(o, bordado)).toEqual({ stage: "Pendiente", turn: "Te toca", mine: true, action: "Empezar producción" });
    const enCurso = order({ areaTasks: [task(1, "bordado", "en_proceso")] });
    expect(labels(enCurso, bordado)).toMatchObject({ stage: "En proceso", action: "Marcar terminado" });
    const step = getOrderNextStep(enCurso, bordado);
    expect(step.action).toEqual({ kind: "move", statusId: 4, label: "Marcar terminado" });
  });

  it("a quien no le toca le dice a quién sí, sin botón", () => {
    const o = order({ areaTasks: [task(1, "bordado", "terminado"), task(2, "dtf", "en_proceso")] });
    expect(labels(o, bordado)).toEqual({ stage: "Terminado", turn: "Turno de: DTF", mine: false, action: null });
    expect(labels(o, dtf)).toMatchObject({ turn: "Te toca", action: "Marcar terminado" });
  });

  it("con todo terminado le toca a Recepción entregar; producción no ve 'Entregar'", () => {
    const o = order({ areaTasks: [task(1, "bordado", "terminado")] });
    expect(labels(o, recepcion)).toEqual({ stage: "Terminado", turn: "Te toca: entregar", mine: true, action: "Entregar" });
    expect(labels(o, bordado)).toEqual({ stage: "Terminado", turn: "Turno de: Recepción (entregar)", mine: false, action: null });
  });

  it("varias áreas pendientes se nombran juntas", () => {
    const o = order({ areaTasks: [task(1, "bordado", "pendiente"), task(2, "dtf", "pendiente"), task(3, "laser", "pendiente")] });
    expect(labels(o, { roles: ["taller"], isAdmin: false, isManager: false }).turn).toBe("Turno de: Bordado, DTF y Láser");
  });

  it("Bordado en digitalización o pruebas: el paso se da en el detalle", () => {
    const o = order({ areaTasks: [task(1, "bordado", "pendiente", { prepStage: "en_pruebas" })] });
    expect(labels(o, bordado)).toMatchObject({ turn: "Te toca: prueba de bordado", action: "Ver pruebas" });
    expect(getOrderNextStep(o, bordado).action).toEqual({ kind: "open", label: "Ver pruebas" });
  });

  it("circuito de Diseño: Diseño abre su montaje y Recepción registra la respuesta", () => {
    const enDiseno = order({ requiresDesign: true, statusId: 6, status: { id: 6, name: "en diseño" }, designStartedAt: null });
    expect(labels(enDiseno, diseno)).toEqual({ stage: "Diseño", turn: "Nuevo: empiézalo", mine: true, action: "Abrir diseño" });
    expect(labels(enDiseno, bordado).action).toBeNull();
    const esperando = order({ requiresDesign: true, statusId: 7, status: { id: 7, name: "esperando autorización" } });
    expect(labels(esperando, recepcion)).toMatchObject({ turn: "Te toca: respuesta del cliente", action: "Registrar respuesta" });
    const cambios = order({ requiresDesign: true, statusId: 8, status: { id: 8, name: "cambios solicitados" } });
    expect(labels(cambios, diseno).action).toBe("Corregir diseño");
    expect(getOrderNextStep(enDiseno, diseno).stages.map((s) => s.label)).toEqual([
      "Diseño",
      "Pendiente",
      "En proceso",
      "Terminado",
      "Entregado",
    ]);
  });

  it("entregado y cancelado no tienen turno ni botón", () => {
    expect(labels(order({ statusId: 5, status: { id: 5, name: "entregado" } }), recepcion)).toEqual({
      stage: "Entregado",
      turn: null,
      mine: null,
      action: null,
    });
    const cancelado = getOrderNextStep(order({ statusId: 10, status: { id: 10, name: "cancelado" } }), recepcion);
    expect(cancelado.current).toBe(-1);
    expect(cancelado.action).toBeNull();
  });

  it("sin tareas por área: lo produce el área del pedido", () => {
    const o = order({ statusId: 1, status: { id: 1, name: "pendiente" }, area: "dtf" });
    expect(labels(o, dtf)).toMatchObject({ turn: "Te toca", action: "Empezar producción" });
    expect(labels(o, bordado)).toMatchObject({ turn: "Turno de: DTF", action: null });
  });
});
