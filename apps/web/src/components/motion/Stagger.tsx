"use client";

import { createContext, useContext } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { DUR, EASE_OUT, STAGGER_STEP } from "@/lib/motion";

const ReducedCtx = createContext(false);

const containerVariants = (step: number, delay: number) => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_OUT } },
};
const reducedItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: "linear" as const } },
};

interface StaggerProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate"> {
  /** Segundos entre hijos (por defecto 45ms). */
  step?: number;
  /** Retraso antes del primer hijo. */
  delay?: number;
  /** Animar al entrar en pantalla en vez de al montar. */
  inView?: boolean;
  /** Renderizar como otro elemento (ul, section…). */
  as?: "div" | "ul" | "ol" | "section";
}

/**
 * Contenedor que escalona la entrada de sus `<StaggerItem>`. Úsalo para grids
 * de KPIs, listas de tarjetas, filas. Con "reducir movimiento" los hijos
 * aparecen con un fade corto, sin escalonado ni desplazamiento.
 *
 *   <Stagger className="grid gap-4 sm:grid-cols-3">
 *     {kpis.map(k => <StaggerItem key={k.id}><StatCard .../></StaggerItem>)}
 *   </Stagger>
 */
export function Stagger({ step = STAGGER_STEP, delay = 0.02, inView = false, as = "div", ...props }: StaggerProps) {
  const reduced = Boolean(useReducedMotion());
  const Comp = motion[as] as typeof motion.div;
  const variants = containerVariants(reduced ? 0 : step, delay);
  return (
    <ReducedCtx.Provider value={reduced}>
      {inView ? (
        <Comp variants={variants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} {...props} />
      ) : (
        <Comp variants={variants} initial="hidden" animate="show" {...props} />
      )}
    </ReducedCtx.Provider>
  );
}

interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  as?: "div" | "li" | "article" | "section";
}

/** Hijo de `<Stagger>`: fade + sube 10px (fade a secas si se reduce el movimiento). */
export function StaggerItem({ as = "div", ...props }: StaggerItemProps) {
  const reduced = useContext(ReducedCtx);
  const Comp = motion[as] as typeof motion.div;
  return <Comp variants={reduced ? reducedItemVariants : itemVariants} {...props} />;
}
