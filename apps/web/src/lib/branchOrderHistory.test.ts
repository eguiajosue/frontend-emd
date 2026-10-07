import { describe, expect, it } from "vitest";
import {
  BRANCH_HISTORY_PAGE_SIZE,
  buildBranchHistoryParams,
  EMPTY_BRANCH_HISTORY_FILTERS,
  hasBranchHistoryFilters,
  parseBranchOrderHistory,
} from "./branchOrderHistory";
import type { Order } from "@/types";

const order = (id: number, over: Partial<Order> = {}): Order =>
  ({
    id,
    statusId: 1,
    description: `Pedido ${id}`,
    clientNameOverride: `Cliente ${id}`,
    creationDate: new Date(Date.UTC(2026, 8, id)).toISOString(),
    ...over,
  }) as Order;

describe("buildBranchHistoryParams", () => {
  it("sin filtros sólo manda page y limit", () => {
    expect(buildBranchHistoryParams(EMPTY_BRANCH_HISTORY_FILTERS, 1)).toEqual({
      page: 1,
      limit: BRANCH_HISTORY_PAGE_SIZE,
    });
  });

  it("manda q, statusId y el rango como instantes ISO (día completo en hora local)", () => {
    const params = buildBranchHistoryParams(
      { q: "  madero ", statusId: 5, from: "2026-09-01", to: "2026-09-30" },
      3,
      10
    );
    expect(params).toMatchObject({ page: 3, limit: 10, q: "madero", statusId: 5 });
    expect(params.from).toBe(new Date("2026-09-01T00:00:00").toISOString());
    expect(params.to).toBe(new Date("2026-09-30T23:59:59.999").toISOString());
  });
});

describe("hasBranchHistoryFilters", () => {
  it("detecta filtros activos", () => {
    expect(hasBranchHistoryFilters(EMPTY_BRANCH_HISTORY_FILTERS)).toBe(false);
    expect(hasBranchHistoryFilters({ ...EMPTY_BRANCH_HISTORY_FILTERS, q: " " })).toBe(false);
    expect(hasBranchHistoryFilters({ ...EMPTY_BRANCH_HISTORY_FILTERS, statusId: 4 })).toBe(true);
    expect(hasBranchHistoryFilters({ ...EMPTY_BRANCH_HISTORY_FILTERS, from: "2026-09-01" })).toBe(true);
  });
});

describe("parseBranchOrderHistory", () => {
  it("respuesta paginada { data, meta }: se usa tal cual, ordenada por fecha desc", () => {
    const page = parseBranchOrderHistory(
      { data: [order(1), order(3), order(2)], meta: { total: 45, page: 2, limit: 20, totalPages: 3 } },
      EMPTY_BRANCH_HISTORY_FILTERS,
      2
    );
    expect(page.orders.map((o) => o.id)).toEqual([3, 2, 1]);
    expect(page).toMatchObject({ total: 45, page: 2, totalPages: 3 });
  });

  it("meta incompleta: deduce total y páginas", () => {
    const page = parseBranchOrderHistory({ data: [order(1), order(2)] }, EMPTY_BRANCH_HISTORY_FILTERS, 1);
    expect(page).toMatchObject({ total: 2, page: 1, totalPages: 1 });
  });

  it("array plano (backend sin paginar): filtra, ordena y pagina en el cliente", () => {
    const all = Array.from({ length: 25 }, (_, i) => order(i + 1, { statusId: i % 2 ? 5 : 1 }));
    const first = parseBranchOrderHistory(all, EMPTY_BRANCH_HISTORY_FILTERS, 1);
    expect(first.orders).toHaveLength(20);
    expect(first.orders[0].id).toBe(25);
    expect(first).toMatchObject({ total: 25, totalPages: 2 });

    const second = parseBranchOrderHistory(all, EMPTY_BRANCH_HISTORY_FILTERS, 2);
    expect(second.orders.map((o) => o.id)).toEqual([5, 4, 3, 2, 1]);

    const delivered = parseBranchOrderHistory(all, { ...EMPTY_BRANCH_HISTORY_FILTERS, statusId: 5 }, 1);
    expect(delivered.total).toBe(12);
    expect(delivered.orders.every((o) => o.statusId === 5)).toBe(true);
  });

  it("array plano: busca por cliente, descripción o # sin importar acentos", () => {
    const all = [
      order(1, { clientNameOverride: "Escuela Peña" }),
      order(2, { description: "Sudaderas con escudo" }),
      order(3),
    ];
    const f = (q: string) => parseBranchOrderHistory(all, { ...EMPTY_BRANCH_HISTORY_FILTERS, q }, 1).orders.map((o) => o.id);
    expect(f("pena")).toEqual([1]);
    expect(f("ESCUDO")).toEqual([2]);
    expect(f("3")).toEqual([3]);
  });

  it("array plano: rango de fechas inclusivo en ambos extremos (hora local)", () => {
    const at = (day: number, h: number) => new Date(2026, 8, day, h).toISOString();
    const all = [
      order(1, { creationDate: at(4, 23) }),
      order(2, { creationDate: at(5, 0) }),
      order(3, { creationDate: at(5, 23) }),
      order(4, { creationDate: at(6, 0) }),
    ];
    const page = parseBranchOrderHistory(all, { ...EMPTY_BRANCH_HISTORY_FILTERS, from: "2026-09-05", to: "2026-09-05" }, 1);
    expect(page.orders.map((o) => o.id).sort()).toEqual([2, 3]);
  });

  it("payload vacío o nulo", () => {
    expect(parseBranchOrderHistory(null, EMPTY_BRANCH_HISTORY_FILTERS, 1)).toMatchObject({ orders: [], total: 0, totalPages: 1 });
    expect(parseBranchOrderHistory([], EMPTY_BRANCH_HISTORY_FILTERS, 1)).toMatchObject({ orders: [], total: 0, totalPages: 1 });
  });
});
