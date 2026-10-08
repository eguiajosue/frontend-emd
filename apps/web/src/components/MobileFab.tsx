"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Botón flotante de la acción principal de la pantalla, sólo en teléfono:
 * queda al alcance del pulgar, encima de la barra de pestañas (y del home
 * indicator), en vez de arriba junto al título.
 */
export function MobileFab({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  const reduced = useReducedMotion();
  // Al bajar se encoge a sólo el ícono (y deja ver más contenido); arriba, con texto.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      layout={!reduced}
      transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
      aria-label={label}
      className="fixed right-4 z-30 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-ink px-4 text-base font-semibold text-ink-foreground shadow-soft-md [-webkit-tap-highlight-color:transparent] md:hidden bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
    >
      <Icon className="h-6 w-6" aria-hidden />
      {!compact && <span className="pr-1">{label}</span>}
    </motion.button>
  );
}
