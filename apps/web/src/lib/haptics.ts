/**
 * Vibración corta al confirmar una acción, como en las apps nativas. Sólo
 * Android la soporta desde la web (iOS la ignora); con "reducir movimiento"
 * o sin soporte no hace nada.
 */
const PATTERNS = { light: 8, medium: 16, success: [10, 40, 14] } as const;

export function haptic(kind: keyof typeof PATTERNS = "light") {
  if (typeof navigator === "undefined" || typeof window === "undefined") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(PATTERNS[kind] as number | number[]);
  } catch {
    /* sin vibración */
  }
}
