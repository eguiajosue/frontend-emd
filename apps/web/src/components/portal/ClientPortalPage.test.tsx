import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientPortalPage } from "./ClientPortalPage";
import type { PortalView } from "@/lib/clientPortal";

// Registro de llamadas aparte de la implementación: un `vi.fn` que devuelve
// una promesa rechazada la deja como rechazo no manejado en vitest.
const request = vi.fn();
let impl: (path: string, opts?: unknown) => Promise<unknown> = () => Promise.resolve(null);
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    request: (path: string, opts?: unknown) => {
      request(path, opts);
      return impl(path, opts);
    },
  };
});
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}));

const { ApiError } = await import("@/lib/api");

function view(over: Partial<PortalView> = {}): PortalView {
  return {
    order: {
      id: 108,
      description: "Gorras con logo",
      clientName: "Cafetería Luna",
      deliveryDate: "2026-10-20T18:00:00.000Z",
      creationDate: "2026-10-01T10:00:00.000Z",
      branch: null,
    },
    stage: { key: "autorizacion", label: "Tu aprobación" },
    stages: [
      { key: "diseno", label: "Diseño" },
      { key: "autorizacion", label: "Tu aprobación" },
      { key: "produccion", label: "Producción" },
      { key: "listo", label: "Listo para entregar" },
      { key: "entregado", label: "Entregado" },
    ],
    products: [{ name: "Gorra", quantity: 12, sizes: { general: { M: 12 } } }],
    design: {
      revisionId: 5,
      round: 1,
      sentAt: "2026-10-02T10:00:00.000Z",
      approved: false,
      awaitingResponse: true,
      files: [{ id: 9, filename: "montaje.png", mimeType: "image/png" }],
    },
    mockups: [],
    response: null,
    ...over,
  };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClientPortalPage token="tok" />
    </QueryClientProvider>
  );
}

beforeEach(() => request.mockReset());

describe("portal del cliente", () => {
  it("muestra el pedido, la etapa actual, el diseño y lo que pidió", async () => {
    impl = ((path: string) =>
      path === "portal/tok"
        ? Promise.resolve(view())
        : Promise.resolve({ dataUrl: "data:image/png;base64,AAAA", filename: "montaje.png", mimeType: "image/png" }));
    setup();
    expect(await screen.findByRole("heading", { name: "Gorras con logo" })).toBeInTheDocument();
    expect(screen.getByText("Hola, Cafetería Luna")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Etapas de tu pedido" }).querySelector("[aria-current='step']")).toHaveTextContent(
      "Tu aprobación"
    );
    expect(await screen.findByRole("img", { name: "montaje.png" })).toBeInTheDocument();
    expect(screen.getByText("Gorra")).toBeInTheDocument();
    expect(screen.getByText("12 pzas")).toBeInTheDocument();
  });

  it("pedir cambios exige comentario y lo manda", async () => {
    impl = ((path: string) =>
      path === "portal/tok" ? Promise.resolve(view()) : Promise.resolve({ dataUrl: null, mimeType: "image/png" }));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Pedir cambios" }));
    const send = screen.getByRole("button", { name: "Enviar cambios" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Comentario"), "Más grande");
    await userEvent.click(send);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("portal/tok/respond", { method: "POST", body: { kind: "cambios", comment: "Más grande" } })
    );
  });

  it("con respuesta pendiente agradece y deja cambiarla", async () => {
    impl = () => Promise.resolve(view({ response: { id: 1, revisionId: 5, kind: "aprobar", comment: null, status: "pendiente", createdAt: "" } }));
    setup();
    expect(await screen.findByText("¡Gracias! Recibimos tu respuesta.")).toBeInTheDocument();
    expect(screen.getByText(/Aprobaste el diseño/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi respuesta" }));
    expect(screen.getByRole("button", { name: "Aprobar diseño" })).toBeInTheDocument();
  });

  it("un diseño aprobado ya no ofrece responder", async () => {
    impl = () => Promise.resolve(view({
        stage: { key: "produccion", label: "Producción" },
        design: { ...view().design!, approved: true, awaitingResponse: false, files: [] },
      }));
    setup();
    expect(await screen.findByText("¿En qué va tu pedido?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar diseño" })).toBeNull();
  });

  it("enlace vencido o inexistente", async () => {
    impl = () => Promise.reject(new ApiError("Gone", 410));
    setup();
    expect(await screen.findByRole("heading", { name: "Este enlace ya venció" })).toBeInTheDocument();
  });
});
