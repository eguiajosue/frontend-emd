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

/**
 * Toast de alta: con número y destino ("a Diseño", "a Taller") dice qué pasó
 * con el pedido, que es lo que Recepción quiere confirmar. Sin datos cae a
 * las variantes genéricas.
 */
export function orderCreatedMessage(details?: { id?: number; destination?: string }): string {
  if (details?.id && details.destination) {
    return `Pedido #${details.id} enviado a ${details.destination}`;
  }
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
