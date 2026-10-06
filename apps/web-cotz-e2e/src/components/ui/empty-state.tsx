"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Empty state reusable con voz propia.
 *
 * Reemplaza pantallas en blanco / "No hay datos" genéricos por un ícono
 * ilustrativo, un título con carácter y (cuando tiene sentido) una acción
 * concreta para salir del estado vacío. Pensado para tablas, listas y
 * secciones del dashboard — mantiene el tono profesional-cálido del resto
 * de la app, no lo vuelve infantil.
 */

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Segunda acción secundaria, ej. "Limpiar filtros" junto a "Crear pedido". */
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const { reduced } = useMotionPreset();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.15, ease: "linear" } : { duration: 0.25 }}
      className={cn(
        "mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-12 text-center shadow-soft",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick}>
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.icon && (
                <secondaryAction.icon className="h-4 w-4" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
