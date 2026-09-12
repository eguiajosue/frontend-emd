import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MobileDayWeekView } from "./MobileDayWeekView";

// FullCalendar necesita mediciones de layout reales (ancho de columnas,
// `dayMinWidth`) que jsdom no puede dar ("No ScrollGrid implementation"
// al forzar el scroll horizontal) — se stubea acá para poder testear la
// tira de días y el botón de volver sin depender de la librería, mismo
// criterio que ya se usa para no testear `TimeGridCalendar` directo.
vi.mock("@fullcalendar/react", () => ({
  default: () => <div data-testid="fullcalendar-stub" />,
}));

const selectedDate = new Date(2026, 8, 22); // martes 22 de sep 2026

describe("MobileDayWeekView", () => {
  it("muestra la tira de 7 días de la semana, con el día seleccionado marcado", () => {
    render(
      <MobileDayWeekView
        events={[]}
        orders={[]}
        initialDate={selectedDate}
        onBack={() => {}}
        onAddAt={() => {}}
        onEdit={() => {}}
        onSelectOrder={() => {}}
      />
    );

    const selectedLabel = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
    const selectedButton = screen.getByRole("button", { name: selectedLabel });
    expect(selectedButton).toHaveAttribute("aria-current", "date");

    // El resto de la semana está presente pero no marcado como actual.
    const otherDay = new Date(2026, 8, 23);
    const otherLabel = format(otherDay, "EEEE d 'de' MMMM", { locale: es });
    expect(screen.getByRole("button", { name: otherLabel })).not.toHaveAttribute("aria-current");
  });

  it("tocar el botón de volver llama a onBack", async () => {
    const onBack = vi.fn();
    render(
      <MobileDayWeekView
        events={[]}
        orders={[]}
        initialDate={selectedDate}
        onBack={onBack}
        onAddAt={() => {}}
        onEdit={() => {}}
        onSelectOrder={() => {}}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Volver al mes" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("tocar otro día de la tira lo marca como seleccionado", async () => {
    render(
      <MobileDayWeekView
        events={[]}
        orders={[]}
        initialDate={selectedDate}
        onBack={() => {}}
        onAddAt={() => {}}
        onEdit={() => {}}
        onSelectOrder={() => {}}
      />
    );

    const otherDay = new Date(2026, 8, 24);
    const otherLabel = format(otherDay, "EEEE d 'de' MMMM", { locale: es });
    await userEvent.click(screen.getByRole("button", { name: otherLabel }));

    expect(screen.getByRole("button", { name: otherLabel })).toHaveAttribute("aria-current", "date");
  });
});
