import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let roles: string[] = ["recepcion"];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    roles,
    isSessionLoading: false,
    canManageOperations: roles.includes("admin") || roles.includes("recepcion"),
    canUseMockups: roles.some((r) => ["admin", "recepcion", "diseno"].includes(r)),
  }),
}));

const RESULT = { image: { dataUrl: "data:image/png;base64,X", width: 2, height: 1 }, config: { garment: "tshirt" } };
vi.mock("@/components/mockups/MockupStudio", () => ({
  MockupStudio: ({ attachLabel, onAttach }: { attachLabel: string; onAttach: (r: unknown) => void }) => (
    <button type="button" onClick={() => onAttach(RESULT)}>
      {attachLabel}
    </button>
  ),
}));
vi.mock("@/components/mockups/AttachToOrderDialog", () => ({
  AttachToOrderDialog: ({ open, result }: { open: boolean; result: unknown }) =>
    open ? <div role="dialog">{result === RESULT ? "con resultado" : "sin resultado"}</div> : null,
}));

import MockupsPage from "./page";

beforeEach(() => {
  roles = ["recepcion"];
});

describe("Página Mockups", () => {
  it("Recepción ve el estudio con el título, sin bajada", () => {
    render(<MockupsPage />);
    const title = screen.getByRole("heading", { level: 1, name: "Mockups" });
    expect(title.parentElement?.querySelectorAll("p")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Adjuntar a pedido" })).toBeInTheDocument();
  });

  it("Adjuntar a pedido abre el buscador de pedidos con la lámina", async () => {
    render(<MockupsPage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar a pedido" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("con resultado");
  });

  it("Diseño también arma mockups y los adjunta a pedido", () => {
    roles = ["diseno"];
    render(<MockupsPage />);
    expect(screen.queryByText("Sin acceso a Mockups")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuntar a pedido" })).toBeInTheDocument();
  });

  it("Producción no tiene acceso", () => {
    roles = ["bordado"];
    render(<MockupsPage />);
    expect(screen.getByText("Sin acceso a Mockups")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar a pedido" })).not.toBeInTheDocument();
  });
});
