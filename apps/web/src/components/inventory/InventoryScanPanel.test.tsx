import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryScanPanel } from "./InventoryScanPanel";
import type { InventoryItem } from "@/types";

const scanMutate = vi.fn();
const registerMutate = vi.fn();
const updateMutate = vi.fn();
const beeps: string[] = [];

const hilo: InventoryItem = { id: 1, area: "bordado", name: "Hilo rojo", unit: "cono", quantity: 10, stockStatus: "ok", barcode: "EMD-000001" };
const tinta: InventoryItem = { id: 2, area: "impresiones", name: "Tinta cyan", unit: "litro", quantity: 0, stockStatus: "out", barcode: "EMD-000002" };
const items = [hilo, tinta];

vi.mock("@/hooks/useInventory", () => ({
  useInventoryItems: () => ({ data: items }),
  useInventoryMutations: () => ({
    scanMovement: { mutateAsync: scanMutate },
    registerMovement: { mutateAsync: registerMutate },
    update: { mutateAsync: updateMutate, isPending: false },
  }),
}));
vi.mock("@/lib/barcode/beep", () => ({ playScanBeep: (kind: string) => beeps.push(kind) }));

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

/** Lo que el backend responde a un escaneo de `item`. */
function okResponse(item: InventoryItem, type: "ENTRADA" | "SALIDA", quantity: number) {
  const balanceAfter = item.quantity + (type === "ENTRADA" ? quantity : -quantity);
  return { item: { ...item, quantity: balanceAfter }, movement: { id: 99, itemId: item.id, type, delta: 0, balanceAfter, createdAt: "" } };
}

/** Lector "modo teclado": todas las teclas seguidas, en el mismo instante, y Enter. */
function scannerBurst(code: string, target: Element = document.body) {
  for (const key of code) fireEvent.keyDown(target, { key });
  fireEvent.keyDown(target, { key: "Enter" });
}

async function scanInInput(code: string) {
  const input = screen.getByLabelText("Código");
  await userEvent.type(input, `${code}{Enter}`);
}

let now = 0;
beforeEach(() => {
  beeps.length = 0;
  scanMutate.mockReset();
  registerMutate.mockReset();
  updateMutate.mockReset();
  // Cada prueba lejos de la anterior: el filtro de duplicados no se cruza.
  now += 10_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

describe("InventoryScanPanel", () => {
  it("ENTRADA: registra +1 por código, pita y lo suma al registro de la sesión", async () => {
    scanMutate.mockResolvedValue(okResponse(hilo, "ENTRADA", 1));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);

    await scanInInput("EMD-000001");

    expect(scanMutate).toHaveBeenCalledWith({ code: "EMD-000001", payload: { type: "ENTRADA", quantity: 1 } });
    const entry = await screen.findByTestId("scan-log-entry");
    expect(within(entry).getByText("+1")).toBeInTheDocument();
    expect(within(entry).getByText("Hilo rojo")).toBeInTheDocument();
    expect(within(entry).getByText(/Quedan 11 cono/)).toBeInTheDocument();
    expect(screen.getByText("1 entradas · 0 salidas")).toBeInTheDocument();
    expect(beeps).toEqual(["ok"]);
  });

  it("SALIDA con cantidad 2 desde el lector, con el foco fuera de cualquier campo", async () => {
    scanMutate.mockResolvedValue(okResponse(hilo, "SALIDA", 2));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("radio", { name: /Salida/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sumar uno a la cantidad" }));
    (document.activeElement as HTMLElement | null)?.blur();

    act(() => scannerBurst("EMD-000001"));

    await waitFor(() =>
      expect(scanMutate).toHaveBeenCalledWith({ code: "EMD-000001", payload: { type: "SALIDA", quantity: 2 } })
    );
    const entry = await screen.findByTestId("scan-log-entry");
    expect(within(entry).getByText("−2")).toBeInTheDocument();
    expect(within(entry).getByText(/Quedan 8 cono/)).toBeInTheDocument();
  });

  it("el lector funciona aunque el foco esté en otro campo y no deja el código escrito ahí", async () => {
    scanMutate.mockResolvedValue(okResponse(hilo, "ENTRADA", 1));
    render(
      <>
        <input aria-label="Otro campo" />
        <InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />
      </>
    );
    const other = screen.getByLabelText("Otro campo") as HTMLInputElement;
    other.focus();
    act(() => {
      for (const key of "EMD-000001") {
        fireEvent.keyDown(other, { key });
        // El navegador inserta el carácter: lo simulamos.
        fireEvent.input(other, { target: { value: other.value + key } });
      }
      fireEvent.keyDown(other, { key: "Enter" });
    });
    await waitFor(() => expect(scanMutate).toHaveBeenCalledTimes(1));
    expect(other.value).toBe("");
  });

  it("tecleo humano en otro campo no dispara escaneos", async () => {
    render(
      <>
        <input aria-label="Notas" />
        <InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />
      </>
    );
    // userEvent con demora = velocidad de persona.
    await userEvent.type(screen.getByLabelText("Notas"), "hola mundo{Enter}", { delay: 60 });
    expect(scanMutate).not.toHaveBeenCalled();
  });

  it("ignora el mismo código repetido dentro de 800 ms", async () => {
    scanMutate.mockResolvedValue(okResponse(hilo, "ENTRADA", 1));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);
    await scanInInput("EMD-000001");
    now += 300;
    await scanInInput("EMD-000001");
    now += 1000;
    await scanInInput("EMD-000001");
    await waitFor(() => expect(scanMutate).toHaveBeenCalledTimes(2));
  });

  it("Deshacer registra el movimiento contrario y marca la línea", async () => {
    scanMutate.mockResolvedValue(okResponse(hilo, "ENTRADA", 1));
    registerMutate.mockResolvedValue(okResponse({ ...hilo, quantity: 11 }, "SALIDA", 1));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);
    await scanInInput("EMD-000001");

    await userEvent.click(await screen.findByRole("button", { name: "Deshacer +1 de Hilo rojo" }));

    expect(registerMutate).toHaveBeenCalledWith({
      id: 1,
      payload: { type: "SALIDA", quantity: 1, note: "Deshacer escaneo de EMD-000001" },
    });
    const entry = screen.getByTestId("scan-log-entry");
    expect(await within(entry).findByText(/Deshecho/)).toBeInTheDocument();
    expect(within(entry).queryByRole("button", { name: /Deshacer/ })).not.toBeInTheDocument();
    expect(screen.getByText("0 entradas · 0 salidas")).toBeInTheDocument();
  });

  it("stock insuficiente: aviso claro con el artículo y pitido de error", async () => {
    scanMutate.mockRejectedValue(httpError(400, "Stock insuficiente: hay 0 litro"));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: /Salida/ }));
    await scanInInput("EMD-000002");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No alcanza: Tinta cyan");
    expect(alert).toHaveTextContent("Stock insuficiente: hay 0 litro");
    expect(beeps).toEqual(["error"]);
    expect(screen.queryByTestId("scan-log-entry")).not.toBeInTheDocument();
  });

  it("código desconocido → ligar a un artículo y registrar el movimiento pendiente", async () => {
    scanMutate
      .mockRejectedValueOnce(httpError(404, "No hay ningún artículo con el código 7501234567890"))
      .mockResolvedValueOnce(okResponse(tinta, "ENTRADA", 1));
    updateMutate.mockResolvedValue({ ...tinta, barcode: "7501234567890" });
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);
    await scanInInput("7501234567890");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Código sin artículo")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Buscar artículo para ligar"), "tinta");
    await userEvent.click(within(dialog).getByRole("button", { name: /Tinta cyan/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Ligar y registrar entrada de 1" }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 2, payload: { barcode: "7501234567890" } });
    await waitFor(() => expect(scanMutate).toHaveBeenCalledTimes(2));
    expect(scanMutate).toHaveBeenLastCalledWith({ code: "7501234567890", payload: { type: "ENTRADA", quantity: 1 } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByTestId("scan-log-entry")).toHaveTextContent("Tinta cyan");
  });

  it("código desconocido → el código ya asignado a otro se informa en el diálogo", async () => {
    scanMutate.mockRejectedValueOnce(httpError(404, "No hay ningún artículo con el código ABC-1"));
    updateMutate.mockRejectedValue(httpError(409, "Ese código ya está asignado a Hilo rojo"));
    render(<InventoryScanPanel items={items} onCreateItem={vi.fn()} onExit={vi.fn()} />);
    await scanInInput("ABC-1");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Tinta cyan/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /Ligar y registrar/ }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ese código ya está asignado a Hilo rojo");
  });

  it("código desconocido → crear artículo nuevo con ese código", async () => {
    scanMutate.mockRejectedValueOnce(httpError(404, "No hay ningún artículo con el código NUEVO-1"));
    const onCreateItem = vi.fn();
    render(<InventoryScanPanel items={items} onCreateItem={onCreateItem} onExit={vi.fn()} />);
    await scanInInput("NUEVO-1");
    await userEvent.click(await screen.findByRole("button", { name: /Crear artículo nuevo/ }));
    expect(onCreateItem).toHaveBeenCalledWith("NUEVO-1");
  });
});
