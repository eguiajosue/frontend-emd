"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface TourStep {
  /** Selector del elemento a resaltar. Si no existe en el DOM, el paso se salta. */
  selector: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="sidebar-nav"]',
    title: "Navegación",
    description: "Desde acá accedés a Pedidos, Historial, Clientes y más, según tu rol.",
  },
  {
    selector: '[data-tour="new-order-button"]',
    title: "Nueva orden",
    description: "Creá un pedido nuevo con este botón, desde la pantalla de Pedidos.",
  },
  {
    selector: '[data-tour="theme-toggle"]',
    title: "Tema",
    description: "Cambiá entre claro y oscuro cuando quieras, se guarda en tu cuenta.",
  },
  {
    selector: '[data-tour="help-link"]',
    title: "Ayuda",
    description: "Si algo no queda claro, acá encontrás guías y soporte.",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(selector: string): TargetRect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Tour breve (spotlight + tooltip) para usuarios nuevos, disparado una sola
 * vez (flag `hasSeenOnboarding` en preferencias de usuario). Si un paso no
 * puede targetear su elemento (no existe en la pantalla actual), se salta
 * automáticamente en vez de romper el tour.
 */
export function OnboardingTour() {
  const { status } = useSession();
  const { preferences, updatePreferences } = useUserPreferences();
  const { reduced } = useMotionPreset();
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const shouldRun =
    status === "authenticated" &&
    !!preferences &&
    preferences.hasSeenOnboarding !== true &&
    !dismissed;

  useEffect(() => {
    if (shouldRun && !active) {
      // Pequeño delay: da tiempo a que el layout del dashboard termine de montar.
      const t = setTimeout(() => setActive(true), 400);
      return () => clearTimeout(t);
    }
  }, [shouldRun, active]);

  const finish = useCallback(() => {
    setActive(false);
    setDismissed(true);
    updatePreferences({ hasSeenOnboarding: true });
  }, [updatePreferences]);

  // Busca el primer paso targeteable a partir de `stepIndex`, saltando los que no existen.
  const recompute = useCallback(() => {
    if (!active) return;
    let idx = stepIndex;
    while (idx < STEPS.length) {
      const r = getRect(STEPS[idx].selector);
      if (r) {
        setStepIndex(idx);
        setRect(r);
        return;
      }
      idx += 1;
    }
    // Ningún paso restante se pudo targetear: termina el tour sin romper nada.
    finish();
  }, [active, stepIndex, finish]);

  useEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [active, recompute]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex >= STEPS.length - 1;

  const tooltipStyle = useMemo(() => {
    if (!rect) return undefined;
    const padding = 12;
    const preferBelow = rect.top < window.innerHeight * 0.6;
    return {
      top: preferBelow ? rect.top + rect.height + padding : undefined,
      bottom: preferBelow ? undefined : window.innerHeight - rect.top + padding,
      left: Math.min(Math.max(rect.left, padding), window.innerWidth - 320 - padding),
    };
  }, [rect]);

  if (!active || !rect || !step) return null;

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[110]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.01 : 0.2 }}
      >
        {/* Overlay con "recorte" (spotlight) sobre el elemento actual vía box-shadow. */}
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-[top,left,width,height] duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />

        <motion.div
          key={stepIndex}
          className={cn("glass-heavy fixed w-80 max-w-[calc(100vw-24px)] rounded-xl border p-4 shadow-2xl")}
          style={tooltipStyle}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{step.title}</p>
            <button
              type="button"
              aria-label="Cerrar tour"
              onClick={finish}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {stepIndex + 1} / {STEPS.length}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={finish}>
                Saltar
              </Button>
              <Button size="sm" onClick={handleNext}>
                {isLast ? "Listo" : "Siguiente"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
