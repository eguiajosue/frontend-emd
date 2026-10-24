import { afterEach, describe, expect, it } from "vitest";
import type { Area } from "@/types";
import {
  DEFAULT_AREAS,
  getAreaCatalog,
  normalizeSessionAccess,
  resetAreaCatalog,
  setAreaCatalog,
  subscribeAreaCatalog,
} from "@emd/business/src/areas";
import { isOperationalOnly, statusIdsFor } from "@emd/business/src/roleTaskMapping";
import {
  areaOptions,
  areaToneCss,
  areaTones,
  formatAreaList,
  getAreaIcon,
  getAreaLabel,
  isDesignArea,
  productionAreaOptions,
  productionAreasOf,
} from "./areas";
import { inventoryAreaLabel, inventoryAreaOptions } from "./inventory";
import { buildMenuItems, isNavItemVisible } from "./navMenu";
import { formatAccessList } from "./roles";

const impresion3d: Area = {
  id: 7,
  slug: "impresion-3d",
  name: "Impresión 3D",
  icon: "Box",
  color: "#7c3aed",
  isDesign: false,
  isProductionDestination: true,
  hasInventory: true,
  generalViewEnabled: true,
  inventoryCategories: [],
  inventoryUnits: [],
  sortOrder: 70,
  active: true,
  stages: [],
};

afterEach(() => resetAreaCatalog());

describe("catálogo de áreas", () => {
  it("arranca con las seis de siempre, con sus nombres e íconos", () => {
    expect(getAreaCatalog()).toBe(DEFAULT_AREAS);
    expect(areaOptions().map((a) => a.label)).toEqual(["Taller", "DTF", "Bordado", "Diseño", "Láser", "Impresiones"]);
    expect(getAreaLabel("laser")).toBe("Láser");
    expect(getAreaIcon("taller")).not.toBeNull();
  });

  it("Diseño no es destino de producción", () => {
    expect(productionAreaOptions().map((a) => a.value)).not.toContain("diseno");
    expect(isDesignArea("diseno")).toBe(true);
    expect(productionAreasOf(["diseno", "dtf"])).toEqual(["dtf"]);
  });

  it("un área nueva aparece sola en opciones, nombres, inventario e íconos", () => {
    setAreaCatalog([...DEFAULT_AREAS, impresion3d]);
    expect(productionAreaOptions()).toContainEqual({ value: "impresion-3d", label: "Impresión 3D" });
    expect(getAreaLabel("impresion-3d")).toBe("Impresión 3D");
    expect(formatAreaList(["impresion-3d", "dtf"])).toBe("Impresión 3D, DTF");
    expect(getAreaIcon("impresion-3d")).not.toBeNull();
    expect(inventoryAreaLabel("impresion-3d")).toBe("Impresión 3D");
    expect(inventoryAreaOptions().map((o) => o.value)).toEqual([
      "taller",
      "dtf",
      "bordado",
      "diseno",
      "laser",
      "impresiones",
      "impresion-3d",
      "recepcion",
    ]);
  });

  it("un área desactivada deja de ofrecerse pero conserva su nombre", () => {
    setAreaCatalog([...DEFAULT_AREAS, { ...impresion3d, active: false }]);
    expect(areaOptions().map((a) => a.value)).not.toContain("impresion-3d");
    expect(getAreaLabel("impresion-3d")).toBe("Impresión 3D");
  });

  it("avisa a los suscriptores sólo cuando cambia, y respeta el orden", () => {
    let calls = 0;
    const unsubscribe = subscribeAreaCatalog(() => calls++);
    setAreaCatalog([impresion3d, ...DEFAULT_AREAS]);
    setAreaCatalog([impresion3d, ...DEFAULT_AREAS]);
    setAreaCatalog([]);
    unsubscribe();
    expect(calls).toBe(1);
    expect(getAreaCatalog().at(-1)?.slug).toBe("impresion-3d");
  });

  it("un slug que no está en el catálogo se muestra tal cual", () => {
    expect(getAreaLabel("vieja")).toBe("vieja");
    expect(getAreaIcon("vieja")).toBeNull();
    expect(getAreaLabel(null)).toBe("Sin área");
  });
});

describe("sesión: roles y áreas", () => {
  it("separa las áreas de una sesión guardada antes del cambio", () => {
    expect(normalizeSessionAccess({ roles: ["recepcion", "bordado"] })).toEqual({
      roles: ["recepcion"],
      areas: ["bordado"],
    });
    expect(normalizeSessionAccess({ roles: ["recepcion"], areas: ["impresion-3d"] })).toEqual({
      roles: ["recepcion"],
      areas: ["impresion-3d"],
    });
  });

  it("cualquier área (también una nueva) da los estados de producción", () => {
    expect(statusIdsFor({ roles: [], areas: ["impresion-3d"] }).sort()).toEqual([1, 3, 4]);
    expect(statusIdsFor({ roles: ["recepcion"], areas: [] }).sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 10]);
    expect(statusIdsFor({ roles: [], areas: [] })).toEqual([]);
  });

  it("sólo operativo: trabaja en un área y no tiene rol de gestión", () => {
    expect(isOperationalOnly({ roles: [], areas: ["impresion-3d"] })).toBe(true);
    expect(isOperationalOnly({ roles: ["recepcion"], areas: ["taller"] })).toBe(false);
    expect(isOperationalOnly({ roles: [], areas: [] })).toBe(false);
  });

  it("el menú de quien trabaja un área nueva incluye su bandeja", () => {
    const tareas = buildMenuItems()
      .flatMap((g) => g.items)
      .find((i) => i.url === "/dashboard/tareas")!;
    expect(isNavItemVisible(tareas, { roles: ["recepcion"], areas: ["impresion-3d"] }, false)).toBe(true);
  });

  it("muestra roles y áreas juntos", () => {
    setAreaCatalog([...DEFAULT_AREAS, impresion3d]);
    expect(formatAccessList({ roles: ["recepcion"], areas: ["impresion-3d"] })).toBe("Recepción, Impresión 3D");
    expect(formatAccessList({ roles: [], areas: [] })).toBe("sin rol asignado");
  });
});

describe("colores por área", () => {
  it("el color base es el tono pleno y el texto queda legible", () => {
    const tones = areaTones("#e24091");
    expect(tones?.light.tone).toBe("330 74% 57%");
    // El texto sobre el tinte es bastante más oscuro que el color pleno.
    const inkLight = Number(tones?.light.ink.split(" ")[2].replace("%", ""));
    expect(inkLight).toBeLessThanOrEqual(36);
    const darkInk = Number(tones?.dark.ink.split(" ")[2].replace("%", ""));
    expect(darkInk).toBeGreaterThanOrEqual(74);
  });

  it("un amarillo claro igual da texto oscuro suficiente", () => {
    const ink = Number(areaTones("#c5d629")?.light.ink.split(" ")[2].replace("%", ""));
    expect(ink).toBeLessThan(30);
  });

  it("genera reglas data-area para cada área y descarta colores o slugs inválidos", () => {
    const css = areaToneCss([
      ...DEFAULT_AREAS,
      impresion3d,
      { ...impresion3d, slug: "rota", color: "rojo" },
      { ...impresion3d, slug: 'x"]{}', color: "#000000" },
    ]);
    expect(css).toContain('[data-area="impresion-3d"]{--tone:');
    expect(css).toContain('.dark [data-area="impresion-3d"]{--tone:');
    expect(css).toContain('[data-area="bordado"]{--tone:330 74% 57%');
    expect(css).not.toContain("rota");
    expect(css).not.toContain('x"]');
  });
});
