import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { CrudPage, type CrudFilterConfig } from "./CrudPage";
import type { BaseEntity } from "@/types";

interface Widget extends BaseEntity {
  name: string;
  category: { name: string } | null;
}

const widgets: Widget[] = [
  { id: 1, name: "Tornillo", category: { name: "Ferretería" } },
  { id: 2, name: "Tuerca", category: { name: "Ferretería" } },
  { id: 3, name: "Lámina de acrílico", category: { name: "Láminas" } },
];

vi.mock("@/hooks/useEntity", () => ({
  CATALOG_STALE_TIME: 300_000,
  useEntityList: () => ({ data: widgets, isPending: false, isError: false, refetch: vi.fn() }),
  useEntityMutations: () => ({
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    isMutating: false,
  }),
}));

const columns = () => [
  { accessorKey: "name", header: "Nombre" },
];

const categoryFilters: CrudFilterConfig<Widget>[] = [
  {
    key: "category",
    label: "Categoría",
    allLabel: "Todas las categorías",
    options: [
      { value: "Ferretería", label: "Ferretería" },
      { value: "Láminas", label: "Láminas" },
    ],
    matches: (item, value) => item.category?.name === value,
  },
];

function renderPage(extra: Partial<React.ComponentProps<typeof CrudPage<Widget>>> = {}) {
  return render(
    <CrudPage<Widget>
      entity="materials"
      title="Widgets"
      createLabel="Nuevo Widget"
      canEdit={false}
      fields={[]}
      schema={z.object({})}
      columns={columns}
      {...extra}
    />
  );
}

// DataTable renderiza una versión desktop (<table>) y una lista mobile en
// simultáneo (alternadas por CSS, ambas presentes en jsdom) — mismo patrón
// que data-table.test.tsx: se usa getAllByText/queryAllByText en vez de la
// variante singular.

describe("CrudPage - búsqueda y filtros", () => {
  it("sin `search` ni `filters`, no muestra la barra de filtros", () => {
    renderPage();
    expect(screen.queryByPlaceholderText(/buscar/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Tornillo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tuerca").length).toBeGreaterThan(0);
  });

  it("con `search: true`, filtra las filas por texto (incluida la categoría anidada)", async () => {
    renderPage({ search: true });

    expect(screen.getAllByText("Tornillo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lámina de acrílico").length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText("Buscar..."), "lámina");

    expect(screen.queryAllByText("Tornillo")).toHaveLength(0);
    expect(screen.getAllByText("Lámina de acrílico").length).toBeGreaterThan(0);
  });

  it("con `filters`, un dropdown narrows las filas por categoría", async () => {
    renderPage({ filters: categoryFilters });

    await userEvent.click(screen.getByLabelText("Categoría"));
    await userEvent.click(await screen.findByRole("option", { name: "Láminas" }));

    expect(screen.queryAllByText("Tornillo")).toHaveLength(0);
    expect(screen.getAllByText("Lámina de acrílico").length).toBeGreaterThan(0);
  });

  it("sin resultados, muestra el estado vacío con 'Limpiar filtros' en vez del vacío de 'crear el primero'", async () => {
    renderPage({ search: true });

    await userEvent.type(screen.getByPlaceholderText("Buscar..."), "no existe ningún widget así");

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.queryAllByText("Tornillo")).toHaveLength(0);

    await userEvent.click(screen.getAllByRole("button", { name: /limpiar filtros/i })[0]);
    expect(screen.getAllByText("Tornillo").length).toBeGreaterThan(0);
  });
});
