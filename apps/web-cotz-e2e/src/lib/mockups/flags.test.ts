import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLAG_CODES } from "./flagCodes";
import { countryNameEs, flagLayerName, flagUrl, getFlags, normalizeSearch, searchFlags } from "./flags";

const PUBLIC = join(__dirname, "..", "..", "..", "public");

describe("banderas", () => {
  it("México, Estados Unidos y Canadá van fijas arriba; el resto A-Z en español", () => {
    const flags = getFlags();
    expect(flags.slice(0, 3).map((f) => f.code)).toEqual(["mx", "us", "ca"]);
    expect(flags.slice(0, 3).map((f) => f.name)).toEqual(["México", "Estados Unidos", "Canadá"]);
    const rest = flags.slice(3).map((f) => f.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
    expect(flags).toHaveLength(FLAG_CODES.length);
    expect(FLAG_CODES).toHaveLength(249);
  });

  it("todos los países tienen nombre en español", () => {
    expect(countryNameEs("de")).toBe("Alemania");
    expect(countryNameEs("jp")).toBe("Japón");
    for (const f of getFlags()) expect(f.name).not.toBe(f.code.toUpperCase());
  });

  it("buscar no distingue acentos ni mayúsculas: «méx» encuentra México", () => {
    expect(normalizeSearch("  MÉXICO  ")).toBe("mexico");
    expect(searchFlags("méx")[0]).toMatchObject({ code: "mx", name: "México" });
    expect(searchFlags("mex").map((f) => f.code)).toContain("mx");
    expect(searchFlags("japon").map((f) => f.code)).toEqual(["jp"]);
    expect(searchFlags("eua")[0].code).toBe("us");
    expect(searchFlags("zzz")).toEqual([]);
    expect(searchFlags("")).toHaveLength(getFlags().length);
  });

  it("cada código tiene su SVG 4x3 en public/flags y la licencia está junto", () => {
    expect(flagUrl("mx")).toBe("/flags/4x3/mx.svg");
    const files = new Set(readdirSync(join(PUBLIC, "flags", "4x3")));
    for (const code of FLAG_CODES) expect(files.has(`${code}.svg`), code).toBe(true);
    expect(files.size).toBe(FLAG_CODES.length);
    expect(existsSync(join(PUBLIC, "flags", "LICENSE"))).toBe(true);
  });

  it("nombre de la capa", () => {
    expect(flagLayerName({ name: "México" })).toBe("Bandera de México");
  });
});
