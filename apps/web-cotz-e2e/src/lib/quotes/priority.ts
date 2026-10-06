/**
 * Prioridad de una cotización. Se guarda como fecha (`priorityDate`,
 * `YYYY-MM-DD`) y no como texto: "Hoy" capturado ayer hoy se lee "Atrasada",
 * en vez de seguir diciendo "Hoy" para siempre.
 *
 * Todo en la fecha LOCAL del navegador (el día de Recepción), nunca en UTC:
 * a las 7 p. m. en México ya es "mañana" en UTC.
 */

export type PriorityChoice = "hoy" | "manana" | "normal";

/** Cómo se lee una fecha de prioridad respecto de hoy. */
export type PriorityTone = "atrasada" | "hoy" | "manana" | "futura";

export const PRIORITY_CHOICE_LABELS: Record<PriorityChoice, string> = {
  hoy: "Hoy",
  manana: "Mañana",
  normal: "Normal",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` de la fecha local de `date`. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` de `days` días después (o antes) de la fecha local de `now`. */
export function localDateKeyPlusDays(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return localDateKey(d);
}

/** Fecha a guardar para cada opción del alta: Hoy → hoy, Mañana → mañana, Normal → null. */
export function priorityDateFor(choice: PriorityChoice, now: Date = new Date()): string | null {
  if (choice === "hoy") return localDateKey(now);
  if (choice === "manana") return localDateKeyPlusDays(now, 1);
  return null;
}

/**
 * Tono del chip: anterior a hoy → atrasada; hoy; mañana; después → futura.
 * `null` = prioridad normal (sin chip). Compara textos `YYYY-MM-DD`, que
 * ordenan igual que las fechas.
 */
export function priorityTone(priorityDate: string | null | undefined, now: Date = new Date()): PriorityTone | null {
  if (!priorityDate) return null;
  const today = localDateKey(now);
  if (priorityDate < today) return "atrasada";
  if (priorityDate === today) return "hoy";
  if (priorityDate === localDateKeyPlusDays(now, 1)) return "manana";
  return "futura";
}

/** Opción del alta que corresponde a una fecha guardada (null si es otra fecha). */
export function priorityChoiceOf(priorityDate: string | null | undefined, now: Date = new Date()): PriorityChoice | null {
  const tone = priorityTone(priorityDate, now);
  if (tone === null) return "normal";
  if (tone === "hoy" || tone === "manana") return tone;
  return null;
}

const SHORT_DATE = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/** "3 oct" a partir de `YYYY-MM-DD` (sin pasar por UTC). */
export function shortDateLabel(priorityDate: string): string {
  const [y, m, d] = priorityDate.split("-").map(Number);
  return SHORT_DATE.format(new Date(y, m - 1, d)).replace(".", "");
}

/** Texto del chip de prioridad. */
export function priorityLabel(priorityDate: string, now: Date = new Date()): string {
  const tone = priorityTone(priorityDate, now);
  if (tone === "atrasada") return "Atrasada";
  if (tone === "hoy") return "Hoy";
  if (tone === "manana") return "Mañana";
  return `Para el ${shortDateLabel(priorityDate)}`;
}
