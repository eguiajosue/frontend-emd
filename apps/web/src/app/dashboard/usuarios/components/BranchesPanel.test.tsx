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

const upload = vi.fn();
const remove = vi.fn();
let logoState: { logoOnLight: string | null; logoOnDark: string | null } | undefined;
vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => ({ getLogos: () => logoState, logos: [], isLoading: false, isError: false }),
  useBranchLogoMutations: () => ({
    upload: { mutateAsync: upload, isPending: false },
    remove: { mutateAsync: remove, isPending: false },
  }),
}));
// jsdom no decodifica imágenes: la validación (tipo/peso/medidas) tiene su propio test.
const checkLogoFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/branchLogoFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/branchLogoFile")>()),
  checkLogoFile,
}));

beforeEach(() => {
  createEmployee.mockReset().mockResolvedValue({});
  updateEmployee.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue({});
  remove.mockReset().mockResolvedValue(undefined);
  checkLogoFile.mockReset();
  logoState = undefined;
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


describe("BranchesPanel · logos de la sucursal", () => {
  const png = (name = "logo.png") => new File([new Uint8Array(10)], name, { type: "image/png" });

  it("tiene dos cargadores: fondos claros (negro) y fondos oscuros (blanco)", () => {
    render(<BranchesPanel />);
    expect(screen.getByText("Logo para fondos claros (negro)")).toBeInTheDocument();
    expect(screen.getByText("Logo para fondos oscuros (blanco)")).toBeInTheDocument();
    expect(screen.getAllByText("Sin logo")).toHaveLength(2);
  });

  it("la vista previa es sobre fondo claro (negro) y sobre fondo oscuro (blanco)", () => {
    logoState = { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: "data:image/png;base64,BLANCO" };
    render(<BranchesPanel />);
    expect(screen.getByTestId("logo-preview-onLight")).toHaveClass("bg-white");
    expect(screen.getByTestId("logo-preview-onLight").querySelector("img")).toHaveAttribute("src", "data:image/png;base64,NEGRO");
    expect(screen.getByTestId("logo-preview-onDark")).toHaveClass("bg-neutral-900");
    expect(screen.getByTestId("logo-preview-onDark").querySelector("img")).toHaveAttribute("src", "data:image/png;base64,BLANCO");
  });

  it("sube el logo validado a la variante correcta", async () => {
    checkLogoFile.mockResolvedValue({ ok: true, dataUrl: "data:image/png;base64,XYZ", width: 100, height: 25, warning: null });
    render(<BranchesPanel />);
    await userEvent.upload(screen.getByLabelText("Logo para fondos oscuros (blanco) de Punto Madero"), png());
    expect(checkLogoFile).toHaveBeenCalledWith(expect.any(File), "onDark");
    expect(upload).toHaveBeenCalledWith({ branchId: 1, variant: "onDark", imageDataUrl: "data:image/png;base64,XYZ" });
  });

  it("si la validación falla, muestra el error y NO sube", async () => {
    checkLogoFile.mockResolvedValue({ ok: false, error: "El logo pesa 500 KB: el máximo es 400 KB." });
    render(<BranchesPanel />);
    await userEvent.upload(screen.getByLabelText("Logo para fondos claros (negro) de Punto Madero"), png());
    expect(await screen.findByRole("alert")).toHaveTextContent("El logo pesa 500 KB");
    expect(upload).not.toHaveBeenCalled();
  });

  it("muestra el mensaje del backend cuando rechaza la subida", async () => {
    checkLogoFile.mockResolvedValue({ ok: true, dataUrl: "data:image/png;base64,XYZ", width: 1, height: 1, warning: null });
    upload.mockRejectedValue(Object.assign(new Error("El logo pesa más de 400 KB"), { status: 400 }));
    render(<BranchesPanel />);
    await userEvent.upload(screen.getByLabelText("Logo para fondos claros (negro) de Punto Madero"), png());
    expect(await screen.findByRole("alert")).toHaveTextContent("El logo pesa más de 400 KB");
  });

  it("un logo casi transparente o del color equivocado sólo avisa: se sube igual", async () => {
    checkLogoFile.mockResolvedValue({
      ok: true,
      dataUrl: "data:image/png;base64,XYZ",
      width: 1,
      height: 1,
      warning: "Este logo se ve muy claro: sobre fondos claros casi no se verá.",
    });
    render(<BranchesPanel />);
    await userEvent.upload(screen.getByLabelText("Logo para fondos claros (negro) de Punto Madero"), png());
    expect(await screen.findByRole("status")).toHaveTextContent("muy claro");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("quita el logo de una variante", async () => {
    logoState = { logoOnLight: "data:image/png;base64,NEGRO", logoOnDark: null };
    render(<BranchesPanel />);
    // Sólo la variante cargada ofrece "Quitar".
    expect(screen.getAllByRole("button", { name: /^Quitar logo/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^Quitar logo para fondos claros/ }));
    expect(remove).toHaveBeenCalledWith({ branchId: 1, variant: "onLight" });
  });
});
