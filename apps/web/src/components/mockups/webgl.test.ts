// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isWebGLAvailable } from "./webgl";

describe("isWebGLAvailable", () => {
  const loseContext = vi.fn();

  beforeEach(() => {
    // jsdom no trae WebGL: se simula lo mínimo que mira la detección.
    (window as unknown as Record<string, unknown>).WebGL2RenderingContext = function WebGL2RenderingContext() {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).WebGL2RenderingContext;
    loseContext.mockReset();
  });

  it("true cuando el navegador da un contexto WebGL 2 (y lo libera)", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ getExtension: () => ({ loseContext }) } as unknown as RenderingContext);
    expect(isWebGLAvailable()).toBe(true);
    expect(getContext).toHaveBeenCalledWith("webgl2");
    expect(loseContext).toHaveBeenCalled();
  });

  it("false cuando no hay contexto (GPU bloqueada o aceleración apagada)", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(isWebGLAvailable()).toBe(false);
  });

  it("false cuando pedir el contexto truena", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(isWebGLAvailable()).toBe(false);
  });

  it("false cuando el navegador ni siquiera conoce WebGL 2", () => {
    delete (window as unknown as Record<string, unknown>).WebGL2RenderingContext;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    expect(isWebGLAvailable()).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });
});
