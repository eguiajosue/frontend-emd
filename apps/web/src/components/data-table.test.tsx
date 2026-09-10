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
});
