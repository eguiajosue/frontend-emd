import { describe, expect, it } from "vitest";
import { buildMenuItems, findActiveNavUrl, homePathForRoles, isNavItemVisible } from "./navMenu";

describe("findActiveNavUrl", () => {
  const urls = ["/dashboard/admin", "/dashboard/admin/rendimiento", "/dashboard/orders"];

  it("coincidencia exacta", () => {
    expect(findActiveNavUrl(urls, "/dashboard/orders")).toBe("/dashboard/orders");
  });

  it("sub-página mantiene marcado al padre", () => {
    expect(findActiveNavUrl(urls, "/dashboard/orders/123")).toBe("/dashboard/orders");
  });

  it("gana la ruta más específica", () => {
    expect(findActiveNavUrl(urls, "/dashboard/admin/rendimiento")).toBe("/dashboard/admin/rendimiento");
    expect(findActiveNavUrl(urls, "/dashboard/admin")).toBe("/dashboard/admin");
  });

  it("no confunde prefijos de texto (orders-x no es orders)", () => {
    expect(findActiveNavUrl(urls, "/dashboard/orders-archivo")).toBeNull();
  });
});

describe("homePathForRoles", () => {
  it("admin y superuser al panel; el resto a su trabajo", () => {
    expect(homePathForRoles(["admin"])).toBe("/dashboard/admin");
    expect(homePathForRoles(["superuser"])).toBe("/dashboard/admin");
    expect(homePathForRoles(["recepcion"])).toBe("/dashboard/orders");
    expect(homePathForRoles(["bordado"])).toBe("/dashboard/orders");
    expect(homePathForRoles([])).toBe("/dashboard/orders");
  });
});

describe("buildMenuItems", () => {
  it("Operación va primero y Pedidos está en ella", () => {
    const groups = buildMenuItems(["admin"]);
    expect(groups[0].groupLabel).toBe("Operación");
    expect(groups[0].items.map((i) => i.url)).toContain("/dashboard/orders");
  });

  it("recepción no ve ningún ítem de Administración (el grupo queda vacío y se oculta)", () => {
    const admin = buildMenuItems(["recepcion"]).find((g) => g.groupLabel === "Administración")!;
    expect(admin.items.filter((i) => isNavItemVisible(i, ["recepcion"], false))).toHaveLength(0);
  });
});
