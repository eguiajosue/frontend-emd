// Tipos de notificación emitidos por el backend (ver
// backend-emd/src/order/order.service.ts y notifications.gateway.ts) y su
// presentación en el panel de notificaciones: cada tipo tiene su propia
// etiqueta ("tag") con color, para poder distinguirlos de un vistazo.

export type NotificationType =
  | "order_status_changed"
  | "area_user_updated_order"
  | "order_assigned"
  | "order_note_added"
  | (string & {});

export interface NotificationTagMeta {
  /** Texto visible de la etiqueta. */
  label: string;
  /** Clases Tailwind del chip (fondo/texto/borde), en la línea del design system. */
  className: string;
}

const DEFAULT_TAG: NotificationTagMeta = {
  label: "Notificación",
  className: "border-transparent bg-muted text-muted-foreground",
};

export const NOTIFICATION_TAGS: Record<string, NotificationTagMeta> = {
  // Cambio de estado de un pedido: etiqueta propia y distinguible.
  order_status_changed: {
    label: "Cambio de estado",
    className:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  },
  area_user_updated_order: {
    label: "Edición de pedido",
    className:
      "border-transparent bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200",
  },
  order_assigned: {
    label: "Asignación",
    className:
      "border-transparent bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  },
  order_note_added: {
    label: "Nota",
    className:
      "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
};

/** Metadatos de la etiqueta de un tipo de notificación (nunca falla). */
export const notificationTag = (type: NotificationType): NotificationTagMeta =>
  NOTIFICATION_TAGS[type] ?? DEFAULT_TAG;

/** Payload en vivo (WebSocket `orderStatusChanged`) de un cambio de estado. */
export interface OrderStatusChangedPayload {
  orderId: number;
  changedByUsername: string;
  previousStatus: string;
  newStatus: string;
  changedAt: string | Date;
}

/**
 * Texto en español del cambio de estado, equivalente al `body` que persiste
 * el backend, para renderizar la notificación que llega en vivo por WS.
 * Ej: `Ana cambió el estado del pedido #123 de "en diseño" a "terminado"`.
 */
export const formatOrderStatusChanged = (
  payload: OrderStatusChangedPayload,
): string =>
  `${payload.changedByUsername} cambió el estado del pedido #${payload.orderId} de "${payload.previousStatus}" a "${payload.newStatus}"`;
