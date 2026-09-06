/**
 * Micro-copy con variantes para las acciones MÁS frecuentes de la app
 * (crear pedido, cambiar estado). Rotar entre 2-3 frases con el mismo
 * significado evita que el toast se sienta robótico en uso repetido durante
 * el día, sin caer en informalidad ni tocar el resto de los mensajes del
 * sistema (que siguen siendo directos y sin sorpresas).
 */

function pickVariant(variants: string[]): string {
  return variants[Math.floor(Math.random() * variants.length)];
}

const ORDER_CREATED_VARIANTS = [
  "Pedido creado correctamente",
  "Pedido cargado — ya está en el tablero",
  "Listo, el pedido quedó registrado",
];

export function orderCreatedMessage(): string {
  return pickVariant(ORDER_CREATED_VARIANTS);
}

const ORDER_STATUS_UPDATED_VARIANTS = (orderId: number) => [
  `Pedido #${orderId} actualizado`,
  `Pedido #${orderId} avanzó de estado`,
  `Listo, pedido #${orderId} al día`,
];

export function orderStatusUpdatedMessage(orderId: number): string {
  return pickVariant(ORDER_STATUS_UPDATED_VARIANTS(orderId));
}
