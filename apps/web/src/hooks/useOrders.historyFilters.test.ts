import { describe, expect, it } from "vitest";
import { historyFilterParams } from "./useOrders";

describe("historyFilterParams", () => {
  it("sólo manda los filtros con valor", () => {
    expect(historyFilterParams({})).toEqual({});
    expect(historyFilterParams({ q: "  ", area: "" })).toEqual({});
  });

  it("convierte los días locales en instantes, con el último día completo", () => {
    expect(
      historyFilterParams({
        q: " EMD-P0042 ",
        statusId: 3,
        clientId: 4,
        area: "bordado",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30",
        deliveryFrom: "2026-10-01",
        deliveryTo: "2026-10-31",
      })
    ).toEqual({
      q: "EMD-P0042",
      statusId: "3",
      clientId: "4",
      area: "bordado",
      dateFrom: new Date("2026-09-01T00:00:00").toISOString(),
      dateTo: new Date("2026-09-30T23:59:59.999").toISOString(),
      deliveryFrom: new Date("2026-10-01T00:00:00").toISOString(),
      deliveryTo: new Date("2026-10-31T23:59:59.999").toISOString(),
    });
  });
});
