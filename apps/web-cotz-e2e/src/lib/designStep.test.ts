import { describe, expect, it } from "vitest";
import { getDesignStep } from "./designStep";
import type { Order } from "@/types";

const order = (name: string, requiresDesign = true, extra: Partial<Order> = {}) =>
  ({ requiresDesign, status: { id: 1, name }, ...extra }) as unknown as Order;

const diseno = { roles: ["diseno"], isAdmin: false };
const recepcion = { roles: ["recepcion"], isAdmin: false };

describe("getDesignStep", () => {
  it("en diseño: le toca a Diseño, Recepción ve dónde está", () => {
    expect(getDesignStep(order("en diseño"), diseno)).toMatchObject({ mine: true, label: "Te toca: montaje" });
    expect(getDesignStep(order("en diseño"), recepcion)).toMatchObject({ mine: false, label: "En Diseño" });
  });

  it("sin empezar: Diseño ve 'Nuevo', Recepción 'sin empezar'; empezado dice quién", () => {
    const fresh = order("en diseño", true, { designStartedAt: null });
    expect(getDesignStep(fresh, diseno)).toMatchObject({ label: "Nuevo: empiézalo", mine: true });
    expect(getDesignStep(fresh, recepcion)).toMatchObject({ label: "En Diseño · sin empezar" });
    const started = order("en diseño", true, {
      designStartedAt: "2026-10-03T10:00:00.000Z",
      designStartedByName: "Dani",
    });
    expect(getDesignStep(started, recepcion)).toMatchObject({ label: "En Diseño · Dani" });
  });

  it("esperando autorización: le toca a Recepción", () => {
    expect(getDesignStep(order("esperando autorización"), recepcion)).toMatchObject({ mine: true });
    expect(getDesignStep(order("esperando autorización"), diseno)).toMatchObject({ mine: false });
  });

  it("cambios solicitados: se marca como devuelto", () => {
    expect(getDesignStep(order("cambios solicitados"), diseno)).toMatchObject({ mine: true, returned: true });
  });

  it("fuera del circuito de diseño no hay paso", () => {
    expect(getDesignStep(order("en proceso", false), diseno)).toBeNull();
    expect(getDesignStep(order("autorizado"), recepcion)).toBeNull();
  });
});
