import { cn } from "@/lib/utils";

/**
 * El backend calcula `score` como el promedio de dos z-scores (desempeño
 * relativo al resto de empleados/áreas del mismo período), NO una escala
 * 0-100 — un z-score de 0 es "en el promedio", y valores típicos rondan
 * entre -2 y +2. Los cortes reflejan eso: por encima de +0.3 desvíos
 * estándar del promedio es buen desempeño, por debajo de -0.3 necesita
 * atención, y en el medio es desempeño típico.
 */
const HIGH_SCORE_THRESHOLD = 0.3;
const MID_SCORE_THRESHOLD = -0.3;

export function scoreTier(score: number | null): "high" | "mid" | "low" | "unknown" {
  if (score == null) return "unknown";
  if (score >= HIGH_SCORE_THRESHOLD) return "high";
  if (score >= MID_SCORE_THRESHOLD) return "mid";
  return "low";
}

const TIER_STYLES: Record<ReturnType<typeof scoreTier>, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  mid: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  unknown: "bg-muted text-muted-foreground",
};

const TIER_LABELS: Record<ReturnType<typeof scoreTier>, string> = {
  high: "Buen desempeño",
  mid: "Desempeño medio",
  low: "Necesita atención",
  unknown: "Datos insuficientes",
};

export function ScoreBadge({ score }: { score: number | null }) {
  const tier = scoreTier(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TIER_STYLES[tier]
      )}
    >
      {TIER_LABELS[tier]}
      {score != null && <span className="font-semibold">{score.toFixed(2)}</span>}
    </span>
  );
}
