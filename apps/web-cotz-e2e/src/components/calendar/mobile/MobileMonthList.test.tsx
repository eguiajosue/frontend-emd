import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MobileMonthList } from "./MobileMonthList";
import type { CalendarEvent } from "@/types";

const now = new Date();
const day15 = new Date(now.getFullYear(), now.getMonth(), 15, 10, 0);

const baseEvent: CalendarEvent = {
  id: 1,
  title: "Instalar torniquetes",
  clientName: "MEDLINE",
  clientId: null,
  category: "instalacion",
  eventDate: day15.toISOString(),
  hasTime: true,
  status: "pendiente",
  reminderMinutesBefore: null,
  createdById: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("MobileMonthList", () => {
  it("muestra el encabezado de días de la semana (lunes primero)", () => {
    render(<MobileMonthList events={[]} orders={[]} onSelectDay={() => {}} />);
    const header = ["L", "M", "M", "J", "V", "S", "D"];
    header.forEach((label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
  });

  it("muestra una píldora truncada para un evento del mes actual", () => {
    render(<MobileMonthList events={[baseEvent]} orders={[]} onSelectDay={() => {}} />);
    expect(screen.getByText("Instalar torniquetes")).toBeInTheDocument();
  });

  it("tocar un día (con o sin actividad) llama a onSelectDay con esa fecha", async () => {
    const onSelectDay = vi.fn();
    render(<MobileMonthList events={[baseEvent]} orders={[]} onSelectDay={onSelectDay} />);

    // El "15" del mes actual aparece varias veces en el rango cargado (un
    // día 15 por mes): se apunta por el aria-label con la fecha completa,
    // no por el texto visible del número.
    const label = format(day15, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(onSelectDay).toHaveBeenCalledTimes(1);
    const calledWith = onSelectDay.mock.calls[0][0] as Date;
    expect(calledWith.getDate()).toBe(15);
    expect(calledWith.getMonth()).toBe(day15.getMonth());
  });
});
