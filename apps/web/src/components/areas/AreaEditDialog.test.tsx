import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AreaOverview } from "@emd/types";
import { DEFAULT_AREAS, resetAreaCatalog } from "@emd/business/src/areas";
import { AreaEditDialog, changesOf } from "./AreaEditDialog";

const update = vi.fn();
vi.mock("@/hooks/useAreaAdmin", () => ({
  useAreaAdminMutations: () => ({ create: vi.fn(), update, isCreating: false, isUpdating: false }),
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
});
