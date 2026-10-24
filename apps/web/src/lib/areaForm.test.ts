import { describe, expect, it } from "vitest";
import type { AreaOverview } from "@emd/types";
import { DEFAULT_AREAS } from "@emd/business/src/areas";
import {
  EMPTY_DRAFT,
  MAX_SUGGESTIONS,
  addSuggestion,
  deactivationBlocker,
  draftToPayload,
  moveStage,
  removeSuggestion,
  slugPreview,
  stageDraftsOf,
  stagesChanged,
  stagesPayload,
  summaryLines,
  validateColor,
  validateName,
  validateStages,
  validateStep,
  wizardSteps,
  type StageDraft,
} from "./areaForm";

describe("slugPreview", () => {
  it.each([
    ["Impresión 3D", "impresion-3d"],
    ["  Serigrafía  ", "serigrafia"],
    ["Ñandú & Co.", "nandu-co"],
    ["!!!", ""],
  ])("%s → %s", (name, slug) => expect(slugPreview(name)).toBe(slug));
});

describe("validateName", () => {
  it("acepta un nombre nuevo", () => {
    expect(validateName("Impresión 3D", DEFAULT_AREAS)).toBeUndefined();
  });

  it("pide al menos dos caracteres con letras o números", () => {
    expect(validateName("A", DEFAULT_AREAS)).toMatch(/al menos 2/);
    expect(validateName("!!", DEFAULT_AREAS)).toMatch(/letras o números/);
    expect(validateName("   ", DEFAULT_AREAS)).toMatch(/al menos 2/);
  });

  it("rechaza nombres reservados", () => {
    expect(validateName("Admin", DEFAULT_AREAS)).toMatch(/reservado/);
    expect(validateName("Recepción", DEFAULT_AREAS)).toMatch(/reservado/);
  });

  it("rechaza un nombre repetido, sin importar mayúsculas ni acentos", () => {
    expect(validateName("láser", DEFAULT_AREAS)).toMatch(/Ya existe un área parecida: "Láser"/);
    expect(validateName("LASER", DEFAULT_AREAS)).toMatch(/Ya existe/);
  });

  it("al editar, el nombre de la propia área no choca", () => {
    const taller = DEFAULT_AREAS.find((a) => a.slug === "taller")!;
    expect(validateName("Taller", DEFAULT_AREAS, taller.id)).toBeUndefined();
    expect(validateName("DTF", DEFAULT_AREAS, taller.id)).toMatch(/Ya existe/);
  });

  it("limita la longitud", () => {
    expect(validateName("x".repeat(41), DEFAULT_AREAS)).toMatch(/hasta 40/);
  });
});

describe("validateColor / validateStep", () => {
  it("el color debe ser #rrggbb", () => {
    expect(validateColor("#7c3aed")).toBeUndefined();
    expect(validateColor("#7C3AED")).toBeUndefined();
    expect(validateColor("7c3aed")).toBeDefined();
    expect(validateColor("#fff")).toBeDefined();
  });

  it("sólo el paso de identidad valida", () => {
    expect(validateStep("identidad", EMPTY_DRAFT, DEFAULT_AREAS)).toHaveProperty("name");
    expect(validateStep("identidad", { ...EMPTY_DRAFT, name: "Impresión 3D" }, DEFAULT_AREAS)).toEqual({});
    expect(validateStep("identidad", { ...EMPTY_DRAFT, name: "Ok", color: "rojo" }, DEFAULT_AREAS)).toHaveProperty("color");
    expect(validateStep("comportamiento", EMPTY_DRAFT, DEFAULT_AREAS)).toEqual({});
  });
});

describe("wizardSteps", () => {
  it("sin inventario propio se salta el paso de inventario inicial", () => {
    expect(wizardSteps({ hasInventory: true, isProductionDestination: true })).toEqual([
      "identidad",
      "comportamiento",
      "etapas",
      "inventario",
      "equipo",
      "resumen",
    ]);
    expect(wizardSteps({ hasInventory: false, isProductionDestination: true })).toEqual([
      "identidad",
      "comportamiento",
      "etapas",
      "equipo",
      "resumen",
    ]);
  });

  it("un área que no recibe producción no tiene etapas", () => {
    expect(wizardSteps({ hasInventory: true, isProductionDestination: false })).toEqual([
      "identidad",
      "comportamiento",
      "inventario",
      "equipo",
      "resumen",
    ]);
  });
});

describe("sugerencias de inventario", () => {
  it("recorta, ignora vacías y repetidas (sin importar mayúsculas)", () => {
    let list: string[] = [];
    list = addSuggestion(list, "  Filamento ");
    list = addSuggestion(list, "filamento");
    list = addSuggestion(list, "   ");
    list = addSuggestion(list, "Resina");
    expect(list).toEqual(["Filamento", "Resina"]);
  });

  it("respeta el tope y permite quitar", () => {
    const full = Array.from({ length: MAX_SUGGESTIONS }, (_, i) => `u${i}`);
    expect(addSuggestion(full, "otra")).toEqual(full);
    expect(removeSuggestion(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("draftToPayload", () => {
  it("normaliza nombre y color", () => {
    expect(draftToPayload({ ...EMPTY_DRAFT, name: "  Impresión 3D ", color: "#7C3AED" })).toMatchObject({
      name: "Impresión 3D",
      color: "#7c3aed",
    });
  });

  it("sin inventario propio no manda sugerencias", () => {
    const payload = draftToPayload({
      ...EMPTY_DRAFT,
      name: "Oficina",
      hasInventory: false,
      inventoryCategories: ["Papel"],
      inventoryUnits: ["caja"],
    });
    expect(payload.inventoryCategories).toEqual([]);
    expect(payload.inventoryUnits).toEqual([]);
  });
});

describe("summaryLines", () => {
  it("describe lo que hará el área", () => {
    const lines = summaryLines({ ...EMPTY_DRAFT, generalViewEnabled: false }, 2).join("\n");
    expect(lines).toMatch(/podrán producirse aquí/);
    expect(lines).toMatch(/inventario propio/);
    expect(lines).toMatch(/sólo ve lo que se le asignó/);
    expect(lines).toMatch(/cuenta compartida/);
    expect(lines).toMatch(/2 personas pasarán/);
  });

  it("singular y sin cuenta compartida", () => {
    const lines = summaryLines({ ...EMPTY_DRAFT, createSharedAccount: false, isProductionDestination: false }, 1).join("\n");
    expect(lines).toMatch(/1 persona pasará/);
    expect(lines).toMatch(/no se ofrece al crear pedidos/);
    expect(lines).not.toMatch(/cuenta compartida/);
  });
});

describe("etapas", () => {
  const work = (name: string, id?: number): StageDraft => ({ id, name, kind: "work" });
  const review = (name: string, id?: number): StageDraft => ({ id, name, kind: "review" });

  it("acepta una lista vacía y una de trabajo + revisión", () => {
    expect(validateStages([])).toBeUndefined();
    expect(validateStages([work("Slicing"), review("Prueba"), work("Post-proceso")])).toBeUndefined();
  });

  it.each([
    ["la primera es una revisión", [review("Prueba"), work("Producir")], /primera etapa/],
    ["dos revisiones seguidas", [work("Corte"), review("Prueba 1"), review("Prueba 2")], /después de otra revisión/],
    ["nombres repetidos (sin importar mayúsculas)", [work("Corte"), work("corte")], /repetida/],
    ["nombre muy corto", [work("a")], /entre 2 y 40/],
    ["demasiadas", Array.from({ length: 7 }, (_, i) => work(`Etapa ${i}`)), /hasta 6/],
  ])("rechaza %s", (_label, stages, message) => {
    expect(validateStages(stages)).toMatch(message);
  });

  it("el paso de etapas del wizard valida la lista", () => {
    expect(validateStep("etapas", EMPTY_DRAFT, DEFAULT_AREAS)).toEqual({});
    expect(validateStep("etapas", { ...EMPTY_DRAFT, stages: [review("Prueba")] }, DEFAULT_AREAS)).toHaveProperty("stages");
  });

  it("mueve una etapa arriba o abajo sin salirse de la lista", () => {
    const list = [work("A1"), work("B2"), work("C3")];
    expect(moveStage(list, 1, -1).map((s) => s.name)).toEqual(["B2", "A1", "C3"]);
    expect(moveStage(list, 1, 1).map((s) => s.name)).toEqual(["A1", "C3", "B2"]);
    expect(moveStage(list, 0, -1)).toEqual(list);
    expect(moveStage(list, 2, 1)).toEqual(list);
  });

  it("detecta cambios en orden, nombre o tipo respecto al área", () => {
    const stages = [
      { id: 1, key: "a", name: "Digitalizado", kind: "work" as const },
      { id: 2, key: "b", name: "En pruebas", kind: "review" as const },
    ];
    expect(stagesChanged(stages, stageDraftsOf(stages))).toBe(false);
    expect(stagesChanged(stages, [{ ...stageDraftsOf(stages)[0], name: " Digitalizado " }, stageDraftsOf(stages)[1]])).toBe(false);
    expect(stagesChanged(stages, [{ ...stageDraftsOf(stages)[0], name: "Digitalizar" }, stageDraftsOf(stages)[1]])).toBe(true);
    expect(stagesChanged(stages, [...stageDraftsOf(stages), work("Extra")])).toBe(true);
    expect(stagesChanged(stages, [...stageDraftsOf(stages)].reverse())).toBe(true);
  });

  it("el payload recorta nombres y sólo manda id de las que ya existen", () => {
    expect(stagesPayload([work(" Corte ", 4), review("Prueba")])).toEqual([
      { id: 4, name: "Corte", kind: "work" },
      { name: "Prueba", kind: "review" },
    ]);
  });

  it("draftToPayload manda las etapas sólo si el área recibe producción", () => {
    const stages = [work("Corte"), review("Prueba")];
    expect(draftToPayload({ ...EMPTY_DRAFT, name: "Nueva", stages }).stages).toEqual([
      { name: "Corte", kind: "work" },
      { name: "Prueba", kind: "review" },
    ]);
    expect(draftToPayload({ ...EMPTY_DRAFT, name: "Nueva", stages, isProductionDestination: false }).stages).toEqual([]);
  });

  it("el resumen cuenta el camino de las tareas", () => {
    const lines = summaryLines({ ...EMPTY_DRAFT, stages: [work("Corte"), review("Prueba")] }, 0).join("\n");
    expect(lines).toMatch(/«Corte» → «Prueba» antes de producir/);
  });
});

const overview = (slug: string, over: Partial<AreaOverview> = {}): AreaOverview => ({
  ...DEFAULT_AREAS.find((a) => a.slug === slug)!,
  users: 1,
  hasSharedAccount: true,
  openOrders: 0,
  openTasks: 0,
  ...over,
});

describe("deactivationBlocker", () => {
  it("dice por qué no se puede, con singular y plural", () => {
    expect(deactivationBlocker(overview("taller"))).toBeNull();
    expect(deactivationBlocker(overview("dtf", { openOrders: 1, openTasks: 0 }))).toBe("Tiene 1 pedido abierto.");
    expect(deactivationBlocker(overview("dtf", { openOrders: 2, openTasks: 1 }))).toBe("Tiene 2 pedidos abiertos y 1 tarea sin terminar.");
    expect(deactivationBlocker(overview("diseno"))).toMatch(/no se desactiva/);
  });
});
