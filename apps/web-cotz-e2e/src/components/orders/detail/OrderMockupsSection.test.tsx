import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrderMockupSummary } from "@/lib/mockups/types";
import type { Order } from "@/types";

let mockups: OrderMockupSummary[] = [];
const detailCalls: { mockupId: number; enabled: boolean | undefined }[] = [];
const createMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
vi.mock("@/hooks/useOrderMockups", () => ({
  useOrderMockups: () => ({ mockups, isLoading: false, isError: false }),
  useOrderMockupDetail: (_orderId: number, mockupId: number, options?: { enabled?: boolean }) => {
    detailCalls.push({ mockupId, enabled: options?.enabled });
    return options?.enabled
      ? { data: { id: mockupId, dataUrl: `data:image/png;base64,M${mockupId}` }, isPending: false, isError: false }
      : { data: undefined, isPending: true, isError: false };
  },
  useCreateOrderMockup: () => ({ mutateAsync: createMutateAsync }),
  useDeleteOrderMockup: () => ({ mutateAsync: deleteMutateAsync }),
  mockupErrorMessage: () => "No se pudo guardar el mockup.",
}));

const RESULT = {
  image: { dataUrl: "data:image/png;base64,NEW", width: 1600, height: 800 },
  config: { garment: "cap", colors: { body: "#000000", mesh: "#ffffff", visor: "#000000" }, layers: [] },
};
vi.mock("@/components/mockups/MockupStudioDialog", () => ({
  MockupStudioDialog: ({ open, onAttach }: { open: boolean; onAttach: (r: typeof RESULT) => Promise<void> }) =>
    open ? (
      <button type="button" onClick={() => onAttach(RESULT).catch(() => undefined)}>
        Guardar mockup de prueba
      </button>
    ) : null,
}));

vi.mock("@/lib/mockups/presets", () => ({
  PLACEMENT_PRESETS: { tshirt: [], cap: [] },
  defaultPlacement: () => ({ position: [0, 0, 0], normal: [0, 0, 1], scale: 1, rotation: 0 }),
  applyPreset: (l: unknown) => l,
}));

const downloadFromUrl = vi.fn();
vi.mock("@/lib/download", () => ({ downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args) }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { OrderMockupsSection } from "./OrderMockupsSection";

const order = { id: 16 } as Order;
const MOCKUPS: OrderMockupSummary[] = [
  { id: 1, orderId: 16, garment: "tshirt", createdAt: "2026-10-01T15:30:00.000Z", createdBy: { id: 3, name: "Ana" } },
  { id: 2, orderId: 16, garment: "cap", createdAt: "2026-10-02T15:30:00.000Z", createdBy: null },
];

beforeEach(() => {
  mockups = [];
  detailCalls.length = 0;
  createMutateAsync.mockReset();
  createMutateAsync.mockResolvedValue({ id: 3 });
  deleteMutateAsync.mockReset();
  deleteMutateAsync.mockResolvedValue(undefined);
  downloadFromUrl.mockReset();
  downloadFromUrl.mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("OrderMockupsSection", () => {
  it("sin mockups y sin permiso para crear, la sección no aparece", () => {
    const { container } = render(<OrderMockupsSection order={order} canManage={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Recepción sin mockups ve un vacío mínimo y el botón para crear", () => {
    render(<OrderMockupsSection order={order} canManage />);
    expect(screen.getByRole("heading", { name: "Mockups" })).toBeInTheDocument();
    expect(screen.getByText("Sin mockups todavía.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear mockup/ })).toBeInTheDocument();
  });

  it("producción ve las miniaturas, las abre en grande y descarga, sin crear ni eliminar", async () => {
    mockups = MOCKUPS;
    render(<OrderMockupsSection order={order} canManage={false} />);
    const list = screen.getByRole("list", { name: "Mockups del pedido" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Crear mockup/ })).not.toBeInTheDocument();
    // La imagen de cada miniatura se pide recién cuando se ve en pantalla.
    expect(detailCalls.filter((c) => c.mockupId === 1).every((c) => c.enabled === false)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Ver mockup de gorra" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "Mockup de gorra" })).toHaveAttribute(
      "src",
      "data:image/png;base64,M2"
    );
    expect(within(dialog).queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Descargar/ }));
    expect(downloadFromUrl).toHaveBeenCalledWith(
      "data:image/png;base64,M2",
      expect.stringMatching(/^mockup-gorra-2026-10-0\d\.png$/)
    );
  });

  it("Recepción elimina un mockup con confirmación", async () => {
    mockups = MOCKUPS;
    render(<OrderMockupsSection order={order} canManage />);
    await userEvent.click(screen.getByRole("button", { name: "Ver mockup de playera" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Eliminar/ }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("¿Eliminar este mockup?");
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    expect(deleteMutateAsync).toHaveBeenCalledWith({ orderId: 16, mockupId: 1 });
    expect(toastSuccess).toHaveBeenCalledWith("Mockup eliminado");
  });

  it("Crear mockup guarda directo en este pedido", async () => {
    render(<OrderMockupsSection order={order} canManage />);
    await userEvent.click(screen.getByRole("button", { name: /Crear mockup/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar mockup de prueba" }));
    expect(createMutateAsync).toHaveBeenCalledWith({
      orderId: 16,
      payload: { garment: "cap", imageDataUrl: "data:image/png;base64,NEW", config: RESULT.config },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Mockup agregado al pedido #16");
  });

  it("si guardar falla, avisa y el estudio sigue abierto", async () => {
    createMutateAsync.mockRejectedValueOnce(new Error("413"));
    render(<OrderMockupsSection order={order} canManage />);
    await userEvent.click(screen.getByRole("button", { name: /Crear mockup/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar mockup de prueba" }));
    expect(toastError).toHaveBeenCalledWith("No se pudo guardar el mockup.");
    expect(screen.getByRole("button", { name: "Guardar mockup de prueba" })).toBeInTheDocument();
  });
});
