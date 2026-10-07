import { describe, expect, it } from "vitest";
import { matchesOrigin, originLabel, originParams, parseOrigin } from "./orderOrigin";

describe("orderOrigin", () => {
  it("parseOrigin acepta matriz, sucursal o un id; lo demás es 'Todos'", () => {
    expect(parseOrigin("matriz")).toBe("matriz");
    expect(parseOrigin("sucursal")).toBe("sucursal");
    expect(parseOrigin("3")).toBe("3");
    for (const raw of [null, undefined, "", "todos", "0", "-2", "1.5", "abc"]) {
      expect(parseOrigin(raw)).toBeUndefined();
    }
  });

  it("originParams: Todos = sin parámetros; Matriz y Todas las sucursales = origin; una sucursal = branchId", () => {
    expect(originParams(undefined)).toEqual({});
    expect(originParams("matriz")).toEqual({ origin: "matriz" });
    expect(originParams("sucursal")).toEqual({ origin: "sucursal" });
    expect(originParams("3")).toEqual({ branchId: 3 });
  });

  it("matchesOrigin es la red de seguridad del cliente", () => {
    const matriz = { branchId: null, branch: null };
    const madero = { branchId: 1, branch: { id: 1, name: "Punto Madero" } };
    expect(matchesOrigin(matriz, undefined)).toBe(true);
    expect(matchesOrigin(madero, undefined)).toBe(true);
    expect(matchesOrigin(matriz, "matriz")).toBe(true);
    expect(matchesOrigin(madero, "matriz")).toBe(false);
    expect(matchesOrigin(matriz, "sucursal")).toBe(false);
    expect(matchesOrigin(madero, "sucursal")).toBe(true);
    expect(matchesOrigin(madero, "1")).toBe(true);
    expect(matchesOrigin(madero, "2")).toBe(false);
    // Sólo con `branch` embebido (sin branchId) también cuenta.
    expect(matchesOrigin({ branch: { id: 1, name: "Punto Madero" } }, "1")).toBe(true);
  });

  it("originLabel", () => {
    const branches = [{ id: 1, name: "Punto Madero" }];
    expect(originLabel(undefined, branches)).toBe("Todos");
    expect(originLabel("matriz", branches)).toBe("Matriz");
    expect(originLabel("sucursal", branches)).toBe("Todas las sucursales");
    expect(originLabel("1", branches)).toBe("Punto Madero");
    expect(originLabel("9", branches)).toBe("Sucursal #9");
  });
});
