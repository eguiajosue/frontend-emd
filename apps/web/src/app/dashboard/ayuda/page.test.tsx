import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AyudaPage from "./page";

let mockRoles: string[] = [];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ roles: mockRoles, isAdmin: false }),
}));

beforeEach(() => {
  mockRoles = [];
});

describe("AyudaPage", () => {
  it("con dos áreas de producción muestra una sola guía, sin pestañas", () => {
    mockRoles = ["bordado", "dtf"];
    render(<AyudaPage />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 6")).toBeInTheDocument();
  });

  it("con Taller y Diseño muestra una pestaña por cada forma de trabajar", () => {
    mockRoles = ["taller", "diseno"];
    render(<AyudaPage />);
    expect(screen.getByRole("tab", { name: "Diseño" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Producción" })).toBeInTheDocument();
  });

  it("avanza y retrocede entre pasos", async () => {
    mockRoles = ["recepcion"];
    render(<AyudaPage />);
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("Paso 2 de 13")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Crear un pedido" })).toBeInTheDocument();
  });

  it("sin rol pide que un administrador asigne uno", () => {
    render(<AyudaPage />);
    expect(screen.getByText(/todavía no tiene un rol asignado/)).toBeInTheDocument();
  });
});
