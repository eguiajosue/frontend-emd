"use client";

import { Flame } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { priorityLabel, priorityTone, shortDateLabel } from "@/lib/quotes/priority";
import { cn } from "@/lib/utils";
import { PRIORITY_STYLES } from "./quoteStyles";

/**
 * Chip de prioridad: Hoy / Mañana / Atrasada (o "Para el 9 oct"), calculado
 * contra la fecha LOCAL de hoy y recalculado cada minuto: a medianoche
 * "Mañana" pasa sola a "Hoy" y "Hoy" a "Atrasada". Normal = sin chip.
 */
export function QuotePriorityChip({ priorityDate, className }: { priorityDate: string | null; className?: string }) {
  const now = new Date(useNow(60_000));
  const tone = priorityTone(priorityDate, now);
  if (!priorityDate || !tone) return null;
  const label = priorityLabel(priorityDate, now);
  return (
    <span
      data-testid="quote-priority"
      data-tone={tone}
      title={tone === "atrasada" ? `Era para el ${shortDateLabel(priorityDate)}` : undefined}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold",
        PRIORITY_STYLES[tone],
        className
      )}
    >
      {(tone === "atrasada" || tone === "hoy") && <Flame className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}
