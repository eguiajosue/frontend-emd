import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { SizeGrid } from "./SizeGrid";
import { SizeSummary } from "./SizeSummary";
import type { SizeBreakdown } from "@/lib/garmentSizes";

function Harness({ onChange }: { onChange?: (v: SizeBreakdown) => void }) {
  const [v, setV] = useState<SizeBreakdown | null>(null);
  return (
    <SizeGrid
      idPrefix="t"
      value={v}
      onChange={(n) => {
        setV(n);
        onChange?.(n);
      }}
    />
  );
}

describe("SizeGrid", () => {
  it("captura cantidades y calcula el total", () => {
    const spy = vi.fn();
    render(<Harness onChange={spy} />);
    fireEvent.change(screen.getByLabelText("General S"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("General M"), { target: { value: "2" } });
    expect(screen.getByTestId("t-total").textContent).toContain("7 pzas");
    expect(spy).toHaveBeenLastCalledWith({ general: { S: 5, M: 2 } });
  });

  it("agrega un corte a demanda y suma entre cortes", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Mujer S")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Mujer \(dama\)/ }));
    fireEvent.change(screen.getByLabelText("Mujer S"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("General M"), { target: { value: "5" } });
    expect(screen.getByTestId("t-total").textContent).toContain("8 pzas");
  });

  it("flechas suman y restan 1, y rechaza no dígitos", () => {
    render(<Harness />);
    const input = screen.getByLabelText("General L");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect((input as HTMLInputElement).value).toBe("2");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect((input as HTMLInputElement).value).toBe("1");
    fireEvent.change(input, { target: { value: "a" } });
    expect((input as HTMLInputElement).value).toBe("");
  });
});

describe("SizeSummary", () => {
  it("muestra el resumen y nada sin tallas", () => {
    const { container, rerender } = render(<SizeSummary sizes={{ general: { S: 5, M: 2, L: 3 } }} />);
    expect(container.textContent).toContain("General: 5 S · 2 M · 3 L");
    expect(container.textContent).toContain("10 pzas");
    rerender(<SizeSummary sizes={undefined} />);
    expect(container.textContent).toBe("");
  });
});
