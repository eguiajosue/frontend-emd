import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AreaOverview } from "@emd/types";
import { DEFAULT_AREAS } from "@emd/business/src/areas";
import AreasPage, { deactivationBlocker } from "./page";

const update = vi.fn();
let overview: AreaOverview[] = [];
let isAdmin = true;

vi.mock("@/hooks/useAreaAdmin", () => ({
  useAreaOverview: () => ({ areas: overview, isPending: false, isError: false, refetch: vi.fn() }),
  useAreaAdminMutations: () => ({ create: vi.fn(), update, isCreating: false, isUpdating: false }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageUsers: isAdmin, isSessionLoading: false }),
}));
vi.mock("@/components/areas/AreaWizard", () => ({
  AreaWizard: ({ open }: { open: boolean }) => (open ? <div role="dialog">Wizard abierto</div> : null),
}));
vi.mock("@/components/areas/AreaEditDialog", () => ({
  AreaEditDialog: ({ area }: { area: AreaOverview | null }) => (area ? <div role="dialog">Editando {area.name}</div> : null),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (slug: string, over: Partial<AreaOverview> = {}): AreaOverview => {
  const base = DEFAULT_AREAS.find((a) => a.slug === slug)!;
  return { ...base, users: 2, hasSharedAccount: true, openOrders: 0, openTasks: 0, ...over };
};

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({});
  isAdmin = true;
  overview = [
    row("taller"),
    row("dtf", { openOrders: 2, openTasks: 3 }),
    row("diseno"),
    { ...row("laser"), active: false, users: 0, hasSharedAccount: false },
  ];
});

describe("deactivationBlocker", () => {
  it("dice por qué no se puede, con singular y plural", () => {
    expect(deactivationBlocker(row("taller"))).toBeNull();
    expect(deactivationBlocker(row("dtf", { openOrders: 1, openTasks: 0 }))).toBe("Tiene 1 pedido abierto.");
    expect(deactivationBlocker(row("dtf", { openOrders: 2, openTasks: 1 }))).toBe("Tiene 2 pedidos abiertos y 1 tarea sin terminar.");
    expect(deactivationBlocker(row("diseno"))).toMatch(/no se desactiva/);
  });
});

describe("AreasPage", () => {
  it("lista las áreas con personas, cuenta compartida y trabajo abierto", () => {
    render(<AreasPage />);
    const list = screen.getByRole("list", { name: "Áreas" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByText("2 pedidos · 3 tareas")).toBeInTheDocument();
    expect(within(list).getByText("Desactivada")).toBeInTheDocument();
    expect(within(list).getByText("Fase previa")).toBeInTheDocument();
  });

  it("sólo administración entra", () => {
    isAdmin = false;
    render(<AreasPage />);
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nueva área/ })).not.toBeInTheDocument();
  });

  it("abre el wizard y la edición", async () => {
    const user = userEvent.setup();
    render(<AreasPage />);

    await user.click(screen.getByRole("button", { name: /Nueva área/ }));
    expect(screen.getByText("Wizard abierto")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar Taller" }));
    expect(screen.getByText("Editando Taller")).toBeInTheDocument();
  });

  it("desactivar pide confirmación y manda active: false", async () => {
    const user = userEvent.setup();
    render(<AreasPage />);

    await user.click(screen.getByRole("button", { name: "Desactivar Taller" }));
    expect(update).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { active: false }));
  });

  it("un área con trabajo abierto no se puede desactivar y Diseño no ofrece el botón", () => {
    render(<AreasPage />);
    expect(screen.getByRole("button", { name: "Desactivar DTF" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Desactivar Diseño|Activar Diseño/ })).not.toBeInTheDocument();
  });

  it("activar un área desactivada no pide confirmación", async () => {
    const user = userEvent.setup();
    render(<AreasPage />);

    await user.click(screen.getByRole("button", { name: "Activar Láser" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(5, { active: true }));
  });
});
