/**
 * Transición "splash de tinta" al cambiar de tema (ThemeToggle).
 *
 * Usa la View Transitions API (soportada en Chromium/Edge; sin soporte en
 * Safari en el momento de escribir esto) combinada con un `clip-path: circle()`
 * animado con la Web Animations API sobre el pseudo-elemento
 * `::view-transition-new(root)`, expandiéndose desde el punto donde el
 * usuario tocó el botón — así el nuevo tema "se derrama" desde ahí en vez de
 * hacer un corte instantáneo.
 *
 * Sólo toca `clip-path` en un pseudo-elemento (compositor-friendly, no
 * dispara layout/paint del árbol real) y cae a un cambio instantáneo cuando:
 *  - el navegador no soporta `document.startViewTransition`, o
 *  - el usuario tiene `prefers-reduced-motion: reduce`.
 */

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Ejecuta `applyChange` (el side-effect que efectivamente cambia el tema) con
 * un splash de tinta originado en `(x, y)` — normalmente las coordenadas del
 * click en el botón de ThemeToggle. Si el navegador o las preferencias del
 * usuario no lo permiten, aplica el cambio al instante sin animación.
 */
export function runInkSplashTransition(
  applyChange: () => void,
  origin: { x: number; y: number }
): void {
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    applyChange();
    return;
  }

  const { x, y } = origin;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(() => {
    applyChange();
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 650, // premium pero rápido, en línea con DURATION_ENTRANCE*~2 de motion.ts
          easing: "cubic-bezier(0.16, 1, 0.3, 1)", // EASE_OUT de motion.ts
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      // Si la transición se cancela (p.ej. click repetido muy rápido), no rompemos nada:
      // el cambio de tema ya se aplicó dentro del callback de startViewTransition.
    });
}
