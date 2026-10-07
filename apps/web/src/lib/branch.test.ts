import { describe, expect, it } from "vitest";
import { branchOriginLabel, orderBranchName } from "./branch";
import { isBranchOnly, getRoleLabel } from "./roles";

describe("sucursal en pedidos", () => {
  const order = {
    branch: { id: 1, name: "Punto Madero" },
    branchEmployee: { id: 1, name: "Ana López" },
  };

  it("arma «Punto Madero · Ana López»", () => {
    expect(branchOriginLabel(order)).toBe("Punto Madero · Ana López");
    expect(orderBranchName(order)).toBe("Punto Madero");
  });

  it("sin empleado (pedido viejo) sólo muestra la sucursal", () => {
    expect(branchOriginLabel({ branch: order.branch, branchEmployee: null })).toBe("Punto Madero");
  });

  it("los pedidos de la matriz no llevan etiqueta", () => {
    expect(branchOriginLabel({ branch: null, branchEmployee: null })).toBeNull();
    expect(orderBranchName({})).toBeNull();
  });

  it("isBranchOnly sólo es cierto si todos los roles son sucursal", () => {
    expect(isBranchOnly(["sucursal"])).toBe(true);
    expect(isBranchOnly(["sucursal", "recepcion"])).toBe(false);
    expect(isBranchOnly([])).toBe(false);
    expect(isBranchOnly(undefined)).toBe(false);
    expect(getRoleLabel("sucursal")).toBe("Sucursal");
  });
});
