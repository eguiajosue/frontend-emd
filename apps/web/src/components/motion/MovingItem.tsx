"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Elemento de una lista/columna que se DESLIZA a su nuevo lugar cuando cambia
 * de columna (mismo `layoutId` en ambas) en vez de desaparecer y aparecer.
 * Con "reducir movimiento" no se anima nada.
 *
 * Las columnas que comparten tarjetas van dentro de un mismo `<LayoutGroup>`.
 */
export function MovingItem({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <li className={className}>{children}</li>;
  return (
    <motion.li
      layoutId={id}
      layout="position"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ layout: { type: "spring", bounce: 0.12, duration: 0.45 }, default: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.li>
  );
}
