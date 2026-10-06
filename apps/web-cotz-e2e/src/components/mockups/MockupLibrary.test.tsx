import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MockupLogoSummary } from "@/lib/mockups/types";

const request = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => request(...args),
}));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "tok" }));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

const imports = vi.hoisted(() => ({
  importDesignFile: vi.fn(),
  importDesignFromUrl: vi.fn(),
  designFromDataUrl: vi.fn(),
  makeLogoThumbnail: vi.fn(),
}));
vi.mock("@/lib/mockups/importDesign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mockups/importDesign")>()),
  ...imports,
}));

import { MockupLibraryDialog } from "./MockupLibrary";

// El stub global de IntersectionObserver nunca avisa; aquí todo "se ve" al
// observarlo, salvo lo que el test marque como fuera de pantalla.
const hidden = new Set<string>();
const OriginalIO = window.IntersectionObserver;
beforeAll(() => {
  window.IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      if (hidden.has(el.textContent ?? "")) return;
      this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
afterAll(() => {
  window.IntersectionObserver = OriginalIO;
});

const logo = (id: number, name: string, useCount: number): MockupLogoSummary => ({
  id,
  name,
  useCount,
  createdAt: "2026-09-01T10:00:00.000Z",
  createdBy: { id: 1, name: "Rita Ponce" },
  lastUsedAt: null,
});
let logos: MockupLogoSummary[] = [];

function wrap(props: Partial<React.ComponentProps<typeof MockupLibraryDialog>> = {}) {
  const onAddDesign = vi.fn();
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MockupLibraryDialog open onOpenChange={onOpenChange} onAddDesign={onAddDesign} {...props} />
    </QueryClientProvider>
  );
  return { onAddDesign, onOpenChange };
}

beforeEach(() => {
  hidden.clear();
  logos = [logo(2, "Colegio San Marcos", 9), logo(1, "Ferretería El Tornillo", 3)];
  request.mockReset();
  toastSuccess.mockReset();
  Object.values(imports).forEach((f) => f.mockReset());
  request.mockImplementation(async (path: string, opts: { method?: string; body?: Record<string, string> } = {}) => {
    const method = opts.method ?? "GET";
    if (path === "mockup-logos" && method === "GET") return logos;
    if (path === "mockup-logos" && method === "POST") {
      const created = logo(7, opts.body!.name, 0);
      logos = [...logos, created];
      return created;
    }
    let m = path.match(/^mockup-logos\/(\d+)\/(thumbnail|image)$/);
    if (m) return { dataUrl: `data:image/png;base64,${m[2].toUpperCase()}${m[1]}` };
    m = path.match(/^mockup-logos\/(\d+)\/use$/);
    if (m) return undefined;
    m = path.match(/^mockup-logos\/(\d+)$/);
    if (m && method === "DELETE") {
      logos = logos.filter((l) => l.id !== Number(m![1]));
      return undefined;
    }
    if (m && method === "PATCH") {
      logos = logos.map((l) => (l.id === Number(m![1]) ? { ...l, ...opts.body } : l));
      return logos.find((l) => l.id === Number(m![1]));
    }
    throw new Error(`ruta inesperada ${method} ${path}`);
  });
  imports.designFromDataUrl.mockImplementation(async (name: string, dataUrl: string) => ({ name, dataUrl, aspect: 2 }));
});

describe("Biblioteca · Logos", () => {
  it("muestra los logos en el orden del backend (más usados) con miniatura cargada al verse", async () => {
    hidden.add("Ferretería El Tornillo3 usos");
    wrap();
    const list = await screen.findByRole("list", { name: "Logos de la empresa" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Colegio San Marcos9 usos", "Ferretería El Tornillo3 usos"]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("mockup-logos/2/thumbnail", { token: "tok" }));
    // La que no se ve no se pide, y la imagen completa tampoco.
    expect(request).not.toHaveBeenCalledWith("mockup-logos/1/thumbnail", expect.anything());
    expect(request).not.toHaveBeenCalledWith(expect.stringMatching(/\/image$/), expect.anything());
    await waitFor(() =>
      expect(items[0].querySelector("img")).toHaveAttribute("src", "data:image/png;base64,THUMBNAIL2")
    );
  });

  it("busca por nombre sin acentos", async () => {
    wrap();
    await screen.findByRole("list", { name: "Logos de la empresa" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar logo" }), "ferreteria");
    expect(within(screen.getByRole("list", { name: "Logos de la empresa" })).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Buscar logo" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar logo" }), "xyz");
    expect(screen.getByText("Ningún logo coincide con «xyz».")).toBeInTheDocument();
  });

  it("elegir un logo baja la imagen completa, lo agrega como diseño, suma un uso y cierra", async () => {
    const { onAddDesign, onOpenChange } = wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Agregar logo Colegio San Marcos" }));
    await waitFor(() =>
      expect(onAddDesign).toHaveBeenCalledWith({ name: "Colegio San Marcos", dataUrl: "data:image/png;base64,IMAGE2", aspect: 2 })
    );
    expect(request).toHaveBeenCalledWith("mockup-logos/2/use", { token: "tok", method: "POST" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("subir un logo lo reduce a PNG, manda imagen y miniatura y aparece en la lista", async () => {
    imports.importDesignFile.mockResolvedValue({ name: "taller", dataUrl: "data:image/png;base64,FULL", aspect: 1 });
    imports.makeLogoThumbnail.mockResolvedValue("data:image/png;base64,MINI");
    wrap();
    await screen.findByRole("list", { name: "Logos de la empresa" });
    await userEvent.upload(screen.getByLabelText("Subir logo a la biblioteca"), new File(["x"], "taller.svg", { type: "image/svg+xml" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("mockup-logos", {
        token: "tok",
        method: "POST",
        body: { name: "taller", imageDataUrl: "data:image/png;base64,FULL", thumbnailDataUrl: "data:image/png;base64,MINI" },
      })
    );
    expect(imports.makeLogoThumbnail).toHaveBeenCalledWith("data:image/png;base64,FULL");
    expect(toastSuccess).toHaveBeenCalledWith("Logo «taller» guardado en la biblioteca");
    expect(await screen.findByText("taller")).toBeInTheDocument();
    // La miniatura recién subida no se vuelve a pedir.
    expect(request).not.toHaveBeenCalledWith("mockup-logos/7/thumbnail", expect.anything());
  });

  it("un archivo que no es imagen avisa y no sube nada", async () => {
    const { DesignImportError } = await import("@/lib/mockups/importDesign");
    imports.importDesignFile.mockRejectedValue(new DesignImportError("«notas.txt» no es un diseño compatible. Usa PNG, JPG, SVG o WEBP."));
    wrap();
    await screen.findByRole("list", { name: "Logos de la empresa" });
    await userEvent.upload(screen.getByLabelText("Subir logo a la biblioteca"), new File(["x"], "notas.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no es un diseño compatible");
    expect(request).not.toHaveBeenCalledWith("mockup-logos", expect.objectContaining({ method: "POST" }));
  });

  it("eliminar pide confirmación nombrando a quién lo subió; cancelar lo deja", async () => {
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Colegio San Marcos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    let confirm = await screen.findByRole("alertdialog", { name: "¿Eliminar logo?" });
    expect(confirm).toHaveTextContent("«Colegio San Marcos» (subido por Rita Ponce)");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Colegio San Marcos")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Opciones de Colegio San Marcos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(screen.queryByText("Colegio San Marcos")).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledWith("mockup-logos/2", { token: "tok", method: "DELETE" });
  });

  it("cambiar nombre", async () => {
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Colegio San Marcos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Cambiar nombre" }));
    const input = screen.getByRole("textbox", { name: "Nuevo nombre del logo" });
    await userEvent.clear(input);
    await userEvent.type(input, "CSM{Enter}");
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("mockup-logos/2", { token: "tok", method: "PATCH", body: { name: "CSM" } })
    );
  });
});

describe("Biblioteca · Banderas", () => {
  it("México, Estados Unidos y Canadá van primero, fijas", async () => {
    wrap({ defaultTab: "banderas" });
    const list = await screen.findByRole("list", { name: "Banderas" });
    const buttons = within(list).getAllByRole("button");
    expect(buttons.length).toBe(249);
    expect(buttons.slice(0, 4).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Agregar bandera de México",
      "Agregar bandera de Estados Unidos",
      "Agregar bandera de Canadá",
      "Agregar bandera de Afganistán",
    ]);
    expect(within(buttons[0]).getByLabelText("Fija")).toBeInTheDocument();
    expect(buttons[0].querySelector("img")).toHaveAttribute("src", "/flags/4x3/mx.svg");
    expect(buttons[0].querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("buscar «méx» encuentra México; elegirla la rasteriza y la agrega", async () => {
    imports.importDesignFromUrl.mockResolvedValue({ name: "Bandera de México", dataUrl: "data:image/png;base64,MX", aspect: 4 / 3 });
    const { onAddDesign, onOpenChange } = wrap();
    await userEvent.click(screen.getByRole("tab", { name: "Banderas" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar país" }), "méx");
    const list = screen.getByRole("list", { name: "Banderas" });
    const first = within(list).getAllByRole("button")[0];
    expect(first).toHaveAccessibleName("Agregar bandera de México");
    await userEvent.click(first);
    await waitFor(() => expect(onAddDesign).toHaveBeenCalledWith({ name: "Bandera de México", dataUrl: "data:image/png;base64,MX", aspect: 4 / 3 }));
    expect(imports.importDesignFromUrl).toHaveBeenCalledWith("/flags/4x3/mx.svg", "Bandera de México");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sin coincidencias lo dice", async () => {
    wrap({ defaultTab: "banderas" });
    await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar país" }), "atlantida");
    expect(screen.getByText("Ningún país coincide con «atlantida».")).toBeInTheDocument();
  });
});
