import { describe, expect, it } from "vitest";
import { resolveGuideKeys } from "./guides";

describe("resolveGuideKeys", () => {
  it("dos áreas de producción comparten una sola guía", () => {
    expect(resolveGuideKeys(["taller", "dtf"], false)).toEqual(["produccion"]);
  });
  it("taller y diseño muestran las dos formas de trabajar", () => {
    expect(resolveGuideKeys(["taller", "diseno"], false)).toEqual(["diseno", "produccion"]);
  });
  it("admin incluye la guía de Recepción", () => {
    expect(resolveGuideKeys(["admin"], true)).toEqual(["admin", "recepcion"]);
  });
  it("sin roles no hay guías", () => {
    expect(resolveGuideKeys([], false)).toEqual([]);
  });
});
