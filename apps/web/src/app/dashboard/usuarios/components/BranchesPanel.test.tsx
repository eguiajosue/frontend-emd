import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchesPanel } from "./BranchesPanel";

const createEmployee = vi.fn();
const updateEmployee = vi.fn();
const branches = [
  {
    id: 1,
    name: "Punto Madero",
    active: true,
    employees: [
      { id: 1, branchId: 1, name: "Ana López", active: true },
      { id: 2, branchId: 1, name: "Beto Ruiz", active: false },
    ],
  },
];

vi.mock("@/hooks/useBranches", () => ({
  useBranches: () => ({ data: branches, isPending: false }),
  useBranchMutations: () => ({
    createBranch: { mutateAsync: vi.fn(), isPending: false },
    updateBranch: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
    createEmployee: { mutateAsync: createEmployee, isPending: false },
    updateEmployee: { mutateAsync: updateEmployee, isPending: false },
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  createEmployee.mockReset().mockResolvedValue({});
  updateEmployee.mockReset().mockResolvedValue({});
});

describe("BranchesPanel (admin)", () => {
  it("lista los empleados con su estado", () => {
    render(<BranchesPanel />);
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("agrega un empleado a la sucursal", async () => {
    render(<BranchesPanel />);
    await userEvent.type(screen.getByLabelText("Nuevo empleado de Punto Madero"), "Carla Díaz");
    await userEvent.click(screen.getByRole("button", { name: /Agregar empleado/ }));
    expect(createEmployee).toHaveBeenCalledWith({ branchId: 1, name: "Carla Díaz" });
  });

  it("renombra un empleado", async () => {
    render(<BranchesPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Renombrar a Ana López" }));
    const input = screen.getByLabelText("Nuevo nombre de Ana López");
    await userEvent.clear(input);
    await userEvent.type(input, "Ana M. López");
    await userEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    expect(updateEmployee).toHaveBeenCalledWith({
      branchId: 1,
      employeeId: 1,
      payload: { name: "Ana M. López" },
    });
  });

  it("desactiva un empleado", async () => {
    render(<BranchesPanel />);
    await userEvent.click(screen.getByRole("switch", { name: "Desactivar a Ana López" }));
    expect(updateEmployee).toHaveBeenCalledWith({
      branchId: 1,
      employeeId: 1,
      payload: { active: false },
    });
  });
});
