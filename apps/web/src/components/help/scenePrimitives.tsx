"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_DEFAULT } from "@/lib/motion";

/**
 * Fase actual de una escena animada: avanza sola cada `ms` y vuelve a empezar.
 * Con "reducir movimiento" queda fija en la última fase (el resultado final),
 * así la explicación se entiende igual sin animación.
 */
export function useScenePhase(count: number, ms = 1300): number {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setPhase((p) => (p + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms, reduced]);
  return reduced ? count - 1 : phase;
}

/** Marco de "mini pantalla": barra superior con el nombre de la sección. */
export function Screen({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background shadow-soft">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-navy-50 px-3 py-2 dark:bg-secondary/60">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--magenta))]" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--lime))]" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--cyan))]" />
        <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">{title}</span>
      </div>
      <div className={cn("relative p-3 text-xs", className)}>{children}</div>
    </div>
  );
}

/**
 * Cursor que se mueve a una posición (en % del contenedor) y "hace clic"
 * cuando `click` es verdadero. `at = null` lo oculta.
 */
export function Cursor({ at, click = false }: { at: [number, number] | null; click?: boolean }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-20"
      initial={false}
      animate={{
        left: `${at?.[0] ?? 50}%`,
        top: `${at?.[1] ?? 50}%`,
        opacity: at ? 1 : 0,
        scale: click ? 0.8 : 1,
      }}
      transition={{ type: "spring", bounce: 0, duration: 0.6 }}
    >
      <MousePointer2 className="h-5 w-5 fill-foreground text-background drop-shadow" />
      {click && (
        <motion.span
          className="absolute -left-2 -top-2 h-6 w-6 rounded-full border-2 border-primary"
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}

/** Botón falso de las escenas; se resalta cuando el cursor lo "presiona". */
export function FakeButton({
  children,
  pressed = false,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pressed?: boolean;
  variant?: "primary" | "outline";
  className?: string;
}) {
  return (
    <motion.span
      animate={{ scale: pressed ? 0.94 : 1 }}
      transition={SPRING_DEFAULT}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
        variant === "primary"
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-foreground",
        pressed && "ring-2 ring-primary/40",
        className
      )}
    >
      {children}
    </motion.span>
  );
}

/** Píldora de estado con color según tono. */
export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "amber" | "blue" | "green" | "red" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-warning-soft text-warning",
    blue: "bg-cyan-soft text-cyan-ink",
    green: "bg-success-soft text-success",
    red: "bg-destructive/10 text-destructive",
    violet: "bg-magenta-soft text-magenta-ink",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Texto que se "escribe" letra por letra mientras `active`. */
export function Typing({ text, active }: { text: string; active: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) return;
    if (!active) {
      setShown(0);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 55);
    return () => window.clearInterval(id);
  }, [active, text, reduced]);
  return (
    <span>
      {text.slice(0, reduced ? text.length : shown)}
      {active && !reduced && <span className="animate-pulse">|</span>}
    </span>
  );
}
