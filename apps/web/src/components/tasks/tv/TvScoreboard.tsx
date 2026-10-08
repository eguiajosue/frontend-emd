"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { CheckCircle2, Flame, Target, Trophy } from "lucide-react";
import type { AreaScoreboard } from "@/hooks/useAreaScoreboard";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "UTC" });

/** Cifra que sube contando cuando cambia (no al montar); quieta con "reducir movimiento". */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduced) return void mv.set(value);
    const controls = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduced, mv]);
  return <motion.span>{text}</motion.span>;
}

export function onTimeRate(s: { done: number; onTime: number }): number | null {
  return s.done > 0 ? Math.round((s.onTime / s.done) * 100) : null;
}

export function bestDayLabel(best: AreaScoreboard["bestDay"]): string | null {
  if (!best) return null;
  const day = WEEKDAY.format(new Date(`${best.date}T12:00:00Z`));
  return `${best.done} el ${day}`;
}

/**
 * Marcador del equipo en el Modo TV: lo terminado hoy (cuenta hacia arriba al
 * terminar algo), qué tanto salió a tiempo en la semana, la racha de días sin
 * atrasos y el mejor día de las últimas dos semanas. Sin celebraciones fuera
 * de la tele.
 */
export function TvScoreboard({ data }: { data: AreaScoreboard }) {
  const rate = onTimeRate(data.week);
  const best = bestDayLabel(data.bestDay);
  const record = !!data.bestDay && data.today.done > 0 && data.today.done >= data.bestDay.done;
  const items = [
    {
      key: "hoy",
      icon: CheckCircle2,
      tone: "text-[hsl(var(--brand-lime))]",
      value: <CountUp value={data.today.done} />,
      label: record ? "Terminadas hoy · ¡récord!" : "Terminadas hoy",
    },
    {
      key: "a-tiempo",
      icon: Target,
      tone: "text-[hsl(var(--brand-cyan))]",
      value: rate == null ? "—" : `${rate}%`,
      label: "Entregado a tiempo (semana)",
    },
    {
      key: "racha",
      icon: Flame,
      tone: "text-[hsl(var(--brand-magenta))]",
      value: <CountUp value={data.streakDays} />,
      label: data.streakDays === 1 ? "Día sin atrasos" : "Días seguidos sin atrasos",
    },
    {
      key: "mejor",
      icon: Trophy,
      tone: "text-amber-300",
      value: best ?? "—",
      label: "Mejor día (2 semanas)",
      small: true,
    },
  ];
  return (
    <section aria-label="Marcador del equipo" className="rounded-3xl border border-border/60 bg-card/60 p-2">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted", item.tone)} aria-hidden>
              <item.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block font-heading font-semibold leading-none tabular-nums first-letter:uppercase",
                  item.small ? "truncate text-2xl" : "text-3xl"
                )}
              >
                {item.value}
              </span>
              <span className="text-base text-muted-foreground">{item.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
