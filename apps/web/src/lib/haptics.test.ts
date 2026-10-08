import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic } from "./haptics";

afterEach(() => vi.unstubAllGlobals());

describe("vibración", () => {
  it("vibra con el patrón pedido y respeta 'reducir movimiento'", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    haptic("success");
    expect(vibrate).toHaveBeenCalledWith([10, 40, 14]);
    vibrate.mockClear();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    haptic();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
