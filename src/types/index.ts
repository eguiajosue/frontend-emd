/**
 * Tipos de dominio compartidos por toda la app.
 *
 * Están alineados con el schema de Prisma del backend (`prisma/schema.prisma`)
 * y con los `include` que hacen sus services (ej. `order` incluye client, user,
 * status y orderProducts.product; `client` incluye company; `user` incluye roles).
 *
 * Regla: ningún componente/pantalla define tipos de entidad propios. Si el
 * backend cambia un shape, se actualiza acá y TypeScript marca los usos rotos.
 */

/** Toda entidad del backend tiene id numérico autoincremental. */
export interface BaseEntity {
  id: number;
}

/** Entidad con sólo `id` + `name` (roles, statuses, colores, tallas, tipos). */
export interface NamedEntity extends BaseEntity {
  name: string;
}

export type Role = NamedEntity;
export type Status = NamedEntity;
export type Color = NamedEntity;
export type Size = NamedEntity;
export type ProductType = NamedEntity;

export interface Company extends BaseEntity {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  location?: string | null;
}

export interface Client extends BaseEntity {
  companyId?: number | null;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  company?: Company | null;
}

export interface User extends BaseEntity {
  firstName: string;
  lastName?: string | null;
  username: string;
  roles?: Role[];
  /** Cuenta de área/departamento compartida por todo un equipo (ej. "taller", "dtf"), no de una persona. */
  isSharedAccount?: boolean;
}

/** Versión resumida de `User` que devuelve el backend embebida en `order.assignedUser`. */
export interface AssignedUser extends BaseEntity {
  firstName: string;
  lastName?: string | null;
  username: string;
  isSharedAccount?: boolean;
}

export interface Product extends BaseEntity {
  productTypeId: number;
  colorId?: number | null;
  sizeId?: number | null;
  code?: string | null;
  quantity: number;
  productType?: ProductType | null;
  color?: Color | null;
  size?: Size | null;
}

export interface OrderProduct {
  orderId?: number;
  /** Legado: producto del catálogo completo. Opcional, reemplazado por `customName` en el flujo simple. */
  productId?: number;
  /** Nombre de producto libre (preset o nuevo). Alternativa simple a `productId`. */
  customName?: string;
  quantity: number;
  product?: Product | null;
}

/** Preset de nombre de producto frecuente (GET /order-product-presets). */
export interface OrderProductPreset extends BaseEntity {
  name: string;
}

/* -------------------------------------------------------------------------- */
/* Rendimiento (GET /performance/summary, solo admin/superuser)               */
/* -------------------------------------------------------------------------- */

export interface EmployeePerformance {
  userId: number;
  firstName: string;
  lastName?: string | null;
  username: string;
  totalAssigned: number;
  totalCompleted: number;
  avgTurnaroundHours: number | null;
  onTimeRate: number | null;
  score: number | null;
}

export interface AreaPerformance {
  area: string;
  totalAssigned: number;
  totalCompleted: number;
  avgTurnaroundHours: number | null;
  onTimeRate: number | null;
  score: number | null;
}

export interface PerformanceSummary {
  employees: EmployeePerformance[];
  areas: AreaPerformance[];
}

/** Metadata + contenido de la hoja de autorización, tal como la devuelve GET /orders/:id. */
export interface AuthorizationFile {
  filename: string;
  mimeType: string;
  /** `data:<mime>;base64,<data>`, lista para usar en <img src> o como href. */
  dataUrl: string;
}

/** Payload de subida: base64 SIN el prefijo `data:...;base64,`. */
export interface AuthorizationFileInput {
  data: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "application/pdf";
}

export interface Order extends BaseEntity {
  clientId?: number | null;
  userId?: number;
  /** Usuario al que se le asignó el pedido (distinto de `user`, quien lo creó). */
  assignedUserId?: number | null;
  statusId: number;
  /**
   * Área ACTUAL del pedido (dónde está trabajando ahora). Si `requiresDesign`
   * es `true`, arranca en `'diseno'` y salta a `productionArea` recién cuando
   * el cliente autoriza el montaje.
   */
  area?: string | null;
  /** `true` si Recepción marcó, al crear el pedido, que pasa primero por Diseño. */
  requiresDesign?: boolean;
  /**
   * Área de producción DESTINO (a dónde va cuando termine diseño, o directo
   * si no requiere diseño). Puede definirse al crear o quedar `null` hasta que
   * Recepción o Diseño la elijan más adelante.
   */
  productionArea?: string | null;
  description: string;
  creationDate: string;
  deliveryDate?: string | null;
  /** `null` cuando el pedido se cargó con `clientNameOverride` en vez de un cliente registrado. */
  client?: Client | null;
  /** Nombre de cliente escrito a mano (alternativa a `client` cuando no hay `clientId`). */
  clientNameOverride?: string | null;
  user?: User | null;
  assignedUser?: AssignedUser | null;
  status?: Status | null;
  orderProducts?: OrderProduct[];
  /** Presente en el listado (GET /orders); el archivo completo NO viaja ahí. */
  hasAuthorizationFile?: boolean;
  /** Presente sólo en el detalle (GET /orders/:id). */
  authorizationFile?: AuthorizationFile | null;
  /** ISO timestamp de cuándo el pedido pasó a "entregado", o `null` si nunca llegó a ese estado. */
  deliveredAt: string | null;
}

export interface OrderHistory extends BaseEntity {
  orderId: number;
  previousStatusId: number;
  newStatusId: number;
  changeDate: string;
}

/**
 * Nota interna de un pedido (POST/GET /orders/:id/notes).
 * Endpoint nuevo del backend: el shape puede variar levemente hasta que se
 * termine de estabilizar, por eso `user` queda flexible.
 */
export interface OrderNote extends BaseEntity {
  orderId: number;
  userId: number;
  text: string;
  createdAt: string;
  user?: AssignedUser | null;
}

/**
 * Entrada de historial de ediciones de un pedido (GET /orders/:id/audit-log).
 * `changes` es un JSON genérico cuyo shape define el backend: puede venir como
 * `{ campo: { from, to } }` o como un objeto plano `{ campo: valorNuevo }`;
 * el renderizado en la UI contempla ambos casos de forma defensiva.
 */
export interface OrderAuditLogEntry extends BaseEntity {
  orderId: number;
  userId: number;
  action: string;
  changes: unknown;
  createdAt: string;
  user?: AssignedUser | null;
}

/* -------------------------------------------------------------------------- */
/* Payloads de escritura                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateOrderPayload {
  /** Debe venir `clientId` o `clientNameOverride` (al menos uno). */
  clientId?: number;
  /** Nombre de cliente escrito a mano; alternativa a `clientId`. */
  clientNameOverride?: string;
  userId: number;
  assignedUserId?: number;
  statusId: number;
  /**
   * Área destino (ver `AREA_OPTIONS` en `@/lib/areas`). Obligatoria cuando
   * `requiresDesign` es `false`; opcional (se puede definir después) cuando
   * el pedido entra primero a Diseño.
   */
  area?: string;
  /** `true` si el pedido tiene que pasar por Diseño antes de producción. */
  requiresDesign?: boolean;
  /** Área de producción destino, sólo relevante cuando `requiresDesign` es `true`. */
  productionArea?: string;
  description: string;
  deliveryDate?: string;
  orderProducts?: Array<{ productId?: number; customName?: string; quantity: number }>;
  authorizationFile?: AuthorizationFileInput;
}

export interface UpdateOrderPayload {
  description?: string;
  deliveryDate?: string;
  statusId?: number;
  assignedUserId?: number | null;
  area?: string;
  /** Área de producción destino; editable por recepcion/admin/superuser y por rol `diseno`. */
  productionArea?: string | null;
  authorizationFile?: AuthorizationFileInput;
}

/* -------------------------------------------------------------------------- */
/* Flujo de diseño (Order.requiresDesign)                                     */
/* -------------------------------------------------------------------------- */

/** Payload de subida de archivo de una revisión de diseño (mismo shape que `AuthorizationFileInput`). */
export type DesignRevisionFileInput = AuthorizationFileInput;

/**
 * Una ronda del flujo de diseño (`GET /orders/:id/design-revisions`).
 * Endpoint nuevo, desplegado en paralelo por el equipo de backend: el shape
 * puede variar levemente hasta que se termine de estabilizar.
 */
export interface DesignRevision extends BaseEntity {
  orderId: number;
  /** Número de ronda, arranca en 1. */
  round: number;
  montageFileName?: string | null;
  montageFileMime?: string | null;
  hasMontageFile: boolean;
  sentAt?: string | null;
  sentByUserId?: number | null;
  feedbackText?: string | null;
  feedbackFileName?: string | null;
  hasFeedbackFile: boolean;
  feedbackAt?: string | null;
  feedbackByUserId?: number | null;
  approved: boolean;
  approvedAt?: string | null;
  approvedByUserId?: number | null;
  createdAt: string;
}

/** Alta rápida de cliente (sólo `first_name` es obligatorio). */
export interface CreateClientPayload {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  companyId?: number;
}

export interface CreateOrderHistoryPayload {
  orderId: number;
  previousStatusId: number;
  newStatusId: number;
}

/**
 * Payload genérico para los formularios CRUD reutilizables
 * (`EntityFormDialog` y `SimpleNamedEntityPage`).
 */
export type EntityPayload = Record<string, unknown>;

/** Configuración global de la app (fila única, GET/PATCH /settings). */
export interface AppSettings {
  id: number;
  deliveredRetentionHours: number;
}

/**
 * Notificación de usuario (GET /notifications, /notifications/unread-count).
 * Endpoint nuevo del backend, desplegado en paralelo: el shape puede variar
 * levemente hasta que se termine de estabilizar (ver `useNotifications`).
 */
export interface Notification {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  orderId?: number | null;
  read: boolean;
  createdAt: string;
}

/** Usuario tal como lo devuelve el chat (subset mínimo). */
export interface ChatUserSummary {
  id: number;
  username: string;
  firstName: string;
  lastName?: string | null;
}

/** Usuario elegible para abrir un mensaje directo (GET /chat/users). */
export interface ChatUserOption extends ChatUserSummary {
  roles: string[];
}

/** Participante de una conversación; `isMonitor` marca a admin/superuser. */
export interface ChatMember extends ChatUserSummary {
  isMonitor: boolean;
}

/** Mensaje del chat interno. */
export interface ChatMessage {
  id: number;
  conversationId: number;
  body: string;
  createdAt: string;
  senderId: number;
  sender?: ChatUserSummary;
  /** Sólo en los mensajes que llegan en vivo por WebSocket. */
  senderName?: string;
  senderUsername?: string;
}

/**
 * Conversación del chat: canal fijo Recepción ↔ área (`area`) o mensaje
 * directo 1 a 1 (`direct`). GET /chat/conversations.
 */
export interface ChatConversation {
  id: number;
  type: "area" | "direct";
  area: string | null;
  title: string;
  otherUser: ChatUserSummary | null;
  lastMessageAt: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** true cuando el usuario participa sólo para monitoreo (admin/superuser). */
  isMonitor: boolean;
}
