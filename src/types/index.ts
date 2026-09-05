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
  last_name: string;
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

export interface Order extends BaseEntity {
  clientId?: number;
  userId?: number;
  statusId: number;
  description: string;
  creationDate: string;
  deliveryDate?: string | null;
  client?: Client | null;
  user?: User | null;
  status?: Status | null;
  orderProducts?: OrderProduct[];
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
  statusId: number;
  description: string;
  deliveryDate?: string;
  orderProducts?: Array<{ productId: number; quantity: number }>;
}

export interface UpdateOrderPayload {
  description?: string;
  deliveryDate?: string;
  statusId?: number;
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
