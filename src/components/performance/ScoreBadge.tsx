import { cn } from "@/lib/utils";

/**
 * Cortes de score fijos (0-100 asumido): son un criterio simple de aplicar en
 * el cliente sin depender de percentiles (que requerirían recalcular con cada
 * fetch y no serían estables entre pantallas). Ajustar acá si el backend
 * documenta una escala distinta.
 */
const HIGH_SCORE_THRESHOLD = 75;
const MID_SCORE_THRESHOLD = 50;

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
      {score != null && <span className="font-semibold">{Math.round(score)}</span>}
    </span>
  );
}
