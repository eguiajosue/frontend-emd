import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api";
import type { Order } from "@/types";

const ORDERS = [
  { id: 101, statusId: 1, status: { id: 1, name: "pendiente" }, description: "Playeras evento", client: { first_name: "Colegio", last_name: "Alameda" } },
  { id: 102, statusId: 1, status: { id: 1, name: "pendiente" }, description: "Gorras", clientNameOverride: "José Núñez" },
  { id: 87, statusId: 3, status: { id: 3, name: "en proceso" }, description: "Lonas", clientNameOverride: "Taquería El Güero" },
] as unknown as Order[];

let mockOrdersState: { data?: Order[]; isPending: boolean; isError?: boolean; refetch?: () => void } = {
  data: ORDERS,
  isPending: false,
};
vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => mockOrdersState,
}));

const mutateAsync = vi.fn();
vi.mock("@/hooks/useOrderMockups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useOrderMockups")>()),
  useCreateOrderMockup: () => ({ mutateAsync }),
}));

vi.mock("@/lib/mockups/presets", () => ({
  PLACEMENT_PRESETS: { tshirt: [], cap: [] },
  defaultPlacement: () => ({ position: [0, 0, 0], normal: [0, 0, 1], scale: 1, rotation: 0 }),
  applyPreset: (l: unknown) => l,
}));

vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({
    getLogos: (id: number) => (id === 1 ? { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" } : undefined),
    logos: [],
    isLoading: false,
    isError: false,
  }),
}));

const push = vi.fn();
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isBranch: false }) }));
vi.mock("@/hooks/useBranches", () => ({ useMyBranch: () => ({ branch: undefined }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() } }));

import { AttachToOrderDialog, filterOrdersForAttach } from "./AttachToOrderDialog";

const RESULT = {
  image: { dataUrl: "data:image/png;base64,SHEET", width: 1600, height: 800 },
  config: { garment: "tshirt" as const, colors: { body: "#ffffff" }, layers: [] },
};

beforeEach(() => {
  mockOrdersState = { data: ORDERS, isPending: false };
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ id: 5 });
  push.mockReset();
  toastSuccess.mockReset();
});

describe("filterOrdersForAttach", () => {
  it("busca por número (con o sin #) o por cliente sin importar acentos", () => {
    expect(filterOrdersForAttach(ORDERS, "#10").map((o) => o.id)).toEqual([102, 101]);
    expect(filterOrdersForAttach(ORDERS, "nunez").map((o) => o.id)).toEqual([102]);
    expect(filterOrdersForAttach(ORDERS, "alameda").map((o) => o.id)).toEqual([101]);
    expect(filterOrdersForAttach(ORDERS, "").map((o) => o.id)).toEqual([102, 101, 87]);
  });
});

describe("AttachToOrderDialog", () => {
  it("elige el pedido, guarda el mockup y ofrece abrirlo", async () => {
    const onOpenChange = vi.fn();
    render(<AttachToOrderDialog open onOpenChange={onOpenChange} result={RESULT} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar pedido" }), "güero");
    const list = screen.getByRole("list", { name: "Pedidos" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    await userEvent.click(within(list).getByRole("button", { name: /#87/ }));

    expect(mutateAsync).toHaveBeenCalledWith({
      orderId: 87,
      payload: { garment: "tshirt", imageDataUrl: RESULT.image.dataUrl, config: RESULT.config },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    const [message, options] = toastSuccess.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe("Mockup adjuntado al pedido #87");
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/dashboard/orders/87");
  });

  it("un 413 se explica y el diálogo sigue abierto", async () => {
    mutateAsync.mockRejectedValueOnce(new ApiError("Payload Too Large", 413));
    const onOpenChange = vi.fn();
    render(<AttachToOrderDialog open onOpenChange={onOpenChange} result={RESULT} />);
    await userEvent.click(screen.getByRole("button", { name: /#101/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/pesa demasiado.*máximo 8 MB/);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("otros errores muestran el mensaje del servidor", async () => {
    mutateAsync.mockRejectedValueOnce(new ApiError("No tienes acceso a este pedido", 403));
    render(<AttachToOrderDialog open onOpenChange={vi.fn()} result={RESULT} />);
    await userEvent.click(screen.getByRole("button", { name: /#102/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes acceso a este pedido");
  });

  it("si no cargan los pedidos lo dice y deja reintentar", async () => {
    const refetch = vi.fn();
    mockOrdersState = { data: [], isPending: false, isError: true, refetch };
    render(<AttachToOrderDialog open onOpenChange={vi.fn()} result={RESULT} />);
    expect(screen.getByText("No se pudieron cargar los pedidos.")).toBeInTheDocument();
    expect(screen.queryByText("No hay pedidos para elegir.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("sin coincidencias lo dice", async () => {
    render(<AttachToOrderDialog open onOpenChange={vi.fn()} result={RESULT} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar pedido" }), "zzz");
    expect(screen.getByText("Ningún pedido coincide con la búsqueda.")).toBeInTheDocument();
  });
});

describe("AttachToOrderDialog · logo de la sucursal", () => {
  it("los pedidos de sucursal se reconocen por su logo en la lista", () => {
    mockOrdersState = {
      data: [
        { ...ORDERS[0], branchId: 1, branch: { id: 1, name: "Punto Madero" } },
        ORDERS[1],
      ] as Order[],
      isPending: false,
    };
    render(<AttachToOrderDialog open onOpenChange={vi.fn()} result={RESULT} />);
    const list = screen.getByRole("list", { name: "Pedidos" });
    expect(within(list).getAllByTestId("branch-logo")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /#101/ })).toContainElement(within(list).getByTestId("branch-logo"));
  });
});
