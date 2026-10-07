import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BranchLogo } from "./BranchLogo";
import { BranchBadge } from "./BranchBadge";

const NEGRO = "data:image/png;base64,NEGRO";
const BLANCO = "data:image/png;base64,BLANCO";

let logos: Record<number, { logoOnLight: string | null; logoOnDark: string | null }> = {};
const hook = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@/hooks/useBranchLogos", () => ({
  useBranchLogos: () => {
    hook.calls += 1;
    return { getLogos: (id: number) => logos[id], logos: [], isLoading: false, isError: false };
  },
}));

beforeEach(() => {
  logos = { 1: { logoOnLight: NEGRO, logoOnDark: BLANCO } };
  hook.calls = 0;
});

describe("BranchLogo", () => {
  it("no dibuja nada (ni toca los logos) con un pedido de la matriz", () => {
    const { container } = render(<BranchLogo branchId={null} name={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(hook.calls).toBe(0);
  });

  it("auto: dos imágenes, la negra para tema claro y la blanca para oscuro, con el nombre como alt", () => {
    render(<BranchLogo branchId={1} name="Punto Madero" />);
    const imgs = screen.getAllByAltText("Punto Madero");
    expect(imgs).toHaveLength(2);
    const [claro, oscuro] = imgs;
    expect(claro).toHaveAttribute("src", NEGRO);
    expect(claro).toHaveClass("dark:hidden");
    expect(oscuro).toHaveAttribute("src", BLANCO);
    expect(oscuro).toHaveClass("hidden", "dark:block");
    // Impreso desde el navegador (papel blanco): siempre la clara.
    expect(claro).toHaveClass("print:block");
    expect(oscuro).toHaveClass("print:hidden");
  });

  it("surface=light usa sólo el logo negro; surface=dark sólo el blanco", () => {
    const { rerender } = render(<BranchLogo branchId={1} name="Punto Madero" surface="light" />);
    expect(screen.getByAltText("Punto Madero")).toHaveAttribute("src", NEGRO);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    rerender(<BranchLogo branchId={1} name="Punto Madero" surface="dark" />);
    expect(screen.getByAltText("Punto Madero")).toHaveAttribute("src", BLANCO);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("alto fijo con object-contain y carga diferida (sin saltos de layout)", () => {
    render(<BranchLogo branchId={1} name="Punto Madero" surface="light" size="lg" />);
    const img = screen.getByAltText("Punto Madero");
    expect(img).toHaveClass("h-8", "object-contain");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("loading=eager para donde el logo es lo primero que se ve", () => {
    render(<BranchLogo branchId={1} name="Punto Madero" surface="light" loading="eager" />);
    expect(screen.getByAltText("Punto Madero")).toHaveAttribute("loading", "eager");
  });

  it("sin logo cargado cae al badge con el nombre", () => {
    logos = { 1: { logoOnLight: null, logoOnDark: null } };
    render(<BranchLogo branchId={1} name="Punto Madero" />);
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Punto Madero");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("sucursal sin entrada en los logos (o aún sin cargar) también muestra el nombre", () => {
    logos = {};
    render(<BranchLogo branchId={7} name="Plaza Norte" />);
    expect(screen.getByTestId("branch-badge")).toHaveTextContent("Plaza Norte");
  });

  it("sólo hay logo negro: en fondo oscuro fijo va sobre un chip blanco", () => {
    logos = { 1: { logoOnLight: NEGRO, logoOnDark: null } };
    render(<BranchLogo branchId={1} name="Punto Madero" surface="dark" />);
    const img = screen.getByAltText("Punto Madero");
    expect(img).toHaveAttribute("src", NEGRO);
    expect(img.parentElement).toHaveClass("bg-white");
    expect(screen.getByTestId("branch-logo")).toHaveAttribute("data-logo-variant", "light-chip");
  });

  it("sólo hay logo blanco: en fondo claro fijo va sobre un chip oscuro", () => {
    logos = { 1: { logoOnLight: null, logoOnDark: BLANCO } };
    render(<BranchLogo branchId={1} name="Punto Madero" surface="light" />);
    expect(screen.getByAltText("Punto Madero").parentElement).toHaveClass("bg-neutral-900");
  });

  it("el badge de texto en fondo oscuro usa colores claros", () => {
    logos = {};
    render(<BranchLogo branchId={1} name="Punto Madero" surface="dark" />);
    expect(screen.getByTestId("branch-badge")).toHaveClass("text-white/90");
  });
});

describe("BranchBadge (pedido → logo)", () => {
  it("resuelve el logo por order.branch.id", () => {
    render(<BranchBadge order={{ branch: { id: 1, name: "Punto Madero" } }} surface="dark" />);
    expect(screen.getByAltText("Punto Madero")).toHaveAttribute("src", BLANCO);
  });

  it("no muestra nada en los pedidos de la matriz", () => {
    const { container } = render(<BranchBadge order={{ branch: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
