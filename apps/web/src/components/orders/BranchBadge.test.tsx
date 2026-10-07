import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BranchBadge } from "./BranchBadge";

// Sin logos cargados: el badge cae al nombre en texto.
vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({ getLogos: () => undefined, logos: [], isLoading: false, isError: false }),
}));

describe("BranchBadge", () => {
  it("muestra «Punto Madero» en los pedidos de la sucursal", () => {
    render(<BranchBadge order={{ branch: { id: 1, name: "Punto Madero" } }} />);
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Punto Madero");
  });

  it("no muestra nada en los pedidos de la matriz", () => {
    const { container } = render(<BranchBadge order={{ branch: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
