"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMotionPreset } from "@/lib/motion";

/**
 * Transición de ruta del dashboard: la página saliente se desvanece (150ms) y
 * la entrante sube 8px con fade (200ms). Con "reducir movimiento" sólo fade
 * lineal. Envuelve el contenido en `dashboard/layout.tsx` (ya está puesto; las
 * páginas NO deben volver a envolverse en él).
 */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const { routeTransition } = useMotionPreset();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={routeTransition.initial}
        animate={routeTransition.animate}
        exit={routeTransition.exit}
        transition={routeTransition.transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
