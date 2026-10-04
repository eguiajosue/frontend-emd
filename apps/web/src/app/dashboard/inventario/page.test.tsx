import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InventarioPage from "./page";
import type { InventoryArea, InventoryItem } from "@/types";

let areas: InventoryArea[] = [];
let items: InventoryItem[] = [];
const requestedAreas: (InventoryArea | undefined)[] = [];
let roles: string[] = ["admin"];

vi.mock("@/hooks/useInventory", () => ({
  useInventoryAreas: () => ({ data: areas, isPending: false }),
  useInventoryItems: (area?: InventoryArea) => {
    requestedAreas.push(area);
    return {
      data: area ? items.filter((i) => i.area === area) : items,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useInventoryMovements: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useInventoryMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
    remove: { mutateAsync: vi.fn() },
    registerMovement: { mutateAsync: vi.fn(), isPending: false },
  }),
  downloadInventoryExport: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    canManageOperations: roles.includes("admin") || roles.includes("recepcion"),
    isSessionLoading: false,
    roles,
  }),
}));

vi.mock("@/hooks/useEntity", () => ({
  useAuthToken: () => "token",
  useEntityList: () => ({ data: [] }),
  CATALOG_STALE_TIME: 5 * 60_000,
}));

function buildItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: 1,
    area: "bordado",
    name: "Artículo",
    unit: "pieza",
    quantity: 10,
    stockStatus: "ok",
    ...overrides,
  };
}

beforeEach(() => {
  roles = ["admin"];
  areas = ["bordado", "impresiones"];
  requestedAreas.length = 0;
  items = [
    buildItem({ id: 1, name: "Hilo rojo", unit: "cono", quantity: 2, minStock: 5, stockStatus: "low", unitCost: 40 }),
    buildItem({ id: 2, name: "Hilo negro", unit: "cono", quantity: 12, minStock: 5, unitCost: 40 }),
    buildItem({ id: 3, area: "impresiones", name: "Tinta cyan", unit: "litro", quantity: 0, stockStatus: "out" }),
  ];
});

describe("InventarioPage", () => {
  it("muestra indicadores de bajo stock, agotados y valor", () => {
    render(<InventarioPage />);
    expect(screen.getByRole("button", { name: /Bajo stock\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agotados\s*1/ })).toBeInTheDocument();
    // 2×40 + 12×40; la tinta no tiene costo cargado.
    expect(screen.getByText("$560.00")).toBeInTheDocument();
    expect(screen.getByText("1 sin costo cargado")).toBeInTheDocument();
  });

  it("ordena lo urgente primero (agotado, bajo stock, disponible)", () => {
    render(<InventarioPage />);
    const table = screen.getAllByRole("table")[0];
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td p")?.textContent);
    expect(names).toEqual(["Tinta cyan", "Hilo rojo", "Hilo negro"]);
  });

  it("el indicador de bajo stock filtra la tabla", async () => {
    render(<InventarioPage />);
    await userEvent.click(screen.getByRole("button", { name: /Bajo stock\s*1/ }));
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("Hilo rojo")).toBeInTheDocument();
    expect(within(table).queryByText("Hilo negro")).not.toBeInTheDocument();
  });

  it("cambia de departamento con las pestañas", async () => {
    render(<InventarioPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Impresiones" }));
    expect(requestedAreas.at(-1)).toBe("impresiones");
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("Tinta cyan")).toBeInTheDocument();
    expect(within(table).queryByText("Hilo rojo")).not.toBeInTheDocument();
  });

  it("admin y recepción pueden crear y mover stock", () => {
    for (const r of [["admin"], ["recepcion"]]) {
      roles = r;
      const { unmount } = render(<InventarioPage />);
      expect(screen.getByRole("button", { name: /Nuevo artículo/ })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Registrar entrada de Hilo rojo/ }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Más acciones de Hilo rojo/ }).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("un área de producción o Diseño no tiene acceso: el inventario es de Recepción y administración", () => {
    for (const r of [["bordado"], ["diseno", "dtf", "bordado"], ["taller"]]) {
      roles = r;
      areas = ["bordado"];
      const { unmount } = render(<InventarioPage />);
      expect(screen.getByText("Sin acceso al inventario")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Nuevo artículo/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("sin departamentos asignados avisa en vez de mostrar una tabla vacía", () => {
    roles = ["recepcion"];
    areas = [];
    render(<InventarioPage />);
    expect(screen.getByText("No tenés un departamento con inventario")).toBeInTheDocument();
  });
});
