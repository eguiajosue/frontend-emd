import { describe, expect, it } from "vitest";
import { buildOrdersSheetData, ordersExportFileName } from "./ordersExcel";

describe("buildOrdersSheetData", () => {
  it("arma encabezados con las llaves del primer objeto y una fila por pedido", () => {
    const data = buildOrdersSheetData([
      {
        ID: 7,
        Cliente: "ACME",
        Descripción: "Playeras",
        Estado: "EN PROCESO",
        "Asignado a": "Sin asignar",
        "Fecha de Creación": "01/10/2026",
        "Fecha de Entrega": "05/10/2026",
      },
    ]);

    expect(data[0].map((cell) => (cell as { value: unknown }).value)).toEqual([
      "ID",
      "Cliente",
      "Descripción",
      "Estado",
      "Asignado a",
      "Fecha de Creación",
      "Fecha de Entrega",
    ]);
    expect(data[1][0]).toEqual({ type: Number, value: 7 });
    expect(data[1][1]).toEqual({ type: String, value: "ACME" });
    expect(data).toHaveLength(2);
  });

  it("deja vacías las celdas sin valor y no truena con una lista vacía", () => {
    expect(buildOrdersSheetData([])).toEqual([]);
    const data = buildOrdersSheetData([{ ID: 1, Descripción: undefined }]);
    expect(data[1][1]).toBeNull();
  });
});

describe("ordersExportFileName", () => {
  it("usa la fecha ISO del día", () => {
    expect(ordersExportFileName(new Date("2026-10-06T12:00:00Z"))).toBe("pedidos-2026-10-06.xlsx");
  });
});
