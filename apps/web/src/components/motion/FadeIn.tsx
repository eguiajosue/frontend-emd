"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSET: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 10 },
  down: { y: -10 },
  left: { x: 10 },
  right: { x: -10 },
  none: {},
};

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition"> {
  /** Desde dónde llega. Por defecto sube 10px. */
  from?: Direction;
  /** Retraso en segundos (usa múltiplos de 0.05). */
  delay?: number;
  /** Duración en segundos (por defecto DUR.slow = 250ms). */
  duration?: number;
  /** Animar al entrar en pantalla en vez de al montar. */
  inView?: boolean;
}

/**
 * Aparición suave (fade + desplazamiento corto). Con "reducir movimiento"
 * sólo hace fade lineal de 150ms, sin desplazamiento.
 */
export function FadeIn({ from = "up", delay = 0, duration = DUR.slow, inView = false, ...props }: FadeInProps) {
  const reduced = useReducedMotion();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, ...OFFSET[from] };
  const shown = { opacity: 1, x: 0, y: 0 };
  const transition = reduced
    ? { duration: DUR.fast, ease: "linear" as const }
    : { duration, delay, ease: EASE_OUT };
  return inView ? (
    <motion.div initial={hidden} whileInView={shown} viewport={{ once: true, margin: "-40px" }} transition={transition} {...props} />
  ) : (
    <motion.div initial={hidden} animate={shown} transition={transition} {...props} />
  );
}
