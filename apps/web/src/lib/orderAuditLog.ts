/**
 * Redacción del "Historial de cambios" de un pedido (GET /orders/:id/audit-log).
 *
 * Cada entrada del log se convierte en una o más oraciones en español —una por
 * campo modificado— del estilo:
 *
 *   "Ana cambió el estado de 'en diseño' a 'terminado'"
 *
 * Nunca se muestran nombres crudos de columnas ni ids: los catálogos
 * (estado/usuario/cliente) se resuelven contra el diccionario `labels` que
 * manda el backend, con fallback local (`statusLabel`, que también conoce los
 * estados retirados del flujo) para que el historial viejo siga siendo legible.
 */

import { format, formatDistance, isSameDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { getAreaLabel } from "@/lib/areas";
import { statusLabel } from "@/lib/orderStatus";
import { getAssignedUserName } from "@/lib/format";
import type { AssignedUser, OrderAuditLogEntry } from "@/types";

/** Una línea del historial, ya redactada. */
export interface AuditLogLine {
  /** Clave estable para React. */
  key: string;
  /** Quién hizo el cambio ("Ana Pérez", "Usuario eliminado"). */
  actorName: string;
  /** Inicial(es) para el avatar. */
  actorInitials: string;
  /** Qué hizo, sin el sujeto: "cambió el estado de 'x' a 'y'". */
  action: string;
  /** Oración completa, sin la marca de tiempo. */
  sentence: string;
  /** Marca de tiempo relativa: "hace 2 horas", "ayer". */
  relativeTime: string;
  /** Fecha y hora absolutas, para el `title` (tooltip nativo). */
  absoluteTime: string;
  createdAt: string;
}

const MAX_TEXT_LENGTH = 80;

type ValueKind = "status" | "user" | "client" | "area" | "boolean" | "date" | "text";

interface FieldMeta {
  /** Etiqueta con artículo: "el estado", "la fecha de entrega". */
  label: string;
  kind: ValueKind;
  /** Frase alternativa cuando no había valor previo. */
  setPhrase?: (value: string) => string;
  /** Frase alternativa cuando el valor nuevo queda vacío. */
  unsetPhrase?: () => string;
}

/** Todos los campos que `OrderService.update()` puede auditar. */
const FIELDS: Record<string, FieldMeta> = {
  statusId: { label: "el estado", kind: "status" },
  description: { label: "la descripción", kind: "text" },
  deliveryDate: { label: "la fecha de entrega", kind: "date" },
  area: { label: "el área", kind: "area" },
  productionArea: { label: "el área de producción", kind: "area" },
  assignedUserId: {
    label: "el usuario asignado",
    kind: "user",
    setPhrase: (value) => `asignó el pedido a ${value}`,
    unsetPhrase: () => "quitó la asignación del pedido",
  },
  requiresDesign: { label: "si el pedido requiere diseño", kind: "boolean" },
  clientId: { label: "el cliente", kind: "client" },
  clientNameOverride: { label: "el nombre del cliente", kind: "text" },
  round: { label: "la ronda de diseño", kind: "text" },
  revisionId: { label: "la ronda de diseño", kind: "text" },
  feedbackText: { label: "el comentario del cliente", kind: "text" },
};

/** Etiqueta legible de un campo; nunca devuelve la columna cruda a secas. */
export function auditFieldLabel(field: string): string {
  return FIELDS[field]?.label ?? `el campo «${field}»`;
}

function quote(value: string): string {
  return `'${value}'`;
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function formatAuditDate(value: unknown): string | null {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Convierte un valor crudo del log (id, booleano, fecha, texto) en algo
 * legible. Devuelve `null` si el valor está vacío.
 */
export function formatAuditValue(
  field: string,
  value: unknown,
  labels?: OrderAuditLogEntry["labels"]
): string | null {
  if (isEmpty(value)) return null;
  const kind = FIELDS[field]?.kind ?? "text";

  switch (kind) {
    case "status": {
      const id = Number(value);
      // El diccionario del backend gana; `statusLabel` cubre el caso de un
      // backend viejo y también los estados retirados del flujo.
      const fromServer = labels?.statuses?.[String(value)];
      if (fromServer) return fromServer;
      return Number.isFinite(id)
        ? statusLabel(id, `estado eliminado (#${String(value)})`)
        : String(value);
    }
    case "user":
      return labels?.users?.[String(value)] ?? `usuario eliminado (#${String(value)})`;
    case "client":
      return labels?.clients?.[String(value)] ?? `cliente eliminado (#${String(value)})`;
    case "area":
      return getAreaLabel(String(value));
    case "boolean":
      return value ? "sí" : "no";
    case "date":
      return formatAuditDate(value) ?? String(value);
    default: {
      // Los textos libres (descripción, comentarios) se recortan para que la
      // línea del historial siga siendo legible de un vistazo.
      const text = String(value).trim();
      return text.length > MAX_TEXT_LENGTH
        ? `${text.slice(0, MAX_TEXT_LENGTH).trimEnd()}…`
        : text;
    }
  }
}

/**
 * Redacta el cambio de un campo puntual: "cambió el estado de 'x' a 'y'",
 * "estableció la fecha de entrega en 12 de marzo de 2026", "quitó la
 * descripción". Devuelve `null` si no hay nada que contar.
 */
export function describeAuditChange(
  field: string,
  before: unknown,
  after: unknown,
  labels?: OrderAuditLogEntry["labels"]
): string | null {
  const meta = FIELDS[field];
  const label = auditFieldLabel(field);
  const beforeText = formatAuditValue(field, before, labels);
  const afterText = formatAuditValue(field, after, labels);

  if (beforeText === null && afterText === null) return null;

  if (beforeText === null) {
    if (meta?.setPhrase) return meta.setPhrase(afterText as string);
    const value = meta?.kind === "date" ? afterText : quote(afterText as string);
    return `estableció ${label} en ${value}`;
  }

  if (afterText === null) {
    if (meta?.unsetPhrase) return meta.unsetPhrase();
    return `quitó ${label}`;
  }

  if (beforeText === afterText) return null;

  const from = meta?.kind === "date" ? beforeText : quote(beforeText);
  const to = meta?.kind === "date" ? afterText : quote(afterText);
  return `cambió ${label} de ${from} a ${to}`;
}

/** Nombre visible de quien hizo el cambio; tolera un usuario borrado. */
export function auditActorName(user?: AssignedUser | null): string {
  return getAssignedUserName(user) ?? "Usuario eliminado";
}

/** Inicial(es) para el avatar, con el mismo criterio que el resto de la app. */
export function auditActorInitials(user?: AssignedUser | null): string {
  if (!user) return "?";
  const source = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username;
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "hace 2 horas", "ayer", "hace 3 días". */
export function auditRelativeTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha desconocida";
  if (isSameDay(date, subDays(now, 1))) return "ayer";
  // `addSuffix` da "hace 2 horas" (pasado) o "en 2 horas" (futuro, posible si
  // el reloj del cliente está atrasado respecto del servidor).
  return formatDistance(date, now, { addSuffix: true, locale: es });
}

/** Fecha y hora completas, para el tooltip de precisión. */
export function auditAbsoluteTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return format(date, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

/** Acciones que no son un diff de campos y tienen su propia frase. */
const ACTION_PHRASES: Record<string, string> = {
  created: "creó el pedido",
  create: "creó el pedido",
  design_montage_sent: "envió un montaje para autorización",
  design_feedback_added: "cargó el comentario del cliente sobre el montaje",
  design_approved: "registró la autorización del diseño",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * `changes` puede venir como diff (`{ campo: { before, after } }`, acción
 * `updated`) o plano (`{ campo: valorNuevo }`): se contemplan los dos, más los
 * alias históricos (`from/to`, `previous/current`, `old/new`) que ya toleraba
 * el render anterior.
 */
function describeEntry(
  field: string,
  raw: unknown,
  labels?: OrderAuditLogEntry["labels"]
): string | null {
  const diff = asRecord(raw);
  if (diff) {
    const beforeKey = ["before", "from", "previous", "old"].find((k) => k in diff);
    const afterKey = ["after", "to", "current", "new"].find((k) => k in diff);
    if (beforeKey || afterKey) {
      return describeAuditChange(
        field,
        beforeKey ? diff[beforeKey] : null,
        afterKey ? diff[afterKey] : null,
        labels
      );
    }
  }
  return describeAuditChange(field, null, raw, labels);
}

/**
 * Convierte una entrada del log en las líneas listas para renderizar: una por
 * campo cambiado, o una sola frase para las acciones con texto propio.
 */
export function buildAuditLines(
  entry: OrderAuditLogEntry,
  now: Date = new Date()
): AuditLogLine[] {
  const name = auditActorName(entry.user);
  const initials = auditActorInitials(entry.user);
  const relative = auditRelativeTime(entry.createdAt, now);
  const absolute = auditAbsoluteTime(entry.createdAt);
  const changes = asRecord(entry.changes);
  const phrase = ACTION_PHRASES[entry.action];

  const actions: string[] = [];
  if (phrase) {
    actions.push(phrase);
  } else if (changes) {
    for (const [field, raw] of Object.entries(changes)) {
      const described = describeEntry(field, raw, entry.labels);
      if (described) actions.push(described);
    }
  }
  if (actions.length === 0) {
    // Entrada sin campos legibles: mejor una línea genérica que un hueco.
    actions.push("actualizó el pedido");
  }

  return actions.map((action, index) => ({
    key: `${entry.id}-${index}`,
    actorName: name,
    actorInitials: initials,
    action,
    sentence: `${name} ${action}`,
    relativeTime: relative,
    absoluteTime: absolute,
    createdAt: entry.createdAt,
  }));
}
