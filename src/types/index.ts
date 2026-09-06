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
}

/** Versión resumida de `User` que devuelve el backend embebida en `order.assignedUser`. */
export interface AssignedUser extends BaseEntity {
  firstName: string;
  lastName?: string | null;
  username: string;
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
  productId: number;
  quantity: number;
  product?: Product | null;
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
  clientId?: number;
  userId?: number;
  /** Usuario al que se le asignó el pedido (distinto de `user`, quien lo creó). */
  assignedUserId?: number | null;
  statusId: number;
  description: string;
  creationDate: string;
  deliveryDate?: string | null;
  client?: Client | null;
  user?: User | null;
  assignedUser?: AssignedUser | null;
  status?: Status | null;
  orderProducts?: OrderProduct[];
  /** Presente en el listado (GET /orders); el archivo completo NO viaja ahí. */
  hasAuthorizationFile?: boolean;
  /** Presente sólo en el detalle (GET /orders/:id). */
  authorizationFile?: AuthorizationFile | null;
}

export interface OrderHistory extends BaseEntity {
  orderId: number;
  previousStatusId: number;
  newStatusId: number;
  changeDate: string;
}

/* -------------------------------------------------------------------------- */
/* Payloads de escritura                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateOrderPayload {
  clientId: number;
  userId: number;
  assignedUserId?: number;
  statusId: number;
  description: string;
  deliveryDate?: string;
  orderProducts?: Array<{ productId: number; quantity: number }>;
  authorizationFile?: AuthorizationFileInput;
}

export interface UpdateOrderPayload {
  description?: string;
  deliveryDate?: string;
  statusId?: number;
  assignedUserId?: number | null;
  authorizationFile?: AuthorizationFileInput;
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
