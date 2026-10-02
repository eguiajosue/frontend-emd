import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AreaFilterBar } from "./AreaFilterBar";

describe("AreaFilterBar", () => {
  it("es un Select con todas las áreas de producción", async () => {
    render(<AreaFilterBar value="todas" onChange={() => {}} />);

    const trigger = screen.getByRole("combobox", { name: "Filtrar por área" });
    expect(trigger).toHaveTextContent("Todas las áreas");
    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: /Taller/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Bordado/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Diseño/i })).toBeInTheDocument();
  });

  it("al elegir un área, avisa el cambio", async () => {
    const onChange = vi.fn();
    render(<AreaFilterBar value="todas" onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por área" }));
    await userEvent.click(screen.getByRole("option", { name: /Láser/i }));
    expect(onChange).toHaveBeenCalledWith("laser");
  });
});
