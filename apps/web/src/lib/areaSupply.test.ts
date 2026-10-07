import { describe, expect, it } from "vitest";
import { draftsComplete, draftsToInput, emptyDrafts, supplySummary } from "./areaSupply";
import type { AreaSupply } from "@/types";

const supply = (source: AreaSupply["source"], lines: Partial<AreaSupply["lines"][number]>[]): AreaSupply => ({
  id: 1,
  source,
  lines: lines.map((l, i) => ({
    id: i,
    inventoryItemId: null,
    description: "",
    quantity: 1,
    discountedAt: null,
    ...l,
  })),
});

describe("supplySummary", () => {
  it("cliente: origen + cantidad × descripción", () => {
    expect(supplySummary(supply("cliente", [{ description: "playeras negras", quantity: "12.000" }]))).toEqual({
      origin: "del cliente",
      detail: "12 × playeras negras",
    });
  });

  it("nosotros: nombre y cantidad con unidad", () => {
    expect(
      supplySummary(
        supply("nosotros", [
          { description: "Film DTF", quantity: 2, inventoryItem: { id: 1, name: "Film DTF", unit: "m", area: "dtf" } },
          { description: "Tinta blanca", quantity: 1 },
        ])
      )
    ).toEqual({ origin: "nuestros", detail: "Film DTF 2 m, Tinta blanca 1" });
  });

  it("sin hoja no hay resumen", () => {
    expect(supplySummary(null)).toBeNull();
  });
});

describe("borradores de la hoja", () => {
  it("falta origen = incompleto; cliente sin líneas es válido; nosotros exige líneas", () => {
    const d = emptyDrafts(["dtf"]);
    expect(draftsComplete(d, ["dtf"])).toBe(false);
    expect(draftsComplete({ dtf: { source: "cliente", lines: [] } }, ["dtf"])).toBe(true);
    expect(draftsComplete({ dtf: { source: "nosotros", lines: [] } }, ["dtf"])).toBe(false);
    expect(
      draftsComplete({ dtf: { source: "nosotros", lines: [{ key: "a", inventoryItemId: 3, description: "x", quantity: "0" }] } }, ["dtf"])
    ).toBe(false);
  });

  it("cliente: la línea sembrada en blanco se ignora; a medias sigue inválida", () => {
    const blank = { key: "a", description: "", quantity: "" };
    expect(draftsComplete({ dtf: { source: "cliente", lines: [blank] } }, ["dtf"])).toBe(true);
    expect(draftsToInput({ dtf: { source: "cliente", lines: [blank] } }, ["dtf"])).toEqual([
      { area: "dtf", source: "cliente", lines: [] },
    ]);
    expect(draftsComplete({ dtf: { source: "cliente", lines: [{ ...blank, description: "x" }] } }, ["dtf"])).toBe(false);
    expect(draftsComplete({ dtf: { source: "cliente", lines: [{ ...blank, quantity: "3" }] } }, ["dtf"])).toBe(false);
    expect(draftsComplete({ dtf: { source: "nosotros", lines: [blank] } }, ["dtf"])).toBe(false);
  });

  it("convierte a la entrada del API (coma decimal incluida)", () => {
    const input = draftsToInput(
      { dtf: { source: "nosotros", lines: [{ key: "a", inventoryItemId: 3, description: "Film", quantity: "1,5" }] } },
      ["dtf"]
    );
    expect(input).toEqual([{ area: "dtf", source: "nosotros", lines: [{ inventoryItemId: 3, description: "Film", quantity: 1.5 }] }]);
  });
});
