import { describe, expect, it } from "vitest";
import { PULL_THRESHOLD, pullDistance } from "./PullToRefresh";

describe("jalar para actualizar", () => {
  it("sigue al dedo con resistencia y nunca pasa del tope", () => {
    expect(pullDistance(-20)).toBe(0);
    expect(pullDistance(50)).toBe(30);
    expect(pullDistance(PULL_THRESHOLD)).toBeCloseTo(48);
    expect(pullDistance(PULL_THRESHOLD + 40)).toBeCloseTo(58);
    expect(pullDistance(2000)).toBe(140);
  });
});
