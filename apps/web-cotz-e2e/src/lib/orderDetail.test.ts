import { describe, expect, it } from "vitest";
import {
  getOrderDetailPermissions,
  getOrderNextAction,
  splitDeliveryDate,
  type OrderDetailViewer,
} from "./orderDetail";
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
    requiresDesign: false,
    ...extra,
  }) as unknown as Order;

const task = (status: OrderAreaTask["status"]): OrderAreaTask =>
  ({ id: 1, orderId: 1, area: "dtf", status, createdAt: "" }) as unknown as OrderAreaTask;

const recepcion: OrderDetailViewer = { roles: ["recepcion"], isAdmin: false, canManageOperations: true };
const admin: OrderDetailViewer = { roles: ["admin"], isAdmin: true, canManageOperations: true };
const dtf: OrderDetailViewer = { roles: ["dtf"], isAdmin: false, canManageOperations: false };
const diseno: OrderDetailViewer = { roles: ["diseno"], isAdmin: false, canManageOperations: false };

function next(o: Order, viewer: OrderDetailViewer, tasks: OrderAreaTask[] = []) {
  const permissions = getOrderDetailPermissions(o, viewer);
  return getOrderNextAction(o, buildOrderHandoff(o, tasks), permissions, viewer, tasks.length);
}

describe("getOrderDetailPermissions", () => {
  it("recepción edita, borra y ve el historial; un área no", () => {
    expect(getOrderDetailPermissions(order(1, "pendiente"), recepcion)).toMatchObject({
      canEdit: true,
      canDelete: true,
      canSeeHistory: true,
      canChangeStatus: true,
      allowedStatusIds: undefined,
    });
    const area = getOrderDetailPermissions(order(3, "en proceso"), dtf);
    expect(area).toMatchObject({ canEdit: false, canDelete: false, canSeeHistory: false });
    expect(area.allowedStatusIds).not.toContain(5);
  });

  it("autorizado ya es producción: quien gestiona puede mover el estado (forzar)", () => {
    const o = order(7, "autorizado", { requiresDesign: true });
    expect(getOrderDetailPermissions(o, recepcion)).toMatchObject({
      canChangeStatus: true,
      isInDesignLimbo: false,
    });
    expect(getOrderDetailPermissions(o, dtf).canChangeStatus).toBe(false);
  });

  it("dentro del circuito de diseño nadie mueve el estado a mano", () => {
    const o = order(20, "esperando autorización", { requiresDesign: true });
    expect(getOrderDetailPermissions(o, admin)).toMatchObject({
      canChangeStatus: false,
      isInDesignLimbo: true,
    });
  });
});

describe("splitDeliveryDate", () => {
  it("devuelve fecha y hora locales (no corre el día de noche)", () => {
    const iso = new Date(2026, 9, 3, 21, 30).toISOString();
    expect(splitDeliveryDate(iso)).toEqual({ date: "2026-10-03", time: "21:30" });
  });

  it("medianoche local = sin hora", () => {
    expect(splitDeliveryDate(new Date(2026, 9, 3).toISOString())).toEqual({
      date: "2026-10-03",
      time: "",
    });
    expect(splitDeliveryDate(null)).toEqual({ date: "", time: "" });
  });
});

describe("getOrderNextAction", () => {
  it("ya no existe 'Pasar a Diseño': el alta con diseño entra directo a Diseño", () => {
    const o = order(1, "pendiente", { requiresDesign: true });
    expect(next(o, recepcion)?.kind).not.toBe("to-design");
  });

  it("en diseño el botón lleva a la sección de Diseño sólo para quien diseña", () => {
    const o = order(21, "en diseño", { requiresDesign: true });
    expect(next(o, diseno)).toMatchObject({ kind: "section", section: "design" });
    expect(next(o, recepcion)).toBeNull();
  });

  it("volvió con cambios: Diseño ve 'Ver cambios y corregir'", () => {
    const o = order(23, "cambios solicitados", { requiresDesign: true });
    expect(next(o, diseno)).toMatchObject({ kind: "section", label: "Ver cambios y corregir" });
  });

  it("esperando autorización: recepción registra la respuesta", () => {
    const o = order(22, "esperando autorización", { requiresDesign: true });
    expect(next(o, recepcion)).toMatchObject({ kind: "section", label: "Registrar respuesta del cliente" });
  });

  it("producción sin áreas: recepción las define", () => {
    expect(next(order(3, "en proceso"), recepcion)).toMatchObject({ kind: "section", section: "areas" });
  });

  it("flujo lineal: el siguiente estado que el rol puede fijar", () => {
    expect(next(order(3, "en proceso"), dtf, [task("en_proceso")])).toEqual({
      kind: "status",
      statusId: 4,
      label: "Marcar terminado",
    });
    // Entregar es de Recepción, no de las áreas.
    expect(next(order(4, "terminado"), dtf, [task("terminado")])).toBeNull();
    expect(next(order(4, "terminado"), recepcion, [task("terminado")])).toMatchObject({
      kind: "status",
      statusId: 5,
    });
  });

  it("entregado o cancelado: no hay siguiente paso", () => {
    expect(next(order(5, "entregado"), recepcion)).toBeNull();
    expect(next(order(10, "cancelado"), recepcion)).toBeNull();
  });
});
