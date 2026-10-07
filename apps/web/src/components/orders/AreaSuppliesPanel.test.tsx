import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AreaSuppliesPanel } from "./AreaSuppliesPanel";
import type { AreaSupplySheet } from "@/types";

let sheet: AreaSupplySheet;
let canManageOperations = true;
const discount = vi.fn();
vi.mock("@/hooks/useAreaSupplies", () => ({
  useAreaSupplies: () => ({ data: sheet, isLoading: false }),
  useDiscountPendingSupplies: () => ({ mutate: discount, isPending: false, variables: undefined }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canManageOperations }) }));

type SheetLine = NonNullable<AreaSupplySheet["areas"][number]["supply"]>["lines"][number];

const line = (over: Partial<SheetLine> = {}): SheetLine => ({
  id: 1,
  inventoryItemId: 1,
  description: "Hilo rojo",
  quantity: 15,
  discountedAt: null,
  inventoryItem: { id: 1, name: "Hilo rojo", unit: "cono", area: "bordado" },
  state: "apartado",
  pendingDiscount: false,
  shortfall: 0,
  stock: { quantity: 12, reserved: 15, available: -3 },
  ...over,
});

const sheetWith = (lines: SheetLine[], pendingDiscount: boolean): AreaSupplySheet => ({
  areas: [
    {
      taskId: 90,
      area: "bordado",
      status: "terminado",
      supply: { id: 1, source: "nosotros", lines },
      pendingDiscount,
    },
  ],
  movements: [],
});

beforeEach(() => {
  canManageOperations = true;
  discount.mockReset();
});

describe("AreaSuppliesPanel - descuento pendiente", () => {
  it("línea pendiente: aviso ámbar con lo que falta y botón para descontar (gestor)", async () => {
    sheet = sheetWith([line({ pendingDiscount: true, shortfall: 3 })], true);
    render(<AreaSuppliesPanel orderId={110} />);

    expect(screen.getByTestId("supply-pending")).toHaveTextContent("Pendiente de descontar — faltan 3 cono");
    expect(screen.queryByText("Apartado")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Descontar pendientes de Bordado" }));
    expect(discount).toHaveBeenCalledWith("bordado");
  });

  it("quien no es gestor ve el aviso pero no el botón", () => {
    canManageOperations = false;
    sheet = sheetWith([line({ pendingDiscount: true, shortfall: 3 })], true);
    render(<AreaSuppliesPanel orderId={110} />);

    expect(screen.getByTestId("supply-pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descontar pendientes/ })).not.toBeInTheDocument();
  });

  it("sin pendientes: sin aviso ni botón; descontada se lee 'Descontado'", () => {
    sheet = sheetWith([line({ state: "descontado", discountedAt: "2026-10-01T10:00:00.000Z" })], false);
    render(<AreaSuppliesPanel orderId={110} />);

    expect(screen.queryByTestId("supply-pending")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descontar pendientes/ })).not.toBeInTheDocument();
    expect(screen.getByText("Descontado")).toBeInTheDocument();
  });

  it("pendiente con existencia ya disponible: pide reintentar", () => {
    sheet = sheetWith([line({ pendingDiscount: true, shortfall: 0 })], true);
    render(<AreaSuppliesPanel orderId={110} />);
    expect(screen.getByTestId("supply-pending")).toHaveTextContent("Pendiente de descontar — ya hay existencia");
  });
});
