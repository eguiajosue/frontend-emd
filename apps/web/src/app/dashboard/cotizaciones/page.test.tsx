import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseWhatsAppList } from "@/lib/quotes/parseWhatsApp";
import { priorityDateFor } from "@/lib/quotes/priority";
import { WHATSAPP_FIXTURE } from "@/lib/quotes/whatsappFixture";
import { stageOfStatus, type Quote, type QuoteStatus } from "@/lib/quotes/types";

let roles: string[] = ["recepcion"];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    roles,
    isSessionLoading: false,
    canManageOperations: roles.includes("admin") || roles.includes("recepcion"),
  }),
}));

const CLIENTS = [{ id: 40, first_name: "Erika", last_name: "Almanza" }];
vi.mock("@/hooks/useEntity", () => ({
  useAuthToken: () => "tok",
  useEntityList: () => ({ data: CLIENTS }),
}));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn() },
}));

// "Nuevo pedido" real es enorme: aquí basta con ver qué recibe y simular que se creó.
vi.mock("@/components/orders/CreateOrderDialog", () => ({
  CreateOrderDialog: (props: {
    open: boolean;
    onClose: () => void;
    onCreated?: (o: { id: number }) => void;
    initialClientId?: number;
    initialClientNameOverride?: string;
    initialDescription?: string;
  }) =>
    props.open ? (
      <div role="dialog" aria-label="Nuevo pedido">
        <p>
          cliente:{props.initialClientId ?? props.initialClientNameOverride} · desc:{props.initialDescription ?? "-"}
        </p>
        <button
          type="button"
          onClick={() => {
            props.onClose();
            props.onCreated?.({ id: 55 });
          }}
        >
          Crear pedido simulado
        </button>
      </div>
    ) : null,
}));

/* ----------------------- Backend de mentira (/quotes) ---------------------- */

let db: Quote[] = [];
let nextId = 1;
const NOW_ISO = new Date().toISOString();
const make = (over: Partial<Quote>): Quote => ({
  id: nextId++,
  clientId: null,
  clientName: "X",
  description: "Cotización",
  stage: "por_enviar",
  status: "lista",
  comment: null,
  priorityDate: null,
  sentAt: null,
  orderId: null,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
  createdBy: null,
  ...over,
});
const fromPayload = (p: Record<string, unknown>): Quote => {
  const status = (p.status as QuoteStatus) ?? "lista";
  return make({
    clientId: (p.clientId as number) ?? null,
    clientName: p.clientName as string,
    description: p.description as string,
    status,
    stage: stageOfStatus(status),
    comment: (p.comment as string) ?? null,
    priorityDate: (p.priorityDate as string) ?? null,
  });
};

const request = vi.fn(async (path: string, opts: { method?: string; body?: Record<string, unknown> } = {}) => {
  const method = opts.method ?? "GET";
  if (path === "quotes" && method === "GET") return db.map((q) => ({ ...q }));
  if (path === "quotes" && method === "POST") {
    const q = fromPayload(opts.body!);
    db.unshift(q);
    return q;
  }
  if (path === "quotes/bulk") {
    const created = (opts.body!.items as Record<string, unknown>[]).map(fromPayload);
    db.push(...created);
    return created;
  }
  const link = path.match(/^quotes\/(\d+)\/link-order$/);
  if (link) {
    const q = db.find((x) => x.id === Number(link[1]))!;
    q.orderId = opts.body!.orderId as number;
    return { ...q };
  }
  const one = path.match(/^quotes\/(\d+)$/);
  if (one && method === "PATCH") {
    const q = db.find((x) => x.id === Number(one[1]))!;
    const body = opts.body!;
    if (body.status) {
      q.status = body.status as QuoteStatus;
      q.stage = stageOfStatus(q.status);
    } else if (body.stage && body.stage !== q.stage) {
      q.stage = body.stage as Quote["stage"];
      q.status = q.stage === "enviada" ? "esperando_respuesta" : "lista";
    }
    if (body.comment !== undefined) q.comment = body.comment as string | null;
    if (body.description !== undefined) q.description = body.description as string;
    return { ...q };
  }
  if (one && method === "DELETE") {
    db = db.filter((x) => x.id !== Number(one[1]));
    return undefined;
  }
  throw new Error(`ruta no esperada ${method} ${path}`);
});
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: Parameters<typeof request>) => request(...args),
}));

import QuotesPage from "./page";

/** El listado real de WhatsApp ya cargado (13 cotizaciones: 8 por enviar, 5 enviadas). */
function seedFixture() {
  db = parseWhatsAppList(WHATSAPP_FIXTURE).map((p) =>
    make({
      clientName: p.clientName,
      description: p.description,
      stage: p.stage,
      status: p.status,
      comment: p.comment,
      priorityDate: priorityDateFor(p.priority),
    })
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuotesPage />
    </QueryClientProvider>
  );
}

const count = (stage: "por_enviar" | "enviada") => screen.getByTestId(`count-${stage}`).textContent;
const card = (name: string) => screen.getByRole("article", { name });
const cardNames = () => screen.queryAllByTestId("quote-card").map((c) => c.getAttribute("aria-label"));
const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH");

beforeEach(() => {
  roles = ["recepcion"];
  db = [];
  nextId = 1;
  request.mockClear();
  toastSuccess.mockReset();
});

describe("Página Cotizaciones", () => {
  it("título sin bajada y contadores por pestaña", async () => {
    seedFixture();
    renderPage();
    const title = screen.getByRole("heading", { level: 1, name: "Cotizaciones" });
    expect(title.parentElement?.querySelectorAll("p")).toHaveLength(0);
    await waitFor(() => expect(count("por_enviar")).toBe("8"));
    expect(count("enviada")).toBe("5");
    expect(cardNames()).toHaveLength(8);
    expect(cardNames()).toContain("ESTEBAN TALAMAS");
    // Prioridad: DDN es para hoy, GAMU para mañana.
    expect(within(card("DDN")).getByTestId("quote-priority")).toHaveTextContent("Hoy");
    expect(within(card("GAMU")).getByTestId("quote-priority")).toHaveTextContent("Mañana");
  });

  it("chips por subestado filtran con su cuenta; búsqueda sin acentos ni mayúsculas", async () => {
    seedFixture();
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(8));
    const chips = screen.getByRole("group", { name: "Filtrar por subestado" });
    const montaje = within(chips).getByRole("button", { name: /Esperando montaje/ });
    expect(montaje).toHaveTextContent("3");
    await userEvent.click(montaje);
    expect(montaje).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["COLEGIO DE ARQUITECTOS", "MARTHA RENDON PATRONATO PRO ANCIANOS", "IHS"]);
    await userEvent.click(within(chips).getByRole("button", { name: /Todas/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cotización" }), "camioneta");
    expect(cardNames()).toEqual(["ESTEBAN TALAMAS"]);
    expect(count("por_enviar")).toBe("1");
  });

  it("pestaña Enviadas con sus subestados", async () => {
    seedFixture();
    renderPage();
    await waitFor(() => expect(count("enviada")).toBe("5"));
    await userEvent.click(screen.getByRole("tab", { name: /Enviadas/ }));
    expect(cardNames()).toHaveLength(5);
    // OFISDECO: enviada · Comentarios, con el comentario a la vista.
    expect(within(card("OFISDECO")).getByRole("button", { name: /Comentario: en espera de montajes/ })).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Filtrar por subestado" });
    expect(within(chips).getByRole("button", { name: /Esperando respuesta/ })).toHaveTextContent("4");
  });

  it("cambia el subestado en un clic (y cambia de pestaña si es de la otra etapa)", async () => {
    seedFixture();
    renderPage();
    await waitFor(() => expect(cardNames()).toContain("DDN"));
    await userEvent.click(within(card("DDN")).getByRole("button", { name: "Subestado: Lista. Cambiar" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Aceptada" }));
    await waitFor(() => expect(count("por_enviar")).toBe("7"));
    expect(count("enviada")).toBe("6");
    const ddnId = db.find((q) => q.clientName === "DDN")!.id;
    expect(patches()).toEqual([[`quotes/${ddnId}`, { token: "tok", method: "PATCH", body: { status: "aceptada" } }]]);
    expect(toastSuccess).toHaveBeenCalledWith("DDN: Aceptada", expect.objectContaining({ action: expect.anything() }));
  });

  it("Marcar como enviada", async () => {
    seedFixture();
    renderPage();
    await waitFor(() => expect(cardNames()).toContain("GAMU"));
    await userEvent.click(within(card("GAMU")).getByRole("button", { name: "Marcar como enviada" }));
    await waitFor(() => expect(count("enviada")).toBe("6"));
    expect(patches()[0][1]).toMatchObject({ body: { stage: "enviada" } });
    expect(db.find((q) => q.clientName === "GAMU")!.status).toBe("esperando_respuesta");
  });

  it("comentario editable en línea", async () => {
    db = [make({ clientName: "TNL", stage: "enviada", status: "no_aceptada" })];
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /Enviadas/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Agregar comentario" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Comentario" }), "Le pareció caro{Enter}");
    await waitFor(() => expect(patches()[0][1]).toMatchObject({ body: { comment: "Le pareció caro" } }));
    expect(await screen.findByRole("button", { name: /Comentario: Le pareció caro/ })).toBeInTheDocument();
  });

  it("tecla N abre el alta rápida; cliente libre + descripción + prioridad hoy", async () => {
    renderPage();
    await screen.findByText("Todavía no hay cotizaciones");
    await userEvent.keyboard("n");
    const dialog = await screen.findByRole("dialog", { name: "Nueva cotización" });
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Cliente o empresa" }));
    await userEvent.type(screen.getByPlaceholderText("Buscar cliente…"), "Taller Pérez");
    await userEvent.click(await screen.findByText('Usar "Taller Pérez" como nombre de cliente'));
    await userEvent.type(within(dialog).getByLabelText("Descripción"), "50 playeras");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Hoy" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar cotización" }));
    await waitFor(() => expect(cardNames()).toEqual(["Taller Pérez"]));
    const post = request.mock.calls.find(([p, o]) => p === "quotes" && o?.method === "POST")!;
    expect(post[1]!.body).toEqual({
      clientName: "Taller Pérez",
      description: "50 playeras",
      status: "lista",
      priorityDate: priorityDateFor("hoy"),
    });
    expect(within(card("Taller Pérez")).getByTestId("quote-priority")).toHaveTextContent("Hoy");
  });

  it("el alta exige cliente y descripción", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Nueva cotización/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva cotización" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar cotización" }));
    expect(within(dialog).getByText("Elige o escribe un cliente")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribe qué se cotiza")).toBeInTheDocument();
    expect(request.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });

  it("Pegar de WhatsApp: vista previa editable y alta en bloque", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Pegar de WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Pegar de WhatsApp" });
    fireEvent.change(within(dialog).getByLabelText("Listado de WhatsApp"), { target: { value: WHATSAPP_FIXTURE } });
    expect(within(dialog).getByText("13 cotizaciones detectadas")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revisar (13)" }));

    const preview = await screen.findByRole("dialog", { name: "Revisa antes de crear" });
    expect(within(preview).getAllByTestId("paste-row")).toHaveLength(13);
    // ERIKA ALMANZA coincide con un cliente registrado: se liga.
    expect(within(preview).getByLabelText("Cliente, línea 3")).toHaveValue("Erika Almanza");
    // Se corrige una línea y se descarta otra.
    const desc = within(preview).getByLabelText("Descripción, línea 7");
    await userEvent.clear(desc);
    await userEvent.type(desc, "Lona 3x1");
    await userEvent.click(within(preview).getByRole("checkbox", { name: "Incluir línea 13" }));
    await userEvent.click(within(preview).getByRole("button", { name: "Crear 12 cotizaciones" }));

    await waitFor(() => expect(count("por_enviar")).toBe("7"));
    expect(count("enviada")).toBe("5");
    const bulk = request.mock.calls.find(([p]) => p === "quotes/bulk")!;
    const items = bulk[1]!.body!.items as Record<string, unknown>[];
    expect(items).toHaveLength(12);
    expect(items[0]).toEqual({
      clientName: "OFISDECO",
      description: "Cotización",
      status: "comentarios",
      priorityDate: null,
      comment: "en espera de montajes",
    });
    expect(items[2]).toMatchObject({ clientId: 40, clientName: "Erika Almanza", status: "esperando_respuesta" });
    expect(items[6]).toMatchObject({ clientName: "DDN", description: "Lona 3x1", priorityDate: priorityDateFor("hoy") });
    expect(items[8]).toMatchObject({ status: "esperando_montaje", priorityDate: priorityDateFor("manana") });
    expect(toastSuccess).toHaveBeenCalledWith("12 cotizaciones agregadas");
  });

  it("Copiar para WhatsApp: la pestaña o todas", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    db = [
      make({ clientName: "Tex Mex", stage: "enviada", status: "esperando_respuesta" }),
      make({ clientName: "IHS", status: "esperando_montaje", priorityDate: priorityDateFor("manana") }),
    ];
    renderPage();
    await waitFor(() => expect(cardNames()).toEqual(["IHS"]));
    await userEvent.click(screen.getByRole("button", { name: "Copiar para WhatsApp" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Todas/ }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("* IHS . ☑️en espera de montajes *prioridad mañana\n* TEX MEX . ✅enviada")
    );
    expect(toastSuccess).toHaveBeenCalledWith("Copiado: 2 cotizaciones", expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Copiar para WhatsApp" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Esta pestaña/ }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("* IHS . ☑️en espera de montajes *prioridad mañana"));
  });

  it("Convertir en pedido: abre Nuevo pedido prellenado y liga el pedido creado", async () => {
    db = [make({ clientName: "Ofisdeco", description: "50 playeras", stage: "enviada", status: "aceptada" })];
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /Enviadas/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Convertir en pedido" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo pedido" });
    expect(dialog).toHaveTextContent("cliente:Ofisdeco · desc:50 playeras");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear pedido simulado" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(`quotes/${db[0].id}/link-order`, {
        token: "tok",
        method: "POST",
        body: { orderId: 55 },
      })
    );
    const chip = await screen.findByRole("link", { name: /Pedido #55/ });
    expect(chip).toHaveAttribute("href", "/dashboard/orders/55");
    expect(screen.queryByRole("button", { name: "Convertir en pedido" })).not.toBeInTheDocument();
  });

  it("Convertir con cliente registrado pasa el id", async () => {
    db = [make({ clientId: 40, clientName: "Erika Almanza", stage: "enviada", status: "aceptada" })];
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /Enviadas/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Convertir en pedido" }));
    expect(screen.getByRole("dialog", { name: "Nuevo pedido" })).toHaveTextContent("cliente:40 · desc:-");
  });

  it("eliminar pide confirmación", async () => {
    db = [make({ clientName: "BRICER" })];
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Más acciones de BRICER" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Se elimina la cotización de BRICER");
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(`quotes/1`, { token: "tok", method: "DELETE" }));
    await waitFor(() => expect(cardNames()).toEqual([]));
  });

  it("editar guarda los cambios", async () => {
    db = [make({ clientName: "TNL", description: "Lona" })];
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Más acciones de TNL" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar cotización" });
    const desc = within(dialog).getByLabelText("Descripción");
    await userEvent.clear(desc);
    await userEvent.type(desc, "Lona 2x1 con ojillos");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(patches()[0][1]).toMatchObject({ body: { description: "Lona 2x1 con ojillos" } }));
    expect(await screen.findByText("Lona 2x1 con ojillos")).toBeInTheDocument();
  });

  it("Diseño y Producción no tienen acceso", () => {
    roles = ["diseno"];
    renderPage();
    expect(screen.getByText("Sin acceso a Cotizaciones")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
