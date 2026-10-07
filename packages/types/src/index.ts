/**
 * Tipos de dominio compartidos por toda la app.
 *
 * Están alineados con el schema de Prisma del backend (`prisma/schema.prisma`)
 * y con los `include` que hacen sus services (ej. `order` incluye client, user,
 * status y orderProducts.product; `client` incluye company; `user` incluye roles).
 *
 * Regla: ningún componente/pantalla define tipos de entidad propios. Si el
 * backend cambia un shape, se actualiza aquí y TypeScript marca los usos rotos.
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
  /** Sucursal de la cuenta (sólo rol "sucursal", ej. "Punto Madero"). */
  branchId?: number | null;
  branch?: BranchRef | null;
}

/** Sucursal u empleado de sucursal embebidos en un pedido (sólo `id` + `name`). */
export interface BranchRef extends BaseEntity {
  name: string;
}

/** Empleado de una sucursal: quien levanta los pedidos desde la cuenta compartida. */
export interface BranchEmployee extends BaseEntity {
  branchId?: number;
  name: string;
  /** Inactivo = ya no se puede elegir al crear pedidos (los viejos lo conservan). */
  active: boolean;
}

/** Sucursal (extensión de la matriz) con sus empleados (GET /branches). */
export interface Branch extends BaseEntity {
  name: string;
  active: boolean;
  employees?: BranchEmployee[];
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
  /** Líneas de pedido del último año con este producto (los frecuentes vienen del más pedido al menos). */
  uses?: number;
}

/**
 * Plantilla de pedido de un cliente (GET /clients/:id/order-templates): lo
 * que suele pedir, con nombre ("Figuras de coroplast"). Precarga el alta;
 * no guarda fecha, archivo del cliente ni asignado.
 */
export interface OrderTemplate extends BaseEntity {
  clientId: number;
  name: string;
  requiresDesign: boolean;
  /** Áreas de producción, la principal primero. */
  productionAreas: string[];
  description: string;
  /** Pedidos creados con la plantilla (las más usadas van primero). */
  useCount: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  products: Array<{ customName: string; quantity: number }>;
  materials: Array<{
    id: number;
    materialId: number;
    quantity: number;
    description: string;
    supplierId?: number | null;
    material?: { id: number; name: string; unit?: { name: string } | null } | null;
  }>;
}

export interface OrderTemplatePayload {
  name: string;
  requiresDesign: boolean;
  productionAreas?: string[];
  description?: string;
  products: Array<{ customName: string; quantity: number }>;
  materials?: Array<{ materialId: number; quantity: number; description: string; supplierId?: number }>;
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

/** Origen de los insumos de un área: los trae el cliente o los ponemos nosotros. */
export type SupplySource = "cliente" | "nosotros";

/** Línea de la hoja de materiales de un área. `inventoryItemId` sólo en origen "nosotros". */
export interface AreaSupplyLine {
  id: number;
  inventoryItemId: number | null;
  description: string;
  /** El backend serializa Decimal: puede llegar como string. */
  quantity: number | string;
  /** Cuándo se descontó del stock; null = apartado. */
  discountedAt: string | null;
  inventoryItem?: { id: number; name: string; unit: string; area: string; barcode?: string | null } | null;
}

/** Hoja de materiales de UNA tarea de área (se captura al autorizar). */
export interface AreaSupply {
  id: number;
  source: SupplySource;
  lines: AreaSupplyLine[];
}

/** Entrada para `PATCH .../approve` y `PUT /orders/:id/area-supplies`. */
export interface AreaSupplyInput {
  area: string;
  source: SupplySource;
  lines: { inventoryItemId?: number; description?: string; quantity: number }[];
}

/** `GET /orders/:id/area-supplies`: hoja por área con estado de stock y movimientos. */
export interface AreaSupplySheet {
  areas: {
    taskId: number;
    area: string;
    status: AreaTaskStatus;
    supply:
      | (Omit<AreaSupply, "lines"> & {
          lines: (AreaSupplyLine & {
            state?: "apartado" | "descontado";
            stock: { quantity: number; reserved: number; available: number } | null;
          })[];
        })
      | null;
  }[];
  movements: {
    id: number;
    itemId: number;
    type: "ENTRADA" | "SALIDA" | "AJUSTE";
    delta: number;
    balanceAfter: number;
    note?: string | null;
    areaTaskId: number | null;
    createdAt: string;
    item: { id: number; name: string; unit: string };
    createdBy?: { id: number; firstName?: string | null; lastName?: string | null } | null;
  }[];
  warnings?: string[];
}

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
  /** Origen de insumos del área; ausente/null en pedidos anteriores a la hoja. */
  supply?: AreaSupply | null;
}

export interface Order extends BaseEntity {
  clientId?: number | null;
  /** Sucursal desde la que se levantó (ej. "Punto Madero"); `null`/ausente = pedido de la matriz. */
  branchId?: number | null;
  branchEmployeeId?: number | null;
  branch?: BranchRef | null;
  /** Empleado de la sucursal que lo levantó. */
  branchEmployee?: BranchRef | null;
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
   * Hoja de materiales del pedido (opcional, la carga Recepción). En el
   * listado (GET /orders) sólo trae id/quantity/description; el detalle
   * completo con material/proveedor sale de GET /orders/:id/materials.
   */
  materialItems?: OrderMaterialItem[];
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
  /** Cuándo Diseño empezó el montaje ("Empezar diseño" / "Tomar pedido"). null = nadie lo abrió. */
  designStartedAt?: string | null;
  /** Quién lo empezó, tal cual se muestra. */
  designStartedByName?: string | null;
  /**
   * Orden de prioridad de compra elegido a mano (drag & drop) en la pantalla
   * "Hoja de Materiales". `null`/`undefined` cuando todavía no se reordenó
   * (ese pedido va al final, ordenado por id).
   */
  materialsPriority?: number | null;
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
  /** Empleado de la sucursal que levanta el pedido (obligatorio desde la cuenta de sucursal). */
  branchEmployeeId?: number;
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
 * feedback son listas. El contenido no viaja aquí: se pide aparte con
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
export type CalendarEventCategory =
  | "instalacion"
  | "visita"
  | "entrega"
  | "junta"
  /** Evento auto-generado "Compra de materiales", una semana antes de la entrega/instalación de un pedido. */
  | "compras"
  | "otro";

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
  /** Pedido vinculado, opcional. En categoría "compras" arma el checklist de su hoja de materiales. */
  orderId?: number | null;
  category: CalendarEventCategory;
  /** Área de producción involucrada (taller/dtf/bordado/diseno/laser/impresiones), opcional. */
  area?: string | null;
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
  orderId?: number;
  category?: CalendarEventCategory;
  area?: string;
  eventDate: string;
  hasTime?: boolean;
  reminderMinutesBefore?: number;
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;

/* -------------------------------------------------------------------------- */
/* Tareas pendientes del calendario de equipo (GET/POST /calendar-tasks)      */
/* -------------------------------------------------------------------------- */

/**
 * Tarea pendiente del calendario de equipo: actividad sin fecha todavía
 * definida (ej. "Confirmar medidas con cliente"), separada de
 * `CalendarEvent`. Mismo equipo/visibilidad que el calendario, sin
 * asignación a una persona en particular.
 */
export interface CalendarTask extends BaseEntity {
  title: string;
  description?: string | null;
  completed: boolean;
  completedAt?: string | null;
  /** Pedido relacionado, opcional (ej. "confirmar medidas" de un pedido puntual). */
  orderId?: number | null;
  order?: { id: number; description: string } | null;
  createdById: number;
  createdAt: string;
  createdBy?: AssignedUser | null;
}

export interface CreateCalendarTaskPayload {
  title: string;
  description?: string;
  orderId?: number;
}

export type UpdateCalendarTaskPayload = Partial<CreateCalendarTaskPayload>;

/* -------------------------------------------------------------------------- */
/* Catálogo de Materiales y Proveedores                                       */
/* -------------------------------------------------------------------------- */

/** Categoría de material (ej. "Lámina/Panel"): catálogo que crece solo. */
export type MaterialCategory = NamedEntity;

/** Unidad de medida de un material (ej. "Hoja", "Metro"): catálogo que crece solo. */
export type MaterialUnit = NamedEntity;

/** Alcance de un proveedor. */
export type SupplierLocation = "nacional" | "local" | "internacional";

/** Proveedor de materiales/insumos. */
export interface Supplier extends BaseEntity {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  location: SupplierLocation;
  createdAt?: string;
}

export interface CreateSupplierPayload {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  location: SupplierLocation;
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

/**
 * Material/insumo del catálogo (PVC, acrílico, MDF, perfiles metálicos,
 * tornillería, consumibles de DTF/Bordado, etc.). `areas` es un subconjunto
 * de las 6 áreas de producción: un material puede usarse en varias a la vez.
 */
export interface Material extends BaseEntity {
  name: string;
  categoryId?: number | null;
  unitId?: number | null;
  /** Grosor/calibre/tamaño en texto libre (ej. "6mm", "3/16 x 1 1/4"). */
  measure?: string | null;
  color?: string | null;
  brand?: string | null;
  /** Proveedor preferido, opcional — la hoja de un pedido puede usar otro. */
  supplierId?: number | null;
  areas: string[];
  /** Precio de referencia, en pesos mexicanos. Se copia a cada línea de la hoja de materiales al agregarla. */
  suggestedPrice?: number | null;
  createdAt?: string;
  category?: MaterialCategory | null;
  unit?: MaterialUnit | null;
  supplier?: Supplier | null;
}

export interface CreateMaterialPayload {
  name: string;
  /** Nombre de la categoría (no id): se crea sola si es nueva. */
  category?: string;
  /** Nombre de la unidad (no id): se crea sola si es nueva. */
  unit?: string;
  measure?: string;
  color?: string;
  brand?: string;
  supplierId?: number;
  areas?: string[];
  suggestedPrice?: number;
}

export type UpdateMaterialPayload = Partial<CreateMaterialPayload>;

/* -------------------------------------------------------------------------- */
/* Inventario por departamento (GET/POST /inventory)                          */
/* -------------------------------------------------------------------------- */

/**
 * Departamento con inventario propio: las 6 áreas operativas + Recepción.
 * Coincide con el nombre del rol del área.
 */
export type InventoryArea =
  | "taller"
  | "dtf"
  | "bordado"
  | "diseno"
  | "laser"
  | "impresiones"
  | "recepcion";

/** Semáforo de existencias: `low` = en o por debajo del mínimo. */
export type InventoryStockStatus = "ok" | "low" | "out";

/**
 * Existencia física de un departamento. NO es el catálogo de Materiales: un
 * artículo puede vincularse a un Material (`materialId`), pero muchos
 * consumibles (hilos de bordado, tintas de impresión) sólo viven aquí.
 * `quantity` sólo cambia con movimientos (ver `InventoryMovement`).
 */
export interface InventoryItem extends BaseEntity {
  area: InventoryArea;
  name: string;
  sku?: string | null;
  /**
   * Código de barras (Code 128) de la etiqueta: `EMD-000123` por omisión o
   * uno propio (EAN/UPC del fabricante). Único en todo el inventario.
   */
  barcode?: string | null;
  category?: string | null;
  unit: string;
  color?: string | null;
  brand?: string | null;
  location?: string | null;
  quantity: number;
  /** Apartado por hojas de materiales de pedidos (aún sin descontar). */
  reserved?: number;
  /** quantity − reserved. */
  available?: number;
  minStock?: number | null;
  unitCost?: number | null;
  notes?: string | null;
  materialId?: number | null;
  supplierId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  material?: { id: number; name: string } | null;
  supplier?: { id: number; name: string } | null;
  stockStatus: InventoryStockStatus;
  /** quantity × unitCost; null si no hay costo cargado. */
  totalValue?: number | null;
}

export interface CreateInventoryItemPayload {
  area: InventoryArea;
  name: string;
  unit: string;
  sku?: string;
  /** Código propio (3–64 ASCII). Vacío o `null` = el automático `EMD-<id>`. */
  barcode?: string | null;
  category?: string;
  color?: string;
  brand?: string;
  location?: string;
  notes?: string;
  minStock?: number | null;
  unitCost?: number | null;
  materialId?: number | null;
  supplierId?: number | null;
  /** Sólo en el alta: queda como ENTRADA "Stock inicial" del kardex. */
  initialQuantity?: number;
}

export type UpdateInventoryItemPayload = Partial<Omit<CreateInventoryItemPayload, "initialQuantity">>;

/** ENTRADA suma, SALIDA resta, AJUSTE fija el stock al conteo físico. */
export type InventoryMovementType = "ENTRADA" | "SALIDA" | "AJUSTE";

export type InventoryMovementSource = "recepcion" | "area" | "scan" | "inicial";

/** Filtros de la bitácora global (`GET /inventory/movements`). */
export interface InventoryMovementsFilter {
  itemId?: number;
  area?: InventoryArea;
  userId?: number;
  type?: InventoryMovementType;
  /** ISO (fecha o fecha+hora). */
  from?: string;
  to?: string;
  limit?: number;
}

export interface InventoryMovement extends BaseEntity {
  itemId: number;
  type: InventoryMovementType;
  /** Cambio con signo aplicado al stock. */
  delta: number;
  balanceAfter: number;
  /** Stock antes del movimiento (bitácora); null en movimientos antiguos. */
  balanceBefore?: number | null;
  /** Departamento del artículo al moverse. */
  area?: InventoryArea | null;
  /** Motivo capturado por quien lo registró. */
  reason?: string | null;
  /** Origen: gestión de Recepción, usuario del área, escáner o stock inicial. */
  source?: InventoryMovementSource | null;
  unitCost?: number | null;
  note?: string | null;
  orderId?: number | null;
  createdAt: string;
  item?: { id: number; name: string; unit: string; area: InventoryArea } | null;
  order?: { id: number; description: string } | null;
  createdBy?: { id: number; firstName: string; lastName?: string | null } | null;
}

/** Respuesta de `POST /inventory/:id/movements` y de su variante por código de barras. */
export interface InventoryMovementResult {
  movement: InventoryMovement;
  item: InventoryItem;
}

export interface CreateInventoryMovementPayload {
  type: InventoryMovementType;
  /** ENTRADA/SALIDA: cantidad a sumar/restar. AJUSTE: cantidad contada. */
  quantity: number;
  unitCost?: number;
  note?: string;
  /** Motivo para la bitácora. */
  reason?: string;
  orderId?: number;
}

/* -------------------------------------------------------------------------- */
/* Solicitudes de reabasto (`/inventory/restock-requests`)                    */
/* -------------------------------------------------------------------------- */

export type RestockRequestStatus = "PENDIENTE" | "EN_CAMINO" | "COMPRADO" | "RESUELTO";
export type RestockRequestUrgency = "NORMAL" | "URGENTE";

export interface RestockRequest {
  id: number;
  area: InventoryArea;
  itemId?: number | null;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  comment?: string | null;
  urgency: RestockRequestUrgency;
  status: RestockRequestStatus;
  statusNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: number; name: string; unit: string; quantity: number; area: InventoryArea } | null;
  requestedBy: { id: number; firstName: string; lastName?: string | null };
  handledBy?: { id: number; firstName: string; lastName?: string | null } | null;
}

export interface CreateRestockRequestPayload {
  itemId?: number;
  itemName?: string;
  area?: InventoryArea;
  quantity?: number;
  unit?: string;
  comment?: string;
  urgency?: RestockRequestUrgency;
}

export interface UpdateRestockRequestStatusPayload {
  status: RestockRequestStatus;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Hoja de materiales de un pedido (GET/POST /orders/:id/materials)           */
/* -------------------------------------------------------------------------- */

/**
 * Línea de la hoja de materiales de un pedido: qué material, cuánto, de qué
 * proveedor. `description` se autogenera desde el Material elegido pero es
 * editable. `material`/`supplier`/`createdBy` sólo vienen completos al pedir
 * GET /orders/:id/materials (en el listado de pedidos sólo id/quantity/description).
 */
export interface OrderMaterialItem extends BaseEntity {
  orderId: number;
  materialId: number;
  quantity: number;
  description: string;
  supplierId?: number | null;
  /** Copiado del precio sugerido del material al agregar la línea; se sincroniza hasta que el pedido se entrega. */
  price?: number;
  /** Checklist del evento "Compra de materiales": si ya se compró esta línea. */
  purchased?: boolean;
  createdById?: number;
  createdAt?: string;
  material?: { id: number; name: string; unit?: { name: string } | null } | null;
  supplier?: Supplier | null;
  createdBy?: AssignedUser | null;
}

export interface CreateOrderMaterialItemPayload {
  materialId: number;
  quantity: number;
  description: string;
  supplierId?: number;
}

export type UpdateOrderMaterialItemPayload = Partial<CreateOrderMaterialItemPayload> & {
  purchased?: boolean;
};

/** Una entrada de "Tareas asignadas" (`GET /orders/my-tasks`): una por TAREA. */
export interface MyTask {
  key: string;
  kind: "design" | "production";
  /** Área de la tarea (diseno, taller, dtf...). */
  area: string;
  /** Tarea de área; null en Diseño (el trabajo es el pedido). */
  taskId: number | null;
  /** Estado de la tarea de área, o nombre del estado de diseño del pedido. */
  status: string;
  /** A nombre del usuario (nunca desde la cuenta compartida). */
  mine: boolean;
  assignee: { id: number; firstName?: string | null; lastName?: string | null; username: string } | null;
  startedAt: string | null;
  /** Origen de insumos del área (sólo tareas de producción). */
  supply?: AreaSupply | null;
  order: {
    id: number;
    description: string;
    deliveryDate: string | null;
    creationDate: string;
    statusId: number;
    clientNameOverride: string | null;
    designStartedAt: string | null;
    designStartedByName: string | null;
    client: { first_name: string; last_name?: string | null } | null;
    /** Sucursal de origen ("Punto Madero"); null/ausente = pedido de la matriz. */
    branch?: BranchRef | null;
    status: { id: number; name: string };
  };
}

/* -------------------------------------------------------------------------- */
/* Aprendizaje por cliente (GET /clients/:id/insights)                        */
/* -------------------------------------------------------------------------- */

/** Producto que el cliente suele pedir, con la cantidad típica aprendida. */
export interface ClientProductHabit {
  name: string;
  key: string;
  /** En cuántos de sus pedidos aparece. */
  orders: number;
  /** Proporción (0..1, ponderada por recencia) de sus pedidos que lo incluyen. */
  share: number;
  typicalQuantity: number;
  lastQuantity: number;
  lastOrderedAt: string;
}

/** "Lo habitual" de un cliente: un pedido sugerido para autocompletar el alta. */
export interface ClientSuggestedOrder {
  confidence: "alta" | "media";
  /** Pedidos que respaldan la sugerencia. */
  basedOn: number;
  requiresDesign: boolean;
  areas: string[];
  products: Array<{ customName: string; quantity: number }>;
  materials: Array<{
    materialId: number;
    quantity: number;
    description: string;
    supplierId?: number;
    unitName?: string;
  }>;
  /** Días de anticipación con que suele pedir (null si no hay datos suficientes). */
  leadTimeDays: number | null;
}

/**
 * Perfil de hábitos que el sistema aprende del historial de pedidos de un
 * cliente (backend: client-insight.engine.ts). Se re-aprende solo con cada
 * pedido nuevo, borrado o cambio de su hoja de materiales.
 */
export interface ClientInsights {
  version: number;
  ordersAnalyzed: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  products: ClientProductHabit[];
  route: {
    designShare: number;
    requiresDesign: boolean;
    areas: Array<{ area: string; share: number }>;
  };
  materials: Array<{
    materialId: number;
    description: string;
    unitName?: string;
    supplierId?: number;
    orders: number;
    share: number;
    typicalQuantity: number;
  }>;
  leadTime: { days: number; samples: number } | null;
  /** Últimas fechas de entrega (ISO): de aquí sale la hora habitual, en hora local. */
  recentDeliveries: string[];
  cadence: { medianDays: number; samples: number; regular: boolean; nextExpectedAt: string } | null;
  suggestion: ClientSuggestedOrder | null;
}

/** Cliente que, por su ritmo habitual, debería estar por pedir (GET /client-insights/due). */
export interface DueClient {
  clientId: number;
  clientName: string;
  lastOrderAt: string | null;
  nextExpectedAt: string;
  medianDays: number;
  topProduct: string | null;
  ordersAnalyzed: number;
}

/* -------------------------------------------------------------------------- */
/* Inicio por rol (GET /dashboard/reception | design | production)            */
/* -------------------------------------------------------------------------- */

export interface DashboardOrderRef {
  id: number;
  clientName: string;
  description: string;
  products: Array<{ customName: string; quantity: number }>;
  deliveryDate: string | null;
  creationDate: string;
  statusName: string;
}

export interface DashboardPerson {
  id: number;
  name: string;
}

export type AreaHealth = "ok" | "warning" | "critical";

export interface DashboardAreaLoad {
  area: string;
  pending: number;
  inProgress: number;
  doneToday: number;
  overdue: number;
  atRisk: number;
  oldestWaitingSince: string | null;
  upcoming: number;
  changesRequested?: number;
  waitingClient?: number;
  people: string[];
  health: AreaHealth;
}

export type AttentionReason =
  | "overdue"
  | "ready_not_delivered"
  | "at_risk_not_started"
  | "waiting_client"
  | "changes_requested"
  | "design_not_started"
  | "no_date";

export interface DashboardAttentionItem extends DashboardOrderRef {
  reason: AttentionReason;
  since: string | null;
  area: string | null;
}

export interface DashboardLowStockItem {
  id: number;
  name: string;
  area: string;
  unit: string;
  quantity: number;
  minStock: number | null;
  stockStatus: "low" | "out";
}

export interface ReceptionDashboard {
  generatedAt: string;
  dayStart: string;
  totals: {
    active: number;
    inDesign: number;
    waitingClient: number;
    inProduction: number;
    ready: number;
    noDate: number;
  };
  deadlines: { overdue: number; atRisk: number; onTime: number; noDate: number };
  today: { created: number; delivered: number; tasksCompleted: number; designsApproved: number };
  areas: DashboardAreaLoad[];
  attention: DashboardAttentionItem[];
  attentionTotal: number;
  throughput: Array<{ day: string; created: number; delivered: number }>;
  clientsDue: DueClient[];
  alerts: {
    lowStock: number;
    outOfStock: number;
    lowStockItems: DashboardLowStockItem[];
    purchasesDue: number;
  };
}

export interface ProductionWorkItem extends DashboardOrderRef {
  key: string;
  taskId: number;
  area: string;
  status: "pendiente" | "en_proceso";
  mine: boolean;
  assignee: DashboardPerson | null;
  startedAt: string | null;
  /** Desde cuándo el área lo puede trabajar. */
  availableSince: string;
}

export interface ProductionDashboard {
  generatedAt: string;
  dayStart: string;
  areas: string[];
  counters: {
    overdue: number;
    atRisk: number;
    notStarted: number;
    inProgress: number;
    doneToday: number;
    upcoming: number;
  };
  items: ProductionWorkItem[];
  upcoming: Array<DashboardOrderRef & { area: string; designStatus: string }>;
  team: Array<{ name: string; inProgress: number }>;
  events: Array<{
    id: number;
    title: string;
    eventDate: string;
    hasTime: boolean;
    category: string;
    area: string | null;
    clientName: string | null;
    orderId: number | null;
  }>;
}

export interface DesignWorkItem extends DashboardOrderRef {
  key: string;
  status: string;
  mine: boolean;
  assignee: DashboardPerson | null;
  designStartedAt: string | null;
  designStartedByName: string | null;
  round: number;
  lastSentAt: string | null;
  lastFeedbackAt: string | null;
  availableSince: string;
  areas: string[];
}

export interface DesignDashboard {
  generatedAt: string;
  dayStart: string;
  counters: {
    changesRequested: number;
    notStarted: number;
    inProgress: number;
    waitingClient: number;
    overdue: number;
    atRisk: number;
    approvedToday: number;
    approvedWeek: number;
  };
  items: DesignWorkItem[];
  waitingClient: DesignWorkItem[];
  team: Array<{ userId: number | null; name: string; active: number; inProgress: number }>;
  rounds: { avgToApproval: number | null; approvedLast30: number; manyRounds: number };
}

