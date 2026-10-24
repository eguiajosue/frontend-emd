import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_AREAS, resetAreaCatalog, setAreaCatalog } from "@emd/business/src/areas";
import { AreaWizard } from "./AreaWizard";

const create = vi.fn();
vi.mock("@/hooks/useAreaAdmin", () => ({
  useAreaAdminMutations: () => ({ create, update: vi.fn(), setStages: vi.fn(), isCreating: false, isUpdating: false }),
}));
vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({
    data: [
      { id: 3, firstName: "Ana", lastName: "Ruiz", username: "aruiz", roles: [{ id: 2, name: "recepcion" }] },
      { id: 4, firstName: "Beto", lastName: "Lara", username: "blara", roles: [] },
      { id: 9, firstName: "Taller", username: "taller", isSharedAccount: true, roles: [] },
      { id: 10, firstName: "Punto Madero", username: "pmadero", roles: [{ id: 5, name: "sucursal" }] },
    ],
    isPending: false,
  }),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: 7, slug: "impresion-3d", name: "Impresión 3D" });
  toastSuccess.mockReset();
  resetAreaCatalog();
});

const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Siguiente" }));

describe("AreaWizard", () => {
  it("no deja avanzar sin un nombre válido y avisa por qué", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await next(user);
    expect(screen.getByText(/al menos 2 caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 8/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nombre del área/), "Láser");
    await next(user);
    expect(screen.getByText(/Ya existe un área parecida: "Láser"/)).toBeInTheDocument();
  });

  it("muestra el identificador interno que tendrá el nombre", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Impresión 3D");

    expect(screen.getByText(/Identificador interno: impresion-3d/)).toBeInTheDocument();
  });

  it("recorre los ocho pasos y crea el área con todo lo capturado", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<AreaWizard open onClose={onClose} onCreated={onCreated} />);

    // 1 · Identidad
    await user.type(screen.getByLabelText(/Nombre del área/), "Impresión 3D");
    await user.click(screen.getByRole("radio", { name: "Cuboid" }));
    await user.click(screen.getByRole("radio", { name: "#0ea5e9" }));
    await next(user);

    // 2 · Comportamiento
    expect(screen.getByText(/Paso 2 de 8/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /Todo el equipo ve todo/ }));
    await next(user);

    // 3 · Etapas previas a producción
    expect(screen.getByText(/Paso 3 de 8/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar etapa" }));
    await user.type(screen.getByLabelText("Nombre de la etapa 1"), "Slicing");
    await user.click(screen.getByRole("button", { name: "Agregar revisión" }));
    await user.type(screen.getByLabelText("Nombre de la etapa 2"), "Prueba de impresión");
    await next(user);

    // 4 · Capacidad y máquinas
    expect(screen.getByText(/Paso 4 de 8/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Capacidad/), "6");
    await user.type(screen.getByLabelText(/Horas típicas/), "4");
    await user.click(screen.getByRole("button", { name: "Agregar máquina" }));
    await user.type(screen.getByLabelText("Nombre de la máquina 1"), "Impresora 1");
    await next(user);

    // 5 · Datos del pedido
    expect(screen.getByText(/Paso 5 de 8/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar dato" }));
    await user.type(screen.getByLabelText("Nombre del dato 1"), "Alto");
    await user.click(screen.getByRole("combobox", { name: "Tipo del dato 1" }));
    await user.click(await screen.findByRole("option", { name: "Número" }));
    await user.type(screen.getByLabelText("Unidad del dato 1"), "cm");
    await user.click(screen.getByRole("switch", { name: /Obligatorio/ }));
    await next(user);

    // 6 · Inventario inicial
    expect(screen.getByText(/Paso 6 de 8/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Categorías"), "Filamento{Enter}Resina{Enter}");
    await user.type(screen.getByLabelText("Unidades"), "kg,rollo,");
    expect(screen.getByRole("button", { name: "Quitar Resina" })).toBeInTheDocument();
    await next(user);

    // 7 · Equipo: sólo personas (ni cuentas compartidas ni de sucursal)
    expect(screen.getByText(/Paso 7 de 8/)).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Beto Lara")).toBeInTheDocument();
    expect(screen.queryByText("Taller")).not.toBeInTheDocument();
    expect(screen.queryByText("Punto Madero")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Beto Lara/ }));
    await next(user);

    // 8 · Resumen
    expect(screen.getByText(/Paso 8 de 8/)).toBeInTheDocument();
    const summary = screen.getByRole("list", { name: "Resumen del área" });
    expect(within(summary).getByText(/Sugerirá en inventario: Filamento, Resina, kg, rollo/)).toBeInTheDocument();
    expect(within(summary).getByText(/«Slicing» → «Prueba de impresión» antes de producir/)).toBeInTheDocument();
    expect(within(summary).getByText(/Capacidad: 6 tareas abiertas a la vez/)).toBeInTheDocument();
    expect(within(summary).getByText(/Máquinas: Impresora 1/)).toBeInTheDocument();
    expect(within(summary).getByText(/se capturará: Alto/)).toBeInTheDocument();
    expect(within(summary).getByText(/1 persona pasará/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear área" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      name: "Impresión 3D",
      icon: "Cuboid",
      color: "#0ea5e9",
      isProductionDestination: true,
      hasInventory: true,
      generalViewEnabled: false,
      inventoryCategories: ["Filamento", "Resina"],
      inventoryUnits: ["kg", "rollo"],
      createSharedAccount: true,
      userIds: [4],
      stages: [
        { name: "Slicing", kind: "work" },
        { name: "Prueba de impresión", kind: "review" },
      ],
      capacity: 6,
      turnaroundHours: 4,
      machines: [{ name: "Impresora 1" }],
      fields: [{ label: "Alto", type: "number", required: true, unit: "cm" }],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Área "Impresión 3D" creada');
    expect(onCreated).toHaveBeenCalledWith("impresion-3d");
    expect(onClose).toHaveBeenCalled();
  });

  it("sin inventario propio se salta el paso de inventario y no manda sugerencias", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Oficina");
    await next(user);
    await user.click(screen.getByRole("switch", { name: /Inventario propio/ }));
    await next(user);
    await next(user); // Etapas (opcional): se deja vacío
    await next(user); // Capacidad y máquinas (opcional)
    await next(user); // Datos del pedido (opcional)

    expect(screen.getByText(/Paso 6 de 7 · Equipo/)).toBeInTheDocument();
    await next(user);
    await user.click(screen.getByRole("button", { name: "Crear área" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ hasInventory: false, inventoryCategories: [], inventoryUnits: [] });
  });

  it("si el alta falla, el wizard sigue abierto con lo capturado", async () => {
    create.mockRejectedValue(new Error("409"));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AreaWizard open onClose={onClose} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Serigrafía");
    for (let i = 0; i < 7; i++) await next(user);
    await user.click(screen.getByRole("button", { name: "Crear área" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear área" })).toBeInTheDocument();
  });

  it("detecta un nombre repetido contra el catálogo vigente (incluye áreas nuevas)", async () => {
    setAreaCatalog([...DEFAULT_AREAS, { ...DEFAULT_AREAS[0], id: 7, slug: "serigrafia", name: "Serigrafía", sortOrder: 70 }]);
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "serigrafia");
    await next(user);

    expect(screen.getByText(/Ya existe un área parecida: "Serigrafía"/)).toBeInTheDocument();
  });

  it("el paso de etapas no deja avanzar con una lista que no sirve y sin etapas es opcional", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Serigrafía");
    await next(user);
    await next(user);
    expect(screen.getByText(/Paso 3 de 8 · Etapas/)).toBeInTheDocument();
    expect(screen.getByText(/Sin etapas: las tareas nacen listas para producir/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agregar etapa" }));
    await next(user);
    expect(screen.getByText(/entre 2 y 40 caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 3 de 8/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar la etapa 1" }));
    await next(user);
    expect(screen.getByText(/Paso 4 de 8 · Capacidad y máquinas/)).toBeInTheDocument();
  });

  it("un área que no es destino de producción no pide etapas", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Oficina");
    await next(user);
    await user.click(screen.getByRole("switch", { name: /Destino de producción/ }));
    await next(user);

    expect(screen.getByText(/Paso 3 de 5 · Inventario inicial/)).toBeInTheDocument();
  });

  it("capacidad, máquinas y datos no deja avanzar con valores que no sirven", async () => {
    const user = userEvent.setup();
    render(<AreaWizard open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nombre del área/), "Serigrafía");
    await next(user);
    await next(user);
    await next(user);
    expect(screen.getByText(/Paso 4 de 8 · Capacidad y máquinas/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Capacidad/), "0");
    await next(user);
    expect(screen.getByText(/La capacidad debe ser un número entero entre 1 y 500/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Capacidad/));
    await next(user);

    expect(screen.getByText(/Paso 5 de 8 · Datos del pedido/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar dato" }));
    await user.type(screen.getByLabelText("Nombre del dato 1"), "Material");
    await user.click(screen.getByRole("combobox", { name: "Tipo del dato 1" }));
    await user.click(await screen.findByRole("option", { name: "Lista de opciones" }));
    await next(user);
    expect(screen.getByText(/necesita entre 2 y 10 opciones/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 5 de 8/)).toBeInTheDocument();
  });
});
