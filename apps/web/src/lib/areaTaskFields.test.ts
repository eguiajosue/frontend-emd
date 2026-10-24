import { describe, expect, it } from "vitest";
import type { AreaField } from "@emd/types";
import { fieldValuesChanges, formatFieldValue, missingRequiredFields } from "./areaTaskFields";

const f = (over: Partial<AreaField>): AreaField => ({
  id: 1,
  key: "material",
  label: "Material",
  type: "text",
  required: false,
  options: [],
  unit: null,
  ...over,
});

const FIELDS = [
  f({ key: "material", type: "select", options: ["PLA", "ABS"], required: true }),
  f({ id: 2, key: "alto", label: "Alto", type: "number", unit: "cm" }),
  f({ id: 3, key: "notas", label: "Notas" }),
  f({ id: 4, key: "soporte", label: "Soporte", type: "boolean" }),
];

describe("fieldValuesChanges", () => {
  it("sin cambios no manda nada", () => {
    expect(fieldValuesChanges(FIELDS, { material: "PLA", alto: 12 }, { material: "PLA", alto: "12" })).toEqual({});
  });

  it("manda lo nuevo, convierte números y borra con null", () => {
    expect(
      fieldValuesChanges(
        FIELDS,
        { material: "PLA", notas: "viejo" },
        { material: "ABS", alto: "12,5", notas: "", soporte: true }
      )
    ).toEqual({ material: "ABS", alto: 12.5, notas: null, soporte: true });
  });

  it("un sí/no apagado que nunca se capturó no cuenta, pero apagar uno guardado sí", () => {
    expect(fieldValuesChanges(FIELDS, {}, { soporte: false })).toEqual({});
    expect(fieldValuesChanges(FIELDS, { soporte: true }, { soporte: false })).toEqual({ soporte: false });
  });

  it("un número que no es número se trata como sin dato", () => {
    expect(fieldValuesChanges(FIELDS, { alto: 3 }, { alto: "abc" })).toEqual({ alto: null });
  });
});

describe("formatFieldValue y obligatorios", () => {
  it("da formato con unidad, sí/no y guion", () => {
    expect(formatFieldValue(FIELDS[1], 12)).toBe("12 cm");
    expect(formatFieldValue(FIELDS[3], true)).toBe("Sí");
    expect(formatFieldValue(FIELDS[3], false)).toBe("No");
    expect(formatFieldValue(FIELDS[0], undefined)).toBe("—");
  });

  it("lista los obligatorios sin valor", () => {
    expect(missingRequiredFields(FIELDS, {}).map((x) => x.key)).toEqual(["material"]);
    expect(missingRequiredFields(FIELDS, { material: "PLA" })).toEqual([]);
  });
});
