/**
 * Constantes de movimiento centralizadas (Design DNA).
 *
 * Mantienen el mismo "tempo" en toda la app en vez de números mágicos
 * dispersos en cada componente con framer-motion.
 *
 * Refinamiento "Apple fluid interfaces": las transiciones de UI (aparición de
 * modales/cards, stagger de listas, hover) usan springs con amortiguación
 * crítica en vez de duration+ease fijos — no hay gestos de flick en este
 * dashboard (es clicks/forms/tablas), así que nunca agregamos bounce/overshoot,
 * que la guía reserva para interacciones con momentum de gesto real.
 */
import { useReducedMotion } from "framer-motion";

// Duraciones (segundos, para framer-motion). Se mantienen para lo que sigue
// usando duration+ease (transiciones CSS-like, timers no interactivos).
export const DURATION_MICRO = 0.15; // hover, toggles, focus
export const DURATION_STANDARD = 0.22; // transiciones de ruta, aparición/cierre de paneles
export const DURATION_ENTRANCE = 0.35; // entrada de listas/cards al montar

// Easings (se conservan para casos puntuales, p.ej. crossfade de reduced-motion).
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// Desplazamiento sutil para animaciones de entrada (fade + slide).
export const ENTRANCE_OFFSET_Y = 10;

/**
 * Spring por defecto para toda animación de UI que NO tiene un gesto de
 * arrastre/flick detrás (aparición de modal, entrada de card, hover, stagger).
 * Framer Motion (API bounce+duration) — bounce 0 = amortiguación crítica,
 * equivalente al damping 1.0 / "no overshoot" de Apple.
 */
export const SPRING_DEFAULT = {
  type: "spring" as const,
  bounce: 0,
  duration: DURATION_ENTRANCE,
};

/** Spring más rápido para micro-interacciones (hover, press). */
export const SPRING_MICRO = {
  type: "spring" as const,
  bounce: 0,
  duration: DURATION_MICRO,
};

/** Spring para transiciones de ruta / paneles. */
export const SPRING_STANDARD = {
  type: "spring" as const,
  bounce: 0,
  duration: DURATION_STANDARD,
};

/** Transición de entrada estándar para un solo elemento (fade + slide sutil). */
export const entranceTransition = SPRING_DEFAULT;

/** Variants de framer-motion para stagger sutil en listas/grids. */
export const staggerContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: ENTRANCE_OFFSET_Y },
  show: {
    opacity: 1,
    y: 0,
    transition: entranceTransition,
  },
};

/** Transición de fade usada entre vistas del dashboard (dashboard/layout.tsx). */
export const routeTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: SPRING_STANDARD,
};

/** Micro-interacción de hover sutil para cards clickeables (whileHover de framer-motion). */
export const cardHoverMotion = {
  whileHover: { scale: 1.015 },
  transition: SPRING_MICRO,
};

/**
 * Feedback de press instantáneo (whileTap) para tarjetas/elementos clickeables
 * que no son <button> (donde el feedback vive en CSS :active, ver button.tsx).
 * Distinto del hover: se dispara en pointer-down, no al pasar el mouse.
 */
export const cardTapMotion = {
  whileTap: { scale: 0.97 },
  transition: SPRING_MICRO,
};

/** Micro-interacción para botones de formulario (hover/tap con spring, sin cambiar tamaño de layout). */
export const formButtonMotion = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.97 },
  transition: SPRING_MICRO,
};

/**
 * Variantes "reducidas" (crossfade simple, sin desplazamiento ni escala) para
 * cuando el usuario tiene prefers-reduced-motion activado. Framer Motion no
 * puede leer la media query dentro de un objeto de variants estático, así que
 * los componentes deben resolver cuál usar con el hook `useMotionPreset` de
 * abajo en vez de importar `staggerItemVariants`/`routeTransition` a secas
 * cuando quieran respetar reduced-motion explícitamente.
 */
export const reducedStaggerItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15, ease: "linear" as const } },
};

export const reducedRouteTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: "linear" as const },
};

/**
 * Hook central para reduced-motion: devuelve el set de variants/transition
 * correcto según `prefers-reduced-motion` del sistema (vía useReducedMotion
 * nativo de framer-motion), para que ningún componente tenga que reimplementar
 * la media query.
 */
export function useMotionPreset() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    staggerItemVariants: reduced ? reducedStaggerItemVariants : staggerItemVariants,
    routeTransition: reduced ? reducedRouteTransition : routeTransition,
    cardHoverMotion: reduced ? { whileHover: {}, transition: { duration: 0 } } : cardHoverMotion,
    cardTapMotion: reduced ? { whileTap: {}, transition: { duration: 0 } } : cardTapMotion,
    formButtonMotion: reduced
      ? { whileHover: {}, whileTap: {}, transition: { duration: 0 } }
      : formButtonMotion,
  };
}
