import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryFilters, hasHistoryFilters } from "./HistoryFilters";

vi.mock("@/hooks/useEntity", () => ({
  CATALOG_STALE_TIME: 0,
  useEntityList: () => ({ data: [{ id: 5, name: "entregado" }] }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

describe("HistoryFilters", () => {
  it("publica la búsqueda con debounce (no en cada tecla)", async () => {
    const onChange = vi.fn();
    render(<HistoryFilters filters={{}} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/Buscar por código/), "EMD-P0042");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ q: "EMD-P0042" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("'Limpiar' aparece sólo con filtros y los borra todos", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HistoryFilters filters={{}} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /Limpiar/ })).not.toBeInTheDocument();

    rerender(<HistoryFilters filters={{ area: "dtf", statusId: 5 }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Limpiar/ }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("hasHistoryFilters ignora el texto vacío", () => {
    expect(hasHistoryFilters({ q: "  " })).toBe(false);
    expect(hasHistoryFilters({ dateFrom: "2026-10-01" })).toBe(true);
  });
});
