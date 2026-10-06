import { createRef, useImperativeHandle, type Ref } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockupCanvasHandle, MockupCanvasProps } from "@/lib/mockups/types";

const webgl = vi.hoisted(() => ({ available: true }));
const fakeHandle: MockupCanvasHandle = {
  exportSheet: vi.fn(async () => ({ dataUrl: "data:image/png;base64,", width: 1600, height: 800 })),
  exportThumbnail: vi.fn(async () => ({ dataUrl: "data:image/jpeg;base64,", width: 400, height: 400 })),
  setView: vi.fn(),
};

vi.mock("./webgl", () => ({ isWebGLAvailable: () => webgl.available }));

// next/dynamic carga three.js de verdad; aquí se cambia por un lienzo falso
// que expone el handle por `canvasRef`, igual que el real.
vi.mock("next/dynamic", () => ({
  default: () =>
    function FakeCanvas({ canvasRef, config }: MockupCanvasProps & { canvasRef?: Ref<MockupCanvasHandle> }) {
      useImperativeHandle(canvasRef, () => fakeHandle, []);
      return <div data-testid="mockup-canvas">{config.garment}</div>;
    },
}));

import MockupCanvasLazy from "./MockupCanvasLazy";

const props: MockupCanvasProps = {
  config: { garment: "cap", colors: { body: "#000000" }, layers: [] },
  selectedLayerId: null,
  onSelectLayer: vi.fn(),
  onPlacementChange: vi.fn(),
  view: "front",
};

describe("MockupCanvasLazy", () => {
  beforeEach(() => {
    webgl.available = true;
  });

  it("sin WebGL muestra el aviso en lugar del lienzo 3D (R3)", () => {
    webgl.available = false;
    const ref = createRef<MockupCanvasHandle>();
    render(<MockupCanvasLazy ref={ref} {...props} />);
    expect(screen.getByText("Tu navegador no puede mostrar 3D")).toBeInTheDocument();
    expect(screen.getByText(/aceleración por hardware/)).toBeInTheDocument();
    expect(screen.queryByTestId("mockup-canvas")).not.toBeInTheDocument();
    expect(ref.current).toBeNull();
  });

  it("con WebGL monta el lienzo y reenvía el ref (exportSheet / setView)", async () => {
    const ref = createRef<MockupCanvasHandle>();
    render(<MockupCanvasLazy ref={ref} {...props} />);
    expect(await screen.findByTestId("mockup-canvas")).toHaveTextContent("cap");
    expect(screen.queryByText("Tu navegador no puede mostrar 3D")).not.toBeInTheDocument();
    ref.current?.setView("back");
    expect(fakeHandle.setView).toHaveBeenCalledWith("back");
    await expect(ref.current!.exportSheet()).resolves.toMatchObject({ width: 1600, height: 800 });
  });
});
