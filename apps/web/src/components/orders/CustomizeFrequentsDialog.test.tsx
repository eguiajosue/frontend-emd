import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CustomizeFrequentsDialog,
  cleanPresetName,
  resolveFrequents,
  validatePresetName,
} from "./CustomizeFrequentsDialog";
import { ApiError } from "@/lib/api";
import type { OrderProductPreset } from "@/types";

const presets: OrderProductPreset[] = [
  { id: 1, name: "Playera" },
  { id: 2, name: "Gorra" },
  { id: 3, name: "Sudadera básica" },
];

const onSave = vi.fn();
const onCreatePreset = vi.fn();

function renderDialog(opts: { current?: OrderProductPreset[]; create?: boolean } = {}) {
  return render(
    <CustomizeFrequentsDialog
      open
      onOpenChange={vi.fn()}
      presets={presets}
      current={opts.current ?? [presets[0]]}
      onSave={onSave}
      onCreatePreset={opts.create === false ? undefined : onCreatePreset}
    />
  );
}

const field = () => screen.getByLabelText("Producto nuevo");
const addButton = () => screen.getByRole("button", { name: "Agregar" });

beforeEach(() => {
  onSave.mockReset().mockResolvedValue(undefined);
  onCreatePreset.mockReset();
});

describe("validatePresetName / cleanPresetName", () => {
  it("limpia espacios y valida 1 a 80 caracteres", () => {
    expect(cleanPresetName("  Playera   polo ")).toBe("Playera polo");
    expect(validatePresetName("   ")).toMatch(/Escribe/);
    expect(validatePresetName("a")).toBeNull();
    expect(validatePresetName("a".repeat(80))).toBeNull();
    expect(validatePresetName("a".repeat(81))).toMatch(/80/);
  });
});

describe("resolveFrequents", () => {
  it("sin personalizar, los primeros del catálogo; personalizados, en su orden y sin los que ya no existen", () => {
    expect(resolveFrequents(presets, null).map((p) => p.id)).toEqual([1, 2, 3]);
    expect(resolveFrequents(presets, [3, 99, 1]).map((p) => p.id)).toEqual([3, 1]);
  });
});

describe("CustomizeFrequentsDialog", () => {
  it("quita y agrega del catálogo, y guarda el orden resultante", async () => {
    renderDialog({ current: [presets[0], presets[1]] });
    await userEvent.click(screen.getByRole("button", { name: "Quitar Playera" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar Sudadera básica a frecuentes" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledWith([2, 3]);
  });

  it("expone el reordenamiento (asa de arrastre) de cada frecuente", () => {
    renderDialog({ current: [presets[0], presets[1]] });
    expect(screen.getByRole("button", { name: "Mover Playera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover Gorra" })).toBeInTheDocument();
  });

  it("crea un producto nuevo: POST con el nombre limpio y queda en la lista", async () => {
    onCreatePreset.mockResolvedValue({ id: 10, name: "Termo grabado", uses: 0 });
    renderDialog();
    await userEvent.type(field(), "  Termo   grabado ");
    await userEvent.click(addButton());

    expect(onCreatePreset).toHaveBeenCalledWith("Termo grabado");
    expect(await screen.findByRole("button", { name: "Quitar Termo grabado" })).toBeInTheDocument();
    expect(field()).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledWith([1, 10]);
  });

  it("Enter agrega el producto sin cerrar ni enviar nada más", async () => {
    onCreatePreset.mockResolvedValue({ id: 11, name: "Mandil", uses: 0 });
    renderDialog();
    await userEvent.type(field(), "Mandil{Enter}");
    await waitFor(() => expect(onCreatePreset).toHaveBeenCalledWith("Mandil"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("si ya existe en el catálogo (sin importar mayúsculas ni acentos) sólo lo agrega a la lista, sin POST", async () => {
    renderDialog();
    await userEvent.type(field(), "  SUDADERA   basica ");
    await userEvent.click(addButton());

    expect(onCreatePreset).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Quitar Sudadera básica" })).toBeInTheDocument();
  });

  it("si ya está en mis frecuentes avisa y no duplica", async () => {
    renderDialog();
    await userEvent.type(field(), "playera");
    await userEvent.click(addButton());

    expect(onCreatePreset).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("«Playera» ya está en tus frecuentes.");
    expect(screen.getAllByRole("button", { name: "Quitar Playera" })).toHaveLength(1);
  });

  it("valida el largo: vacío y más de 80 no llaman al backend", async () => {
    renderDialog();
    await userEvent.click(addButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el nombre del producto.");

    await userEvent.click(field());
    await userEvent.paste("x".repeat(81));
    await userEvent.click(addButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Máximo 80 caracteres.");
    expect(onCreatePreset).not.toHaveBeenCalled();
  });

  it("muestra el error del backend y conserva lo escrito", async () => {
    onCreatePreset.mockRejectedValue(new ApiError("Ese nombre de producto no está permitido", 400));
    renderDialog();
    await userEvent.type(field(), "Prohibido");
    await userEvent.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese nombre de producto no está permitido");
    expect(field()).toHaveValue("Prohibido");
    expect(screen.queryByRole("button", { name: "Quitar Prohibido" })).not.toBeInTheDocument();
  });

  it("sin onCreatePreset no se ofrece 'Producto nuevo'", () => {
    renderDialog({ create: false });
    expect(screen.queryByLabelText("Producto nuevo")).not.toBeInTheDocument();
  });
});
