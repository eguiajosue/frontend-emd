"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT } from "@/lib/motion";

const STEP_TRANSITION = { duration: DUR.base, ease: EASE_OUT };
import type { Guide } from "./guides";

/**
 * Guía paso a paso: a la izquierda la mini pantalla animada del paso, a la
 * derecha qué hacer. Se navega con Anterior/Siguiente, los puntos o las
 * flechas del teclado.
 */
export function GuideStepper({ guide }: { guide: Guide }) {
  const [index, setIndex] = useState(0);
  const total = guide.steps.length;
  const step = guide.steps[index];
  const go = (next: number) => setIndex(Math.max(0, Math.min(total - 1, next)));

  return (
    <Card
      className="overflow-hidden"
      tabIndex={0}
      aria-label={`Guía de ${guide.label}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="bg-gradient-to-br from-navy-50 to-cyan-soft p-4 dark:from-secondary/50 dark:to-sunken sm:p-6" role="img" aria-label={`Animación: ${step.title}`}>
          <div className="mx-auto h-[16.5rem] max-w-md">
            {/* `key` reinicia la animación al cambiar de paso. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${guide.key}-${index}`}
                className="h-full"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={STEP_TRANSITION}
              >
                {step.scene}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="text-meta font-medium tabular-nums">
              Paso {index + 1} de {total}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div
                className="h-full rounded-full bg-accent-gradient transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={STEP_TRANSITION}
              className="space-y-2"
              aria-live="polite"
            >
              <h3 className="text-section-title">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-auto space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {guide.steps.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "hit-44 h-2 rounded-full transition-all duration-200 focus-ring",
                    i === index ? "w-6 bg-[hsl(var(--magenta-strong))]" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => go(index - 1)} disabled={index === 0}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              {index < total - 1 ? (
                <Button size="sm" onClick={() => go(index + 1)}>
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => go(0)}>
                  Volver a empezar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
