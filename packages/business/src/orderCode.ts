/**
 * Código legible de un pedido: `EMD-P0042`. Es lo que ve y dicta la gente en
 * vez del id interno. Se deriva del id (único, nunca cambia, sin columna
 * propia ni migración); el relleno a 4 dígitos crece solo pasado el 9999.
 * Misma regla que `formatOrderCode` en el backend (`src/order/order-code.ts`).
 */
export const ORDER_CODE_PREFIX = "EMD-P";

export function formatOrderCode(id: number | string): string {
  // Acepta string porque algunos payloads (socket, query string) traen el id
  // como texto.
  return `${ORDER_CODE_PREFIX}${String(id).padStart(4, "0")}`;
}

/**
 * Id del pedido a partir de lo que alguien escribe: acepta el código completo
 * ("EMD-P0042", "emd p42"), sólo la parte "P42", "#42" o "42".
 * `null` si el texto no es un código de pedido.
 */
export function parseOrderCode(text: string): number | null {
  const match = text
    .trim()
    .match(/^(?:emd[\s_-]*)?(?:p[\s_-]*)?#?0*(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * ¿La búsqueda apunta a este pedido por su código? Exacto si se tipeó un
 * código/número completo, o por prefijo del código formateado ("EMD-P00").
 */
export function matchesOrderCode(query: string, id: number): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (parseOrderCode(q) === id) return true;
  return q.length >= 3 && formatOrderCode(id).toLowerCase().startsWith(q);
}
