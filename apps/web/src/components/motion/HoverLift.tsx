"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { SPRING_MICRO } from "@/lib/motion";

interface HoverLiftProps extends HTMLMotionProps<"div"> {
  /** Píxeles que sube al hover (por defecto 3). */
  lift?: number;
}

/**
 * Envoltorio para tarjetas clicables que no son <button>: sube al pasar el
 * mouse y se hunde al presionar. Sin movimiento si se prefiere reducirlo.
 * Para casos sin framer-motion existe la clase CSS `interactive-lift`.
 */
export function HoverLift({ lift = 3, ...props }: HoverLiftProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -lift }}
      whileTap={reduced ? undefined : { scale: 0.985, y: 0 }}
      transition={SPRING_MICRO}
      {...props}
    />
  );
}
