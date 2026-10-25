"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";

interface AnimatedNumberProps {
  value: number;
  /** Decimales a mostrar. */
  decimals?: number;
  /** `Intl.NumberFormat` options o formateador propio (moneda, %, etc.). */
  format?: Intl.NumberFormatOptions | ((n: number) => string);
  locale?: string;
  prefix?: string;
  suffix?: string;
  /** Segundos (por defecto 0.6; es el único movimiento que puede pasar de 250ms: cuenta, no desplaza). */
  duration?: number;
  className?: string;
}

/**
 * Contador animado para KPIs: cuenta desde el valor anterior (o 0 la primera
 * vez, al entrar en pantalla) hasta `value`. Con "reducir movimiento" muestra
 * el valor final de inmediato. Cifras tabulares para que no "bailen".
 * El texto accesible siempre es el valor final (aria-label).
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  format,
  locale = "es-MX",
  prefix = "",
  suffix = "",
  duration = 0.6,
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(reduced ? value : 0);
  const from = useRef(0);

  const fmt = (n: number) => {
    if (typeof format === "function") return format(n);
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      ...format,
    }).format(n);
  };

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      from.current = value;
      return;
    }
    if (!inView) return;
    const controls = animate(from.current, value, {
      duration: Math.max(duration, DUR.base),
      ease: EASE_OUT,
      onUpdate: (n) => setDisplay(n),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => controls.stop();
  }, [value, inView, reduced, duration]);

  const finalText = `${prefix}${fmt(value)}${suffix}`;
  return (
    <span ref={ref} aria-label={finalText} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span aria-hidden>{`${prefix}${fmt(display)}${suffix}`}</span>
    </span>
  );
}
