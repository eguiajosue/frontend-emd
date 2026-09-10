import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";

interface Row {
  id: number;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: ({ row }) => `Fila ${row.original.id}` },
];

const data: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

describe("DataTable, lista móvil con virtualize activo", () => {
  it("monta sólo un lote de tarjetas al inicio, no las 50 de una vez", () => {
    render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(30);
  });

  it("el botón Cargar más revela el resto de las filas", async () => {
    render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");
    await userEvent.click(screen.getByRole("button", { name: /Cargar más/i }));
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(50);
  });

  it("sin virtualize, se comporta igual que siempre (todas las filas)", () => {
    render(<DataTable columns={columns} data={data.slice(0, 10)} />);
    const mobileList = screen.getByTestId("mobile-card-list");
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(10);
  });

  it("no colapsa la lista expandida cuando llega un refetch con nueva referencia pero mismas filas (ej. socket invalidando queries)", async () => {
    const { rerender } = render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");

    await userEvent.click(screen.getByRole("button", { name: /Cargar más/i }));
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(50);

    // Nueva referencia de array, mismo largo lógico (simula invalidateQueries
    // + refetch tras un evento de socket, no un filtrado real).
    const sameLengthNewRef = data.map((row) => ({ ...row }));
    rerender(<DataTable columns={columns} data={sameLengthNewRef} virtualize />);

    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(50);
  });

  it("clampea el conteo visible cuando la data efectivamente se achica (ej. un filtro saca filas)", () => {
    const { rerender } = render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(30);

    const filtrados = data.slice(0, 5);
    rerender(<DataTable columns={columns} data={filtrados} virtualize />);

    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(5);
  });
});
