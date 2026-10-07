import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InventarioPage from "./page";
import type { InventoryArea, InventoryItem } from "@/types";

let areas: InventoryArea[] = [];
let items: InventoryItem[] = [];
const requestedAreas: (InventoryArea | undefined)[] = [];
let roles: string[] = ["admin"];

const createRestock = vi.hoisted(() => vi.fn().mockResolvedValue({}));

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
  useRestockCount: () => ({ data: { pending: 2, open: 3 } }),
  useRestockRequests: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useRestockMutations: () => ({
    create: { mutateAsync: createRestock, isPending: false },
    updateStatus: { mutateAsync: vi.fn(), isPending: false },
  }),
  useInventoryMovements: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useInventoryMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
    remove: { mutateAsync: vi.fn() },
    registerMovement: { mutateAsync: vi.fn(), isPending: false },
    scanMovement: { mutateAsync: vi.fn() },
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

  it("Diseño no tiene acceso al inventario", () => {
    roles = ["diseno"];
    areas = [];
    render(<InventarioPage />);
    expect(screen.getByText("Sin acceso al inventario")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo artículo/ })).not.toBeInTheDocument();
  });

  it("un área de producción ve sólo lo suyo con acciones simples (sin gestión, valor ni exportar)", () => {
    roles = ["bordado"];
    areas = ["bordado"];
    items = items.filter((i) => i.area === "bordado");
    render(<InventarioPage />);
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("Hilo rojo")).toBeInTheDocument();
    expect(within(table).queryByText("Tinta cyan")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Impresiones" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Registrar entrada de Hilo rojo/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Registrar consumo de Hilo rojo/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Avisar reabasto de Hilo rojo/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Nuevo artículo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar CSV/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más acciones/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Valor del inventario")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Bitácora" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mis avisos de reabasto/ })).toBeInTheDocument();
  });

  it("el área avisa reabasto de un artículo y el aviso se envía", async () => {
    roles = ["bordado"];
    areas = ["bordado"];
    items = items.filter((i) => i.area === "bordado");
    render(<InventarioPage />);
    await userEvent.click(screen.getAllByRole("button", { name: /Avisar reabasto de Hilo rojo/ })[0]);
    await userEvent.type(screen.getByLabelText("Comentario"), "ya no queda");
    await userEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(createRestock).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 1, comment: "ya no queda", urgency: "NORMAL" })
    );
  });

  it("Recepción ve la pestaña de solicitudes con badge de pendientes y la bitácora", () => {
    roles = ["recepcion"];
    render(<InventarioPage />);
    expect(screen.getByRole("tab", { name: /Solicitudes de reabasto/ })).toBeInTheDocument();
    expect(screen.getByLabelText("2 pendientes")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bitácora" })).toBeInTheDocument();
  });

  it("sin departamentos asignados avisa en vez de mostrar una tabla vacía", () => {
    roles = ["recepcion"];
    areas = [];
    render(<InventarioPage />);
    expect(screen.getByText("No tienes un departamento con inventario")).toBeInTheDocument();
  });

  it("selecciona artículos y abre la vista previa de etiquetas en lote", async () => {
    render(<InventarioPage />);
    const table = screen.getAllByRole("table")[0];
    await userEvent.click(within(table).getByRole("checkbox", { name: "Seleccionar Hilo rojo" }));
    await userEvent.click(within(table).getByRole("checkbox", { name: "Seleccionar Tinta cyan" }));
    const bar = screen.getByRole("region", { name: "Selección para etiquetas" });
    expect(within(bar).getByText("2 seleccionados")).toBeInTheDocument();

    await userEvent.click(within(bar).getByRole("button", { name: /Imprimir etiquetas/ }));
    expect(await screen.findByRole("heading", { name: "Imprimir 2 etiquetas" })).toBeInTheDocument();
    expect(await screen.findAllByTestId("label-preview")).toHaveLength(2);
  });

  it("“seleccionar todos” marca lo que está a la vista", async () => {
    render(<InventarioPage />);
    const table = screen.getAllByRole("table")[0];
    await userEvent.click(within(table).getByRole("checkbox", { name: /Seleccionar todos/ }));
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
  });

  it("el buscador encuentra por código de barras", async () => {
    items[1] = { ...items[1], barcode: "7501234567890" };
    render(<InventarioPage />);
    await userEvent.type(screen.getByLabelText("Buscar en el inventario"), "750123");
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("Hilo negro")).toBeInTheDocument();
    expect(within(table).queryByText("Hilo rojo")).not.toBeInTheDocument();
  });

  it("Escanear abre el modo escaneo con Entrada/Salida y Salir vuelve a la tabla", async () => {
    render(<InventarioPage />);
    await userEvent.click(screen.getByRole("button", { name: /Escanear/ }));
    expect(screen.getByRole("radiogroup", { name: "Tipo de movimiento" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Entrada/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Salir/ }));
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
  });
});
