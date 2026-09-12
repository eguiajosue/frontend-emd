import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AreaFilterBar } from "./AreaFilterBar";

describe("AreaFilterBar", () => {
  it("en modo tabs, muestra Todas + una tab por área de producción", () => {
    render(<AreaFilterBar value="todas" onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Taller/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bordado/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Diseño/i })).toBeInTheDocument();
  });

  it("al elegir un área, avisa el cambio", async () => {
    const onChange = vi.fn();
    render(<AreaFilterBar value="todas" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: /Láser/i }));
    expect(onChange).toHaveBeenCalledWith("laser");
  });

  it("en modo compacto, usa un dropdown en vez de tabs", () => {
    render(<AreaFilterBar value="todas" onChange={() => {}} compact />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por área")).toBeInTheDocument();
  });
});
