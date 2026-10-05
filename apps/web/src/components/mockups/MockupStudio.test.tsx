import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  DesignLayer,
  DesignPlacement,
  Garment,
  MockupCanvasHandle,
  MockupCanvasProps,
  PlacementPreset,
} from "@/lib/mockups/types";

/* ----------------------------- Lienzo 3D (stub) ---------------------------- */

let canvasProps: MockupCanvasProps | null = null;
const exportSheet = vi.fn();
const setView = vi.fn();
vi.mock("@/components/mockups/MockupCanvasLazy", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const Stub = forwardRef<MockupCanvasHandle, MockupCanvasProps>(function Stub(props, ref) {
    canvasProps = props;
    useImperativeHandle(ref, () => ({ exportSheet, setView }));
    return <div data-testid="canvas" />;
  });
  return { default: Stub, MockupCanvasLazy: Stub };
});

/* --------------------------------- Presets -------------------------------- */

const { placements, presets } = vi.hoisted(() => {
  const placements: Record<Garment, DesignPlacement> = {
    tshirt: { position: [0, 0.1, 0.2], normal: [0, 0, 1], scale: 0.3, rotation: 0 },
    cap: { position: [0, 0.05, 0.1], normal: [0, 0, 1], scale: 0.1, rotation: 0 },
  };
  const presets: Record<Garment, PlacementPreset[]> = {
    tshirt: [
      { id: "chest-left", label: "Pecho izq.", view: "front", placement: { position: [0.1, 0.2, 0.15], normal: [0, 0, 1], scale: 0.12 } },
      { id: "back-top", label: "Espalda alta", view: "back", placement: { position: [0, 0.3, -0.15], normal: [0, 0, -1], scale: 0.25 } },
    ],
    cap: [{ id: "cap-front", label: "Frente", view: "front", placement: { position: [0, 0.06, 0.1], normal: [0, 0, 1], scale: 0.08 } }],
  };
  return { placements, presets };
});
vi.mock("@/lib/mockups/presets", () => ({
  PLACEMENT_PRESETS: presets,
  defaultPlacement: (garment: Garment) => ({ ...placements[garment] }),
  applyPreset: (layer: DesignLayer, preset: PlacementPreset): DesignLayer => ({
    ...layer,
    placement: { ...preset.placement, rotation: preset.placement.rotation ?? 0 },
  }),
}));

/* ------------------------------ Otros módulos ------------------------------ */

const importDesignFile = vi.fn();
vi.mock("@/lib/mockups/importDesign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mockups/importDesign")>()),
  importDesignFile: (file: File) => importDesignFile(file),
}));

const downloadFromUrl = vi.fn();
vi.mock("@/lib/download", () => ({ downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args) }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

import { MockupStudio } from "./MockupStudio";

const SHEET = { dataUrl: "data:image/png;base64,SHEET", width: 1600, height: 800 };

beforeEach(() => {
  canvasProps = null;
  exportSheet.mockReset();
  exportSheet.mockResolvedValue(SHEET);
  setView.mockReset();
  downloadFromUrl.mockReset();
  downloadFromUrl.mockResolvedValue(undefined);
  toastError.mockReset();
  importDesignFile.mockReset();
  importDesignFile.mockImplementation(async (file: File) => ({
    name: file.name.replace(/\.\w+$/, ""),
    dataUrl: "data:image/png;base64,LOGO",
    aspect: 2,
  }));
});

const layers = () => canvasProps!.config.layers;

async function upload(name = "logo.png") {
  const input = screen.getByLabelText("Subir diseño");
  await userEvent.upload(input, new File(["x"], name, { type: "image/png" }));
  await screen.findByRole("button", { name: `Seleccionar ${name.replace(/\.\w+$/, "")}` });
}

describe("MockupStudio", () => {
  it("sin diseños invita a subir el primero", () => {
    render(<MockupStudio />);
    expect(screen.getAllByText("Sube el diseño del cliente").length).toBeGreaterThan(0);
    expect(screen.getByText(/Arrastra un PNG, JPG, SVG o WEBP aquí/)).toBeInTheDocument();
    expect(screen.getByText("Gildan 5000")).toBeInTheDocument();
    expect(screen.getByText("Richardson 112")).toBeInTheDocument();
  });

  it("subir un diseño lo agrega a la prenda, seleccionado y en la posición inicial", async () => {
    render(<MockupStudio />);
    await upload();
    expect(layers()).toHaveLength(1);
    expect(layers()[0]).toMatchObject({ name: "logo", aspect: 2, placement: placements.tshirt });
    expect(canvasProps!.selectedLayerId).toBe(layers()[0].id);
    expect(screen.getByRole("button", { name: "Seleccionar logo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Arrastra el diseño sobre la prenda para moverlo. Supr lo quita y Esc lo deselecciona.")).toBeInTheDocument();
  });

  it("soltar o pegar una imagen sobre el estudio la agrega", async () => {
    render(<MockupStudio />);
    const png = new File(["x"], "soltado.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("canvas"), { dataTransfer: { types: ["Files"], files: [png] } });
    await screen.findByRole("button", { name: "Seleccionar soltado" });

    const pasted = new File(["x"], "pegado.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    paste.clipboardData = { files: [pasted] };
    act(() => {
      window.dispatchEvent(paste);
    });
    await screen.findByRole("button", { name: "Seleccionar pegado" });
    expect(layers().map((l) => l.name)).toEqual(["soltado", "pegado"]);
  });

  it("un archivo que no se puede leer avisa y no agrega nada", async () => {
    importDesignFile.mockRejectedValueOnce(new Error("No se pudo leer «roto.png»."));
    render(<MockupStudio />);
    await userEvent.upload(screen.getByLabelText("Subir diseño"), new File(["x"], "roto.png", { type: "image/png" }));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo leer «roto.png»."));
    expect(layers()).toHaveLength(0);
  });

  it("los sliders de tamaño y rotación cambian el diseño seleccionado", async () => {
    render(<MockupStudio />);
    await upload();
    const size = screen.getByRole("slider", { name: "Tamaño" });
    expect(size).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(size, { key: "ArrowRight" });
    expect(layers()[0].placement.scale).toBeCloseTo(0.3 * 1.05);
    const rotation = screen.getByRole("slider", { name: "Rotación" });
    fireEvent.keyDown(rotation, { key: "ArrowLeft" });
    expect(layers()[0].placement.rotation).toBeCloseTo(-Math.PI / 180);
  });

  it("un preset coloca el diseño y gira la cámara a su vista", async () => {
    render(<MockupStudio />);
    await upload();
    await userEvent.click(screen.getByRole("button", { name: "Espalda alta" }));
    expect(layers()[0].placement.position).toEqual([0, 0.3, -0.15]);
    expect(canvasProps!.view).toBe("back");
    expect(setView).toHaveBeenCalledWith("back");
    expect(screen.getByRole("button", { name: "Espalda alta" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Vista" })).getByRole("button", { name: "Espalda" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("cambiar a gorra muestra frente, malla y visera y regresa los diseños a su lugar", async () => {
    render(<MockupStudio />);
    await upload();
    expect(screen.getByRole("group", { name: "Color de la prenda" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Gorra" }));
    expect(canvasProps!.config.garment).toBe("cap");
    for (const label of ["Frente", "Malla", "Visera"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("group", { name: "Color de la prenda" })).not.toBeInTheDocument();
    expect(layers()).toHaveLength(1);
    expect(layers()[0].placement).toEqual(placements.cap);
    // Presets de la gorra.
    expect(within(screen.getByRole("group", { name: "Posiciones predeterminadas" })).getAllByRole("button")).toHaveLength(1);
  });

  it("colores: swatch rápido y hex escrito a mano", async () => {
    render(<MockupStudio />);
    await userEvent.click(screen.getByRole("button", { name: "Color de la prenda: Negro" }));
    expect(canvasProps!.config.colors.body).toBe("#111111");
    const hex = screen.getByRole("textbox", { name: "Color de la prenda (código hex)" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "c8102e{Enter}");
    expect(canvasProps!.config.colors.body).toBe("#c8102e");
  });

  it("quitar un diseño con el botón, con Supr y deseleccionar con Esc", async () => {
    render(<MockupStudio />);
    await upload("uno.png");
    await upload("dos.png");
    expect(layers()).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Quitar uno" }));
    expect(layers().map((l) => l.name)).toEqual(["dos"]);

    const select = screen.getByRole("button", { name: "Seleccionar dos" });
    expect(select).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(select, { key: "Escape" });
    expect(canvasProps!.selectedLayerId).toBeNull();

    await userEvent.click(select);
    expect(canvasProps!.selectedLayerId).toBe(layers()[0].id);
    fireEvent.keyDown(select, { key: "Delete" });
    expect(layers()).toHaveLength(0);
  });

  it("arrastrar el diseño en el lienzo actualiza su posición", async () => {
    render(<MockupStudio />);
    await upload();
    const id = layers()[0].id;
    const moved: DesignPlacement = { position: [0.2, 0, 0.2], normal: [0, 0, 1], scale: 0.3, rotation: 0 };
    act(() => canvasProps!.onPlacementChange(id, moved));
    expect(layers()[0].placement).toEqual(moved);
  });

  it("Descargar imagen exporta la lámina y la baja como PNG con prenda y fecha", async () => {
    render(<MockupStudio />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar imagen" }));
    expect(exportSheet).toHaveBeenCalledTimes(1);
    expect(downloadFromUrl).toHaveBeenCalledWith(
      SHEET.dataUrl,
      expect.stringMatching(/^mockup-playera-\d{4}-\d{2}-\d{2}\.png$/)
    );
  });

  it("si exportar falla avisa con un toast", async () => {
    exportSheet.mockRejectedValueOnce(new Error("webgl"));
    render(<MockupStudio />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar imagen" }));
    expect(toastError).toHaveBeenCalledWith("No se pudo generar la imagen. Intenta de nuevo.");
    expect(downloadFromUrl).not.toHaveBeenCalled();
  });

  it("Adjuntar entrega la lámina y la configuración a quien lo usa", async () => {
    const onAttach = vi.fn();
    render(<MockupStudio attachLabel="Agregar al pedido" onAttach={onAttach} />);
    await upload();
    await userEvent.click(screen.getByRole("button", { name: "Agregar al pedido" }));
    expect(onAttach).toHaveBeenCalledWith({ image: SHEET, config: canvasProps!.config });
  });

  it("sin onAttach sólo se puede descargar", () => {
    render(<MockupStudio />);
    expect(screen.queryByRole("button", { name: "Adjuntar a pedido" })).not.toBeInTheDocument();
  });
});
