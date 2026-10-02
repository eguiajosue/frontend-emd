import { describe, expect, it } from "vitest";
import { countOrdersByTone, orderViewHref, parseToneParam } from "./orderViews";
import type { Order } from "@/types";

const H = 3_600_000;
const now = Date.UTC(2026, 9, 2, 12);
const order = (id: number, hours: number | null, statusId = 1) =>
  ({
    id,
    statusId,
    creationDate: new Date(now - 24 * H).toISOString(),
    deliveryDate: hours == null ? null : new Date(now + hours * H).toISOString(),
  }) as Order;

describe("orderViews", () => {
  it("cuenta pedidos por plazo con el mismo criterio que las tarjetas", () => {
    const counts = countOrdersByTone([order(1, -2), order(2, -30), order(3, 5), order(4, 300), order(5, 5, 4)], now);
    expect(counts.overdue).toBe(2);
    expect(counts.at_risk).toBe(1);
    expect(counts.on_time).toBe(1);
    expect(counts.finished).toBe(1);
  });

  it("valida el parámetro de la URL", () => {
    expect(parseToneParam("overdue")).toBe("overdue");
    expect(parseToneParam("cualquiera")).toBeNull();
    expect(parseToneParam(null)).toBeNull();
    expect(orderViewHref("at_risk")).toBe("/dashboard/orders?plazo=at_risk");
  });
});
