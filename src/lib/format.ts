/** Helpers de formato compartidos (fechas y nombres de entidades). */

import type { Client, Order, User } from "@/types";

export const DATE_LOCALE = "es-MX";

export const LONG_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

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
  options: Intl.DateTimeFormatOptions = LONG_DATE_FORMAT
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(DATE_LOCALE, options);
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

export function getOrderClientName(order: Order): string {
  return getClientName(order.client);
}
