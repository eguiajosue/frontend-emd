import { describe, expect, it } from "vitest";
import {
  buildContinuousWeeks,
  extendRangeBackward,
  extendRangeForward,
  initialMonthRange,
  MAX_LOADED_MONTHS,
  MONTH_LOAD_STEP,
  weekDaysFor,
} from "./mobileCalendarUtils";

describe("initialMonthRange", () => {
  it("centra el rango en el mes de anchor, con before/after meses a cada lado", () => {
    const range = initialMonthRange(new Date(2026, 4, 15), 2, 2); // mayo 2026
    expect(range.start).toEqual(new Date(2026, 2, 1)); // marzo
    expect(range.end).toEqual(new Date(2026, 6, 1)); // julio
  });
});

describe("extendRangeBackward / extendRangeForward", () => {
  it("suma meses al principio/final del rango", () => {
    const range = initialMonthRange(new Date(2026, 4, 15), 1, 1); // abr-jun 2026
    const backward = extendRangeBackward(range, 2)!;
    expect(backward.start).toEqual(new Date(2026, 1, 1)); // febrero
    expect(backward.end).toEqual(range.end);

    const forward = extendRangeForward(range, 2)!;
    expect(forward.start).toEqual(range.start);
    expect(forward.end).toEqual(new Date(2026, 7, 1)); // agosto
  });

  it("no supera MAX_LOADED_MONTHS: devuelve null en el techo", () => {
    // Rango que ya ocupa el máximo permitido.
    const range = { start: new Date(2020, 0, 1), end: new Date(2020, 0 + MAX_LOADED_MONTHS - 1, 1) };
    expect(extendRangeBackward(range)).toBeNull();
    expect(extendRangeForward(range)).toBeNull();
  });

  it("cerca del techo, extiende sólo lo que queda de margen en vez de fallar", () => {
    const range = { start: new Date(2020, 0, 1), end: new Date(2020, 0 + MAX_LOADED_MONTHS - 2, 1) };
    const extended = extendRangeForward(range, MONTH_LOAD_STEP)!;
    expect(extended).not.toBeNull();
    // Sólo avanzó el margen disponible (1 mes), no los 3 pedidos.
    expect(extended.end).toEqual(new Date(2020, 0 + MAX_LOADED_MONTHS - 1, 1));
  });
});

describe("buildContinuousWeeks", () => {
  it("cubre el rango completo en semanas de lunes a domingo, sin huecos ni duplicados", () => {
    const range = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 1) }; // sólo mayo 2026
    const weeks = buildContinuousWeeks(range);

    weeks.forEach((week) => expect(week.days).toHaveLength(7));
    // Mayo 2026 empieza viernes: la primera semana arranca el lunes 27 de abril.
    expect(weeks[0].days[0]).toEqual(new Date(2026, 3, 27));
    // Termina domingo 31 de mayo.
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek.days[6]).toEqual(new Date(2026, 4, 31));
  });

  it("etiqueta con el nombre del mes sólo la semana que contiene el día 1 (y la primera semana de la lista)", () => {
    const range = { start: new Date(2026, 4, 1), end: new Date(2026, 5, 1) }; // mayo-junio 2026
    const weeks = buildContinuousWeeks(range);

    const labeled = weeks.filter((w) => w.monthLabel !== null);
    // La primera semana (aunque no arranque el mes exacto) + la semana del 1 de junio.
    expect(labeled).toHaveLength(2);
    expect(labeled[0].monthLabel).toMatch(/mayo/i);
    expect(labeled[1].monthLabel).toMatch(/junio/i);
  });
});

describe("weekDaysFor", () => {
  it("devuelve los 7 días lunes a domingo de la semana de la fecha dada", () => {
    // Viernes 22 de mayo 2026 -> semana del lunes 18 al domingo 24.
    const days = weekDaysFor(new Date(2026, 4, 22));
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual(new Date(2026, 4, 18));
    expect(days[6]).toEqual(new Date(2026, 4, 24));
  });
});
