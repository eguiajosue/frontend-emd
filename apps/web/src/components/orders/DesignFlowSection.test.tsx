import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesignFlowSection } from "./DesignFlowSection";
import type { DesignRevision, Order } from "@/types";

let revisions: DesignRevision[] = [];
const approveRevision = vi.fn().mockResolvedValue(true);

vi.mock("@/hooks/useDesignRevisions", () => ({
  useDesignRevisions: () => ({
    revisions,
    isLoading: false,
    isUnavailable: false,
    sendMontage: vi.fn(),
    isSendingMontage: false,
    submitFeedback: vi.fn(),
    isSubmittingFeedback: false,
    approveRevision: (...args: unknown[]) => approveRevision(...args),
    isApproving: false,
  }),
  useDesignRevisionFile: () => ({ data: undefined, isError: false, isLoading: false }),
  useDesignRevisionFileContent: () => ({ data: undefined, isError: false, isLoading: false }),
}));

vi.mock("@/hooks/useInventory", () => ({
  useInventoryItems: () => ({
    data: [
      { id: 7, area: "taller", name: "Film DTF", sku: null, barcode: "EMD-000007", unit: "m", quantity: 10, available: 8 },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({ tasks: [] }),
}));

const startDesign = vi.fn();
vi.mock("@/hooks/useOrders", () => ({
  useTakeOrderDesign: () => ({ takeDesign: vi.fn(), isTakingDesign: false }),
  useStartOrderDesign: () => ({ startDesign, isStartingDesign: false }),
}));

let permissions = { roles: ["admin"], isAdmin: true };
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => permissions,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "1" } } }),
}));

function revision(round: number, approved: boolean): DesignRevision {
  return {
    id: round,
    round,
    approved,
    sentAt: "2026-09-01T10:00:00.000Z",
  } as DesignRevision;
}

const order: Order = {
  id: 9,
  description: "Letrero luminoso",
  statusId: 1,
  requiresDesign: true,
  creationDate: "2026-09-01T00:00:00.000Z",
} as Order;

describe("DesignFlowSection - rondas anteriores colapsadas, ronda vigente abierta", () => {
  it("con una sola ronda, no arma acordeón: se ve directo", () => {
    revisions = [revision(1, false)];
    render(<DesignFlowSection order={order} />);

    expect(screen.getByText("Ronda 1")).toBeInTheDocument();
  });

  it("con varias rondas, las anteriores quedan colapsadas y la última se ve sin abrir nada", async () => {
    revisions = [revision(1, true), revision(2, true), revision(3, false)];
    render(<DesignFlowSection order={order} />);

    // La ronda vigente (3) se ve de una, sin acordeón.
    expect(screen.getByText("Ronda 3")).toBeInTheDocument();

    // Las rondas 1 y 2 están en triggers de acordeón, colapsados por defecto.
    const trigger1 = screen.getByRole("button", { name: /Ronda 1/i });
    const trigger2 = screen.getByRole("button", { name: /Ronda 2/i });
    expect(trigger1).toHaveAttribute("aria-expanded", "false");
    expect(trigger2).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger1);
    expect(trigger1).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DesignFlowSection - respuesta del cliente", () => {
  const waiting = {
    ...order,
    status: { id: 22, name: "esperando autorización" },
  } as Order;

  it("sin hoja de materiales, 'Pasar a producción' queda bloqueado", async () => {
    revisions = [revision(1, false)];
    render(<DesignFlowSection order={waiting} />);

    await userEvent.click(screen.getByRole("button", { name: "Autorizó" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Hoja de materiales");
    await userEvent.click(screen.getByRole("button", { name: "Taller" }));
    // Con el área elegida falta el origen del insumo.
    expect(screen.getByRole("button", { name: "Pasar a producción" })).toBeDisabled();
  });

  it("origen 'cliente' sin detalle alcanza y se manda en la autorización", async () => {
    approveRevision.mockClear();
    revisions = [revision(1, false)];
    render(<DesignFlowSection order={waiting} />);

    await userEvent.click(screen.getByRole("button", { name: "Autorizó" }));
    await userEvent.click(screen.getByRole("button", { name: "Taller" }));
    await userEvent.click(screen.getByRole("radio", { name: "Taller: lo trae el cliente" }));
    await userEvent.type(screen.getByLabelText("Taller: descripción del insumo del cliente"), "playeras negras");
    await userEvent.type(screen.getByLabelText("Taller: cantidad del insumo del cliente"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Pasar a producción" }));

    expect(approveRevision).toHaveBeenCalledWith({
      revisionId: 1,
      productionAreas: ["taller"],
      supplies: [{ area: "taller", source: "cliente", lines: [{ description: "playeras negras", quantity: 12 }] }],
    });
  });

  it("origen 'nosotros' exige elegir un artículo del inventario (o texto libre)", async () => {
    approveRevision.mockClear();
    revisions = [revision(1, false)];
    render(<DesignFlowSection order={waiting} />);

    await userEvent.click(screen.getByRole("button", { name: "Autorizó" }));
    await userEvent.click(screen.getByRole("button", { name: "Taller" }));
    await userEvent.click(screen.getByRole("radio", { name: "Taller: lo ponemos nosotros" }));
    expect(screen.getByRole("button", { name: "Pasar a producción" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Taller: buscar insumo en inventario"), "film");
    await userEvent.click(screen.getByRole("button", { name: /Film DTF/ }));
    const qty = screen.getByLabelText("Taller: cantidad de Film DTF");
    await userEvent.clear(qty);
    await userEvent.type(qty, "2");
    await userEvent.click(screen.getByRole("button", { name: "Pasar a producción" }));

    expect(approveRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        supplies: [{ area: "taller", source: "nosotros", lines: [{ inventoryItemId: 7, description: "Film DTF", quantity: 2 }] }],
      })
    );
  });

  it("con cambios pedidos, lo que pidió el cliente se lee primero", () => {
    revisions = [{ ...revision(1, false), feedbackText: "Agrandar el logo" } as DesignRevision];
    render(
      <DesignFlowSection
        order={{ ...order, status: { id: 23, name: "cambios solicitados" } } as Order}
      />
    );

    expect(screen.getByText("El cliente pidió estos cambios")).toBeInTheDocument();
    expect(screen.getByText("Agrandar el logo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Corregir y reenviar \(ronda 2\)/ })).toBeInTheDocument();
  });
});

describe("DesignFlowSection - Empezar diseño", () => {
  const fresh = {
    ...order,
    area: "diseno",
    status: { id: 21, name: "en diseño" },
    designStartedAt: null,
    assignedUserId: 1,
    assignedUser: { id: 1, isSharedAccount: true },
  } as unknown as Order;

  it("desde la cuenta compartida pide el nombre antes de empezar", async () => {
    revisions = [];
    permissions = { roles: ["diseno"], isAdmin: false };
    render(<DesignFlowSection order={fresh} />);

    const button = screen.getByRole("button", { name: /Empezar diseño/ });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tu nombre"), "Dani");
    await userEvent.click(button);
    expect(startDesign).toHaveBeenCalledWith(fresh.id, "Dani");
    permissions = { roles: ["admin"], isAdmin: true };
  });

  it("Recepción ve que todavía nadie lo empezó, y quién cuando ya arrancó", () => {
    revisions = [];
    permissions = { roles: ["recepcion"], isAdmin: false };
    const { rerender } = render(<DesignFlowSection order={fresh} />);
    expect(screen.getByText("Diseño todavía no lo empezó.")).toBeInTheDocument();

    rerender(
      <DesignFlowSection
        order={{ ...fresh, designStartedAt: new Date().toISOString(), designStartedByName: "Dani" } as Order}
      />
    );
    expect(screen.getByText("Dani")).toBeInTheDocument();
    permissions = { roles: ["admin"], isAdmin: true };
  });
});
