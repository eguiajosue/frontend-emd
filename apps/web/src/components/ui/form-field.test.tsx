import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";
import { Input } from "./input";
import { AnimatedNumber } from "../motion/AnimatedNumber";

describe("FormField: cableado accesible del control", () => {
  it("vincula el error con aria-invalid y aria-describedby", () => {
    render(
      <FormField label="Correo" htmlFor="f-mail" error="Correo no válido">
        <Input id="f-mail" />
      </FormField>
    );
    const input = screen.getByLabelText("Correo");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("f-mail-error");
    expect(screen.getByRole("alert").id).toBe("f-mail-error");
  });

  it("vincula la ayuda cuando no hay error y marca el campo obligatorio", () => {
    render(
      <FormField label="Nombre" htmlFor="f-name" hint="Como en su INE" required>
        <Input id="f-name" />
      </FormField>
    );
    const input = screen.getByLabelText(/Nombre/);
    expect(input.getAttribute("aria-describedby")).toBe("f-name-hint");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(document.getElementById("f-name-hint")?.textContent).toBe("Como en su INE");
  });

  it("conserva el aria-describedby propio y no toca contenedores", () => {
    render(
      <FormField label="Clave" htmlFor="f-key" error="Muy corta">
        <div data-testid="wrap">
          <Input id="f-key" aria-describedby="otro" />
        </div>
      </FormField>
    );
    expect(screen.getByTestId("wrap").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Clave").getAttribute("aria-describedby")).toBe("otro");
  });
});

describe("AnimatedNumber", () => {
  it("expone el valor final como texto para lectores de pantalla", () => {
    render(<AnimatedNumber value={1250} prefix="$" />);
    expect(screen.getByText("$1,250", { selector: ".sr-only" })).toBeTruthy();
  });
});
