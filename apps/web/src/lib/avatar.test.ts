import { describe, expect, it } from "vitest";
import { avatarDataUri, avatarSeedFor } from "./avatar";

describe("avatarSeedFor", () => {
  it("usa el id cuando no hay semilla guardada", () => {
    expect(avatarSeedFor({ id: 5, avatarSeed: null })).toBe("5");
  });
  it("la semilla guardada gana sobre el id", () => {
    expect(avatarSeedFor({ id: 5, avatarSeed: "abc123" })).toBe("abc123");
  });
  it("sin usuario, sin id ni semilla devuelve null", () => {
    expect(avatarSeedFor(null)).toBeNull();
    expect(avatarSeedFor({})).toBeNull();
  });
});

describe("avatarDataUri", () => {
  it("devuelve un SVG como data URI, igual para la misma semilla", () => {
    const uri = avatarDataUri("a");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(avatarDataUri("a")).toBe(uri);
  });
  it("semillas distintas dan avatares distintos", () => {
    expect(avatarDataUri("a")).not.toBe(avatarDataUri("b"));
  });
});
