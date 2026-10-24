import { describe, expect, it } from "vitest";
import { ordersScreenCopy, ordersScreenTitle, ownProductionAreas } from "./orderScreen";

describe("ordersScreenTitle", () => {
  it("Recepción y admin administran pedidos", () => {
    expect(ordersScreenTitle({ roles: ["recepcion"], areas: [] })).toBe("Pedidos");
    expect(ordersScreenTitle({ roles: ["admin"], areas: [] })).toBe("Pedidos");
    expect(ordersScreenTitle({ roles: ["superuser"], areas: [] })).toBe("Pedidos");
  });

  it("un rol operativo ve las tareas que le tocan, no 'Pedidos'", () => {
    // Un bordador no administra pedidos: llamarle "Pedidos" le sugiere un
    // alcance que no tiene.
    expect(ordersScreenTitle({ roles: [], areas: ["bordado"] })).toBe("Tareas asignadas");
    expect(ordersScreenTitle({ roles: [], areas: ["diseno", "dtf"] })).toBe("Tareas asignadas");
  });

  it("con recepción más un área de producción manda recepción", () => {
    expect(ordersScreenTitle({ roles: ["recepcion"], areas: ["bordado"] })).toBe("Pedidos");
  });
});

describe("ordersScreenCopy", () => {
  it("cuenta los pendientes en singular y en plural", () => {
    expect(
      ordersScreenCopy({ roles: [], areas: ["bordado"] }, { canManageOperations: false, pendingCount: 1 })
        .description
    ).toContain("1 pendiente en tu área");
    expect(
      ordersScreenCopy({ roles: [], areas: ["bordado"] }, { canManageOperations: false, pendingCount: 3 })
        .description
    ).toContain("3 pendientes en tu área");
  });

  it("con varias áreas lo dice en plural", () => {
    const copy = ordersScreenCopy({ roles: [], areas: ["bordado", "dtf"] }, {
      canManageOperations: false,
      pendingCount: 2,
    });
    expect(copy.description).toContain("en tus áreas");
    expect(copy.description).toContain("Bordado, DTF");
  });

  it("sin pendientes no muestra un cero", () => {
    const copy = ordersScreenCopy({ roles: [], areas: ["laser"] }, {
      canManageOperations: false,
      pendingCount: 0,
    });
    expect(copy.description).toBe("Sin pendientes por ahora.");
  });

  it("las áreas se nombran con etiqueta legible, no con el slug", () => {
    const copy = ordersScreenCopy({ roles: [], areas: ["diseno"] }, { canManageOperations: false });
    expect(copy.description).toContain("Diseño");
    expect(copy.description).not.toContain("diseno");
  });
});

describe("ownProductionAreas", () => {
  it("Diseño no es un área de producción", () => {
    expect(ownProductionAreas(["diseno", "bordado"])).toEqual(["bordado"]);
  });

  it("sin áreas no hay áreas propias", () => {
    expect(ownProductionAreas([])).toEqual([]);
  });
});
