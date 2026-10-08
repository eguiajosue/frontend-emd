"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Cuánto hay que jalar (px de dedo) para que suelte la actualización. */
export const PULL_THRESHOLD = 80;

/** `true` en la app instalada (Android/iOS): ahí el navegador no trae su propio "jalar para actualizar". */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Resistencia del jalón: al principio sigue al dedo, luego cuesta más. */
export function pullDistance(dy: number): number {
  if (dy <= 0) return 0;
  return Math.min(140, dy < PULL_THRESHOLD ? dy * 0.6 : PULL_THRESHOLD * 0.6 + (dy - PULL_THRESHOLD) * 0.25);
}

/**
 * "Jalar para actualizar" de la app instalada: desde arriba de la pantalla,
 * al soltar pasado el umbral vuelve a pedir los datos visibles (con una
 * vibración corta). No se activa con un diálogo abierto ni en el navegador
 * normal, que ya tiene el suyo.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const fetching = useIsFetching();
  const [enabled, setEnabled] = useState(false);
  const [dy, setDy] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => setEnabled(isStandaloneApp() && "ontouchstart" in window), []);

  useEffect(() => {
    if (refreshing && fetching === 0) {
      const t = setTimeout(() => setRefreshing(false), 300);
      return () => clearTimeout(t);
    }
  }, [refreshing, fetching]);

  useEffect(() => {
    if (!enabled) return;
    const blocked = () => window.scrollY > 0 || !!document.querySelector("[role='dialog'][data-state='open']");
    const onStart = (e: TouchEvent) => {
      start.current = blocked() || e.touches.length > 1 ? null : e.touches[0].clientY;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const d = e.touches[0].clientY - start.current;
      if (d <= 0 || window.scrollY > 0) {
        setDy(0);
        return;
      }
      setDy(d);
      const over = d >= PULL_THRESHOLD;
      if (over !== armed.current) {
        armed.current = over;
        if (over) haptic("light");
      }
    };
    const onEnd = () => {
      if (start.current != null && armed.current) {
        haptic("medium");
        setRefreshing(true);
        void queryClient.refetchQueries({ type: "active" });
      }
      start.current = null;
      armed.current = false;
      setDy(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, queryClient]);

  if (!enabled || (dy === 0 && !refreshing)) return null;
  const offset = refreshing ? PULL_THRESHOLD * 0.6 : pullDistance(dy);
  const ready = dy >= PULL_THRESHOLD;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center top-[calc(4rem+env(safe-area-inset-top))]"
      style={{ transform: `translateY(${offset - 24}px)`, opacity: Math.min(1, offset / 30) }}
      role="status"
      aria-live="polite"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft-md ring-1 ring-border/60">
        {refreshing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            <span className="sr-only">Actualizando…</span>
          </>
        ) : (
          <ArrowDown
            className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", ready && "rotate-180 text-primary")}
            aria-label={ready ? "Suelta para actualizar" : "Jala para actualizar"}
          />
        )}
      </span>
    </div>
  );
}
