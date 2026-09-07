// Ids sembrados por backend-emd/prisma/seed.ts (STATUS_SEEDS, con id
// explícito). El id 2 ("en pruebas") fue RETIRADO del flujo: sus pedidos se
// migraron a "en proceso" (ver la migración
// 20260906140000_remove_en_pruebas_status) y el id no se reutiliza.
export const statusMap: { [key: number]: string } = {
  1: "pendiente",
  3: "en proceso",
  4: "terminado",
  5: "entregado",
};

// Estados que ya no existen pero que pueden seguir apareciendo en textos
// históricos (historial de pedidos viejo, notificaciones ya emitidas). Se
// mantienen sólo para que esos registros sigan renderizándose legibles.
export const retiredStatusMap: { [key: number]: string } = {
  2: "en pruebas",
};

/** Nombre legible de un estado, incluidos los retirados del flujo. */
export const statusLabel = (
  statusId: number | null | undefined,
  fallback = "desconocido",
): string => {
  if (statusId == null) return fallback;
  return statusMap[statusId] ?? retiredStatusMap[statusId] ?? fallback;
};

// Sólo estados vigentes: los retirados no se ofrecen en selectores/filtros.
export const statusOptions = Object.entries(statusMap).map(([id, name]) => ({
  value: Number(id),
  label: name,
}));

/**
 * Id de estado "entregado". Fuente única de verdad para saber si un pedido ya
 * fue entregado (sin depender de comparar el label en texto) — usar
 * `isDeliveredStatus` desde cualquier componente que necesite suprimir la UI
 * de urgencia (borde rojo/pulso de vencido, barra de progreso) para pedidos
 * ya entregados.
 */
export const DELIVERED_STATUS_ID = 5;

export function isDeliveredStatus(statusId: number): boolean {
  return statusId === DELIVERED_STATUS_ID;
}

/**
 * Orden lineal del flujo "normal" de un pedido (pendiente → en proceso →
 * terminado → entregado). Usado sólo para ofrecer, en la lista de pedidos,
 * un botón de acción rápida con el "próximo" estado sugerido — no reemplaza
 * a `OrderStatusButtons` (que permite ir a cualquier estado a mano).
 */
export const STATUS_FLOW_ORDER: number[] = [1, 3, 4, 5];

/**
 * Próximo estado del flujo lineal después de `currentStatusId`, o `null` si
 * ya es el último (entregado) o el estado actual no forma parte del flujo
 * conocido (ej. un estado del flujo de diseño).
 */
export function getNextStatusOption(
  currentStatusId: number
): { value: number; label: string } | null {
  const index = STATUS_FLOW_ORDER.indexOf(currentStatusId);
  if (index === -1 || index === STATUS_FLOW_ORDER.length - 1) return null;
  const nextId = STATUS_FLOW_ORDER[index + 1];
  return { value: nextId, label: statusMap[nextId] ?? `Estado ${nextId}` };
}

/**
 * Estados del flujo de diseño (opcional, `Order.requiresDesign`). El backend
 * los siembra con ids que pueden variar entre entornos, así que NUNCA se
 * hardcodean acá — se identifican por NOMBRE contra `order.status?.name`
 * (que el backend siempre incluye en `GET /orders`).
 *
 * No forman parte de `statusMap`/`statusOptions` a propósito: eso hace que el
 * selector manual de estado (`OrderStatusButtons`) nunca los muestre — sólo
 * se llega a ellos a través de las acciones del flujo de diseño
 * (`useDesignRevisions`), nunca a mano.
 */
export const DESIGN_FLOW_STATUS_NAMES = {
  EN_DISENO: "en diseño",
  ESPERANDO_AUTORIZACION: "esperando autorización",
  CAMBIOS_SOLICITADOS: "cambios solicitados",
  AUTORIZADO: "autorizado",
} as const;

export type DesignFlowStatusName =
  (typeof DESIGN_FLOW_STATUS_NAMES)[keyof typeof DESIGN_FLOW_STATUS_NAMES];

const DESIGN_FLOW_STATUS_NAME_SET = new Set<string>(
  Object.values(DESIGN_FLOW_STATUS_NAMES)
);

/** `true` si `name` (case-insensitive) es uno de los 4 estados del flujo de diseño. */
export function isDesignFlowStatusName(name: string | null | undefined): boolean {
  return !!name && DESIGN_FLOW_STATUS_NAME_SET.has(name.toLowerCase());
}

/** Compara el nombre de estado de un pedido contra un estado del flujo de diseño, sin importar mayúsculas/acentos de capitalización. */
export function isOrderInDesignStatus(
  statusName: string | null | undefined,
  target: DesignFlowStatusName
): boolean {
  return (statusName ?? "").toLowerCase() === target;
}
