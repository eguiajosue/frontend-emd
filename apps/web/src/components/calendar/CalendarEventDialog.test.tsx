import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarEventDialog } from "./CalendarEventDialog";
import type { CalendarEvent } from "@/types";

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
}));

vi.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEventMutations: () => ({ create: createMock, update: updateMock }),
}));

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 1 });
  updateMock.mockReset();
  updateMock.mockResolvedValue({ id: 1 });
});

describe("CalendarEventDialog", () => {
  it("no deja crear un evento sin título", async () => {
    render(<CalendarEventDialog open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/Fecha/), "2026-09-20");
    await userEvent.click(screen.getByRole("button", { name: /Crear evento/i }));

    expect(await screen.findByText("El título es obligatorio")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crea un evento con fecha y hora (caso mínimo)", async () => {
    const onSaved = vi.fn();
    render(<CalendarEventDialog open onClose={() => {}} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/Qué hay que hacer/), "Instalar anuncio");
    await userEvent.type(screen.getByLabelText(/^Fecha/), "2026-09-20");
    await userEvent.type(screen.getByLabelText(/^Hora/), "15:00");
    await userEvent.click(screen.getByRole("button", { name: /Crear evento/i }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Instalar anuncio",
        hasTime: true,
        reminderMinutesBefore: undefined,
      })
    );
    const payload = createMock.mock.calls[0][0];
    expect(new Date(payload.eventDate).toISOString().slice(11, 16)).toBe("15:00");
  });

  it('con "Todo el día" activado, no manda hora y hasTime queda false', async () => {
    render(<CalendarEventDialog open onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText(/Qué hay que hacer/), "Visita a planta");
    await userEvent.type(screen.getByLabelText(/^Fecha/), "2026-09-20");
    await userEvent.click(screen.getByRole("switch", { name: /Todo el día/i }));

    // Al activar "todo el día" el campo Hora desaparece del formulario.
    expect(screen.queryByLabelText(/^Hora/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Crear evento/i }));

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ hasTime: false }));
  });

  it("convierte el recordatorio adicional a minutos antes de mandarlo (3 días antes)", async () => {
    render(<CalendarEventDialog open onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText(/Qué hay que hacer/), "Visita a planta");
    await userEvent.type(screen.getByLabelText(/^Fecha/), "2026-09-20");
    await userEvent.click(screen.getByRole("switch", { name: /Recordatorio adicional/i }));

    const amountInput = screen.getByLabelText("Cantidad de anticipación del recordatorio");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "3");
    // La unidad por defecto ya es "Días antes" (ver estado inicial del diálogo).

    await userEvent.click(screen.getByRole("button", { name: /Crear evento/i }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ reminderMinutesBefore: 3 * 60 * 24 })
    );
  });

  it("en modo edición, precarga los datos del evento y manda un update", async () => {
    const event: CalendarEvent = {
      id: 7,
      title: "Entregar sello",
      clientName: "NLDC",
      clientId: null,
      eventDate: "2026-09-20T11:00:00.000Z",
      hasTime: true,
      status: "pendiente",
      reminderMinutesBefore: null,
      createdById: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    render(<CalendarEventDialog open onClose={() => {}} event={event} />);

    expect(screen.getByDisplayValue("Entregar sello")).toBeInTheDocument();
    expect(screen.getByText("Editar evento")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(updateMock).toHaveBeenCalledWith(7, expect.objectContaining({ title: "Entregar sello" }));
  });
});
