import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrderDialog } from "./CreateOrderDialog";

const createMock = vi.fn();
let mockData: Record<string, unknown[]> = {};

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: (key: string) => ({ data: mockData[key] ?? [] }),
  useEntityMutations: () => ({ create: createMock }),
  useAuthToken: () => "token",
  CATALOG_STALE_TIME: 5 * 60_000,
}));

let mockFrequentIds: number[] | null = null;
const updatePreferencesMock = vi.fn();
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { frequentProductIds: mockFrequentIds },
    updatePreferences: updatePreferencesMock,
  }),
}));

let mockClientOrders: unknown[] = [];
let mockRepeatSource: unknown = undefined;
/** Las queries del contexto del cliente todavía cargando (esqueleto de "Empezar desde"). */
let mockContextLoading = false;
vi.mock("@/hooks/useOrders", () => ({
  useClientOrders: (clientId: number | null) => ({
    orders: clientId && !mockContextLoading ? mockClientOrders : [],
    isLoading: Boolean(clientId) && mockContextLoading,
  }),
  useOrder: (_id: unknown, options?: { enabled?: boolean }) => ({
    data: options?.enabled ? mockRepeatSource : undefined,
  }),
}));

let mockInsights: unknown = null;
vi.mock("@/hooks/useClientInsights", () => ({
  useClientInsights: (clientId: number | null) => ({
    insights: clientId && !mockContextLoading ? mockInsights : null,
    isLoading: Boolean(clientId) && mockContextLoading,
  }),
}));

let mockTemplates: unknown[] = [];
let mockTemplateSource: unknown = undefined;
const templateCreate = vi.fn();
const templateUpdate = vi.fn();
const templateMarkUsed = vi.fn();
vi.mock("@/hooks/useOrderTemplates", () => ({
  useClientOrderTemplates: (clientId: number | null) => ({
    templates: clientId ? mockTemplates : [],
  }),
  useOrderTemplate: (_id: unknown, options?: { enabled?: boolean }) => ({
    data: options?.enabled ? mockTemplateSource : undefined,
  }),
  useOrderTemplateMutations: () => ({
    create: { mutateAsync: templateCreate, isPending: false },
    update: { mutateAsync: templateUpdate, isPending: false },
    markUsed: { mutate: templateMarkUsed },
  }),
}));

const prefetchClientMock = vi.fn();
vi.mock("@/hooks/useOrderComposerPrefetch", () => ({
  COMPOSER_PREVIOUS_ORDERS_LIMIT: 8,
  usePrefetchClientContext: () => prefetchClientMock,
}));

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

const createPresetMock = vi.fn();
vi.mock("@/hooks/useProductPresets", () => ({
  useCreateProductPreset: () => ({ createPreset: createPresetMock, isCreating: false }),
}));

const requestMock = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  request: (...args: unknown[]) => requestMock(...args),
}));

let mockIsBranch = false;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    isBranch: mockIsBranch,
    session: { user: { id: "7", roles: [mockIsBranch ? "sucursal" : "recepcion"] } },
  }),
}));

vi.mock("@/hooks/useBranches", () => ({
  useMyBranch: (enabled: boolean) => ({
    branch: enabled
      ? {
          id: 1,
          name: "Punto Madero",
          active: true,
          employees: [
            { id: 1, name: "Ana López" },
            { id: 3, name: "Carla Díaz" },
          ],
        }
      : undefined,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

// El estudio 3D real no corre en jsdom: un stub que "agrega" un mockup listo.
const STUDIO_RESULT = {
  image: { dataUrl: "data:image/png;base64,MOCKUP", width: 1600, height: 800 },
  config: { garment: "tshirt", colors: { body: "#ffffff" }, layers: [] },
};
vi.mock("@/components/mockups/MockupStudioDialog", () => ({
  MockupStudioDialog: ({
    open,
    onAttach,
    onOpenChange,
  }: {
    open: boolean;
    onAttach: (r: typeof STUDIO_RESULT) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onAttach(STUDIO_RESULT);
          onOpenChange(false);
        }}
      >
        Agregar mockup de prueba
      </button>
    ) : null,
}));

const DESIGN_SHARED = {
  id: 50,
  username: "diseno",
  firstName: "Diseño",
  isSharedAccount: true,
  roles: [{ id: 1, name: "diseno" }],
};

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 123 });
  toastSuccess.mockReset();
  toastError.mockReset();
  mockIsBranch = false;
  mockData = {};
  mockClientOrders = [];
  mockFrequentIds = null;
  updatePreferencesMock.mockReset();
  updatePreferencesMock.mockResolvedValue({});
  mockRepeatSource = undefined;
  mockContextLoading = false;
  requestMock.mockReset();
  requestMock.mockResolvedValue([]);
  invalidateQueries.mockReset();
  mockTemplates = [];
  mockTemplateSource = undefined;
  mockInsights = null;
  templateCreate.mockReset();
  templateUpdate.mockReset();
  templateMarkUsed.mockReset();
  prefetchClientMock.mockReset();
  window.localStorage.clear();
});

function renderDialog(props: Partial<React.ComponentProps<typeof CreateOrderDialog>> = {}) {
  return render(<CreateOrderDialog open onClose={() => {}} onCreated={() => {}} {...props} />);
}

/** Elige un cliente por texto libre (la lista real de clientes está vacía en estos tests). */
async function pickClientByFreeText(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
  await userEvent.type(screen.getByPlaceholderText("Buscar cliente…"), name);
  await userEvent.click(await screen.findByText(`Usar "${name}" como nombre de cliente`));
}

async function chooseWithoutDesign() {
  await userEvent.click(screen.getByRole("radio", { name: "Sin diseño" }));
}

async function toggleArea(label: string) {
  const group = screen.getByRole("group", { name: /^Áreas de producción/ });
  await userEvent.click(within(group).getByRole("button", { name: new RegExp(label) }));
}

async function addProduct(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Agregar producto" }));
  await userEvent.type(screen.getByPlaceholderText("+ Escribe cualquier producto…"), name);
  await userEvent.click(await screen.findByText(`Usar "${name}" como producto nuevo`));
}

async function setQty(name: string, value: string) {
  const input = screen.getByLabelText(`Cantidad de ${name}`);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
}

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: /Crear pedido/ }));
}

async function openMoreMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Más opciones" }));
}

/** Pedido mínimo válido sin diseño (no depende de la lista de usuarios). */
async function fillDirectOrder() {
  await pickClientByFreeText("Juan Pérez");
  await chooseWithoutDesign();
  await toggleArea("Taller");
  await addProduct("Playera");
  await setQty("Playera", "5");
  await userEvent.type(screen.getByLabelText("Descripción"), "Bordado urgente");
}

const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));

describe("CreateOrderDialog (comanda de una pantalla)", () => {
  it("es una sola vista con zonas Qué se pide → Entrega → Ruta, sin Cancelar, y el CTA fuera del scroll", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Qué se pide", "Entrega", "Ruta"]);
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    const cta = screen.getByRole("button", { name: /Crear pedido/ });
    expect(cta.closest(".overflow-y-auto")).toBeNull();
  });

  it("abre con el foco en el cliente", async () => {
    renderDialog();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Cliente" }));
  });

  it("sin cliente no crea y lleva el foco al cliente", async () => {
    renderDialog();
    await submit();
    expect(await screen.findAllByText("Selecciona o escribe un cliente")).not.toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Cliente" }));
  });

  it("el primer campo con error en pantalla recibe el foco (productos antes que la ruta)", async () => {
    renderDialog();
    await pickClientByFreeText("Ana");
    await chooseWithoutDesign();
    await submit();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Agregar producto" }));
    const notice = screen.getByRole("alert");
    expect(within(notice).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Productos",
      "Descripción",
      "Áreas de producción",
    ]);
  });

  it("una fila con nombre pero sin cantidad bloquea y no se descarta en silencio", async () => {
    renderDialog();
    await fillDirectOrder();
    await setQty("Playera", "");
    await submit();
    expect(await screen.findByText("Falta la cantidad")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Producto 1" })).toHaveValue("Playera");
    expect(createMock).not.toHaveBeenCalled();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByLabelText("Cantidad de Playera"));
  });

  it("sin productos no crea", async () => {
    renderDialog();
    await pickClientByFreeText("Juan Pérez");
    await submit();
    expect(await screen.findByText("Agrega al menos un producto")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crea el pedido con el payload esperado (sin diseño, un producto)", async () => {
    const onCreated = vi.fn();
    renderDialog({ onCreated });
    await fillDirectOrder();
    await submit();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientNameOverride: "Juan Pérez",
        requiresDesign: false,
        area: "taller",
        productionArea: undefined,
        productionAreas: ["taller"],
        userId: 7,
        statusId: 1,
        description: "Bordado urgente",
        orderProducts: [{ customName: "Playera", quantity: 5 }],
      })
    );
    expect(onCreated).toHaveBeenCalledWith({ id: 123 });
  });

  it("las tallas de una prenda viajan en la línea y su total es la cantidad", async () => {
    renderDialog();
    await pickClientByFreeText("Juan Pérez");
    await chooseWithoutDesign();
    await toggleArea("Taller");
    await addProduct("Playera");
    await userEvent.type(screen.getByLabelText("Descripción"), "Playeras con tallas");
    await userEvent.click(screen.getByRole("button", { name: "Tallas" }));
    fireEvent.change(screen.getByLabelText(/^General M/), { target: { value: "5" } });
    await userEvent.click(screen.getByRole("button", { name: /Mujer \(dama\)/ }));
    fireEvent.change(screen.getByLabelText(/^Mujer S/), { target: { value: "3" } });
    expect(screen.getByLabelText("Cantidad de Playera")).toHaveValue("8");
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderProducts: [{ customName: "Playera", quantity: 8, sizes: { general: { M: 5 }, mujer: { S: 3 } } }],
      })
    );
  });

  it("con diseño, propone 'Cualquier diseñador' (cuenta compartida) y lo manda como asignación", async () => {
    mockData.users = [DESIGN_SHARED];
    renderDialog();
    await pickClientByFreeText("Ana");
    expect(screen.getByRole("combobox", { name: /Asignar a/ })).toHaveTextContent("Cualquier diseñador");
    await addProduct("Lona");
    await userEvent.type(screen.getByLabelText("Descripción"), "Lona 2x1");
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresDesign: true,
        area: undefined,
        productionArea: undefined,
        productionAreas: undefined,
        assignedUserId: 50,
      })
    );
  });

  it("con diseño, las áreas son la producción destino en orden de elección (la primera es la principal)", async () => {
    mockData.users = [DESIGN_SHARED];
    renderDialog();
    await pickClientByFreeText("Ana");
    await toggleArea("Bordado");
    await toggleArea("DTF");
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).getByRole("button", { name: /Bordado/ })).toHaveTextContent("principal");
    expect(within(group).getByRole("button", { name: /DTF/ })).not.toHaveTextContent("principal");
    await addProduct("Gorra");
    await userEvent.type(screen.getByLabelText("Descripción"), "Gorras");
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ productionArea: "bordado", productionAreas: ["bordado", "dtf"] })
    );
  });

  it("sin diseño con 2 áreas: la primera elegida recibe el pedido", async () => {
    renderDialog();
    await pickClientByFreeText("Ana");
    await chooseWithoutDesign();
    await toggleArea("DTF");
    await toggleArea("Taller");
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).getByRole("button", { name: /DTF/ })).toHaveTextContent("principal");
    await addProduct("Gorra");
    await userEvent.type(screen.getByLabelText("Descripción"), "Gorras");
    await submit();
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ area: "dtf", productionAreas: ["dtf", "taller"] }));
  });

  it("la ayuda de la ruta vive en el «?» (no como texto suelto)", async () => {
    renderDialog();
    expect(screen.queryByText(/pasa a producción cuando el cliente autoriza/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Ayuda sobre la ruta" }));
    expect(await screen.findByText(/pasa a producción cuando el cliente autoriza/)).toBeInTheDocument();
  });

  it("los chips de área llevan el color de marca del área", () => {
    renderDialog();
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    const chip = within(group).getByRole("button", { name: /Bordado/ });
    expect(chip.querySelector('[data-area="bordado"]')).not.toBeNull();
  });

  it("sin diseño y sin área no crea", async () => {
    renderDialog();
    await pickClientByFreeText("Ana");
    await chooseWithoutDesign();
    await addProduct("Gorra");
    await userEvent.type(screen.getByLabelText("Descripción"), "Gorras");
    await submit();
    expect(await screen.findByText("Elige al menos un área de producción")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("Diseño no se ofrece como área de producción", () => {
    renderDialog();
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).queryByRole("button", { name: /Diseño/ })).toBeNull();
  });

  it("aplica los últimos defaults desde la primera apertura, saneados", () => {
    window.localStorage.setItem("emd:lastOrderDefaults", JSON.stringify({ requiresDesign: false, area: "bordado" }));
    renderDialog();
    expect(screen.getByRole("radio", { name: "Sin diseño" })).toHaveAttribute("aria-checked", "true");
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).getByRole("button", { name: /Bordado/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Como el último pedido")).toBeInTheDocument();
  });

  it("un default corrupto no abre en 'Sin diseño'", () => {
    window.localStorage.setItem("emd:lastOrderDefaults", JSON.stringify({ area: "diseno" }));
    renderDialog();
    expect(screen.getByRole("radio", { name: "Con diseño" })).toHaveAttribute("aria-checked", "true");
  });

  it("agregar el mismo producto dos veces suma en una sola fila", async () => {
    renderDialog();
    await addProduct("Playera");
    await userEvent.click(screen.getByRole("combobox", { name: "Agregar producto" }));
    await userEvent.type(screen.getByPlaceholderText("+ Escribe cualquier producto…"), "playera");
    // En minúsculas se guarda con mayúscula inicial, y suma a la misma línea.
    await userEvent.click(await screen.findByText('Usar "Playera" como producto nuevo'));
    expect(screen.getAllByLabelText(/^Cantidad de /)).toHaveLength(1);
    expect(screen.getByLabelText("Cantidad de Playera")).toHaveValue("2");
    expect(screen.getByText("Se sumó a Playera (ahora 2)")).toBeInTheDocument();
  });

  it("renombrar una línea igual a otra las fusiona sumando cantidades", async () => {
    renderDialog();
    await addProduct("Playera");
    await addProduct("Gorra");
    const name = screen.getByRole("textbox", { name: "Producto 2" });
    await userEvent.clear(name);
    await userEvent.type(name, "playera{Enter}");
    expect(screen.getAllByLabelText(/^Cantidad de /)).toHaveLength(1);
    expect(screen.getByLabelText("Cantidad de Playera")).toHaveValue("2");
  });

  it("«50 playera» agrega con cantidad 50; Enter deja el foco para la siguiente línea", async () => {
    mockData.orderProductPresets = [{ id: 1, name: "Playera bordada" }];
    renderDialog();
    const add = screen.getByRole("combobox", { name: "Agregar producto" });
    await userEvent.click(add);
    await userEvent.type(add, "50 playera bor");
    expect(screen.getByRole("option", { name: "Playera bordada" })).toHaveTextContent("×50");
    // Lo escrito va primero (productos personalizados); la sugerencia queda a una flecha.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByLabelText("Cantidad de Playera bordada")).toHaveValue("50");
    expect(add).toHaveValue("");
    expect(document.activeElement).toBe(add);
    // Producto nuevo con cantidad al frente.
    await userEvent.type(add, "12 Gorra{Enter}");
    expect(screen.getByLabelText("Cantidad de Gorra")).toHaveValue("12");
    // Cantidad al frente sobre una línea existente: suma.
    await userEvent.type(add, "3 gorra{Enter}");
    expect(screen.getByLabelText("Cantidad de Gorra")).toHaveValue("15");
    // Enter vacío pasa a la descripción.
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByLabelText("Descripción"));
  });

  it("los frecuentes agregan y suman", async () => {
    mockData.orderProductPresets = [{ id: 1, name: "Playera bordada" }];
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Agregar Playera bordada" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar Playera bordada, 1 en el pedido" }));
    expect(screen.getByLabelText("Cantidad de Playera bordada")).toHaveValue("2");
  });

  it("muestra los frecuentes propios del usuario, en su orden", () => {
    mockData.orderProductPresets = [
      { id: 1, name: "Playera" },
      { id: 2, name: "Gorra" },
      { id: 3, name: "Taza" },
    ];
    mockFrequentIds = [3, 1];
    renderDialog();
    const chips = screen.getAllByRole("button", { name: /^Agregar (Playera|Gorra|Taza)$/ });
    expect(chips.map((c) => c.textContent)).toEqual(["Taza", "Playera"]);
  });

  it("«Personalizar frecuentes» (menú ⋯) guarda la lista en las preferencias del usuario", async () => {
    mockData.orderProductPresets = [
      { id: 1, name: "Playera" },
      { id: 2, name: "Gorra" },
    ];
    renderDialog();
    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Personalizar frecuentes" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar Playera" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar Playera a frecuentes" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(updatePreferencesMock).toHaveBeenCalledWith({ frequentProductIds: [2, 1] });
  });

  it("Personalizar crea un producto nuevo (POST) y lo guarda en las preferencias", async () => {
    mockData.orderProductPresets = [{ id: 1, name: "Playera" }];
    createPresetMock.mockResolvedValue({ id: 9, name: "Termo grabado", uses: 0 });
    renderDialog();
    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Personalizar frecuentes" }));
    await userEvent.type(screen.getByLabelText("Producto nuevo"), "Termo grabado");
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(createPresetMock).toHaveBeenCalledWith("Termo grabado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(updatePreferencesMock).toHaveBeenCalledWith({ frequentProductIds: [1, 9] });
  });

  it("con el catálogo vacío 'Personalizar frecuentes' sigue disponible para crear el primer producto", async () => {
    mockData.orderProductPresets = [];
    renderDialog();
    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Personalizar frecuentes" }));
    expect(screen.getByLabelText("Producto nuevo")).toBeInTheDocument();
  });

  it("el stepper suma y resta sin bajar de 1", async () => {
    renderDialog();
    await addProduct("Gorra");
    await userEvent.click(screen.getByRole("button", { name: "Sumar 1 a Gorra" }));
    expect(screen.getByLabelText("Cantidad de Gorra")).toHaveValue("2");
    await userEvent.click(screen.getByRole("button", { name: "Restar 1 a Gorra" }));
    await userEvent.click(screen.getByRole("button", { name: "Restar 1 a Gorra" }));
    expect(screen.getByLabelText("Cantidad de Gorra")).toHaveValue("1");
  });

  it("Enter no envía; Ctrl+Enter crea una sola vez aunque se repita", async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    createMock.mockImplementation(() => new Promise((r) => (resolveCreate = r)));
    renderDialog();
    await fillDirectOrder();
    const qty = screen.getByLabelText("Cantidad de Playera");
    qty.focus();
    await userEvent.keyboard("{Enter}");
    expect(createMock).not.toHaveBeenCalled();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(createMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveCreate({ id: 9 }));
  });

  it("Ctrl+Enter dentro de una lista abierta elige la opción y NO crea con datos viejos", async () => {
    renderDialog();
    await fillDirectOrder();
    await userEvent.click(screen.getByRole("combobox", { name: "Agregar producto" }));
    await userEvent.type(screen.getByPlaceholderText("+ Escribe cualquier producto…"), "Taza");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(createMock).not.toHaveBeenCalled();
    // Con la lista cerrada, Ctrl+Enter sí crea, y con el producto nuevo incluido.
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderProducts: [
          { customName: "Playera", quantity: 5 },
          { customName: "Taza", quantity: 1 },
        ],
      })
    );
  });

  it("el toast ofrece crear otro pedido para el mismo cliente", async () => {
    const onCreateAnother = vi.fn();
    renderDialog({ onCreateAnother });
    await fillDirectOrder();
    await submit();
    const [message, options] = toastSuccess.mock.calls[0];
    expect(message).toBe("Pedido #123 enviado a Taller");
    expect(options.action.label).toBe("Crear otro para Juan Pérez");
    options.action.onClick();
    expect(onCreateAnother).toHaveBeenCalledWith(undefined, "Juan Pérez");
  });

  it("precargado desde 'Crear otro': muestra el cliente sin registrar y no cuenta como datos sin guardar", async () => {
    const onClose = vi.fn();
    renderDialog({ initialClientNameOverride: "Ana", onClose });
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Ana");
    expect(screen.getByText("Sin registrar")).toBeInTheDocument();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Agregar producto" }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("precarga la descripción (Convertir en pedido desde una cotización)", () => {
    renderDialog({ initialClientNameOverride: "OFISDECO", initialDescription: "50 playeras bordadas" });
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("OFISDECO");
    expect(screen.getByLabelText("Descripción")).toHaveValue("50 playeras bordadas");
  });

  it("cierra directo si no hay nada cargado, aunque se haya preseleccionado la cuenta compartida", async () => {
    mockData.users = [DESIGN_SHARED];
    const onClose = vi.fn();
    renderDialog({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("entrega: «Mañana» fija la fecha, muestra la hora y tocarlo otra vez la quita", async () => {
    renderDialog();
    expect(screen.queryByRole("combobox", { name: "Hora de entrega" })).toBeNull();
    const tomorrow = screen.getByRole("radio", { name: /^Mañana, / });
    await userEvent.click(tomorrow);
    expect(tomorrow).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("combobox", { name: "Hora de entrega" })).toBeInTheDocument();
    expect(screen.getByTestId("order-summary")).toHaveTextContent(/Entrega/);
    expect(screen.queryByRole("button", { name: "Quitar fecha" })).toBeNull();
    await userEvent.click(tomorrow);
    expect(tomorrow).toHaveAttribute("data-state", "off");
    expect(screen.queryByRole("combobox", { name: "Hora de entrega" })).toBeNull();
  });

  it("el resumen del footer no se recorta", async () => {
    renderDialog();
    await fillDirectOrder();
    const summary = screen.getByTestId("order-summary");
    expect(summary.className).not.toMatch(/\btruncate\b/);
    expect(summary).toHaveTextContent("Juan Pérez · Directo a Taller · 1 producto, 5 u.");
  });
});

/* -------------------------------------------------------------------------- */
/* Buscar cliente                                                             */
/* -------------------------------------------------------------------------- */

describe("CreateOrderDialog: buscar cliente", () => {
  const CLIENTS = [
    { id: 1, first_name: "Colegio", last_name: "San Marcos", phone: "81 1234 5678" },
    { id: 2, first_name: "Ferretería", last_name: "El Tornillo", company: { id: 4, name: "Grupo Acero" } },
    { id: 3, first_name: "Ana", last_name: "López" },
  ];

  it("sin texto muestra los recientes", async () => {
    mockData.clients = CLIENTS;
    window.localStorage.setItem("emd:recentClientIds", JSON.stringify([3]));
    renderDialog();
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("aria-label"))).toEqual(["Ana López"]);
    expect(screen.getByText("Recientes")).toBeInTheDocument();
  });

  it("busca por teléfono y Enter elige; el foco salta a «Agregar producto»", async () => {
    mockData.clients = CLIENTS;
    renderDialog();
    const input = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(input);
    await userEvent.type(input, "1234 56");
    expect(screen.getByRole("option", { name: "Colegio San Marcos" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Colegio San Marcos");
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Agregar producto" }));
  });

  it("pasar por un cliente precarga su contexto (lo aprendido, pedidos y plantillas)", async () => {
    mockData.clients = CLIENTS;
    renderDialog();
    const input = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(input);
    await userEvent.type(input, "colegio");
    expect(prefetchClientMock).toHaveBeenCalledWith(1);
  });

  it("busca por empresa y se mueve con flechas", async () => {
    mockData.clients = CLIENTS;
    renderDialog();
    const input = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(input);
    await userEvent.type(input, "acero");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAccessibleName("Ferretería El Tornillo");
    expect(options[0]).toHaveTextContent("Grupo Acero");
    // Al final: usarlo como texto libre o registrarlo.
    expect(options.map((o) => o.textContent)).toEqual([
      "Ferretería El TornilloGrupo Acero",
      'Usar "acero" como nombre de cliente',
      "Registrar «acero»",
    ]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("acero");
    expect(screen.getByText("Sin registrar")).toBeInTheDocument();
  });

  it("Escape cierra la lista sin cerrar el panel", async () => {
    mockData.clients = CLIENTS;
    const onClose = vi.fn();
    renderDialog({ onClose });
    const input = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(input);
    await userEvent.type(input, "ana");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("«Registrar «X»» abre el alta de cliente con el nombre ya escrito", async () => {
    renderDialog();
    const input = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(input);
    await userEvent.type(input, "Tienda Sol");
    await userEvent.click(screen.getByRole("option", { name: "Registrar «Tienda Sol»" }));
    const alta = await screen.findByRole("dialog", { name: "Nuevo cliente" });
    expect(within(alta).getByDisplayValue("Tienda Sol")).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Crear otro al terminar                                                     */
/* -------------------------------------------------------------------------- */

describe("CreateOrderDialog: crear otro al terminar", () => {
  it("deja el panel abierto con el mismo cliente, limpia el resto y avisa «#123 creado»", async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderDialog({ onClose, onCreated });
    await userEvent.click(screen.getByRole("switch", { name: "Crear otro al terminar" }));
    expect(window.localStorage.getItem("emd:orderCreateAnother:v1:7")).toBe("1");
    await fillDirectOrder();
    await submit();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByTestId("order-created-banner")).toHaveTextContent("#123 creado · Taller");
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Juan Pérez");
    expect(screen.queryByLabelText("Cantidad de Playera")).toBeNull();
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Agregar producto" }));

    // «Ver» abre el pedido recién creado.
    await userEvent.click(screen.getByRole("button", { name: "Ver" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith({ id: 123 });
  });

  it("Ctrl+Shift+Enter invierte «crear otro» sólo esa vez", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await fillDirectOrder();
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByTestId("order-created-banner")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Crear otro al terminar" })).toHaveAttribute("aria-checked", "false");
  });

  it("se recuerda por usuario y un alta puntual (cotización) no lo ofrece", () => {
    window.localStorage.setItem("emd:orderCreateAnother:v1:7", "1");
    const { unmount } = renderDialog();
    expect(screen.getByRole("switch", { name: "Crear otro al terminar" })).toHaveAttribute("aria-checked", "true");
    unmount();
    renderDialog({ createAnotherEnabled: false });
    expect(screen.queryByRole("switch", { name: "Crear otro al terminar" })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Borrador                                                                   */
/* -------------------------------------------------------------------------- */

const DRAFT_KEY = "emd:orderDraft:v1:7";

function seedDraft(savedAt: number, key = DRAFT_KEY) {
  window.localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      savedAt,
      data: {
        clientNameOverride: "Juan Pérez",
        clientLabel: "Juan Pérez",
        requiresDesign: false,
        areas: ["taller"],
        description: "Bordado urgente",
        deliveryDate: "",
        deliveryTime: "",
        rows: [{ key: "row-4", customName: "Playera", quantity: 5 }],
        materials: [],
        base: null,
        routeTouched: true,
        descriptionTouched: true,
      },
    })
  );
}

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("CreateOrderDialog: borrador", () => {
  it("se guarda solo (500 ms) y cerrar con datos no pregunta: queda el borrador", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await pickClientByFreeText("Juan Pérez");
    await addProduct("Playera");
    await wait(650);
    const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY)!);
    expect(saved.data.clientNameOverride).toBe("Juan Pérez");
    expect(saved.data.rows).toEqual([expect.objectContaining({ customName: "Playera", quantity: 1 })]);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("al abrir lo ofrece (nunca lo restaura solo) y «Continuar» lo carga", async () => {
    seedDraft(Date.now() - 12 * 60_000);
    renderDialog();
    expect(screen.getByText(/Borrador de hace 12 min · Juan Pérez/)).toBeInTheDocument();
    expect(screen.queryByTestId("order-client-name")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Juan Pérez");
    expect(screen.getByLabelText("Cantidad de Playera")).toHaveValue("5");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Bordado urgente");
    expect(screen.queryByText(/Borrador de hace/)).toBeNull();
    // Las claves de fila siguen siendo únicas: una línea nueva no choca con la restaurada.
    await addProduct("Gorra");
    expect(screen.getAllByLabelText(/^Cantidad de /)).toHaveLength(2);
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientNameOverride: "Juan Pérez",
        area: "taller",
        orderProducts: [
          { customName: "Playera", quantity: 5 },
          { customName: "Gorra", quantity: 1 },
        ],
      })
    );
    // Crear borra el borrador.
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("«Descartar» lo borra", async () => {
    seedDraft(Date.now() - 60_000);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByText(/Borrador de hace/)).toBeNull();
  });

  it("vence a las 4 horas", () => {
    seedDraft(Date.now() - 5 * 60 * 60_000);
    renderDialog();
    expect(screen.queryByText(/Borrador de hace/)).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("es por usuario: el de otro usuario no se ofrece", () => {
    seedDraft(Date.now(), "emd:orderDraft:v1:8");
    renderDialog();
    expect(screen.queryByText(/Borrador de hace/)).toBeNull();
    expect(window.localStorage.getItem("emd:orderDraft:v1:8")).not.toBeNull();
  });

  it("con un borrador sin resolver no se pisa: cerrar con datos pide confirmar", async () => {
    seedDraft(Date.now() - 60_000);
    const onClose = vi.fn();
    renderDialog({ onClose });
    await pickClientByFreeText("Otra persona");
    await wait(650);
    expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)!).data.clientNameOverride).toBe("Juan Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(await screen.findByText("¿Descartar pedido?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Seguir editando/i }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Otra persona");
  });

  it("crear sin resolver el borrador viejo no lo borra (queda para después)", async () => {
    const savedAt = Date.now() - 60_000;
    seedDraft(savedAt);
    renderDialog();
    await fillDirectOrder();
    await wait(650);
    await submit();
    expect(createMock).toHaveBeenCalledTimes(1);
    // Es el mismo borrador de antes: ni se pisó al cargar ni se borró al crear.
    expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)!).savedAt).toBe(savedAt);
  });

  it("con algo precargado no ofrece el borrador", () => {
    seedDraft(Date.now());
    renderDialog({ initialClientNameOverride: "Ana" });
    expect(screen.queryByText(/Borrador de hace/)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Repetir un pedido anterior                                                 */
/* -------------------------------------------------------------------------- */

const CLIENT = { id: 9, first_name: "Colegio", last_name: "Alameda" };

/** Pedido de "Figuras" de coroplast: se repite el pedido, no las figuras ni la fecha. */
const PREVIOUS_ORDER = {
  id: 41,
  clientId: 9,
  requiresDesign: false,
  area: "impresiones",
  productionArea: "impresiones",
  areaTasks: [{ id: 1, area: "impresiones", status: "pendiente" }],
  description: "Figuras para el festival de primavera",
  creationDate: "2026-09-01T10:00:00Z",
  deliveryDate: "2026-09-10T18:00:00Z",
  clientResourceFileName: "logo.png",
  orderProducts: [{ customName: "Figuras", quantity: 20 }],
  materialItems: [{ id: 3, quantity: 4, description: "Vinil impreso sobre coroplast" }],
};

const PREVIOUS_MATERIALS = [
  {
    id: 3,
    orderId: 41,
    materialId: 12,
    quantity: 4,
    description: "Vinil impreso sobre coroplast",
    supplierId: 2,
    material: { id: 12, name: "Coroplast", unit: { name: "Hoja" } },
  },
];

async function pickRecentClient() {
  window.localStorage.setItem("emd:recentClientIds", JSON.stringify([CLIENT.id]));
  mockData.clients = [CLIENT];
}

/** Elige al cliente desde los recientes del buscador. */
async function chooseColegio() {
  await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
  await userEvent.click(screen.getByRole("option", { name: "Colegio Alameda" }));
}

async function expandMaterials() {
  await userEvent.click(screen.getByRole("button", { name: /^\d+ material(es)? de / }));
}

describe("CreateOrderDialog: repetir un pedido anterior", () => {
  it("«Empezar desde» ofrece el último pedido y usarlo copia productos, ruta, descripción y materiales", async () => {
    await pickRecentClient();
    mockClientOrders = [PREVIOUS_ORDER];
    requestMock.mockResolvedValueOnce(PREVIOUS_MATERIALS);
    renderDialog();

    await chooseColegio();
    const group = screen.getByRole("group", { name: "Empezar desde" });
    const chip = within(group).getByRole("button", { name: "Usar el pedido #41 como base" });
    expect(chip).toHaveTextContent("#41");
    expect(chip).toHaveAttribute("title", "Figuras ×20");

    await userEvent.click(chip);

    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("20");
    expect(screen.getByRole("radio", { name: "Sin diseño" })).toBeChecked();
    expect(screen.getByLabelText("Descripción")).toHaveValue("Figuras para el festival de primavera");
    expect(screen.getAllByText("Como el pedido #41").length).toBeGreaterThan(0);
    // Los materiales quedan en una sola línea plegada.
    expect(await screen.findByRole("button", { name: "1 material de #41" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Vinil impreso sobre coroplast")).toBeNull();
    await expandMaterials();
    expect(screen.getByText("Vinil impreso sobre coroplast")).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith("orders/41/materials", { token: "token" });
    // La fecha no se repite.
    expect(screen.queryByRole("combobox", { name: "Hora de entrega" })).toBeNull();

    // Cambia lo de esta vez y crea.
    await setQty("Figuras", "35");
    await submit();

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 9,
        requiresDesign: false,
        area: "impresiones",
        orderProducts: [{ customName: "Figuras", quantity: 35 }],
        description: "Figuras para el festival de primavera",
        deliveryDate: undefined,
        clientResourceFile: undefined,
      })
    );
    expect(requestMock).toHaveBeenCalledWith("orders/123/materials", {
      token: "token",
      method: "POST",
      body: { materialId: 12, quantity: 4, description: "Vinil impreso sobre coroplast", supplierId: 2 },
    });
  });

  it("tocar otra vez el chip de la base vuelve a lo que había antes", async () => {
    await pickRecentClient();
    mockClientOrders = [PREVIOUS_ORDER];
    requestMock.mockResolvedValueOnce(PREVIOUS_MATERIALS);
    renderDialog();

    await chooseColegio();
    await userEvent.click(screen.getByRole("button", { name: "Usar el pedido #41 como base" }));
    expect(await screen.findByRole("button", { name: "1 material de #41" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Quitar base (pedido #41)" }));

    expect(screen.queryByLabelText("Cantidad de Figuras")).toBeNull();
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /material(es)? de/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Usar el pedido #41 como base" })).toBeInTheDocument();
  });

  it("«Más» lista los pedidos anteriores y las plantillas", async () => {
    await pickRecentClient();
    mockClientOrders = [PREVIOUS_ORDER, { ...PREVIOUS_ORDER, id: 30, orderProducts: [{ customName: "Lona", quantity: 2 }] }];
    mockTemplates = [TEMPLATE];
    requestMock.mockResolvedValue([]);
    renderDialog();
    await chooseColegio();
    await userEvent.click(screen.getByRole("button", { name: "Más" }));
    await userEvent.click(await screen.findByRole("button", { name: "Usar el pedido #30 como base" }));
    expect(screen.getByLabelText("Cantidad de Lona")).toHaveValue("2");
  });

  it("muestra un esqueleto mientras carga el contexto del cliente (sin saltos)", async () => {
    await pickRecentClient();
    mockContextLoading = true;
    renderDialog();
    await chooseColegio();
    const group = screen.getByRole("group", { name: "Empezar desde" });
    expect(within(group).queryAllByRole("button")).toHaveLength(0);
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(group.children.length).toBe(3);
  });

  it("«Repetir pedido» abre con el cliente y el pedido como base", async () => {
    mockData.clients = [CLIENT];
    mockRepeatSource = PREVIOUS_ORDER;
    renderDialog({ repeatFromOrderId: 41 });

    expect(await screen.findByTestId("order-client-name")).toHaveTextContent("Colegio Alameda");
    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("20");
    expect(screen.getAllByText("Como el pedido #41").length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Plantillas por cliente                                                     */
/* -------------------------------------------------------------------------- */

const TEMPLATE = {
  id: 5,
  clientId: 9,
  name: "Figuras de coroplast",
  requiresDesign: true,
  productionAreas: ["impresiones"],
  description: "Figuras para eventos del colegio",
  useCount: 3,
  products: [{ customName: "Figuras", quantity: 12 }],
  materials: [
    {
      id: 1,
      materialId: 12,
      quantity: 6,
      description: "Vinil impreso sobre coroplast",
      supplierId: null,
      material: { id: 12, name: "Coroplast", unit: { name: "Hoja" } },
    },
  ],
};

describe("CreateOrderDialog: plantillas del cliente", () => {
  it("tocar una plantilla precarga el pedido y al crear cuenta un uso", async () => {
    await pickRecentClient();
    mockTemplates = [TEMPLATE];
    mockData.users = [DESIGN_SHARED];
    renderDialog();

    await chooseColegio();
    const chip = screen.getByRole("button", { name: "Figuras de coroplast" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("12");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Figuras para eventos del colegio");
    expect(screen.getAllByText("Plantilla «Figuras de coroplast»").length).toBeGreaterThan(0);
    await expandMaterials();
    expect(screen.getByText("Vinil impreso sobre coroplast")).toBeInTheDocument();
    // La plantilla ya trae sus materiales: no se pide nada al backend.
    expect(requestMock).not.toHaveBeenCalled();

    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 9,
        requiresDesign: true,
        productionArea: "impresiones",
        orderProducts: [{ customName: "Figuras", quantity: 12 }],
        deliveryDate: undefined,
      })
    );
    expect(templateMarkUsed).toHaveBeenCalledWith(5);
    expect(requestMock).toHaveBeenCalledWith("orders/123/materials", expect.objectContaining({ method: "POST" }));
  });

  it("tocar la plantilla en uso la quita", async () => {
    await pickRecentClient();
    mockTemplates = [TEMPLATE];
    renderDialog();
    await chooseColegio();
    await userEvent.click(screen.getByRole("button", { name: "Figuras de coroplast" }));
    await userEvent.click(screen.getByRole("button", { name: "Figuras de coroplast" }));
    expect(screen.queryByLabelText("Cantidad de Figuras")).toBeNull();
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
  });

  it("«Guardar como plantilla» (menú ⋯) guarda el pedido en pantalla (sin fecha ni archivo)", async () => {
    await pickRecentClient();
    templateCreate.mockResolvedValue({ ...TEMPLATE, id: 8, name: "Playera", materials: [] });
    renderDialog();

    await chooseColegio();
    await chooseWithoutDesign();
    await toggleArea("Bordado");
    await addProduct("Playera");
    await setQty("Playera", "40");
    await userEvent.type(screen.getByLabelText("Descripción"), "Logo en el pecho");

    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Guardar como plantilla" }));
    const name = await screen.findByLabelText("Nombre");
    expect(name).toHaveValue("Playera");
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    expect(templateCreate).toHaveBeenCalledWith({
      clientId: 9,
      payload: {
        name: "Playera",
        requiresDesign: false,
        productionAreas: ["bordado"],
        description: "Logo en el pecho",
        products: [{ customName: "Playera", quantity: 40 }],
        materials: [],
      },
    });
    // Lo que está en pantalla pasa a ser esa plantilla.
    expect((await screen.findAllByText("Plantilla «Playera»")).length).toBeGreaterThan(0);
    await openMoreMenu();
    expect(screen.getByRole("menuitem", { name: "Actualizar plantilla «Playera»" })).toBeInTheDocument();
  });

  it("sin cliente registrado no se puede guardar plantilla", async () => {
    renderDialog();
    await pickClientByFreeText("Ana");
    await addProduct("Playera");
    await openMoreMenu();
    expect(screen.getByRole("menuitem", { name: "Guardar como plantilla" })).toHaveAttribute("aria-disabled", "true");
  });

  it("sin diseño y sin áreas no deja guardar la plantilla", async () => {
    await pickRecentClient();
    renderDialog();
    await chooseColegio();
    await chooseWithoutDesign();
    await addProduct("Playera");
    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Guardar como plantilla" }));
    expect(await screen.findByText(/sin diseño, la plantilla necesita a dónde ir/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar plantilla" })).toBeDisabled();
  });

  it("«Actualizar plantilla» guarda los cambios en la plantilla en uso", async () => {
    await pickRecentClient();
    mockTemplates = [TEMPLATE];
    templateUpdate.mockResolvedValue(TEMPLATE);
    renderDialog();
    await chooseColegio();
    await userEvent.click(screen.getByRole("button", { name: "Figuras de coroplast" }));
    await setQty("Figuras", "20");
    await openMoreMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Actualizar plantilla «Figuras de coroplast»" }));
    expect(templateUpdate).toHaveBeenCalledWith({
      id: 5,
      payload: expect.objectContaining({
        products: [{ customName: "Figuras", quantity: 20 }],
        materials: [{ materialId: 12, quantity: 6, description: "Vinil impreso sobre coroplast", supplierId: undefined }],
      }),
    });
  });

  it("abre con la plantilla de `templateId` (Nuevo pedido desde Clientes)", async () => {
    mockData.clients = [CLIENT];
    mockTemplateSource = TEMPLATE;
    renderDialog({ templateId: 5 });
    expect(await screen.findByTestId("order-client-name")).toHaveTextContent("Colegio Alameda");
    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("12");
  });
});

/* -------------------------------------------------------------------------- */
/* Aprendizaje por cliente (autocompletado)                                   */
/* -------------------------------------------------------------------------- */

const at = (hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const INSIGHTS = {
  version: 1,
  ordersAnalyzed: 6,
  firstOrderAt: null,
  lastOrderAt: null,
  products: [
    { name: "Figuras", key: "figuras", orders: 6, share: 1, typicalQuantity: 12, lastQuantity: 14, lastOrderedAt: "" },
    { name: "Lona", key: "lona", orders: 2, share: 0.3, typicalQuantity: 1, lastQuantity: 1, lastOrderedAt: "" },
    { name: "Gorra", key: "gorra", orders: 1, share: 0.1, typicalQuantity: 30, lastQuantity: 30, lastOrderedAt: "" },
  ],
  route: { designShare: 1, requiresDesign: true, areas: [{ area: "impresiones", share: 1 }] },
  materials: [],
  leadTime: { days: 7, samples: 6 },
  recentDeliveries: [at(14), at(14), at(14)],
  cadence: null,
  suggestion: {
    confidence: "alta",
    basedOn: 6,
    requiresDesign: false,
    areas: ["impresiones"],
    products: [{ customName: "Figuras", quantity: 12 }],
    materials: [{ materialId: 12, quantity: 6, description: "Vinil impreso sobre coroplast", unitName: "Hoja" }],
    leadTimeDays: 7,
  },
};

describe("CreateOrderDialog: lo aprendido del cliente", () => {
  it("«Lo habitual» autocompleta el pedido y respeta la descripción ya escrita", async () => {
    await pickRecentClient();
    mockInsights = INSIGHTS;
    renderDialog();
    await chooseColegio();
    await userEvent.type(screen.getByLabelText("Descripción"), "Figuras del festival");

    const habitual = screen.getByRole("button", { name: "Usar lo habitual de Colegio Alameda" });
    expect(habitual.getAttribute("title")).toMatch(/^Figuras ×12 · sin diseño · aprendido de 6 pedidos$/);
    await userEvent.click(habitual);

    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("12");
    expect(screen.getByRole("radio", { name: "Sin diseño" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Quitar lo habitual" })).toHaveAttribute("aria-pressed", "true");
    await expandMaterials();
    expect(screen.getByText("Vinil impreso sobre coroplast")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción")).toHaveValue("Figuras del festival");

    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 9,
        requiresDesign: false,
        area: "impresiones",
        orderProducts: [{ customName: "Figuras", quantity: 12 }],
        description: "Figuras del festival",
      })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "orders/123/materials",
      expect.objectContaining({ method: "POST", body: expect.objectContaining({ materialId: 12, quantity: 6 }) })
    );
  });

  it("tocar otra vez «Lo habitual» lo deshace", async () => {
    await pickRecentClient();
    mockInsights = INSIGHTS;
    renderDialog();
    await chooseColegio();
    await userEvent.click(screen.getByRole("button", { name: "Usar lo habitual de Colegio Alameda" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar lo habitual" }));
    expect(screen.queryByLabelText("Cantidad de Figuras")).toBeNull();
    expect(screen.getByRole("button", { name: "Usar lo habitual de Colegio Alameda" })).toBeInTheDocument();
  });

  it("los habituales del cliente van primero en «agregar rápido» con su cantidad (sólo lo que pidió 2+ veces)", async () => {
    await pickRecentClient();
    mockInsights = { ...INSIGHTS, suggestion: null };
    mockData.orderProductPresets = [
      { id: 1, name: "Taza" },
      { id: 2, name: "lona" },
    ];
    renderDialog();
    await chooseColegio();
    const group = screen.getByRole("group", { name: "Agregar rápido" });
    // Deduplicado: "lona" del catálogo no se repite.
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Figuras×12", "Lona×1", "Taza"]);

    await userEvent.click(within(group).getByRole("button", { name: /Agregar Figuras, 12/ }));
    expect(screen.getByLabelText("Cantidad de Figuras")).toHaveValue("12");
    expect(within(group).getByRole("button", { name: "Figuras ya está en el pedido (12)" })).toBeInTheDocument();
  });

  it("un producto que el cliente ya pidió arranca con su cantidad habitual", async () => {
    await pickRecentClient();
    mockInsights = { ...INSIGHTS, suggestion: null };
    renderDialog();
    await chooseColegio();
    await addProduct("Gorra");
    expect(screen.getByLabelText("Cantidad de Gorra")).toHaveValue("30");
    await addProduct("Mochila");
    expect(screen.getByLabelText("Cantidad de Mochila")).toHaveValue("1");
  });

  it("ofrece su fecha habitual como chip y propone la hora en que suele recibir", async () => {
    await pickRecentClient();
    mockInsights = INSIGHTS;
    renderDialog();
    await chooseColegio();
    const chip = screen.getByRole("radio", { name: /su anticipación habitual/ });
    expect(chip).toHaveTextContent("habitual");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("combobox", { name: "Hora de entrega" })).toHaveTextContent("14:00");
  });

  it("propone la ruta con la que suele ir el cliente, con «Deshacer»", async () => {
    await pickRecentClient();
    mockInsights = {
      ...INSIGHTS,
      suggestion: null,
      route: { designShare: 0.1, requiresDesign: false, areas: [{ area: "bordado", share: 0.8 }] },
    };
    renderDialog();
    expect(screen.getByRole("radio", { name: "Con diseño" })).toBeChecked();
    await chooseColegio();
    expect(screen.getByRole("radio", { name: "Sin diseño" })).toBeChecked();
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).getByRole("button", { name: /Bordado/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Como suele pedir")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByRole("radio", { name: "Con diseño" })).toBeChecked();
    expect(within(group).getByRole("button", { name: /Bordado/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Como suele pedir")).toBeNull();
  });

  it("no pisa una ruta que el usuario ya eligió", async () => {
    await pickRecentClient();
    mockInsights = {
      ...INSIGHTS,
      suggestion: null,
      route: { designShare: 0.1, requiresDesign: false, areas: [{ area: "bordado", share: 0.8 }] },
    };
    renderDialog();
    await toggleArea("DTF");
    await chooseColegio();
    expect(screen.getByRole("radio", { name: "Con diseño" })).toBeChecked();
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).getByRole("button", { name: /Bordado/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Como suele pedir")).toBeNull();
  });
});

describe("CreateOrderDialog · mockups 3D", () => {
  const MOCKUP_BODY = {
    garment: "tshirt",
    imageDataUrl: "data:image/png;base64,MOCKUP",
    config: STUDIO_RESULT.config,
  };
  const mockupCalls = () =>
    requestMock.mock.calls.filter(([path]) => String(path).endsWith("/123/mockups"));

  async function addMockup() {
    await userEvent.click(screen.getByRole("button", { name: "Crear mockup" }));
    // El stub vive fuera del diálogo modal (Radix lo oculta y le quita los clics).
    fireEvent.click(screen.getByRole("button", { name: "Agregar mockup de prueba", hidden: true }));
  }

  it("el mockup queda pendiente (se puede quitar) y se sube al pedido después de crearlo", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await fillDirectOrder();
    await addMockup();
    await addMockup();
    const list = screen.getByRole("list", { name: "Mockups para el pedido" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Quitar mockup 2" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(requestMock).not.toHaveBeenCalled();

    await submit();
    expect(createMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(mockupCalls()).toHaveLength(1));
    expect(mockupCalls()[0][1]).toMatchObject({ method: "POST", token: "token", body: MOCKUP_BODY });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("si subir el mockup falla, el pedido igual se crea y el toast trae Reintentar con el mismo cuerpo", async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    requestMock.mockImplementation((path: string) =>
      String(path).endsWith("/mockups")
        ? Promise.reject(new Error("Fallo de red"))
        : Promise.resolve([])
    );
    renderDialog({ onClose, onCreated });
    await fillDirectOrder();
    await addMockup();
    await submit();

    // El pedido no se bloquea ni se revierte.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith({ id: 123 });
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const [message, options] = toastError.mock.calls[0] as [
      string,
      { description: string; action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("El pedido #123 se creó, pero no se pudo adjuntar el mockup.");
    expect(options.description).toBe("Fallo de red");
    expect(options.action.label).toBe("Reintentar");

    requestMock.mockResolvedValue({ id: 9 });
    options.action.onClick();
    await vi.waitFor(() => expect(mockupCalls()).toHaveLength(2));
    expect(mockupCalls()[1][1]).toMatchObject({ method: "POST", body: MOCKUP_BODY });
    await vi.waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orderMockups", 123], exact: true })
    );
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("un mockup demasiado pesado (413) lo explica en el toast", async () => {
    const { ApiError } = await import("@/lib/api");
    requestMock.mockImplementation((path: string) =>
      String(path).endsWith("/mockups")
        ? Promise.reject(new ApiError("Payload Too Large", 413))
        : Promise.resolve([])
    );
    renderDialog();
    await fillDirectOrder();
    await addMockup();
    await submit();
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect((toastError.mock.calls[0][1] as { description: string }).description).toMatch(/máximo 8 MB/);
  });

  it("sin mockups no se hace ningún POST extra", async () => {
    renderDialog();
    await fillDirectOrder();
    await submit();
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls.filter(([path]) => String(path).includes("mockups"))).toHaveLength(0);
  });
});

describe("CreateOrderDialog: cuenta de sucursal (Punto Madero)", () => {
  beforeEach(() => {
    mockIsBranch = true;
  });

  /** La sucursal no ve la ruta: cliente, producto y descripción. */
  async function fillBranchOrder() {
    await pickClientByFreeText("Juan Pérez");
    await addProduct("Playera");
    await setQty("Playera", "5");
    await userEvent.type(screen.getByLabelText("Descripción"), "Bordado urgente");
  }

  it("no muestra la ruta (la decide el backend) y abre con el foco en quién levanta", async () => {
    renderDialog();
    expect(screen.queryByRole("radio", { name: "Con diseño" })).toBeNull();
    expect(screen.queryByRole("group", { name: /^Áreas de producción/ })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Asignar a/ })).toBeNull();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: /¿Quién levanta el pedido\?/ }));
  });

  it("pide elegir el empleado y no crea sin él", async () => {
    renderDialog();
    await fillBranchOrder();
    await submit();
    expect(await screen.findAllByText("Elige quién levanta el pedido")).not.toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: /¿Quién levanta el pedido\?/ }));
  });

  it("sólo ofrece los empleados activos que manda el backend, los envía y los recuerda en el día", async () => {
    const { unmount } = renderDialog();
    await userEvent.click(screen.getByRole("combobox", { name: /¿Quién levanta el pedido\?/ }));
    expect(screen.getByRole("option", { name: "Ana López" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carla Díaz" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Beto Ruiz" })).toBeNull();
    await userEvent.click(screen.getByRole("option", { name: "Carla Díaz" }));

    await fillBranchOrder();
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        branchEmployeeId: 3,
        requiresDesign: true,
        area: undefined,
        productionArea: undefined,
        productionAreas: undefined,
        assignedUserId: undefined,
      })
    );
    unmount();

    // La próxima apertura ya trae a Carla.
    renderDialog();
    expect(screen.getByRole("combobox", { name: /¿Quién levanta el pedido\?/ })).toHaveTextContent("Carla Díaz");
  });

  it("la matriz no ve el selector ni manda empleado", async () => {
    mockIsBranch = false;
    renderDialog();
    expect(screen.queryByRole("combobox", { name: /¿Quién levanta el pedido\?/ })).toBeNull();
    await fillDirectOrder();
    await submit();
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ branchEmployeeId: undefined }));
  });
});
