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
        "mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick} size="sm">
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.icon && (
                <secondaryAction.icon className="mr-2 h-4 w-4" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
