// Tipos de notificación emitidos por el backend (ver
// backend-emd/src/order/order.service.ts y notifications.gateway.ts) y su
// presentación en el panel de notificaciones: cada tipo tiene su propia
// etiqueta ("tag") con color, para poder distinguirlos de un vistazo.

export type NotificationType =
  | "order_status_changed"
  | "area_user_updated_order"
  | "order_assigned"
  | "order_note_added"
  | "order_ready"
  | "design_montage_sent"
  | "design_feedback_added"
  | "design_approved"
  | "area_task_created"
  | "area_task_completed"
  | "chat_message"
  | (string & {});

/**
 * Grupos con los que se organiza el panel de notificaciones. Cada tipo cae en
 * uno; los tipos que el backend agregue y todavía no estén mapeados caen en
 * "otras" en vez de perderse.
 */
export type NotificationGroup = "diseno" | "produccion" | "pedidos" | "otras";

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, string> = {
  pedidos: "Pedidos",
  diseno: "Diseño",
  produccion: "Producción",
  otras: "Otras",
};

const GROUP_BY_TYPE: Record<string, NotificationGroup> = {
  order_status_changed: "pedidos",
  order_assigned: "pedidos",
  order_note_added: "pedidos",
  area_user_updated_order: "pedidos",
  design_montage_sent: "diseno",
  design_feedback_added: "diseno",
  design_approved: "diseno",
  area_task_created: "produccion",
  area_task_completed: "produccion",
  order_ready: "produccion",
};

/** Grupo al que pertenece un tipo de notificación (nunca falla). */
export const notificationGroup = (type: NotificationType): NotificationGroup =>
  GROUP_BY_TYPE[type] ?? "otras";

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
  order_ready: {
    label: "Listo para entregar",
    className:
      "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  // Circuito de Diseño: montaje enviado -> comentarios del cliente -> autorizado.
  design_montage_sent: {
    label: "Montaje enviado",
    className:
      "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
  },
  design_feedback_added: {
    label: "Cambios solicitados",
    className:
      "border-transparent bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200",
  },
  design_approved: {
    label: "Diseño autorizado",
    className:
      "border-transparent bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-200",
  },
  // Trabajo por área de producción.
  area_task_created: {
    label: "Trabajo asignado al área",
    className:
      "border-transparent bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  area_task_completed: {
    label: "Área terminada",
    className:
      "border-transparent bg-lime-100 text-lime-900 dark:bg-lime-500/20 dark:text-lime-200",
  },
  chat_message: {
    label: "Chat",
    className:
      "border-transparent bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200",
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
