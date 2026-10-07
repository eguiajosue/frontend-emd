import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/types";
import {
  MAX_QUANTITY,
  MOVEMENT_SOURCE_LABEL,
  formatDelta,
  inventoryAreaLabel,
  projectedBalance,
  sortByUrgency,
  summarizeInventory,
} from "./inventory";

const item = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: 1,
  area: "bordado",
  name: "Hilo",
  unit: "cono",
  quantity: 10,
  stockStatus: "ok",
  ...overrides,
});

describe("inventory helpers", () => {
  it("etiqueta Recepción además de las áreas operativas", () => {
    expect(inventoryAreaLabel("recepcion")).toBe("Recepción");
    expect(inventoryAreaLabel("impresiones")).toBe("Impresiones");
  });

  it("proyecta el stock según el tipo de movimiento", () => {
    expect(projectedBalance(10, "ENTRADA", 5)).toBe(15);
    expect(projectedBalance(10, "SALIDA", 4)).toBe(6);
    expect(projectedBalance(10, "SALIDA", 11)).toBeNull();
    expect(projectedBalance(10, "SALIDA", 0)).toBeNull();
    expect(projectedBalance(10, "AJUSTE", 0)).toBe(0);
    expect(projectedBalance(10, "AJUSTE", 7)).toBe(7);
  });

  it("resume conteos y valor (sin contar los artículos sin costo)", () => {
    const summary = summarizeInventory([
      item({ id: 1, unitCost: 10, quantity: 3 }),
      item({ id: 2, stockStatus: "low", unitCost: 2, quantity: 5 }),
      item({ id: 3, stockStatus: "out", quantity: 0 }),
    ]);
    expect(summary).toEqual({ items: 3, low: 1, out: 1, value: 40, withoutCost: 1 });
  });

  it("ordena por urgencia: agotados, bajo stock y después por nombre", () => {
    const sorted = sortByUrgency([
      item({ id: 1, name: "B" }),
      item({ id: 2, name: "Z", stockStatus: "out" }),
      item({ id: 3, name: "A" }),
      item({ id: 4, name: "C", stockStatus: "low" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual([2, 4, 3, 1]);
  });

  it("formatea el delta con signo", () => {
    expect(formatDelta(5)).toBe("+5");
    expect(formatDelta(-2.5)).toBe("−2.5");
  });
});

describe("tope de cantidad y origen 'orden'", () => {
  it("projectedBalance rechaza cantidades arriba del tope del backend (999999)", () => {
    expect(projectedBalance(0, "ENTRADA", MAX_QUANTITY)).toBe(MAX_QUANTITY);
    expect(projectedBalance(0, "ENTRADA", MAX_QUANTITY + 1)).toBeNull();
    expect(projectedBalance(5, "AJUSTE", 1_000_000)).toBeNull();
  });

  it("los movimientos de la hoja de materiales se leen 'Hoja de materiales'", () => {
    expect(MOVEMENT_SOURCE_LABEL.orden).toBe("Hoja de materiales");
  });
});
