import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthorizationSheet, pickAuthorizationSheet } from "./AuthorizationSheet";
import type { DesignRevision, DesignRevisionFileContent } from "@/types";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PDF = "data:application/pdf;base64,JVBERi0xLjQK";

let revisions: DesignRevision[] | undefined = [];
let listError = false;
const listCalls: { orderId: number | null; enabled?: boolean }[] = [];
const fileCalls: { fileId: number | null; enabled: boolean }[] = [];
const legacyCalls: { revisionId: number | null; enabled: boolean }[] = [];
let files: Record<number, DesignRevisionFileContent> = {};
let legacy: DesignRevisionFileContent | undefined;

vi.mock("@/hooks/useDesignRevisions", () => ({
  useDesignRevisionList: (orderId: number | null, options: { enabled?: boolean } = {}) => {
    listCalls.push({ orderId, enabled: options.enabled });
    return {
      data: listError ? undefined : revisions,
      isError: listError,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
  useDesignRevisionFileContent: (
    _orderId: number | null,
    _revisionId: number | null,
    fileId: number | null,
    enabled: boolean
  ) => {
    fileCalls.push({ fileId, enabled });
    return {
      data: enabled && fileId !== null ? files[fileId] : undefined,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
  useDesignRevisionLegacyMontage: (_orderId: number | null, revisionId: number | null, enabled: boolean) => {
    legacyCalls.push({ revisionId, enabled });
    return { data: enabled ? legacy : undefined, isError: false, isFetching: false, refetch: vi.fn() };
  },
}));

vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: (id: number) => (id === 1 ? { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" } : undefined),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));

function revision(round: number, extra: Partial<DesignRevision> = {}): DesignRevision {
  return {
    id: round * 10,
    orderId: 16,
    round,
    approved: false,
    hasMontageFile: true,
    hasFeedbackFile: false,
    montageFiles: [{ id: round * 100, filename: `montaje-${round}.png`, mimeType: "image/png" }],
    sentAt: "2026-09-01T10:00:00.000Z",
    createdAt: "2026-09-01T10:00:00.000Z",
    ...extra,
  } as DesignRevision;
}

const order = { id: 16, requiresDesign: true };

beforeEach(() => {
  revisions = [];
  listError = false;
  listCalls.length = 0;
  fileCalls.length = 0;
  legacyCalls.length = 0;
  files = {};
  legacy = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickAuthorizationSheet", () => {
  it("prefiere la ronda autorizada, luego la última con montaje", () => {
    const r1 = revision(1, { feedbackText: "más grande" });
    const r2 = revision(2, { approved: true });
    expect(pickAuthorizationSheet([r2, r1])).toEqual({ kind: "approved", revision: r2 });
    expect(pickAuthorizationSheet([r1])).toEqual({ kind: "changes", revision: r1 });
    const r3 = revision(3);
    expect(pickAuthorizationSheet([r1, r3])).toEqual({ kind: "pending", revision: r3 });
  });

  it("ignora rondas sin archivos", () => {
    const vacia = revision(2, { montageFiles: [], hasMontageFile: false });
    expect(pickAuthorizationSheet([vacia])).toEqual({ kind: "none" });
    expect(pickAuthorizationSheet([])).toEqual({ kind: "none" });
  });
});

describe("AuthorizationSheet", () => {
  it("autorizada con varias imágenes: grilla con zoom y descarga", async () => {
    revisions = [
      revision(1, { feedbackText: "otro color" }),
      revision(2, {
        approved: true,
        approvedAt: "2026-09-03T15:00:00.000Z",
        montageFiles: [
          { id: 201, filename: "frente.png", mimeType: "image/png" },
          { id: 202, filename: "espalda.png", mimeType: "image/png" },
        ],
      }),
    ];
    files = {
      201: { filename: "frente.png", mimeType: "image/png", dataUrl: PNG },
      202: { filename: "espalda.png", mimeType: "image/png", dataUrl: PNG },
    };
    render(<AuthorizationSheet order={order} />);

    const section = screen.getByRole("region", { name: "Hoja de autorización" });
    expect(within(section).getByText("Autorizada")).toBeInTheDocument();
    expect(within(section).getByText(/Ronda 2 · autorizada por el cliente/)).toBeInTheDocument();
    expect(within(section).queryByRole("note")).not.toBeInTheDocument();

    const grid = within(section).getByRole("list", { name: "Imágenes de la hoja de autorización" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(2);
    expect(within(grid).getByRole("img", { name: "frente.png" })).toHaveAttribute("src", PNG);
    expect(within(grid).getByRole("button", { name: "Descargar espalda.png" })).toBeInTheDocument();
    // Sólo los archivos de la hoja vigente, no los de la ronda con cambios.
    expect([...new Set(fileCalls.filter((c) => c.enabled).map((c) => c.fileId))].sort()).toEqual([201, 202]);

    await userEvent.click(within(grid).getByRole("button", { name: "Ampliar frente.png" }));
    expect(await screen.findByRole("button", { name: "Cerrar imagen" })).toBeInTheDocument();
  });

  it("autorizada en PDF: abrir en pestaña nueva (blob) y descargar", async () => {
    revisions = [
      revision(1, {
        approved: true,
        montageFiles: [{ id: 101, filename: "hoja.pdf", mimeType: "application/pdf" }],
      }),
    ];
    files = { 101: { filename: "hoja.pdf", mimeType: "application/pdf", dataUrl: PDF } };
    const createObjectURL = vi.fn(() => "blob:http://localhost/hoja");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<AuthorizationSheet order={order} />);

    const docs = screen.getByRole("list", { name: "Documentos de la hoja de autorización" });
    expect(within(docs).getByText("hoja.pdf")).toBeInTheDocument();
    expect(within(docs).getByText("PDF")).toBeInTheDocument();
    expect(within(docs).getByRole("button", { name: "Descargar hoja.pdf" })).toBeInTheDocument();

    await userEvent.click(within(docs).getByRole("button", { name: "Abrir hoja.pdf" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("blob:http://localhost/hoja", "_blank", "noopener,noreferrer");
  });

  it("sin autorizar: muestra la última enviada con su estado y el aviso", () => {
    revisions = [revision(1, { feedbackText: "más grande" }), revision(2)];
    files = { 200: { filename: "montaje-2.png", mimeType: "image/png", dataUrl: PNG } };
    render(<AuthorizationSheet order={order} />);

    expect(screen.getByText("Sin autorizar")).toBeInTheDocument();
    expect(screen.getByText(/Ronda 2 · esperando autorización del cliente/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("no se produce con ella");
    expect(screen.getByRole("img", { name: "montaje-2.png" })).toBeInTheDocument();
  });

  it("con cambios pedidos: lo dice y cita al cliente", () => {
    revisions = [revision(1, { feedbackText: "el logo más grande" })];
    render(<AuthorizationSheet order={order} />);

    expect(screen.getByText("Con cambios")).toBeInTheDocument();
    expect(screen.getByText(/Ronda 1 · el cliente pidió cambios/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("“el logo más grande”");
    // Todavía cargando: skeleton en vez de la imagen.
    expect(screen.getByLabelText("Cargando montaje-1.png")).toBeInTheDocument();
  });

  it("sin rondas: un aviso discreto", () => {
    revisions = [];
    render(<AuthorizationSheet order={order} />);
    expect(screen.getByRole("region", { name: "Hoja de autorización" })).toHaveTextContent(
      "Todavía no hay hoja de autorización"
    );
    expect(fileCalls.some((c) => c.enabled)).toBe(false);
  });

  it("ronda legacy sin montageFiles: usa el endpoint /montage", () => {
    revisions = [
      revision(1, {
        approved: true,
        montageFiles: [],
        hasMontageFile: true,
        montageFileName: "viejo.png",
        montageFileMime: "image/png",
      }),
    ];
    legacy = { filename: "viejo.png", mimeType: "image/png", dataUrl: PNG };
    render(<AuthorizationSheet order={order} />);

    expect(screen.getByRole("img", { name: "viejo.png" })).toHaveAttribute("src", PNG);
    expect(legacyCalls.some((c) => c.enabled && c.revisionId === 10)).toBe(true);
    expect(fileCalls.some((c) => c.enabled)).toBe(false);
  });

  it("ronda legacy en PDF: botón para abrir", () => {
    revisions = [
      revision(1, {
        approved: true,
        montageFiles: undefined,
        hasMontageFile: true,
        montageFileName: "viejo.pdf",
        montageFileMime: "application/pdf",
      }),
    ];
    legacy = { filename: "viejo.pdf", mimeType: "application/pdf", dataUrl: PDF };
    render(<AuthorizationSheet order={order} />);
    expect(screen.getByRole("button", { name: "Abrir viejo.pdf" })).toBeEnabled();
  });

  it("pedido sin diseño: no hay sección ni GET", () => {
    const { container } = render(<AuthorizationSheet order={{ id: 16, requiresDesign: false }} />);
    expect(container).toBeEmptyDOMElement();
    expect(listCalls.every((c) => c.enabled === false)).toBe(true);
  });

  it("error al cargar las rondas: ofrece reintentar", () => {
    listError = true;
    render(<AuthorizationSheet order={order} />);
    expect(screen.getByText("No se pudo cargar la hoja de autorización.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("AuthorizationSheet · logo de la sucursal", () => {
  it("el encabezado de la hoja lleva el logo del pedido de sucursal (y nada en uno de matriz)", () => {
    revisions = [revision(1, { approved: true })];
    const { unmount } = render(
      <AuthorizationSheet order={{ id: 16, requiresDesign: true, branch: { id: 1, name: "Punto Madero" } }} />
    );
    const logo = screen.getByTestId("branch-logo");
    expect(logo).toHaveAttribute("data-surface", "auto");
    // Las dos versiones: la negra (tema claro y papel impreso) y la blanca (tema oscuro).
    expect(within(logo).getAllByAltText("Punto Madero").map((i) => i.getAttribute("src"))).toEqual([
      "data:image/png;base64,NEGRO",
      "data:image/png;base64,BLANCO",
    ]);
    unmount();

    render(<AuthorizationSheet order={{ id: 17, requiresDesign: true, branch: null }} />);
    expect(screen.queryByTestId("branch-logo")).not.toBeInTheDocument();
  });

  it("también cuando todavía no hay hoja", () => {
    revisions = [];
    render(<AuthorizationSheet order={{ id: 16, requiresDesign: true, branch: { id: 1, name: "Punto Madero" } }} />);
    expect(screen.getByTestId("branch-logo")).toBeInTheDocument();
  });
});
