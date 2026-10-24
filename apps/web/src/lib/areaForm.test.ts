import { describe, expect, it } from "vitest";
import { DEFAULT_AREAS } from "@emd/business/src/areas";
import {
  EMPTY_DRAFT,
  MAX_SUGGESTIONS,
  addSuggestion,
  draftToPayload,
  removeSuggestion,
  slugPreview,
  summaryLines,
  validateColor,
  validateName,
  validateStep,
  wizardSteps,
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
    expect(wizardSteps({ hasInventory: true })).toEqual(["identidad", "comportamiento", "inventario", "equipo", "resumen"]);
    expect(wizardSteps({ hasInventory: false })).toEqual(["identidad", "comportamiento", "equipo", "resumen"]);
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
