/**
 * En el teléfono los avisos en vivo (pedido nuevo, cambio de estado, chat) no
 * salen como pop-up encima de lo que la persona está haciendo: ya llegan a la
 * campana y a los contadores, que laten al subir. Sólo lo que pide atención
 * directa da una vibración corta.
 *
 * Los toasts que responden a algo que la persona acaba de hacer ("Deshacer",
 * errores) no pasan por aquí: ésos sí se ven siempre.
 */
export const COMPACT_QUERY = "(max-width: 767px)";

export function isCompactScreen(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

/** Aviso discreto en lugar del pop-up: vibración corta si es importante. */
export function quietNotice(important = false) {
  if (!important || typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(60);
  } catch {
    /* sin vibración: la campana igual late */
  }
}
