import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QuotePriorityChip } from "./QuotePriorityChip";

describe("QuotePriorityChip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Lunes 5 de octubre, 11:59 p. m. (hora local).
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("Normal (sin fecha) no muestra chip", () => {
    const { container } = render(<QuotePriorityChip priorityDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Mañana pasa a Hoy, y Hoy a Atrasada, al cruzar la medianoche", () => {
    render(
      <>
        <QuotePriorityChip priorityDate="2026-10-05" />
        <QuotePriorityChip priorityDate="2026-10-06" />
        <QuotePriorityChip priorityDate="2026-10-04" />
      </>
    );
    expect(screen.getAllByTestId("quote-priority").map((c) => c.textContent)).toEqual(["Hoy", "Mañana", "Atrasada"]);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getAllByTestId("quote-priority").map((c) => c.textContent)).toEqual(["Atrasada", "Hoy", "Atrasada"]);
    expect(screen.getAllByTestId("quote-priority")[0]).toHaveAttribute("data-tone", "atrasada");
  });

  it("una fecha más adelante se muestra como fecha", () => {
    render(<QuotePriorityChip priorityDate="2026-10-09" />);
    expect(screen.getByTestId("quote-priority")).toHaveTextContent("Para el 9 oct");
  });
});
