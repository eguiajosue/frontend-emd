import type { QuoteStatus } from "@/lib/quotes/types";
import type { PriorityTone } from "@/lib/quotes/priority";

/**
 * Color de cada subestado: punto + chip suave (clases completas para Tailwind).
 * Usa los tokens de marca (-soft de fondo, -ink de texto: contraste >= 4.5:1
 * en claro y oscuro). Lectura: lima = listo/aceptado, ámbar = falta algo,
 * cian = informativo, magenta = requiere atención, marino = en espera.
 */
export const QUOTE_STATUS_STYLES: Record<QuoteStatus, { dot: string; chip: string }> = {
  lista: {
    dot: "bg-lime-strong",
    chip: "bg-lime-soft text-lime-ink ring-lime-strong/30",
  },
  pendiente_medidas: {
    dot: "bg-warning",
    chip: "bg-warning-soft text-warning ring-warning/25",
  },
  info: {
    dot: "bg-cyan-strong",
    chip: "bg-cyan-soft text-cyan-ink ring-cyan-strong/25",
  },
  esperando_montaje: {
    dot: "bg-chart-5",
    chip: "bg-chart-5/15 text-foreground ring-chart-5/35",
  },
  esperando_respuesta: {
    dot: "bg-navy-400",
    chip: "bg-secondary text-secondary-foreground ring-border",
  },
  aceptada: {
    dot: "bg-success",
    chip: "bg-success-soft text-success ring-success/30",
  },
  no_aceptada: {
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive ring-destructive/25",
  },
  comentarios: {
    dot: "bg-magenta",
    chip: "bg-magenta-soft text-magenta-ink ring-magenta-strong/25",
  },
};

export const PRIORITY_STYLES: Record<PriorityTone, string> = {
  atrasada: "bg-magenta-strong text-white shadow-soft-xs",
  hoy: "bg-lime text-lime-foreground",
  manana: "bg-cyan-soft text-cyan-ink ring-1 ring-inset ring-cyan-strong/25",
  futura: "bg-muted text-muted-foreground",
};
