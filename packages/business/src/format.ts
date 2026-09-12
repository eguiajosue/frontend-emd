/** Helpers de formato compartidos (fechas y nombres de entidades). */

import type { AssignedUser, Client, Order, OrderProduct, User } from "@emd/types";

export const DATE_LOCALE = "es-MX";

export const LONG_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Preferencia de formato de hora del usuario (Configuración > Formato de hora). */
export type TimeFormatPreference = "24h" | "12h";

/** Hora de un `Date`, respetando el formato elegido (24h o 12h con AM/PM). */
export function formatTimeOfDay(date: Date, timeFormat: TimeFormatPreference = "24h"): string {
  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: timeFormat === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

/**
 * Etiqueta corta de una hora entera (0-23) para el eje de un calendario, ej.
 * "14" en 24h o "2p" en 12h.
 */
export function formatHourLabel(hour: number, timeFormat: TimeFormatPreference): string {
  if (timeFormat === "24h") return String(hour);
  const period = hour < 12 ? "a" : "p";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

/** Fecha corta; devuelve "-" si el valor falta o es inválido. */
export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(DATE_LOCALE);
}

/** Fecha larga con hora; devuelve "-" si el valor falta o es inválido. */
export function formatDateTime(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = LONG_DATE_FORMAT,
  timeFormat: TimeFormatPreference = "24h"
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(DATE_LOCALE, { ...options, hour12: timeFormat === "12h" });
}

/**
 * Fecha de entrega: muestra solo la fecha cuando la hora es medianoche
 * (00:00, el valor por defecto cuando no se especificó hora), y fecha + hora
 * cuando se cargó una hora distinta de medianoche.
 */
export function formatDeliveryDate(value?: string | null, timeFormat: TimeFormatPreference = "24h"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (!hasTime) return date.toLocaleDateString(DATE_LOCALE);
  return `${date.toLocaleDateString(DATE_LOCALE)} ${formatTimeOfDay(date, timeFormat)}`;
}

/**
 * Combina una fecha (`YYYY-MM-DD`) y una hora opcional (`HH:mm`) en un ISO
 * datetime. Sin hora, usa medianoche (comportamiento histórico). Devuelve
 * `undefined` si no hay fecha.
 */
export function combineDateAndTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const timePart = time && time.trim() ? time : "00:00";
  const parsed = new Date(`${date}T${timePart}`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function getClientName(client?: Client | null): string {
  if (!client) return "-";
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "-";
}

export function getUserName(user?: User | null): string {
  if (!user) return "-";
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.username || "-";
}

/**
 * Nombre de cliente de un pedido: el cliente registrado si lo tiene, o el
 * nombre escrito a mano (`clientNameOverride`) cuando se cargó así en vez de
 * un cliente del catálogo.
 */
export function getOrderClientName(order: Order): string {
  if (order.client) return getClientName(order.client);
  if (order.clientNameOverride) return order.clientNameOverride;
  return "-";
}

/**
 * Nombre a mostrar de una línea de producto de pedido: prioriza `customName`
 * (texto libre, flujo simple), luego el producto del catálogo (legado), y por
 * último cae a un genérico con el id.
 */
export function getOrderProductName(op: OrderProduct): string {
  // El catálogo de productos se retiró: la línea siempre trae su nombre. El
  // fallback queda por si llega un registro viejo sin él.
  return op.customName?.trim() || "Producto";
}

/** Nombre del usuario asignado a un pedido, o `null` si no tiene. */
export function getAssignedUserName(user?: AssignedUser | null): string | null {
  if (!user) return null;
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const name = full || user.username || null;
  if (!name) return null;
  return user.isSharedAccount ? `Área: ${name}` : name;
}
