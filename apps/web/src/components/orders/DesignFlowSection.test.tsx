import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesignFlowSection } from "./DesignFlowSection";
import type { DesignRevision, Order } from "@/types";

let revisions: DesignRevision[] = [];

vi.mock("@/hooks/useDesignRevisions", () => ({
  useDesignRevisions: () => ({
    revisions,
    isLoading: false,
    isUnavailable: false,
    sendMontage: vi.fn(),
    isSendingMontage: false,
    submitFeedback: vi.fn(),
    isSubmittingFeedback: false,
    approveRevision: vi.fn(),
    isApproving: false,
  }),
  useDesignRevisionFile: () => ({ data: undefined, isError: false, isLoading: false }),
  useDesignRevisionFileContent: () => ({ data: undefined, isError: false, isLoading: false }),
}));

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({ tasks: [] }),
}));

vi.mock("@/hooks/useOrders", () => ({
  useTakeOrderDesign: () => ({ takeDesign: vi.fn(), isTakingDesign: false }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ roles: ["admin"], isAdmin: true }),
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
