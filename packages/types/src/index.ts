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

export interface OrderProduct {
  orderId?: number;
  /** Nombre del producto: escrito a mano o elegido de `OrderProductPreset`. */
  customName: string;
  quantity: number;
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

/**
 * Metadata + contenido de un archivo ya guardado, tal como lo devuelve el
 * backend embebido en el JSON (ej. `Order.clientResourceFile` en
 * `GET /orders/:id`). Nombre neutro a propósito: lo usan tanto los recursos
 * que manda el cliente al dar de alta el pedido como las rondas de diseño.
 */
export interface UploadedFileContent {
  filename: string;
  mimeType: string;
  /** `data:<mime>;base64,<data>`, lista para usar en <img src> o como href. */
  dataUrl: string;
}

/** Payload de subida: base64 SIN el prefijo `data:...;base64,`. */
export interface UploadedFileInput {
  data: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "application/pdf";
}

/** Avance de un área dentro de un pedido. */
export type AreaTaskStatus = "pendiente" | "en_proceso" | "terminado";

/**
 * Trabajo que le toca a UN área dentro de un pedido. Varias áreas conviven en
 * el mismo pedido y avanzan en paralelo, sin esperarse entre sí.
 */
export interface OrderAreaTask {
  id: number;
  orderId: number;
  /** taller | dtf | bordado | laser | impresiones (nunca 'diseno'). */
  area: string;
  status: AreaTaskStatus;
  assignedUserId?: number | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  assignedUser?: AssignedUser | null;
}

export interface Order extends BaseEntity {
  clientId?: number | null;
  /** Quien CREÓ el pedido (la recepcionista del alta). No cambia nunca. */
  userId?: number;
  /**
   * Recepcionista que está ATENDIENDO el pedido hoy. `null` mientras nadie lo
   * haya tomado, en cuyo caso el responsable efectivo sigue siendo `userId`.
   *
   * Existe porque las notificaciones del circuito van a una persona concreta:
   * si la que lo creó está de franco, otra lo toma con
   * `POST /orders/:id/take-reception` y pasa a recibirlas ella.
   */
  attendedByUserId?: number | null;
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
   * Trabajo de producción partido por área. Un pedido puede necesitar varias
   * (ej. bordado + dtf) y todas avanzan EN PARALELO, cada una con su propio
   * estado y responsable. Ver WORKFLOW.md §3 en el backend.
   */
  areaTasks?: OrderAreaTask[];
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
  /** Versión embebida de `attendedByUserId`; `null` si nadie lo tomó todavía. */
  attendedBy?: AssignedUser | null;
  assignedUser?: AssignedUser | null;
  status?: Status | null;
  orderProducts?: OrderProduct[];
  /**
   * Recursos que mandó el CLIENTE al dar de alta el pedido (logo, referencias)
   * para que Diseño pueda trabajar. Opcional, y NO es la hoja de autorización
   * —esa es el montaje que sube Diseño en cada ronda—.
   *
   * Presente en el listado (GET /orders); el archivo completo NO viaja ahí.
   */
  hasClientResourceFile?: boolean;
  /** Presente sólo en el detalle (GET /orders/:id). */
  clientResourceFile?: UploadedFileContent | null;
  /** ISO timestamp de cuándo el pedido pasó a "entregado", o `null` si nunca llegó a ese estado. */
  deliveredAt: string | null;
  /**
   * ISO timestamp de cuándo el pedido quedó archivado (lo sella el backend al
   * autorizarse el montaje), o `null` si sigue activo.
   *
   * Archivado significa sólo que sale del tablero ACTIVO de Diseño: el pedido
   * se sigue viendo en la vista Lista, la búsqueda y el historial, y su trabajo
   * de producción sigue corriendo normalmente.
   */
  archivedAt?: string | null;
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
  /**
   * Diccionario id → nombre de las entidades referenciadas en `changes`, que
   * el backend adjunta para poder redactar el historial con nombres en vez de
   * ids. Opcional: si el backend todavía no lo manda, la UI cae a los mapas
   * locales (`statusLabel`) o muestra el id degradado.
   */
  labels?: {
    statuses?: Record<string, string>;
    users?: Record<string, string>;
    clients?: Record<string, string>;
  } | null;
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
  /**
   * Todas las áreas de producción que van a trabajar el pedido. Pueden ser
   * varias y avanzan en paralelo; `productionArea` queda como la principal.
   */
  productionAreas?: string[];
  description: string;
  deliveryDate?: string;
  orderProducts?: Array<{ productId?: number; customName?: string; quantity: number }>;
  /** Recursos que manda el cliente (logo, referencias) para que Diseño trabaje. */
  clientResourceFile?: UploadedFileInput;
}

export interface UpdateOrderPayload {
  description?: string;
  deliveryDate?: string;
  statusId?: number;
  assignedUserId?: number | null;
  area?: string;
  /** Área de producción destino; editable por recepcion/admin/superuser y por rol `diseno`. */
  productionArea?: string | null;
  /** Recursos que manda el cliente (logo, referencias) para que Diseño trabaje. */
  clientResourceFile?: UploadedFileInput;
}

/* -------------------------------------------------------------------------- */
/* Flujo de diseño (Order.requiresDesign)                                     */
/* -------------------------------------------------------------------------- */

/** Payload de subida de archivo de una revisión de diseño (mismo shape que `UploadedFileInput`). */
export type DesignRevisionFileInput = UploadedFileInput;

/**
 * Metadata de UN archivo de una ronda de diseño. Una hoja de autorización
 * puede ser varias imágenes o un PDF, así que tanto el montaje como el
 * feedback son listas. El contenido no viaja acá: se pide aparte con
 * `GET /orders/:id/design-revisions/:revisionId/files/:fileId`.
 */
export interface DesignRevisionFile {
  id: number;
  filename: string;
  mimeType: string;
}

/** Respuesta de `GET /orders/:id/design-revisions/:revisionId/files/:fileId`. */
export interface DesignRevisionFileContent {
  filename: string;
  mimeType: string;
  /** `data:<mime>;base64,<data>`, lista para usar en <img src> o como href. */
  dataUrl: string;
}

/**
 * Una ronda del flujo de diseño (`GET /orders/:id/design-revisions`).
 * Endpoint nuevo, desplegado en paralelo por el equipo de backend: el shape
 * puede variar levemente hasta que se termine de estabilizar.
 */
export interface DesignRevision extends BaseEntity {
  orderId: number;
  /** Número de ronda, arranca en 1. */
  round: number;
  /** Legacy: apunta al PRIMER archivo de `montageFiles`. */
  montageFileName?: string | null;
  /** Legacy: apunta al PRIMER archivo de `montageFiles`. */
  montageFileMime?: string | null;
  /** Legacy: `true` si `montageFiles` tiene al menos un archivo. */
  hasMontageFile: boolean;
  /** Todos los archivos del montaje de esta ronda (1..10). */
  montageFiles?: DesignRevisionFile[];
  sentAt?: string | null;
  sentByUserId?: number | null;
  feedbackText?: string | null;
  /** Legacy: apunta al PRIMER archivo de `feedbackFiles`. */
  feedbackFileName?: string | null;
  /** Legacy: `true` si `feedbackFiles` tiene al menos un archivo. */
  hasFeedbackFile: boolean;
  /** Todos los adjuntos del feedback de esta ronda (0..10). */
  feedbackFiles?: DesignRevisionFile[];
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
  isOnline: boolean;
  lastSeenAt: string | null;
}

/**
 * `otherUser` de una conversación directa (GET /chat/conversations): además
 * del resumen mínimo, trae presencia en tiempo real. No se agrega a
 * `ChatUserSummary` porque ese tipo también se usa donde no hay presencia
 * (p. ej. `ChatMessage.sender`).
 */
export interface ChatConversationOtherUser extends ChatUserSummary {
  isOnline: boolean;
  lastSeenAt: string | null;
}

/** Participante de una conversación; `isMonitor` marca a admin/superuser. */
export interface ChatMember extends ChatUserSummary {
  isMonitor: boolean;
  /** Último mensaje leído por este miembro en esta conversación (null = nunca leyó). */
  lastReadAt: string | null;
  /** Última vez que el cliente de este miembro confirmó tener la conexión viva. */
  deliveredAt: string | null;
  isOnline: boolean;
  /** Última desconexión del último socket vivo de este usuario (null = nunca se conectó). */
  lastSeenAt: string | null;
}

/** Pedido resumido adjunto a un mensaje de chat. */
export interface ChatOrderRef {
  id: number;
  description: string;
  area: string | null;
  status: { name: string } | null;
}

/**
 * Payload de subida de un adjunto de chat (foto, documento o audio): base64
 * SIN el prefijo `data:...;base64,`, igual que `UploadedFileInput`.
 */
export interface ChatAttachmentInput {
  data: string;
  filename: string;
  mimeType: string;
}

/** Adjunto ya persistido de un mensaje de chat (respuesta de la API/WS). */
export interface ChatMessageAttachment {
  filename: string;
  mimeType: string;
  size: number | null;
  dataUrl?: string;
}

/**
 * Mensaje del chat interno.
 */
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
  orderId?: number | null;
  order?: ChatOrderRef | null;
  attachment?: ChatMessageAttachment | null;
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
  otherUser: ChatConversationOtherUser | null;
  lastMessageAt: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** true cuando el usuario participa sólo para monitoreo (admin/superuser). */
  isMonitor: boolean;
}

/* -------------------------------------------------------------------------- */
/* Calendario de equipo de Recepción (GET/POST /calendar-events)              */
/* -------------------------------------------------------------------------- */

/**
 * Categoría de un evento: define su color en el calendario y si lleva
 * seguimiento de estado. Una junta, por ejemplo, es sólo informativa — no
 * tiene "pendiente"/"terminado" (ver `CATEGORY_META` en el frontend web).
 */
export type CalendarEventCategory = "instalacion" | "visita" | "entrega" | "junta" | "otro";

/**
 * Evento del calendario de equipo de Recepción: instalaciones, juntas,
 * visitas a clientes — reemplaza la lista que hoy se coordina a mano por
 * WhatsApp. Compartido: cualquier recepcion/admin/superuser lo ve y edita,
 * no sólo quien lo creó. Reusa `AreaTaskStatus` para el mismo ciclo
 * pendiente → en_proceso → terminado ("❌ / 🟠 / ✅") en las categorías que
 * lo necesitan.
 */
export interface CalendarEvent extends BaseEntity {
  title: string;
  /** Cliente/empresa escrito a mano, igual que hoy en WhatsApp ("MEDLINE"). */
  clientName?: string | null;
  /** Cliente real vinculado, si se eligió de la lista en vez de texto libre. */
  clientId?: number | null;
  client?: Client | null;
  category: CalendarEventCategory;
  eventDate: string;
  /** `false` = evento "todo el día" (la hora de `eventDate` se ignora). */
  hasTime: boolean;
  status: AreaTaskStatus;
  /** Anticipación (en minutos) del recordatorio push pedido al crear el evento. */
  reminderMinutesBefore?: number | null;
  createdById: number;
  createdAt: string;
  createdBy?: AssignedUser | null;
}

export interface CreateCalendarEventPayload {
  title: string;
  clientName?: string;
  clientId?: number;
  category?: CalendarEventCategory;
  eventDate: string;
  hasTime?: boolean;
  reminderMinutesBefore?: number;
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;
