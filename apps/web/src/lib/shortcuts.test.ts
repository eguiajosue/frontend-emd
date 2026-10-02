// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveGoShortcuts } from "./shortcuts";

describe("resolveGoShortcuts", () => {
  it("sólo incluye pantallas del menú del rol, con su nombre, más Inicio", () => {
    const result = resolveGoShortcuts(
      [
        { title: "Tareas asignadas", url: "/dashboard/orders" },
        { title: "Chat interno", url: "/dashboard/chat" },
      ],
      "/dashboard/orders"
    );
    expect(result).toEqual([
      { key: "i", url: "/dashboard/orders", label: "Inicio" },
      { key: "p", url: "/dashboard/orders", label: "Tareas asignadas" },
    ]);
  });
});

describe("isTypingTarget", () => {
  it("detecta campos de texto", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
