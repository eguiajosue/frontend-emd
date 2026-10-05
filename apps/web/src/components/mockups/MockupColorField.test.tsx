import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MockupColorField, type MyColorsControls } from "./MockupColorField";

function Harness({ controls, initial = "#ffffff" }: { controls?: MyColorsControls; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MockupColorField label="Frente" value={value} onChange={setValue} myColors={controls} />
      <output data-testid="value">{value}</output>
    </>
  );
}

function controls(entries: MyColorsControls["entries"] = []): MyColorsControls {
  return { entries, onAdd: vi.fn(async () => true), onToggleFavorite: vi.fn(), onRemove: vi.fn() };
}

describe("MockupColorField · Mis colores", () => {
  it("sin controles no muestra la fila (otros usos del campo no cambian)", () => {
    render(<Harness />);
    expect(screen.queryByText("Mis colores")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Frente: Negro" })).toBeInTheDocument();
  });

  it("muestra favoritos primero con su estrella y aplica el color al tocarlo", async () => {
    render(
      <Harness
        controls={controls([
          { value: "#1f2a44", favorite: true },
          { value: "#c8102e", favorite: false },
        ])}
      />
    );
    const row = screen.getByRole("group", { name: "Frente: mis colores" });
    const dots = within(row).getAllByRole("button");
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual(["Frente: #1F2A44 (favorito)", "Frente: #C8102E"]);
    await userEvent.click(dots[1]);
    expect(screen.getByTestId("value")).toHaveTextContent("#c8102e");
    expect(dots[1]).toHaveAttribute("aria-pressed", "true");
    // Los colores rápidos siguen ahí.
    expect(screen.getByRole("button", { name: "Frente: Marino" })).toBeInTheDocument();
  });

  it("Agregar color: hex escrito a mano se guarda en mis colores y se aplica", async () => {
    const c = controls();
    render(<Harness controls={c} />);
    expect(screen.getByText("Guarda aquí los colores de tus clientes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Frente: agregar color" }));
    expect(screen.getByLabelText("Color nuevo: elegir color")).toHaveAttribute("type", "color");
    const hex = screen.getByRole("textbox", { name: "Color nuevo (código hex)" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "0A7{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(c.onAdd).toHaveBeenCalledWith("#00aa77");
    expect(screen.getByTestId("value")).toHaveTextContent("#00aa77");
  });

  it("en el panel se marca favorito y se quita un color", async () => {
    const c = controls([{ value: "#c8102e", favorite: false }]);
    render(<Harness controls={c} initial="#c8102e" />);
    await userEvent.click(screen.getByRole("button", { name: "Frente: agregar color" }));
    const list = screen.getByRole("list", { name: "Tus colores" });
    // El color actual ya está guardado: no se puede repetir.
    expect(screen.getByRole("button", { name: "Ya está" })).toBeDisabled();
    await userEvent.click(within(list).getByRole("button", { name: "Marcar #C8102E como favorito" }));
    expect(c.onToggleFavorite).toHaveBeenCalledWith("#c8102e");
    await userEvent.click(within(list).getByRole("button", { name: "Quitar #C8102E de mis colores" }));
    expect(c.onRemove).toHaveBeenCalledWith("#c8102e");
  });
});
