import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientTemplatesDialog } from "./ClientTemplatesDialog";

vi.mock("@/hooks/useEntity", () => ({
  useEntityDetail: () => ({ data: { id: 9, first_name: "Colegio", last_name: "Alameda" } }),
}));

let mockTemplates: unknown[] = [];
const update = vi.fn();
const remove = vi.fn();
vi.mock("@/hooks/useOrderTemplates", () => ({
  useClientOrderTemplates: () => ({ templates: mockTemplates, isLoading: false, isError: false }),
  useOrderTemplateMutations: () => ({
    update: { mutateAsync: update, isPending: false },
    remove: { mutateAsync: remove },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const TEMPLATE = {
  id: 5,
  clientId: 9,
  name: "Figuras de coroplast",
  requiresDesign: false,
  productionAreas: ["impresiones"],
  description: "",
  useCount: 3,
  products: [{ customName: "Figuras", quantity: 12 }],
  materials: [{ id: 1, materialId: 12, quantity: 6, description: "Vinil" }],
};

beforeEach(() => {
  mockTemplates = [TEMPLATE];
  update.mockReset().mockResolvedValue(TEMPLATE);
  remove.mockReset().mockResolvedValue({ id: 5 });
});

describe("ClientTemplatesDialog", () => {
  it("muestra qué guarda cada plantilla y enlaza a un pedido nuevo con ella", () => {
    render(<ClientTemplatesDialog clientId={9} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Plantillas de Colegio Alameda" })).toBeInTheDocument();
    expect(screen.getByText("Figuras ×12")).toBeInTheDocument();
    expect(screen.getByText("Impresiones · 1 material · usada 3 veces")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nuevo pedido/ })).toHaveAttribute(
      "href",
      "/dashboard/orders?new=1&template=5"
    );
  });

  it("sin plantillas explica cómo crearlas", () => {
    mockTemplates = [];
    render(<ClientTemplatesDialog clientId={9} onClose={() => {}} />);
    expect(screen.getByText(/todavía no tiene plantillas/)).toBeInTheDocument();
  });

  it("renombra en el lugar", async () => {
    render(<ClientTemplatesDialog clientId={9} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Renombrar Figuras de coroplast" }));
    const input = screen.getByLabelText("Nombre de la plantilla");
    await userEvent.clear(input);
    await userEvent.type(input, "Figuras{Enter}");
    expect(update).toHaveBeenCalledWith({ id: 5, payload: { name: "Figuras" } });
  });

  it("un nombre repetido muestra el error del backend", async () => {
    update.mockRejectedValue(new Error("Este cliente ya tiene una plantilla con ese nombre"));
    render(<ClientTemplatesDialog clientId={9} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Renombrar Figuras de coroplast" }));
    await userEvent.type(screen.getByLabelText("Nombre de la plantilla"), " 2{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Este cliente ya tiene una plantilla con ese nombre");
  });

  it("elimina después de confirmar", async () => {
    render(<ClientTemplatesDialog clientId={9} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar Figuras de coroplast" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    expect(remove).toHaveBeenCalledWith(5);
  });
});
