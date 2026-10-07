import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AreaSupplySummary } from "./AreaSupplySummary";

describe("AreaSupplySummary", () => {
  it("muestra 'Insumos: del cliente — …'", () => {
    render(
      <AreaSupplySummary
        supply={{
          id: 1,
          source: "cliente",
          lines: [{ id: 1, inventoryItemId: null, description: "playeras negras", quantity: "12", discountedAt: null }],
        }}
      />
    );
    expect(screen.getByTestId("area-supply-summary")).toHaveTextContent("Insumos: del cliente — 12 × playeras negras");
  });

  it("no pinta nada sin hoja", () => {
    const { container } = render(<AreaSupplySummary supply={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
