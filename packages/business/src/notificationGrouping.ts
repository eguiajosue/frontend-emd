import type { Notification } from "@emd/types";

/**
 * Agrupa notificaciones por día ("Hoy", "Ayer", y después la fecha), en el
 * mismo orden en que llegaron. Una lista plana de 100 avisos con sólo un
 * "hace 3 días" al costado no se puede leer: los cortes por día dan el punto
 * de referencia.
 */
export interface NotificationDayGroup {
  key: string;
  label: string;
  notifications: Notification[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Etiqueta del día de una fecha, relativa a `now`. */
export function dayLabel(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return "Esta semana";
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function groupByDay(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  notifications.forEach((notification) => {
    const label = dayLabel(notification.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.notifications.push(notification);
      return;
    }
    groups.push({ key: label, label, notifications: [notification] });
  });
  return groups;
}
