import { describe, expect, it, vi } from "vitest";
import {
  PATTERN_LIMITS,
  contrastColor,
  drawFabricPattern,
  normalizeFabricPattern,
  patternPeriod,
  stripeLayout,
  tileSize,
  type PatternContext,
} from "./fabricPattern";

describe("normalizeFabricPattern", () => {
  it("sin datos: tela lisa del color base con valores por defecto", () => {
    expect(normalizeFabricPattern(undefined, "#1F2A44")).toEqual({
      kind: "plain",
      colors: ["#1f2a44"],
      stripeWidth: PATTERN_LIMITS.stripeWidth.default,
      spacing: PATTERN_LIMITS.spacing.default,
      direction: "vertical",
    });
  });

  it("tipo desconocido → liso; liso se queda con un solo color", () => {
    const p = normalizeFabricPattern({ kind: "polka" as never, colors: ["#ff0000", "#00ff00"] });
    expect(p.kind).toBe("plain");
    expect(p.colors).toEqual(["#ff0000"]);
  });

  it("rayas con un solo color agregan una raya que contraste", () => {
    expect(normalizeFabricPattern({ kind: "stripes", colors: ["#ffffff"] }).colors).toEqual(["#ffffff", "#1f2937"]);
    expect(normalizeFabricPattern({ kind: "plaid", colors: ["#000000"] }).colors).toEqual(["#000000", "#ffffff"]);
    expect(contrastColor("#fafafa")).toBe("#1f2937");
  });

  it("limpia colores inválidos, respeta el tope y acota grosor/separación", () => {
    const p = normalizeFabricPattern({
      kind: "stripes",
      colors: ["fff", "nope", "#000", "#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
      stripeWidth: 500,
      spacing: -3,
      direction: "horizontal",
    });
    expect(p.colors).toHaveLength(PATTERN_LIMITS.maxColors);
    expect(p.colors[0]).toBe("#ffffff");
    expect(p.stripeWidth).toBe(PATTERN_LIMITS.stripeWidth.max);
    expect(p.spacing).toBe(0);
    expect(p.direction).toBe("horizontal");
    expect(normalizeFabricPattern({ kind: "stripes", stripeWidth: 3.6 }).stripeWidth).toBe(4);
    expect(normalizeFabricPattern({ kind: "stripes", stripeWidth: Number.NaN }).stripeWidth).toBe(
      PATTERN_LIMITS.stripeWidth.default
    );
  });
});

describe("franjas y mosaico", () => {
  const stripes = normalizeFabricPattern({
    kind: "stripes",
    colors: ["#ffffff", "#1f2a44", "#c8102e"],
    stripeWidth: 4,
    spacing: 10,
  });

  it("cada color de raya ocupa grosor + separación", () => {
    expect(patternPeriod(stripes)).toBe(28);
    expect(stripeLayout(stripes)).toEqual([
      { offset: 0, width: 4, color: "#1f2a44" },
      { offset: 14, width: 4, color: "#c8102e" },
    ]);
    expect(stripeLayout(normalizeFabricPattern({}))).toEqual([]);
  });

  it("el mosaico es múltiplo del periodo (repite sin costura)", () => {
    const size = tileSize(stripes, 256);
    expect(size % 28).toBe(0);
    expect(Math.abs(size - 256)).toBeLessThanOrEqual(14);
    expect(tileSize(normalizeFabricPattern({}))).toBe(4);
  });

  function fakeCtx() {
    const calls: { style: unknown; alpha: number; rect: number[] }[] = [];
    const ctx: PatternContext = {
      fillStyle: "",
      globalAlpha: 1,
      fillRect: vi.fn((...rect: number[]) => calls.push({ style: ctx.fillStyle, alpha: ctx.globalAlpha, rect })),
    };
    return { ctx, calls };
  }

  it("rayas verticales u horizontales pintan franjas en esa dirección", () => {
    const { ctx, calls } = fakeCtx();
    drawFabricPattern(ctx, stripes, 56);
    expect(calls[0]).toEqual({ style: "#ffffff", alpha: 1, rect: [0, 0, 56, 56] });
    expect(calls.slice(1).map((c) => c.rect)).toEqual([
      [0, 0, 4, 56],
      [14, 0, 4, 56],
      [28, 0, 4, 56],
      [42, 0, 4, 56],
    ]);
    const h = fakeCtx();
    drawFabricPattern(h.ctx, { ...stripes, direction: "horizontal" }, 28);
    expect(h.calls.slice(1).map((c) => c.rect)).toEqual([
      [0, 0, 28, 4],
      [0, 14, 28, 4],
    ]);
  });

  it("cuadros cruzan franjas en las dos direcciones (las horizontales translúcidas)", () => {
    const { ctx, calls } = fakeCtx();
    drawFabricPattern(ctx, { ...stripes, kind: "plaid" }, 28);
    const vertical = calls.filter((c) => c.rect[3] === 28 && c.rect[2] === 4);
    const horizontal = calls.filter((c) => c.rect[2] === 28 && c.rect[3] === 4);
    expect(vertical).toHaveLength(2);
    expect(horizontal).toHaveLength(2);
    expect(horizontal.every((c) => c.alpha < 1)).toBe(true);
    expect(ctx.globalAlpha).toBe(1);
  });
});
