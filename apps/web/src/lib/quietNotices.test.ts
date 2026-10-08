import { afterEach, describe, expect, it, vi } from "vitest";
import { isCompactScreen, quietNotice } from "./quietNotices";

afterEach(() => vi.unstubAllGlobals());

describe("avisos discretos en el teléfono", () => {
  it("detecta pantalla de teléfono", () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("767px") }) });
    expect(isCompactScreen()).toBe(true);
  });
  it("sólo vibra si es importante", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    quietNotice();
    expect(vibrate).not.toHaveBeenCalled();
    quietNotice(true);
    expect(vibrate).toHaveBeenCalledWith(60);
  });
});
