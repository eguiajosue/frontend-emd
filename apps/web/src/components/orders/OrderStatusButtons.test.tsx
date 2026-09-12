import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderStatusButtons } from "./OrderStatusButtons";

describe("OrderStatusButtons", () => {
  it("ofrece los cinco estados de producción", () => {
    render(
      <OrderStatusButtons currentStatusId={1} canChange onChange={() => {}} />,
    );
    ["pendiente", "en proceso", "terminado", "entregado", "cancelado"].forEach(
      (label) => expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );
  });

  it("no ofrece los estados del circuito de diseño", () => {
    // Se llega a ellos sólo con las acciones de "Proceso de diseño", nunca a
    // mano: mezclarlos acá permitiría saltear la autorización del cliente.
    render(
      <OrderStatusButtons currentStatusId={1} canChange onChange={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "en diseño" })).toBeNull();
    expect(screen.queryByRole("button", { name: "autorizado" })).toBeNull();
  });

  it("aplica el estado que se elige", async () => {
    const onChange = vi.fn();
    render(
      <OrderStatusButtons currentStatusId={1} canChange onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "en proceso" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("el estado actual queda marcado y no se puede volver a elegir", async () => {
    const onChange = vi.fn();
    render(
      <OrderStatusButtons currentStatusId={3} canChange onChange={onChange} />,
    );
    const actual = screen.getByRole("button", { name: "en proceso" });
    expect(actual).toHaveAttribute("aria-pressed", "true");
    expect(actual).toBeDisabled();
    await userEvent.click(actual);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sin permiso los botones se ven pero no se pueden usar", async () => {
    // Deshabilitados, no ocultos: que quede claro que la acción existe y que
    // el problema es de permisos.
    const onChange = vi.fn();
    render(
      <OrderStatusButtons currentStatusId={1} canChange={false} onChange={onChange} />,
    );
    const otro = screen.getByRole("button", { name: "terminado" });
    expect(otro).toBeInTheDocument();
    expect(otro).toBeDisabled();
    expect(otro).toHaveAttribute(
      "title",
      "Sin permiso para cambiar el estado de este pedido",
    );
    await userEvent.click(otro);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mientras se guarda no acepta otro click", async () => {
    const onChange = vi.fn();
    render(
      <OrderStatusButtons currentStatusId={1} canChange isChanging onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "terminado" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("con allowedStatusIds, los estados fuera de la lista quedan deshabilitados aunque canChange sea true", async () => {
    // Caso real: producción puede cambiar el estado (está en su etapa), pero
    // "entregado"/"cancelado" son de Recepción — el botón no debe ofrecerse
    // como si fuera a funcionar.
    const onChange = vi.fn();
    render(
      <OrderStatusButtons
        currentStatusId={4}
        canChange
        allowedStatusIds={[1, 3, 4]}
        onChange={onChange}
      />,
    );
    const entregado = screen.getByRole("button", { name: "entregado" });
    expect(entregado).toBeDisabled();
    expect(entregado).toHaveAttribute(
      "title",
      "Tu rol no puede mover el pedido a este estado",
    );
    await userEvent.click(entregado);
    expect(onChange).not.toHaveBeenCalled();

    const enProceso = screen.getByRole("button", { name: "en proceso" });
    expect(enProceso).not.toBeDisabled();
    await userEvent.click(enProceso);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("sin allowedStatusIds, se permiten todos los estados (comportamiento por defecto)", () => {
    render(
      <OrderStatusButtons currentStatusId={1} canChange onChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "entregado" })).not.toBeDisabled();
  });
});
