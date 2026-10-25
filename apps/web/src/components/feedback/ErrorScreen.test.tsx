import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@emd/api-client";
import { ErrorScreen, ForbiddenScreen, NotFoundScreen, UnauthorizedScreen, variantForError } from "./ErrorScreen";
import { FieldError, fieldErrorId } from "./FieldError";
import { InlineError } from "./InlineError";
import { ErrorState } from "./states";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}));

describe("ErrorScreen", () => {
  it("404 muestra copy en español y vuelve al inicio por defecto", () => {
    render(<NotFoundScreen layout="section" />);
    expect(screen.getByRole("heading", { name: /No encontramos esta página/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver al inicio/i }).getAttribute("href")).toBe("/dashboard");
  });

  it("401 lleva a iniciar sesión", () => {
    render(<UnauthorizedScreen layout="section" plainLinks />);
    expect(screen.getByRole("heading", { name: /sesión expiró/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Iniciar sesión/i }).getAttribute("href")).toBe("/login");
  });

  it("403 explica la falta de permisos", () => {
    render(<ForbiddenScreen layout="section" />);
    expect(screen.getByRole("heading", { name: /No tienes permiso/i })).toBeTruthy();
  });

  it("500 es un alert con reintento y referencia copiable", () => {
    const retry = vi.fn();
    render(
      <ErrorScreen variant="500" digest="abc123" primary={{ label: "Reintentar", onClick: retry }} />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("abc123")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copiar referencia/i })).toBeTruthy();
  });

  it("permite quitar las acciones (enlaces vencidos)", () => {
    render(<ErrorScreen variant="expired" layout="inline" primary={null} secondary={null} />);
    expect(screen.getByRole("heading", { name: /ya venció/i })).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("usa h1 a pantalla completa y h2 dentro del dashboard", () => {
    const { unmount } = render(<ErrorScreen variant="offline" layout="page" animate={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    unmount();
    render(<ErrorScreen variant="offline" layout="section" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  });
});

describe("variantForError", () => {
  it("elige la pantalla según el error", () => {
    expect(variantForError(new ApiError("x", 404))).toBe("404");
    expect(variantForError(new ApiError("x", 403))).toBe("403");
    expect(variantForError(new ApiError("x", 429))).toBe("429");
    expect(variantForError(new ApiError("x", 503))).toBe("503");
    expect(variantForError(new ApiError("x", 410))).toBe("expired");
    expect(variantForError(new ApiError("x", 500))).toBe("500");
    expect(variantForError(new Error("boom"))).toBe("500");
  });
});

describe("InlineError", () => {
  it("toma el mensaje del catálogo y ofrece reintentar si es recuperable", () => {
    const retry = vi.fn();
    render(<InlineError error={new ApiError("Service Unavailable", 503)} onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toMatch(/mantenimiento/i);
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("no ofrece reintentar un 403", () => {
    render(<InlineError error={new ApiError("Forbidden", 403)} onRetry={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("acepta texto propio", () => {
    render(<InlineError message="No se pudo guardar." />);
    expect(screen.getByText("No se pudo guardar.")).toBeTruthy();
  });
});

describe("FieldError", () => {
  it("no renderiza sin mensaje", () => {
    const { container } = render(<FieldError id="email" message={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("se vincula con el campo por id", () => {
    render(<FieldError id="email" message="Ingresar un correo válido" />);
    const el = screen.getByRole("alert");
    expect(el.id).toBe(fieldErrorId("email"));
    expect(el.textContent).toContain("Ingresar un correo válido");
  });
});

describe("ErrorState con error real", () => {
  it("usa el catálogo y oculta el reintento cuando no tiene sentido", () => {
    render(<ErrorState error={new ApiError("Forbidden", 403)} onRetry={() => undefined} />);
    expect(screen.getByText(/No tienes permiso/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
  });

  it("sin error conserva los textos por defecto", () => {
    render(<ErrorState onRetry={() => undefined} />);
    expect(screen.getByText("No se pudo cargar la información")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
  });
});
