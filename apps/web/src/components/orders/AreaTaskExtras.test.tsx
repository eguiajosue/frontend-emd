import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_AREAS, resetAreaCatalog, setAreaCatalog } from "@emd/business/src/areas";
import type { OrderAreaTask } from "@/types";
import { AreaTaskExtras } from "./AreaTaskExtras";

const setMachine = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const setFieldValues = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
vi.mock("@/hooks/useAreaTasks", () => ({ useAreaTasks: () => ({ setMachine, setFieldValues }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const task = (over: Partial<OrderAreaTask> = {}): OrderAreaTask =>
  ({ id: 4, orderId: 9, area: "impresion-3d", status: "pendiente", createdAt: "", ...over }) as OrderAreaTask;

beforeEach(() => {
  setMachine.mutateAsync.mockClear();
  setFieldValues.mutateAsync.mockClear();
  setAreaCatalog([
    ...DEFAULT_AREAS,
    {
      ...DEFAULT_AREAS[0],
      id: 9,
      slug: "impresion-3d",
      name: "Impresión 3D",
      sortOrder: 70,
      machines: [
        { id: 31, name: "Impresora 1" },
        { id: 32, name: "Impresora 2" },
      ],
      fields: [
        { id: 1, key: "material", label: "Material", type: "select", required: true, options: ["PLA", "ABS"], unit: null },
        { id: 2, key: "alto", label: "Alto", type: "number", required: false, options: [], unit: "cm" },
        { id: 3, key: "soporte", label: "Con soporte", type: "boolean", required: false, options: [], unit: null },
      ],
    },
  ]);
});
afterEach(() => resetAreaCatalog());

describe("AreaTaskExtras", () => {
  it("no pinta nada si el área no tiene máquinas ni datos", () => {
    const { container } = render(<AreaTaskExtras orderId={9} task={task({ area: "taller" })} canEdit />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asigna una máquina del área", async () => {
    const user = userEvent.setup();
    render(<AreaTaskExtras orderId={9} task={task()} canEdit />);

    await user.click(screen.getByRole("combobox", { name: "Máquina" }));
    await user.click(await screen.findByRole("option", { name: "Impresora 2" }));

    await waitFor(() => expect(setMachine.mutateAsync).toHaveBeenCalledWith({ taskId: 4, machineId: 32 }));
  });

  it("captura los datos y guarda sólo lo que cambió", async () => {
    const user = userEvent.setup();
    render(<AreaTaskExtras orderId={9} task={task({ fieldValues: { material: "PLA" } })} canEdit />);

    const save = screen.getByRole("button", { name: "Guardar datos" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/^Alto/), "12,5");
    await user.click(screen.getByRole("switch", { name: /Con soporte/ }));
    await user.click(save);

    await waitFor(() =>
      expect(setFieldValues.mutateAsync).toHaveBeenCalledWith({ taskId: 4, values: { alto: 12.5, soporte: true } })
    );
  });

  it("marca los obligatorios", () => {
    render(<AreaTaskExtras orderId={9} task={task()} canEdit />);
    expect(screen.getByText("Material").parentElement).toHaveTextContent("Material *");
  });

  it("sin permiso de edición muestra un resumen sin controles", () => {
    render(
      <AreaTaskExtras
        orderId={9}
        task={task({ machine: { id: 31, name: "Impresora 1" }, fieldValues: { material: "ABS", alto: 10, soporte: false } })}
        canEdit={false}
      />
    );
    expect(screen.getByText("Impresora 1")).toBeInTheDocument();
    expect(screen.getByText("ABS")).toBeInTheDocument();
    expect(screen.getByText("10 cm")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar datos" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
