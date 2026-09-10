import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateOrderDialog } from "./CreateOrderDialog";

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  useEntityMutations: () => ({ create: vi.fn() }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ session: { user: { roles: ["admin"] } } }),
}));

describe("CreateOrderDialog", () => {
  it("la navegación del wizard vive fuera del área con scroll del diálogo", () => {
    render(
      <CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />
    );
    // El wizard reemplazó el footer de un solo botón por una barra de
    // navegación fija (Atrás/Cancelar + Siguiente/Crear Pedido) — "Crear
    // Pedido" sólo aparece en el último paso, así que se verifica con
    // "Cancelar", que está presente desde el primer paso.
    const button = screen.getByRole("button", { name: /Cancelar/i });
    // La barra de navegación es la única zona que NO debe tener la clase de
    // scroll `overflow-y-auto` que sí tiene el contenido del paso actual.
    const scrollBody = button.closest(".overflow-y-auto");
    expect(scrollBody).toBeNull();
  });
});
