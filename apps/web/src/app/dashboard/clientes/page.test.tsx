import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Client } from "@/types";

const mocks = vi.hoisted(() => ({
  isBranch: false,
  canManageOperations: true,
  clients: [] as unknown[],
  entityCalls: [] as { entity: string; enabled?: boolean }[],
  crudProps: [] as Record<string, unknown>[],
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ isBranch: mocks.isBranch, canManageOperations: mocks.canManageOperations }),
}));
vi.mock("@/hooks/useEntity", () => ({
  useEntityList: (entity: string, options?: { enabled?: boolean }) => {
    mocks.entityCalls.push({ entity, enabled: options?.enabled });
    return { data: entity === "clients" ? mocks.clients : [] };
  },
}));
vi.mock("@/components/crud/CrudPage", () => ({
  CrudPage: (props: Record<string, unknown>) => {
    mocks.crudProps.push(props);
    return <div data-testid={`crud-${String(props.entity)}`} />;
  },
}));
vi.mock("@/components/clients/ClientOrdersDialog", () => ({ ClientOrdersDialog: () => null }));
vi.mock("@/components/clients/ClientTemplatesDialog", () => ({ ClientTemplatesDialog: () => null }));

import ClientesPage from "./page";
import { getClientColumns } from "./components/clientColumns";

type ColumnsFn = (args: { onEdit: () => void; onDelete: () => void; canEdit: boolean; canDelete?: boolean }) => { id?: string; header?: string; cell?: unknown }[];

const crud = (entity: string) => mocks.crudProps.find((p) => p.entity === entity);

beforeEach(() => {
  mocks.isBranch = false;
  mocks.canManageOperations = true;
  mocks.clients = [];
  mocks.entityCalls = [];
  mocks.crudProps = [];
});

describe("Clientes - sucursal", () => {
  beforeEach(() => {
    mocks.isBranch = true;
    mocks.canManageOperations = false;
  });

  it("sólo ve Clientes: sin pestañas ni pantalla de Empresas, y no pide /companies", () => {
    render(<ClientesPage />);
    expect(screen.queryByRole("tab", { name: "Empresas" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("crud-companies")).not.toBeInTheDocument();
    expect(mocks.entityCalls.find((c) => c.entity === "companies")?.enabled).toBe(false);
  });

  it("puede crear y editar sus clientes pero no eliminarlos", () => {
    render(<ClientesPage />);
    const props = crud("clients")!;
    expect(props.canEdit).toBe(true);
    expect(props.canDelete).toBe(false);
    expect(props.filters).toEqual([]);
    expect((props.fields as { name: string }[]).map((f) => f.name)).not.toContain("companyId");
  });

  it("sus columnas no llevan Empresa ni plantillas de pedido", () => {
    render(<ClientesPage />);
    const cols = (crud("clients")!.columns as ColumnsFn)({ onEdit() {}, onDelete() {}, canEdit: true, canDelete: false });
    const headers = cols.map((c) => c.header);
    expect(headers).not.toContain("Empresa");
    expect(headers).toContain("");
  });

  it("no ofrece \"Ver pedidos del cliente\" (el backend le cierra esa ruta; usa Mi historial)", () => {
    render(<ClientesPage />);
    expect(screen.queryByRole("button", { name: "Ver pedidos del cliente" })).not.toBeInTheDocument();
    const cols = (crud("clients")!.columns as ColumnsFn)({ onEdit() {}, onDelete() {}, canEdit: true, canDelete: false });
    const actions = cols.find((c) => c.id === "viewOrders")!;
    const { container } = render(<>{(actions.cell as (ctx: unknown) => React.ReactNode)({ row: { original: { id: 1 } } })}</>);
    expect(container.querySelector('[aria-label="Ver pedidos del cliente"]')).toBeNull();
  });
});

describe("Clientes - matriz", () => {
  it("conserva pestañas, Empresas, filtro por empresa y eliminar", () => {
    render(<ClientesPage />);
    expect(screen.getByRole("tab", { name: "Empresas" })).toBeInTheDocument();
    const props = crud("clients")!;
    expect(props.canEdit).toBe(true);
    expect(props.canDelete).toBe(true);
    expect((props.filters as unknown[]).length).toBe(1);
    expect((props.fields as { name: string }[]).map((f) => f.name)).toContain("companyId");
  });

  it("conserva \"Ver pedidos del cliente\"", () => {
    render(<ClientesPage />);
    const cols = (crud("clients")!.columns as ColumnsFn)({ onEdit() {}, onDelete() {}, canEdit: true, canDelete: true });
    const actions = cols.find((c) => c.id === "viewOrders")!;
    const { container } = render(<>{(actions.cell as (ctx: unknown) => React.ReactNode)({ row: { original: { id: 1 } } })}</>);
    expect(container.querySelector('[aria-label="Ver pedidos del cliente"]')).not.toBeNull();
  });

  it("muestra la columna Sucursal sólo si hay clientes de sucursal", () => {
    const headersOf = () => {
      const cols = (crud("clients")!.columns as ColumnsFn)({ onEdit() {}, onDelete() {}, canEdit: true });
      return cols.map((c) => c.header);
    };
    mocks.clients = [{ id: 1, first_name: "Colegio" }];
    const first = render(<ClientesPage />);
    expect(headersOf()).not.toContain("Sucursal");
    first.unmount();

    mocks.crudProps = [];
    mocks.clients = [{ id: 3, first_name: "Escuela", branch: { id: 1, name: "Punto Madero" } }];
    render(<ClientesPage />);
    expect(headersOf()).toContain("Sucursal");
  });
});

describe("getClientColumns", () => {
  it("la columna Sucursal pinta la insignia de la sucursal del cliente", () => {
    const col = getClientColumns({ onEdit() {}, onDelete() {}, canEdit: true }, { showBranch: true }).find(
      (c) => c.id === "branch"
    )!;
    const cell = col.cell as (ctx: { row: { original: Client } }) => React.ReactElement;
    render(cell({ row: { original: { id: 3, first_name: "Escuela", branch: { id: 1, name: "Punto Madero" } } as Client } }));
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Punto Madero");
  });

  it("sin canDelete no hay botón Eliminar", () => {
    const actions = getClientColumns({ onEdit() {}, onDelete() {}, canEdit: true, canDelete: false }).at(-1)!;
    const cell = actions.cell as (ctx: { row: { original: Client } }) => React.ReactElement;
    render(cell({ row: { original: { id: 1, first_name: "A" } as Client } }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });
});
