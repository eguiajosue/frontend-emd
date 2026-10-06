import type { QuoteStatus } from "@/lib/quotes/types";
import type { PriorityTone } from "@/lib/quotes/priority";

/** Color de cada subestado: punto + chip suave (clases completas para Tailwind). */
export const QUOTE_STATUS_STYLES: Record<QuoteStatus, { dot: string; chip: string }> = {
  lista: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  },
  pendiente_medidas: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  },
  info: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30",
  },
  esperando_montaje: {
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30",
  },
  esperando_respuesta: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-500/30",
  },
  aceptada: {
    dot: "bg-emerald-600",
    chip: "bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-500/40",
  },
  no_aceptada: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  },
  comentarios: {
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/30",
  },
};

export const PRIORITY_STYLES: Record<PriorityTone, string> = {
  atrasada: "bg-rose-600 text-white dark:bg-rose-500",
  hoy: "bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
  manana: "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-500/30",
  futura: "bg-muted text-muted-foreground",
};
