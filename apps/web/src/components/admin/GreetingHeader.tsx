"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";

interface GreetingHeaderProps {
  firstName?: string | null;
  /** Una línea debajo del saludo (qué es esta pantalla / resumen del día). */
  subtitle?: ReactNode;
}

/** Saludo según la hora local: mañana (5–12), tarde (12–20), noche. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Saludo de la home: título grande directo sobre el lienzo (sin tarjeta) +
 * subtítulo, y a la derecha el reloj/fecha en vivo en una píldora (se
 * actualiza cada minuto). Antes de montar (SSR) dice "Hola" para no
 * hidratar un saludo que dependa de la hora del servidor.
 */
export function GreetingHeader({
  firstName,
  subtitle = "Vista global de todos los pedidos, detección de estancamiento y rendimiento por área.",
}: GreetingHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);
  const { formatTime } = useTimeFormat();

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const greeting = now ? greetingForHour(now.getHours()) : "Hola";
  const timeLabel = now ? formatTime(now) : "--:--";
  const dateLabel = now
    ? now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="text-balance font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        {subtitle && (
          <p className="max-w-prose text-[0.95rem] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <p className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" aria-hidden />
        <span className="font-semibold tabular-nums text-foreground">{timeLabel}</span>
        <span aria-hidden>·</span>
        <span className="first-letter:uppercase">{dateLabel}</span>
      </p>
    </header>
  );
}
