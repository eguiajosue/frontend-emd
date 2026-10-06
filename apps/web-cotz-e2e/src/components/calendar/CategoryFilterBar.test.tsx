import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilterBar } from "./CategoryFilterBar";

describe("CategoryFilterBar", () => {
  it("es un Select con todas las categorías", async () => {
    render(<CategoryFilterBar value="todos" onChange={() => {}} />);

    const trigger = screen.getByRole("combobox", { name: "Filtrar por categoría" });
    expect(trigger).toHaveTextContent("Todas las categorías");
    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: /Instalación/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Junta \/ Reunión/i })).toBeInTheDocument();
  });

  it("al elegir una categoría, avisa el cambio", async () => {
    const onChange = vi.fn();
    render(<CategoryFilterBar value="todos" onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por categoría" }));
    await userEvent.click(screen.getByRole("option", { name: /Entrega/i }));
    expect(onChange).toHaveBeenCalledWith("entrega");
  });
});
