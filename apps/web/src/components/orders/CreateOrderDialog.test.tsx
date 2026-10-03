import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrderDialog } from "./CreateOrderDialog";

const createMock = vi.fn();
let mockData: Record<string, unknown[]> = {};

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: (key: string) => ({ data: mockData[key] ?? [] }),
  useEntityMutations: () => ({ create: createMock }),
  CATALOG_STALE_TIME: 5 * 60_000,
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ session: { user: { id: "7", roles: ["recepcion"] } } }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
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
  mockData = {};
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
  await userEvent.type(screen.getByPlaceholderText("+ Agregar producto…"), name);
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

/** Pedido mínimo válido sin diseño (no depende de la lista de usuarios). */
async function fillDirectOrder() {
  await pickClientByFreeText("Juan Pérez");
  await chooseWithoutDesign();
  await toggleArea("Taller");
  await addProduct("Playera");
  await setQty("Playera", "5");
  await userEvent.type(screen.getByLabelText("Descripción"), "Bordado urgente");
}

describe("CreateOrderDialog (una sola vista)", () => {
  it("es una sola vista: no hay pasos ni botón Siguiente, y el CTA vive fuera del área con scroll", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull();
    for (const title of ["Cliente", "Diseño y producción", "Qué se pide", "Entrega"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    const cta = screen.getByRole("button", { name: /Crear pedido/ });
    expect(cta.closest(".overflow-y-auto")).toBeNull();
  });

  it("sin cliente no crea y lleva el foco al cliente", async () => {
    renderDialog();
    await submit();
    expect(await screen.findAllByText("Seleccioná o escribí un cliente")).not.toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Cliente" }));
  });

  it("una fila con nombre pero sin cantidad bloquea y no se descarta en silencio", async () => {
    renderDialog();
    await fillDirectOrder();
    await setQty("Playera", "");
    await submit();
    expect(await screen.findByText("Falta la cantidad")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Producto 1" })).toHaveTextContent("Playera");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("sin productos muestra el estado vacío y no crea", async () => {
    renderDialog();
    expect(screen.getByText("Buscá o escribí un producto.")).toBeInTheDocument();
    await pickClientByFreeText("Juan Pérez");
    await submit();
    expect(await screen.findByText("Agregá al menos un producto")).toBeInTheDocument();
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

  it("con diseño, las áreas son la producción destino en orden de elección", async () => {
    mockData.users = [DESIGN_SHARED];
    renderDialog();
    await pickClientByFreeText("Ana");
    await toggleArea("Bordado");
    await toggleArea("DTF");
    expect(screen.getByText(/2 áreas van a trabajar este pedido en paralelo\. Principal: Bordado\./)).toBeInTheDocument();
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
    expect(
      screen.getByText("2 áreas van a trabajar este pedido en paralelo. Lo recibe DTF.")
    ).toBeInTheDocument();
    await addProduct("Gorra");
    await userEvent.type(screen.getByLabelText("Descripción"), "Gorras");
    await submit();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ area: "dtf", productionAreas: ["dtf", "taller"] })
    );
  });

  it("sin diseño y sin área no crea", async () => {
    renderDialog();
    await pickClientByFreeText("Ana");
    await chooseWithoutDesign();
    await addProduct("Gorra");
    await userEvent.type(screen.getByLabelText("Descripción"), "Gorras");
    await submit();
    expect(await screen.findByText("Elegí al menos un área de producción")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("Diseño no se ofrece como área de producción", () => {
    renderDialog();
    const group = screen.getByRole("group", { name: /^Áreas de producción/ });
    expect(within(group).queryByRole("button", { name: /Diseño/ })).toBeNull();
  });

  it("aplica los últimos defaults desde la primera apertura, saneados", () => {
    window.localStorage.setItem(
      "emd:lastOrderDefaults",
      JSON.stringify({ requiresDesign: false, area: "bordado" })
    );
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
    await userEvent.type(screen.getByPlaceholderText("+ Agregar producto…"), "playera");
    await userEvent.click(await screen.findByText('Usar "playera" como producto nuevo'));
    expect(screen.getAllByLabelText(/^Cantidad de /)).toHaveLength(1);
    expect(screen.getByLabelText("Cantidad de Playera")).toHaveValue("2");
    expect(screen.getByText("Se sumó a Playera (ahora 2)")).toBeInTheDocument();
  });

  it("los frecuentes agregan y suman", async () => {
    mockData.orderProductPresets = [{ id: 1, name: "Playera bordada" }];
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Agregar Playera bordada" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar Playera bordada, 1 en el pedido" }));
    expect(screen.getByLabelText("Cantidad de Playera bordada")).toHaveValue("2");
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
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pide confirmar antes de cerrar si hay datos cargados", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await pickClientByFreeText("Juan Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("¿Descartar pedido?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Seguir editando/i }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(screen.getByTestId("order-client-name")).toHaveTextContent("Juan Pérez");
  });

  it("cierra directo si no hay nada cargado, aunque se haya preseleccionado la cuenta compartida", async () => {
    mockData.users = [DESIGN_SHARED];
    const onClose = vi.fn();
    renderDialog({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("entrega: el atajo 'Mañana' fija la fecha y deja elegir la hora", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("radio", { name: "Mañana" }));
    expect(screen.getByText(/^Entrega el/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Hora de entrega" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar fecha" }));
    expect(screen.queryByText(/^Entrega el/)).toBeNull();
  });
});
