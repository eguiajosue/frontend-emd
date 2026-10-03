import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbs,
  buildMenuItems,
  findActiveNavUrl,
  homePathForRoles,
  OPERATIONAL_MENU,
  isNavItemVisible,
  pageTitleFromBreadcrumbs,
} from "./navMenu";

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
    // Diseño y Producción van a su bandeja de tareas, no a "Pedidos".
    expect(homePathForRoles(["bordado"])).toBe("/dashboard/tareas");
    expect(homePathForRoles(["diseno", "taller"])).toBe("/dashboard/tareas");
    expect(homePathForRoles(["recepcion", "taller"])).toBe("/dashboard/orders");
    expect(homePathForRoles([])).toBe("/dashboard/orders");
  });
});

describe("menú de Diseño y Producción", () => {
  it("no ven Pedidos: sólo su bandeja de Tareas asignadas", () => {
    const urls = OPERATIONAL_MENU.flatMap((g) => g.items.map((i) => i.url));
    expect(urls).toContain("/dashboard/tareas");
    expect(urls).not.toContain("/dashboard/orders");
  });

  it("Pedidos sólo para quien gestiona; Tareas para quien además trabaja un área", () => {
    const items = buildMenuItems().flatMap((g) => g.items);
    const pedidos = items.find((i) => i.url === "/dashboard/orders")!;
    const tareas = items.find((i) => i.url === "/dashboard/tareas")!;
    expect(isNavItemVisible(pedidos, ["taller"], false)).toBe(false);
    expect(isNavItemVisible(pedidos, ["recepcion"], false)).toBe(true);
    expect(isNavItemVisible(tareas, ["recepcion"], false)).toBe(false);
    expect(isNavItemVisible(tareas, ["recepcion", "taller"], false)).toBe(true);
    // Admin ve todo el menú, pero no tiene bandeja propia.
    expect(isNavItemVisible(tareas, ["admin"], false)).toBe(false);
  });
});

describe("buildMenuItems", () => {
  it("Operación va primero y Pedidos está en ella", () => {
    const groups = buildMenuItems();
    expect(groups[0].groupLabel).toBe("Operación");
    expect(groups[0].items.map((i) => i.url)).toContain("/dashboard/orders");
  });

  it("recepción no ve ningún ítem de Administración (el grupo queda vacío y se oculta)", () => {
    const admin = buildMenuItems().find((g) => g.groupLabel === "Administración")!;
    expect(admin.items.filter((i) => isNavItemVisible(i, ["recepcion"], false))).toHaveLength(0);
  });
});

describe("buildBreadcrumbs", () => {
  const groups = buildMenuItems();

  it("página del menú: sección › página", () => {
    expect(buildBreadcrumbs(groups, "/dashboard/orders")).toEqual([
      { label: "Operación" },
      { label: "Pedidos" },
    ]);
  });

  it("detalle: la página pasa a ser link y se agrega #id", () => {
    const crumbs = buildBreadcrumbs(groups, "/dashboard/orders/123");
    expect(crumbs).toEqual([
      { label: "Operación" },
      { label: "Pedidos", href: "/dashboard/orders" },
      { label: "#123" },
    ]);
    expect(pageTitleFromBreadcrumbs(crumbs)).toBe("Pedidos #123");
  });

  it("Rendimiento cae en Administración, no bajo Panel General", () => {
    expect(buildBreadcrumbs(groups, "/dashboard/admin/rendimiento")).toEqual([
      { label: "Administración" },
      { label: "Rendimiento" },
    ]);
  });

  it("rutas fuera del menú con nombre propio; desconocidas sin migas", () => {
    expect(buildBreadcrumbs(groups, "/dashboard/configuracion")).toEqual([{ label: "Configuración" }]);
    expect(buildBreadcrumbs(groups, "/dashboard/no-existe")).toEqual([]);
    expect(pageTitleFromBreadcrumbs([])).toBeNull();
  });
});
