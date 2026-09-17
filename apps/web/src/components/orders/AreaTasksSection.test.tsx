import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AreaTasksSection } from "./AreaTasksSection";
import type { Order, OrderAreaTask } from "@/types";

const removeMutateAsync = vi.fn();
let tasks: OrderAreaTask[] = [];
let isUnavailable = false;

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({
    tasks,
    isLoading: false,
    isUnavailable,
    setStatus: { mutateAsync: vi.fn(), isPending: false },
    assign: { mutateAsync: vi.fn(), isPending: false },
    addAreas: { mutateAsync: vi.fn(), isPending: false },
    removeArea: { mutateAsync: removeMutateAsync, isPending: false },
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    roles: ["admin"],
    session: { user: { id: "1" } },
  }),
}));

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
}));

const order: Order = {
  id: 7,
  description: "Letrero luminoso",
  statusId: 1,
  creationDate: "2026-09-01T00:00:00.000Z",
} as Order;

beforeEach(() => {
  tasks = [
    {
      id: 1,
      orderId: 7,
      area: "impresiones",
      status: "pendiente",
      assignedUserId: null,
    } as OrderAreaTask,
  ];
  isUnavailable = false;
  removeMutateAsync.mockReset();
  removeMutateAsync.mockResolvedValue({ success: true });
});

describe("AreaTasksSection - quitar área pide confirmación", () => {
  it("no quita el área al primer click: pide confirmación antes de llamar a removeArea", async () => {
    render(<AreaTasksSection order={order} />);

    await userEvent.click(screen.getByTitle(/Quitar .* del pedido/i));

    expect(removeMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Quitar .* del pedido\?/i)).toBeInTheDocument();
  });

  it("al confirmar, llama a removeArea con el id de la tarea", async () => {
    render(<AreaTasksSection order={order} />);

    await userEvent.click(screen.getByTitle(/Quitar .* del pedido/i));
    await userEvent.click(await screen.findByRole("button", { name: /^Eliminar$/i }));

    expect(removeMutateAsync).toHaveBeenCalledWith(1);
  });
});
