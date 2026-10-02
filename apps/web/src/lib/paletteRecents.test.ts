// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_RECENTS, pushRecent, readRecents } from "./paletteRecents";

beforeEach(() => localStorage.clear());

describe("paletteRecents", () => {
  it("pone el último primero, sin duplicados y con tope", () => {
    for (let i = 1; i <= MAX_RECENTS + 2; i++) {
      pushRecent({ id: `order:${i}`, kind: "order", label: `#${i}`, url: `/dashboard/orders?openOrderId=${i}` });
    }
    pushRecent({ id: "order:4", kind: "order", label: "#4", url: "/dashboard/orders?openOrderId=4" });
    const ids = readRecents().map((r) => r.id);
    expect(ids).toHaveLength(MAX_RECENTS);
    expect(ids[0]).toBe("order:4");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ignora datos corruptos o URLs fuera del dashboard", () => {
    localStorage.setItem("emd:palette-recents:v1", "{nope");
    expect(readRecents()).toEqual([]);
    localStorage.setItem(
      "emd:palette-recents:v1",
      JSON.stringify([{ id: "x", kind: "page", label: "x", url: "https://evil.example" }])
    );
    expect(readRecents()).toEqual([]);
  });
});
