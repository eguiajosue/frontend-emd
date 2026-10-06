import { describe, expect, it } from "vitest";
import {
  localDateKey,
  priorityChoiceOf,
  priorityDateFor,
  priorityLabel,
  priorityTone,
} from "./priority";

describe("prioridad de cotizaciones", () => {
  // 11:59 p. m. local: en UTC (México) ya es el día siguiente.
  const lateNight = new Date(2026, 9, 5, 23, 59, 0);

  it("usa la fecha local, no UTC", () => {
    expect(localDateKey(lateNight)).toBe("2026-10-05");
    expect(priorityDateFor("hoy", lateNight)).toBe("2026-10-05");
    expect(priorityDateFor("manana", lateNight)).toBe("2026-10-06");
    expect(priorityDateFor("normal", lateNight)).toBeNull();
  });

  it("cambio de mes y de año", () => {
    expect(priorityDateFor("manana", new Date(2026, 9, 31, 12))).toBe("2026-11-01");
    expect(priorityDateFor("manana", new Date(2026, 11, 31, 12))).toBe("2027-01-01");
  });

  it("tonos: atrasada, hoy, mañana, futura, normal", () => {
    const now = new Date(2026, 9, 5, 9);
    expect(priorityTone("2026-10-04", now)).toBe("atrasada");
    expect(priorityTone("2026-10-05", now)).toBe("hoy");
    expect(priorityTone("2026-10-06", now)).toBe("manana");
    expect(priorityTone("2026-10-09", now)).toBe("futura");
    expect(priorityTone(null, now)).toBeNull();
    expect(priorityLabel("2026-10-09", now)).toBe("Para el 9 oct");
  });

  it("opción del formulario a partir de la fecha guardada", () => {
    const now = new Date(2026, 9, 5, 9);
    expect(priorityChoiceOf(null, now)).toBe("normal");
    expect(priorityChoiceOf("2026-10-05", now)).toBe("hoy");
    expect(priorityChoiceOf("2026-10-06", now)).toBe("manana");
    expect(priorityChoiceOf("2026-10-01", now)).toBeNull();
  });
});
