import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilterBar } from "./CategoryFilterBar";

describe("CategoryFilterBar", () => {
  it("en modo tabs, muestra Todos + una tab por categoría", () => {
    render(<CategoryFilterBar value="todos" onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Instalación/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Junta \/ Reunión/i })).toBeInTheDocument();
  });

  it("al elegir una categoría, avisa el cambio", async () => {
    const onChange = vi.fn();
    render(<CategoryFilterBar value="todos" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: /Entrega/i }));
    expect(onChange).toHaveBeenCalledWith("entrega");
  });

  it("en modo compacto, usa un dropdown en vez de tabs", () => {
    render(<CategoryFilterBar value="todos" onChange={() => {}} compact />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por categoría")).toBeInTheDocument();
  });
});
