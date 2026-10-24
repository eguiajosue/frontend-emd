import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AreaOverview } from "@emd/types";
import { DEFAULT_AREAS, resetAreaCatalog } from "@emd/business/src/areas";
import { AreaEditDialog, changesOf } from "./AreaEditDialog";

const update = vi.fn();
const setStages = vi.fn();
const setMachines = vi.fn();
const setFields = vi.fn();
vi.mock("@/hooks/useAreaAdmin", () => ({
  useAreaAdminMutations: () => ({ create: vi.fn(), update, setStages, setMachines, setFields, isCreating: false, isUpdating: false }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const area = (slug: string, over: Partial<AreaOverview> = {}): AreaOverview => ({
  ...DEFAULT_AREAS.find((a) => a.slug === slug)!,
  users: 1,
  hasSharedAccount: true,
  openOrders: 0,
  openTasks: 0,
  ...over,
});

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({});
  setStages.mockReset();
  setStages.mockResolvedValue({});
  setMachines.mockReset();
  setMachines.mockResolvedValue({});
  setFields.mockReset();
  setFields.mockResolvedValue({});
  resetAreaCatalog();
});

describe("changesOf", () => {
  const taller = area("taller");
  const draft = {
    name: taller.name,
    icon: taller.icon,
    color: taller.color,
    isProductionDestination: true,
    hasInventory: true,
    generalViewEnabled: true,
    inventoryCategories: [] as string[],
    inventoryUnits: [] as string[],
    capacity: "",
    turnaroundHours: "",
  };

  it("sin cambios no manda nada", () => {
    expect(changesOf(taller, draft)).toEqual({});
  });

  it("sólo manda lo que cambió, con nombre y color normalizados", () => {
    expect(changesOf(taller, { ...draft, name: "  Taller general ", color: "#AA0000", inventoryUnits: ["kg"] })).toEqual({
      name: "Taller general",
      color: "#aa0000",
      inventoryUnits: ["kg"],
    });
  });
});

describe("AreaEditDialog", () => {
  it("guarda sólo el cambio y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AreaEditDialog area={area("taller")} onClose={onClose} />);

    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    const name = screen.getByLabelText(/Nombre del área/);
    await user.clear(name);
    await user.type(name, "Taller general");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { name: "Taller general" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("rechaza un nombre que ya tiene otra área", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("taller")} onClose={vi.fn()} />);

    const name = screen.getByLabelText(/Nombre del área/);
    await user.clear(name);
    await user.type(name, "dtf");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/Ya existe un área parecida: "DTF"/)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("Diseño no puede volverse destino de producción", () => {
    render(<AreaEditDialog area={area("diseno")} onClose={vi.fn()} />);
    expect(screen.getByRole("switch", { name: /Destino de producción/ })).toBeDisabled();
  });

  it("con trabajo abierto no se puede quitar como destino de producción", () => {
    render(<AreaEditDialog area={area("dtf", { openTasks: 2 })} onClose={vi.fn()} />);
    expect(screen.getByRole("switch", { name: /Destino de producción/ })).toBeDisabled();
    expect(screen.getByText(/mientras tenga pedidos o tareas abiertos/)).toBeInTheDocument();
  });

  it("sin inventario propio no pide sugerencias", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("taller")} onClose={vi.fn()} />);

    expect(screen.getByLabelText("Categorías")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /Inventario propio/ }));
    expect(screen.queryByLabelText("Categorías")).not.toBeInTheDocument();
  });

  it("muestra las etapas del área y guarda su cambio sin tocar lo demás", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AreaEditDialog area={area("bordado")} onClose={onClose} />);

    expect(screen.getByLabelText("Nombre de la etapa 1")).toHaveValue("Digitalizado");
    expect(screen.getByLabelText("Nombre de la etapa 2")).toHaveValue("En pruebas");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Agregar etapa" }));
    await user.type(screen.getByLabelText("Nombre de la etapa 3"), "Bastidor");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(setStages).toHaveBeenCalledWith(3, {
        stages: [
          { id: 301, name: "Digitalizado", kind: "work" },
          { id: 302, name: "En pruebas", kind: "review" },
          { name: "Bastidor", kind: "work" },
        ],
      })
    );
    expect(update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("no guarda una lista de etapas que no sirve", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("bordado")} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Subir la etapa 2" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/primera etapa no puede ser una revisión/)).toBeInTheDocument();
    expect(setStages).not.toHaveBeenCalled();
  });

  it("Diseño y las áreas que no reciben producción no muestran etapas", () => {
    const { unmount } = render(<AreaEditDialog area={area("diseno")} onClose={vi.fn()} />);
    expect(screen.queryByText("Etapas previas a producción")).not.toBeInTheDocument();
    unmount();
    render(<AreaEditDialog area={area("taller", { isProductionDestination: false })} onClose={vi.fn()} />);
    expect(screen.queryByText("Etapas previas a producción")).not.toBeInTheDocument();
  });

  it("sin etapas ofrece agregarlas", () => {
    render(<AreaEditDialog area={area("taller")} onClose={vi.fn()} />);
    expect(screen.getByText(/Sin etapas: las tareas nacen listas para producir/)).toBeInTheDocument();
  });

  it("guarda capacidad y tiempos como números (vacío = sin dato)", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("taller", { capacity: 4 })} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/Capacidad/)).toHaveValue("4");
    await user.clear(screen.getByLabelText(/Capacidad/));
    await user.type(screen.getByLabelText(/Horas típicas/), "3");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { capacity: null, turnaroundHours: 3 }));
  });

  it("guarda máquinas y datos propios con sus propias llamadas", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("taller")} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Agregar máquina" }));
    await user.type(screen.getByLabelText("Nombre de la máquina 1"), "Torno 1");
    await user.click(screen.getByRole("button", { name: "Agregar dato" }));
    await user.type(screen.getByLabelText("Nombre del dato 1"), "Material");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(setMachines).toHaveBeenCalledWith(1, { machines: [{ name: "Torno 1" }] }));
    expect(setFields).toHaveBeenCalledWith(1, { fields: [{ label: "Material", type: "text", required: false }] });
    expect(update).not.toHaveBeenCalled();
  });

  it("no guarda si la capacidad no es válida", async () => {
    const user = userEvent.setup();
    render(<AreaEditDialog area={area("taller")} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Capacidad/), "-2");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/La capacidad debe ser un número entero/)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("el tipo de un dato que ya existe no se puede cambiar", () => {
    const fields = [{ id: 1, key: "alto", label: "Alto", type: "number" as const, required: false, options: [], unit: "cm" }];
    render(<AreaEditDialog area={area("taller", { fields })} onClose={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Tipo del dato 1" })).toBeDisabled();
    expect(screen.getByLabelText("Unidad del dato 1")).toHaveValue("cm");
  });
});
