import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MockupConfig, MockupTemplateSummary } from "@/lib/mockups/types";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

import { ApiError } from "@/lib/api";
import { MockupTemplatesDialog, SaveTemplateDialog } from "./MockupTemplates";

const LAYER = {
  id: "l1",
  name: "logo-cliente",
  dataUrl: "data:image/png;base64,LOGO",
  aspect: 1,
  placement: { position: [0, 0.1, 0.13], normal: [0, 0, 1], scale: 0.2, rotation: 0 },
};
const CONFIG: MockupConfig = { garment: "tshirt", colors: { body: "#1f2a44" }, layers: [LAYER as never] };

const summary = (over: Partial<MockupTemplateSummary>): MockupTemplateSummary => ({
  id: 1,
  name: "Uniforme San Marcos",
  garment: "tshirt",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  createdBy: { id: 1, name: "Rita Ponce" },
  thumbnailUrl: "data:image/jpeg;base64,THUMB",
  ...over,
});

let templates: MockupTemplateSummary[] = [];

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  templates = [
    summary({}),
    summary({ id: 2, name: "Sudadera Ferretería", garment: "hoodie" }),
    summary({ id: 3, name: "Gorra Taller", garment: "cap", createdBy: null }),
  ];
  request.mockReset();
  toastSuccess.mockReset();
  request.mockImplementation(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const method = opts.method ?? "GET";
    if (path === "mockup-templates" && method === "GET") return templates;
    if (path === "mockup-templates" && method === "POST") return summary({ id: 9, name: (opts.body as { name: string }).name });
    const m = path.match(/^mockup-templates\/(\d+)$/);
    if (m && method === "GET") {
      const t = templates.find((x) => x.id === Number(m[1]))!;
      return { ...t, config: { ...CONFIG, garment: t.garment, colors: t.garment === "cap" ? { body: "#000000" } : CONFIG.colors } };
    }
    if (m && method === "PATCH") {
      templates = templates.map((t) => (t.id === Number(m[1]) ? { ...t, ...(opts.body as object) } : t));
      return templates.find((t) => t.id === Number(m[1]));
    }
    if (m && method === "DELETE") {
      templates = templates.filter((t) => t.id !== Number(m[1]));
      return undefined;
    }
    throw new Error(`ruta inesperada ${method} ${path}`);
  });
});

describe("SaveTemplateDialog", () => {
  it("propone un nombre, saca la miniatura y guarda prenda + config", async () => {
    const exportThumbnail = vi.fn(async () => ({ dataUrl: "data:image/jpeg;base64,MINI", width: 400, height: 400 }));
    const onOpenChange = vi.fn();
    wrap(<SaveTemplateDialog open onOpenChange={onOpenChange} config={CONFIG} exportThumbnail={exportThumbnail} />);
    const name = screen.getByRole("textbox", { name: "Nombre de la plantilla" });
    expect(name).toHaveValue("Playera · logo-cliente");
    expect(screen.getByText("Playera · 1 diseño")).toBeInTheDocument();
    await userEvent.clear(name);
    await userEvent.type(name, "  Uniforme   escolar ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(exportThumbnail).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("mockup-templates", {
      token: "tok",
      method: "POST",
      body: { name: "Uniforme escolar", garment: "tshirt", config: CONFIG, thumbnailDataUrl: "data:image/jpeg;base64,MINI" },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Plantilla «Uniforme escolar» guardada");
  });

  it("sin nombre no guarda; un 413 explica que pesa demasiado", async () => {
    const exportThumbnail = vi.fn(async () => ({ dataUrl: "data:image/jpeg;base64,MINI", width: 400, height: 400 }));
    wrap(<SaveTemplateDialog open onOpenChange={vi.fn()} config={CONFIG} exportThumbnail={exportThumbnail} />);
    await userEvent.clear(screen.getByRole("textbox", { name: "Nombre de la plantilla" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ponle un nombre a la plantilla.");
    expect(exportThumbnail).not.toHaveBeenCalled();

    request.mockRejectedValueOnce(new ApiError("Payload Too Large", 413));
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre de la plantilla" }), "Pesada");
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La plantilla pesa demasiado");
  });

  it("si la miniatura no se puede generar lo dice y no manda nada", async () => {
    const exportThumbnail = vi.fn(async () => {
      throw new Error("El 3D no terminó de cargar la prenda. Espera un momento o recarga la página.");
    });
    wrap(<SaveTemplateDialog open onOpenChange={vi.fn()} config={CONFIG} exportThumbnail={exportThumbnail} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/^El 3D no terminó/);
    expect(request).not.toHaveBeenCalledWith("mockup-templates", expect.objectContaining({ method: "POST" }));
  });
});

describe("MockupTemplatesDialog", () => {
  it("lista las plantillas con miniatura, prenda y autor; busca sin acentos", async () => {
    wrap(<MockupTemplatesDialog open onOpenChange={vi.fn()} hasWork={false} onApply={vi.fn()} />);
    const list = await screen.findByRole("list", { name: "Plantillas guardadas" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText(/Playera · Rita Ponce/)).toBeInTheDocument();
    expect(within(list).getByText("Próximamente")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar plantilla" }), "ferreteria");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("sin diseños en el estudio, usar una plantilla la aplica directo", async () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();
    wrap(<MockupTemplatesDialog open onOpenChange={onOpenChange} hasWork={false} onApply={onApply} />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar plantilla Gorra Taller" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const [config] = onApply.mock.calls[0];
    expect(config.garment).toBe("cap");
    expect(config.colors).toEqual({ body: "#000000", mesh: "#ffffff", visor: "#1f2937" });
    expect(config.layers).toHaveLength(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastSuccess).toHaveBeenCalledWith("Plantilla «Gorra Taller» aplicada");
  });

  it("con diseños pregunta antes de reemplazar; cancelar no cambia nada", async () => {
    const onApply = vi.fn();
    wrap(<MockupTemplatesDialog open onOpenChange={vi.fn()} hasWork onApply={onApply} />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar plantilla Uniforme San Marcos" }));
    const confirm = await screen.findByRole("alertdialog", { name: "¿Reemplazar el mockup actual?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Usar plantilla Uniforme San Marcos" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Usar plantilla" })
    );
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].garment).toBe("tshirt");
  });

  it("una plantilla de una prenda no habilitada muestra un mensaje claro y no se aplica", async () => {
    const onApply = vi.fn();
    wrap(<MockupTemplatesDialog open onOpenChange={vi.fn()} hasWork={false} onApply={onApply} />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar plantilla Sudadera Ferretería" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta plantilla es de sudadera, que todavía no está disponible en el estudio."
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalledWith("mockup-templates/2", expect.anything());
  });

  it("cambiar nombre y eliminar (con confirmación que nombra al autor)", async () => {
    wrap(<MockupTemplatesDialog open onOpenChange={vi.fn()} hasWork={false} onApply={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Uniforme San Marcos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Cambiar nombre" }));
    const input = screen.getByRole("textbox", { name: "Nuevo nombre de la plantilla" });
    await userEvent.clear(input);
    await userEvent.type(input, "Uniforme 2026{Enter}");
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("mockup-templates/1", { token: "tok", method: "PATCH", body: { name: "Uniforme 2026" } })
    );
    expect(await screen.findByText("Uniforme 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Opciones de Uniforme 2026" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    let confirm = await screen.findByRole("alertdialog", { name: "¿Eliminar plantilla?" });
    expect(confirm).toHaveTextContent("«Uniforme 2026» (de Rita Ponce) se borra para toda la recepción");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(request).not.toHaveBeenCalledWith("mockup-templates/1", expect.objectContaining({ method: "DELETE" }));

    await userEvent.click(screen.getByRole("button", { name: "Opciones de Uniforme 2026" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(screen.queryByText("Uniforme 2026")).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledWith("mockup-templates/1", { token: "tok", method: "DELETE" });
  });

  it("sin plantillas invita a guardar la primera", async () => {
    templates = [];
    wrap(<MockupTemplatesDialog open onOpenChange={vi.fn()} hasWork={false} onApply={vi.fn()} />);
    expect(await screen.findByText("Todavía no hay plantillas")).toBeInTheDocument();
  });
});
