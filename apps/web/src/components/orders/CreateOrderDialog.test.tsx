import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrderDialog } from "./CreateOrderDialog";

const createMock = vi.fn();

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  useEntityMutations: () => ({ create: createMock }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ session: { user: { id: "7", roles: ["recepcion"] } } }),
}));

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 123 });
  window.localStorage.clear();
});

/** Elige un cliente por texto libre (la lista real de clientes está vacía en estos tests). */
async function pickClientByFreeText(name: string) {
  await userEvent.click(screen.getByRole("combobox"));
  await userEvent.type(
    screen.getByPlaceholderText("Buscar o escribir nombre de cliente..."),
    name
  );
  await userEvent.click(await screen.findByText(`Usar "${name}" como nombre de cliente`));
}

/**
 * Cliente (texto libre) + Detalles (sin diseño, para no depender de la lista
 * de usuarios — vacía en estos tests — para el diseñador) + avanza a Productos.
 */
async function fillClientAndDetails() {
  await pickClientByFreeText("Juan Pérez");
  await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

  // Paso Detalles: apaga "requiere diseño" para que el área (no el
  // diseñador) sea el único campo obligatorio, y no depender de `users`.
  // Hay dos Select (área + asignación) simultáneos en este paso, así que se
  // buscan por su label asociado (`htmlFor`/`id`), no por rol solo.
  await userEvent.click(screen.getByRole("switch"));
  // Regex, no texto exacto: el label real incluye el "*" de campo requerido
  // como un `<span>` hermano ("Área destino*"), que getByLabelText exact
  // no matchea.
  await userEvent.click(screen.getByLabelText(/Área destino/));
  await userEvent.click(await screen.findByRole("option", { name: "Taller" }));
  await userEvent.type(screen.getByLabelText(/Descripción/), "Bordado urgente");
  await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
}

describe("CreateOrderDialog", () => {
  it("la navegación del wizard vive fuera del área con scroll del diálogo", () => {
    render(
      <CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />
    );
    // El wizard reemplazó el footer de un solo botón por una barra de
    // navegación fija (Atrás/Cancelar + Siguiente/Crear Pedido) — "Crear
    // Pedido" sólo aparece en el último paso, así que se verifica con
    // "Cancelar", que está presente desde el primer paso.
    const button = screen.getByRole("button", { name: /Cancelar/i });
    // La barra de navegación es la única zona que NO debe tener la clase de
    // scroll `overflow-y-auto` que sí tiene el contenido del paso actual.
    const scrollBody = button.closest(".overflow-y-auto");
    expect(scrollBody).toBeNull();
  });

  it("no deja avanzar del paso Cliente sin elegir uno", async () => {
    render(<CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText("Selecciona o escribí un cliente")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cliente" })).toBeInTheDocument();
  });

  it("una fila de producto con nombre pero sin cantidad bloquea el avance y no se descarta en silencio", async () => {
    render(<CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />);
    await fillClientAndDetails();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(
      screen.getByPlaceholderText("Buscar o escribir producto..."),
      "Playera"
    );
    await userEvent.click(await screen.findByText('Usar "Playera" como producto nuevo'));

    await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(await screen.findByText("Falta la cantidad")).toBeInTheDocument();
    // Sigue en el paso Productos — no lo dejó pasar en falso.
    expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
    // El nombre tipeado no se perdió (antes se descartaba en silencio al enviar).
    expect(screen.getByRole("combobox")).toHaveTextContent("Playera");
  });

  it("no deja crear el pedido sin ningún producto", async () => {
    render(<CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />);
    await fillClientAndDetails();
    // Paso Productos: ninguna fila tocada, avanza directo.
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText(/Agregá al menos un producto/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crea el pedido con el payload esperado (sin diseño, un producto)", async () => {
    const onCreated = vi.fn();
    render(<CreateOrderDialog open onClose={() => {}} onCreated={onCreated} />);
    await fillClientAndDetails();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(
      screen.getByPlaceholderText("Buscar o escribir producto..."),
      "Playera"
    );
    await userEvent.click(await screen.findByText('Usar "Playera" como producto nuevo'));
    await userEvent.type(screen.getByPlaceholderText("Cant."), "5");
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    // Paso Revisar.
    await userEvent.click(screen.getByRole("button", { name: /Crear Pedido/i }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientNameOverride: "Juan Pérez",
        requiresDesign: false,
        area: "taller",
        productionArea: undefined,
        userId: 7,
        description: "Bordado urgente",
        orderProducts: [{ customName: "Playera", quantity: 5 }],
      })
    );
    expect(onCreated).toHaveBeenCalledWith({ id: 123 });
  });

  it("pide confirmar antes de cerrar si hay datos cargados", async () => {
    const onClose = vi.fn();
    render(<CreateOrderDialog open onClose={onClose} onCreated={() => {}} />);
    await pickClientByFreeText("Juan Pérez");

    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(await screen.findByText("¿Descartar pedido?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Seguir editando/i }));
    // El diálogo de confirmación se cierra pero el pedido sigue ahí: el
    // cliente elegido no se perdió.
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveTextContent("Juan Pérez");
  });

  it("cierra directo, sin pedir confirmación, si no hay nada cargado", async () => {
    const onClose = vi.fn();
    render(<CreateOrderDialog open onClose={onClose} onCreated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByText("¿Descartar pedido?")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
