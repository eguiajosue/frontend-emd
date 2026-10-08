/** Tablero de Coordinación (backend: src/coordination, WORKFLOW.md §9). */

export const DELAY_REASONS = [
  { value: "material", label: "Falta material" },
  { value: "cliente", label: "Esperando al cliente" },
  { value: "retrabajo", label: "Retrabajo" },
  { value: "carga", label: "Mucha carga de trabajo" },
  { value: "maquinaria", label: "Máquina / equipo" },
  { value: "otro", label: "Otro" },
] as const;
export type DelayReason = (typeof DELAY_REASONS)[number]["value"];

export const delayReasonLabel = (r: string | null | undefined) =>
  DELAY_REASONS.find((d) => d.value === r)?.label ?? null;

interface Counts {
  pendiente: number;
  enProceso: number;
  atrasadas: number;
  pronto: number;
}
export interface AreaLoad extends Counts {
  area: string;
  sinPersona: number;
  people: (Counts & { userId: number; name: string })[];
}
export interface StageSummary {
  count: number;
  medianHours: number | null;
  p75Hours: number | null;
}
export interface OverdueOrder {
  id: number;
  description: string;
  clientName: string | null;
  deliveryDate: string;
  daysLate: number;
  status: string;
  reason: DelayReason | null;
  note: string | null;
  reasonAt: string | null;
  areas: { area: string; status: "pendiente" | "en_proceso" | "terminado"; prepStage: string | null; assignee: string | null }[];
}
export interface CoordinationOverview {
  generatedAt: string;
  load: AreaLoad[];
  stageTimes: {
    windowDays: number;
    stages: ({ key: string; label: string } & StageSummary)[];
    areas: { area: string; espera: StageSummary; produccion: StageSummary }[];
  };
  overdue: OverdueOrder[];
}

/** "45 min", "6.5 h", "2.3 días". */
export function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} días`;
}

/** Etapa de un área en un pedido atrasado: "digitalizando (Ana)", "sin empezar"… */
export function areaStageLabel(a: OverdueOrder["areas"][number]): string {
  const stage =
    a.prepStage === "digitalizado"
      ? "digitalizando"
      : a.prepStage === "en_pruebas"
        ? "en pruebas"
        : a.status === "en_proceso"
          ? "en proceso"
          : "sin empezar";
  return `${stage}${a.assignee ? ` (${a.assignee})` : ""}`;
}

/** Dónde está detenido un pedido sin áreas abiertas (diseño, listo sin entregar…). */
export function stuckAt(o: OverdueOrder): string {
  const s = o.status.toLowerCase();
  if (s === "terminado") return "Listo, falta entregar";
  if (s === "esperando autorización") return "Esperando que el cliente autorice";
  if (s === "en diseño" || s === "cambios solicitados") return "En diseño";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
