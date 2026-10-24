import { describe, expect, it } from "vitest";
import { resolveGuideKeys } from "./guides";

describe("resolveGuideKeys", () => {
  it("dos áreas de producción comparten una sola guía", () => {
    expect(resolveGuideKeys({ roles: [], areas: ["taller", "dtf"] }, false)).toEqual(["produccion"]);
  });
  it("taller y diseño muestran las dos formas de trabajar", () => {
    expect(resolveGuideKeys({ roles: [], areas: ["taller", "diseno"] }, false)).toEqual(["diseno", "produccion"]);
  });
  it("admin incluye la guía de Recepción", () => {
    expect(resolveGuideKeys({ roles: ["admin"], areas: [] }, true)).toEqual(["admin", "recepcion"]);
  });
  it("sin roles no hay guías", () => {
    expect(resolveGuideKeys({ roles: [], areas: [] }, false)).toEqual([]);
  });
});
