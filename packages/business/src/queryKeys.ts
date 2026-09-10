/**
 * Endpoints del backend y query keys de React Query.
 *
 * Centralizarlos garantiza que dos pantallas que piden la misma entidad
 * compartan cache (deduplicación) y que las invalidaciones post-mutación
 * apunten siempre a la misma key.
 */

export const ENDPOINTS = {
  orders: "orders",
  clients: "clients",
  companies: "companies",
  users: "users",
  roles: "roles",
  orderHistories: "order-histories",
  areaVisibility: "area-visibility",
  orderProductPresets: "order-product-presets",
  performanceSummary: "performance/summary",
  settings: "settings",
  orderHistory: "orders/history",
  notifications: "notifications",
  chat: "chat",
  // Catálogo de estados (`GET /status`): los 4 del circuito de Diseño se
  // siembran con ids que cambian entre entornos, así que el tablero los
  // resuelve por nombre desde acá en vez de hardcodearlos.
  statuses: "status",
} as const;

export type EntityKey = keyof typeof ENDPOINTS;

export const queryKeys = {
  all: (entity: EntityKey) => [entity] as const,
  list: (entity: EntityKey, params?: Record<string, unknown>): unknown[] =>
    params ? [entity, "list", params] : [entity, "list"],
  detail: (entity: EntityKey, id: number | string) =>
    [entity, "detail", String(id)] as const,
};
