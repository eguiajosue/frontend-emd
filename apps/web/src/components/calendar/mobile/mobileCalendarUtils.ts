import {
  addMonths,
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";

/**
 * Utilidades puras de la lista de meses mobile (scroll infinito de semanas
 * compactas, estilo Calendario de Apple). Separadas de `MobileMonthList.tsx`
 * para poder testear la lógica de rango/semanas sin montar React.
 */

/** Cuántos meses se suman de una vez al llegar al borde de la lista cargada. */
export const MONTH_LOAD_STEP = 3;

/**
 * Techo de meses cargados en total (a cada lado se puede extender hasta acá).
 * El scroll "se siente" infinito en el uso normal; esto sólo evita que una
 * sesión larga sin cerrar la pestaña acumule DOM sin límite.
 */
export const MAX_LOADED_MONTHS = 36;

export interface MonthRange {
  /** Primer día del primer mes cargado. */
  start: Date;
  /** Primer día del último mes cargado. */
  end: Date;
}

/** Rango inicial: el mes de `anchor` con `before`/`after` meses a cada lado. */
export function initialMonthRange(anchor: Date, before = 2, after = 2): MonthRange {
  return {
    start: startOfMonth(subMonths(anchor, before)),
    end: startOfMonth(addMonths(anchor, after)),
  };
}

function totalMonths(range: MonthRange): number {
  return differenceInCalendarMonths(range.end, range.start) + 1;
}

/** Suma meses antes del rango, hasta `MAX_LOADED_MONTHS`; `null` si ya está en el techo. */
export function extendRangeBackward(range: MonthRange, months = MONTH_LOAD_STEP): MonthRange | null {
  if (totalMonths(range) >= MAX_LOADED_MONTHS) return null;
  const room = MAX_LOADED_MONTHS - totalMonths(range);
  const step = Math.min(months, room);
  if (step <= 0) return null;
  return { start: subMonths(range.start, step), end: range.end };
}

/** Suma meses después del rango, hasta `MAX_LOADED_MONTHS`; `null` si ya está en el techo. */
export function extendRangeForward(range: MonthRange, months = MONTH_LOAD_STEP): MonthRange | null {
  if (totalMonths(range) >= MAX_LOADED_MONTHS) return null;
  const room = MAX_LOADED_MONTHS - totalMonths(range);
  const step = Math.min(months, room);
  if (step <= 0) return null;
  return { start: range.start, end: addMonths(range.end, step) };
}

export interface CompactWeek {
  /** Lunes de esta semana (clave estable para `key` en React). */
  weekStart: Date;
  /** Los 7 días de la semana, lunes a domingo. */
  days: Date[];
  /**
   * Nombre del mes a mostrar como etiqueta arriba de esta fila, o `null` si
   * no corresponde (la mayoría de las semanas no arrancan un mes nuevo).
   */
  monthLabel: string | null;
}

/**
 * Arma la lista continua de semanas (lunes a domingo) que cubre `range`, sin
 * duplicar la semana que cae a caballo entre dos meses. Cada semana que
 * contiene el día 1 de un mes (o es la primera semana de toda la lista) lleva
 * ese mes como etiqueta, para el pequeño rótulo inline que reemplaza el
 * encabezado grande de un mes a la vez.
 */
export function buildContinuousWeeks(range: MonthRange): CompactWeek[] {
  const start = startOfWeek(range.start, { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(range.end), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });

  // Las semanas de borde se completan hasta lunes/domingo y pueden colarse
  // días de un mes fuera del rango pedido (ej. el 1 de julio en la última
  // semana de un rango que termina en junio): no cuenta como "el mes empieza
  // acá", así que se descarta si su propio mes cae fuera de `range`.
  const rangeStartMonth = startOfMonth(range.start);
  const rangeEndMonth = startOfMonth(range.end);
  const isMonthInRange = (date: Date) => {
    const month = startOfMonth(date);
    return month >= rangeStartMonth && month <= rangeEndMonth;
  };

  const weeks: CompactWeek[] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    const days = allDays.slice(i, i + 7);
    const firstOfMonth = days.find((d) => d.getDate() === 1 && isMonthInRange(d));
    const isFirstWeek = weeks.length === 0;
    const labelSource = firstOfMonth ?? (isFirstWeek ? days[days.length - 1] : null);
    weeks.push({
      weekStart: days[0],
      days,
      monthLabel: labelSource ? capitalize(format(labelSource, "MMMM yyyy", { locale: es })) : null,
    });
  }
  return weeks;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Los 7 días (lunes a domingo) de la semana que contiene `date` — para la tira de días de `MobileDayWeekView`. */
export function weekDaysFor(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: endOfWeek(date, { weekStartsOn: 1 }) });
}
