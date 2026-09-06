"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMotionPreset } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChartDrillDownPanelProps {
  /** Identificador del segmento seleccionado (área, etapa, etc.) — `null`/`undefined` = cerrado. */
  activeKey: string | null | undefined;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Panel de desglose que se expande DEBAJO de un gráfico al hacer click en un
 * segmento (barra), sin navegar a otra página ni tapar el gráfico con un
 * modal — mantiene el contexto visual del gráfico arriba (drill-down "en
 * línea"). Se anima con `layout` + `AnimatePresence` (fade + collapse de
 * altura), respetando `prefers-reduced-motion` vía `useMotionPreset`.
 */
export function ChartDrillDownPanel({
  activeKey,
  title,
  onClose,
  children,
  className,
}: ChartDrillDownPanelProps) {
  const { reduced } = useMotionPreset();

  return (
    <AnimatePresence initial={false}>
      {activeKey != null && (
        <motion.div
          key={activeKey}
          layout={!reduced}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={
            reduced ? { duration: 0.15, ease: "linear" } : { type: "spring", bounce: 0, duration: 0.32 }
          }
          className="overflow-hidden"
        >
          <div
            className={cn(
              "mt-4 rounded-xl border border-border/60 bg-muted/30 p-4",
              className
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{title}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
                Cerrar desglose
              </Button>
            </div>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
