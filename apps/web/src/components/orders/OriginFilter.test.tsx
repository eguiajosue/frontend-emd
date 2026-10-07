import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OriginFilter } from "./OriginFilter";

const permissions = vi.hoisted(() => ({ isBranch: false, isSessionLoading: false }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => permissions }));
const useBranches = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useBranches", () => ({ useBranches }));

beforeEach(() => {
  permissions.isBranch = false;
  permissions.isSessionLoading = false;
  useBranches.mockReset().mockReturnValue({
    data: [
      { id: 1, name: "Punto Madero", active: true },
      { id: 2, name: "Plaza Norte", active: true },
    ],
  });
});

describe("OriginFilter", () => {
  it("ofrece Todos, Matriz, Todas las sucursales y cada sucursal", async () => {
    render(<OriginFilter value={undefined} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Matriz" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todas las sucursales" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Punto Madero" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Plaza Norte" })).toBeInTheDocument();
  });

  it("avisa el origen elegido: matriz, sucursal (todas) o el id de una sucursal", async () => {
    const onChange = vi.fn();
    render(<OriginFilter value={undefined} onChange={onChange} />);
    for (const [name, expected] of [
      ["Matriz", "matriz"],
      ["Todas las sucursales", "sucursal"],
      ["Plaza Norte", "2"],
    ] as const) {
      await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
      await userEvent.click(screen.getByRole("option", { name }));
      expect(onChange).toHaveBeenLastCalledWith(expected);
    }
  });

  it("'Todos' limpia el filtro", async () => {
    const onChange = vi.fn();
    render(<OriginFilter value="matriz" onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: "Origen" })).toHaveTextContent("Matriz");
    await userEvent.click(screen.getByRole("combobox", { name: "Origen" }));
    await userEvent.click(screen.getByRole("option", { name: "Todos" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("la cuenta de sucursal no lo ve (ni pide las sucursales)", () => {
    permissions.isBranch = true;
    render(<OriginFilter value={undefined} onChange={() => {}} />);
    expect(screen.queryByRole("combobox", { name: "Origen" })).not.toBeInTheDocument();
    expect(useBranches).toHaveBeenCalledWith(false);
  });
});
