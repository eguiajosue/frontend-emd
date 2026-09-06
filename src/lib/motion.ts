/**
 * Constantes de movimiento centralizadas (Design DNA).
 *
 * Mantienen el mismo "tempo" en toda la app en vez de números mágicos
 * dispersos en cada componente con framer-motion.
 */

// Duraciones (segundos, para framer-motion).
export const DURATION_MICRO = 0.15; // hover, toggles, focus
export const DURATION_STANDARD = 0.22; // transiciones de ruta, aparición/cierre de paneles
export const DURATION_ENTRANCE = 0.35; // entrada de listas/cards al montar

// Easings.
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// Desplazamiento sutil para animaciones de entrada (fade + slide).
export const ENTRANCE_OFFSET_Y = 10;

/** Transición de entrada estándar para un solo elemento (fade + slide sutil). */
export const entranceTransition = {
  duration: DURATION_ENTRANCE,
  ease: EASE_OUT,
};

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
  transition: { duration: DURATION_STANDARD, ease: EASE_OUT },
};

/** Micro-interacción de hover sutil para cards clickeables (whileHover de framer-motion). */
export const cardHoverMotion = {
  whileHover: { scale: 1.015 },
  transition: { duration: DURATION_MICRO, ease: EASE_IN_OUT },
};
