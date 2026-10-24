import type { AreaField } from "@emd/types";

/** Valores del formulario de datos propios: como se teclean o eligen (texto vacío = sin dato). */
export type FieldFormValues = Record<string, string | number | boolean | undefined>;

type Saved = Record<string, string | number | boolean>;

/** Valor listo para el backend: número para los numéricos, y "" o undefined = sin dato. */
function normalize(field: AreaField, value: FieldFormValues[string]): string | number | boolean | null {
  if (value === undefined || value === "") return null;
  if (field.type === "number") {
    const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (field.type === "boolean") return value === true;
  return typeof value === "string" ? value.trim() || null : String(value);
}

/**
 * Lo que cambió respecto a lo guardado, listo para `PATCH .../fields`: clave →
 * valor nuevo, o `null` para borrar el dato. Un sí/no apagado que nunca se
 * capturó no cuenta como cambio.
 */
export function fieldValuesChanges(
  fields: readonly AreaField[],
  saved: Saved,
  form: FieldFormValues
): Record<string, string | number | boolean | null> {
  const changes: Record<string, string | number | boolean | null> = {};
  for (const field of fields) {
    const next = normalize(field, form[field.key]);
    const before = saved[field.key] ?? null;
    if (field.type === "boolean" && before === null && next === false) continue;
    if (next !== before) changes[field.key] = next;
  }
  return changes;
}

/** Valor para mostrar ("PLA", "12 cm", "Sí", "—"). */
export function formatFieldValue(field: AreaField, value: string | number | boolean | undefined): string {
  if (value === undefined || value === "") return "—";
  if (field.type === "boolean") return value ? "Sí" : "No";
  return field.unit ? `${value} ${field.unit}` : String(value);
}

/** Datos obligatorios que todavía no tienen valor (sin ellos no se puede empezar). */
export function missingRequiredFields(fields: readonly AreaField[], saved: Saved | null | undefined): AreaField[] {
  return fields.filter((f) => f.required && (saved?.[f.key] === undefined || saved[f.key] === ""));
}
