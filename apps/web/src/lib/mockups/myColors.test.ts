import { describe, expect, it } from "vitest";
import {
  MY_COLORS_FULL_MESSAGE,
  addCustomColor,
  normalizeMockupColors,
  orderedMyColors,
  removeMyColor,
  toggleFavoriteColor,
} from "./myColors";
import { MAX_MY_COLORS } from "./types";

const empty = { favorites: [], custom: [] };

describe("normalizeMockupColors", () => {
  it("null o basura → listas vacías", () => {
    expect(normalizeMockupColors(null)).toEqual(empty);
    expect(normalizeMockupColors("x")).toEqual(empty);
    expect(normalizeMockupColors({ favorites: "no", custom: 3 })).toEqual(empty);
  });

  it("normaliza a #rrggbb en minúsculas, quita inválidos y repetidos y respeta el tope", () => {
    const many = Array.from({ length: 60 }, (_, i) => `#${i.toString(16).padStart(6, "0")}`);
    const result = normalizeMockupColors({ favorites: ["FFF", "#ffffff", "nope", 4], custom: many });
    expect(result.favorites).toEqual(["#ffffff"]);
    expect(result.custom).toHaveLength(MAX_MY_COLORS);
  });
});

describe("cambios", () => {
  it("agregar pone el color al principio y no lo repite", () => {
    const a = addCustomColor(empty, "1f2a44");
    expect(a).toEqual({ ok: true, colors: { favorites: [], custom: ["#1f2a44"] }, color: "#1f2a44" });
    if (!a.ok) throw new Error();
    const b = addCustomColor(a.colors, "#C8102E");
    expect(b.ok && b.colors.custom).toEqual(["#c8102e", "#1f2a44"]);
    const again = addCustomColor(a.colors, "#1F2A44");
    expect(again.ok && again.colors).toBe(a.colors);
  });

  it("un hex inválido o la lista llena dan un mensaje", () => {
    expect(addCustomColor(empty, "rojo")).toMatchObject({ ok: false });
    const full = { favorites: [], custom: Array.from({ length: MAX_MY_COLORS }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`) };
    expect(addCustomColor(full, "#ffffff")).toEqual({ ok: false, error: MY_COLORS_FULL_MESSAGE });
  });

  it("la estrella marca y desmarca favoritos", () => {
    const on = toggleFavoriteColor({ favorites: [], custom: ["#123456"] }, "#123456");
    expect(on.ok && on.colors.favorites).toEqual(["#123456"]);
    if (!on.ok) throw new Error();
    const off = toggleFavoriteColor(on.colors, "#123456");
    expect(off.ok && off.colors.favorites).toEqual([]);
  });

  it("quitar lo saca de propios y de favoritos", () => {
    expect(removeMyColor({ favorites: ["#123456"], custom: ["#123456", "#abcdef"] }, "#123456")).toEqual({
      favorites: [],
      custom: ["#abcdef"],
    });
  });

  it("orden para mostrar: favoritos primero, sin repetir", () => {
    expect(orderedMyColors({ favorites: ["#bbbbbb"], custom: ["#aaaaaa", "#bbbbbb", "#cccccc"] })).toEqual([
      { value: "#bbbbbb", favorite: true },
      { value: "#aaaaaa", favorite: false },
      { value: "#cccccc", favorite: false },
    ]);
  });
});
