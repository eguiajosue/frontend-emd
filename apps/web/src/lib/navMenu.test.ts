import { describe, expect, it } from "vitest";
import {
  BRANCH_MENU,
  buildBreadcrumbs,
  buildMenuItems,
  isBranchAllowedPath,
  findActiveNavUrl,
  homePathForRoles,
  OPERATIONAL_MENU,
  isNavItemVisible,
  pageTitleFromBreadcrumbs,
  QUOTES_URL,
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
  it("admin y superuser al panel; Recepción, Diseño y Producción a su Inicio en vivo", () => {
    expect(homePathForRoles(["admin"])).toBe("/dashboard/admin");
    expect(homePathForRoles(["superuser"])).toBe("/dashboard/admin");
    expect(homePathForRoles(["recepcion"])).toBe("/dashboard/inicio");
    expect(homePathForRoles(["bordado"])).toBe("/dashboard/inicio");
    expect(homePathForRoles(["diseno", "taller"])).toBe("/dashboard/inicio");
    expect(homePathForRoles(["recepcion", "taller"])).toBe("/dashboard/inicio");
    expect(homePathForRoles([])).toBe("/dashboard/orders");
  });

  it("Inicio está en el menú de todos los roles", () => {
    expect(OPERATIONAL_MENU[0].items[0].url).toBe("/dashboard/inicio");
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

describe("Mockups", () => {
  const groups = buildMenuItems();
  const operacion = groups.find((g) => g.groupLabel === "Operación")!;
  const mockups = operacion.items.find((i) => i.url === "/dashboard/mockups")!;

  it("va en Operación justo después de Pedidos", () => {
    const urls = operacion.items.map((i) => i.url);
    expect(urls.indexOf("/dashboard/mockups")).toBe(urls.indexOf("/dashboard/orders") + 1);
    expect(mockups.title).toBe("Mockups");
  });

  it("lo ven Recepción y administración; Diseño y Producción no", () => {
    expect(isNavItemVisible(mockups, ["recepcion"], false)).toBe(true);
    expect(isNavItemVisible(mockups, ["admin"], false)).toBe(true);
    expect(isNavItemVisible(mockups, ["superuser"], false)).toBe(true);
    for (const role of ["diseno", "taller", "dtf", "bordado", "laser", "impresiones"]) {
      expect(isNavItemVisible(mockups, [role], false)).toBe(false);
    }
    // El menú operativo (Diseño/Producción) tampoco lo trae.
    expect(OPERATIONAL_MENU.flatMap((g) => g.items.map((i) => i.url))).not.toContain("/dashboard/mockups");
  });

  it("migas: Operación › Mockups", () => {
    expect(buildBreadcrumbs(groups, "/dashboard/mockups")).toEqual([{ label: "Operación" }, { label: "Mockups" }]);
  });
});

describe("Cotizaciones", () => {
  const operacion = buildMenuItems().find((g) => g.groupLabel === "Operación")!;
  const quotes = operacion.items.find((i) => i.url === QUOTES_URL)!;

  it("va en Operación justo después de Mockups, con el mismo acceso", () => {
    const urls = operacion.items.map((i) => i.url);
    expect(QUOTES_URL).toBe("/dashboard/cotizaciones");
    expect(quotes.title).toBe("Cotizaciones");
    expect(urls.indexOf(QUOTES_URL)).toBe(urls.indexOf("/dashboard/mockups") + 1);
    expect(isNavItemVisible(quotes, ["recepcion"], false)).toBe(true);
    expect(isNavItemVisible(quotes, ["superuser"], false)).toBe(true);
    expect(isNavItemVisible(quotes, ["diseno"], false)).toBe(false);
    expect(buildBreadcrumbs(buildMenuItems(), QUOTES_URL)).toEqual([{ label: "Operación" }, { label: "Cotizaciones" }]);
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

describe("cuenta de sucursal (Punto Madero)", () => {
  it("su menú sólo tiene Nuevo pedido, Mis pedidos y Mockups", () => {
    const titles = BRANCH_MENU.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(["Nuevo pedido", "Mis pedidos", "Mockups"]);
  });

  it("el menú completo no la deja ver nada de gestión (cada ítem exige otros roles)", () => {
    const visible = buildMenuItems()
      .flatMap((g) => g.items)
      .filter((item) => isNavItemVisible(item, ["sucursal"], false))
      .map((item) => item.title);
    expect(visible).not.toContain("Pedidos");
    expect(visible).not.toContain("Clientes");
    expect(visible).not.toContain("Usuarios");
    expect(visible).not.toContain("Inventario");
  });

  it("sólo puede entrar a Pedidos, Mockups y Configuración", () => {
    for (const ok of ["/dashboard/orders", "/dashboard/orders/12", "/dashboard/mockups", "/dashboard/configuracion"]) {
      expect(isBranchAllowedPath(ok)).toBe(true);
    }
    for (const no of ["/dashboard/usuarios", "/dashboard/clientes", "/dashboard/admin", "/dashboard/chat", "/dashboard/orders-x"]) {
      expect(isBranchAllowedPath(no)).toBe(false);
    }
  });

  it("entra directo a Mis pedidos", () => {
    expect(homePathForRoles(["sucursal"])).toBe("/dashboard/orders");
  });
});
