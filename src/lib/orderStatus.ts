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
