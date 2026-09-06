export const statusMap: { [key: number]: string } = {
  1: "pendiente",
  2: "en pruebas",
  3: "en proceso",
  4: "terminado",
  5: "entregado",
};

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
