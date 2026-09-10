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
  it("el botón Crear Pedido vive dentro del footer anclado del diálogo", () => {
    render(
      <CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />
    );
    const button = screen.getByRole("button", { name: /Crear Pedido/i });
    // DialogFooter es el único contenedor directo que NO tiene la clase de
    // scroll `overflow-y-auto` que sí tiene el body del diálogo.
    const scrollBody = button.closest(".overflow-y-auto");
    expect(scrollBody).toBeNull();
  });
});
