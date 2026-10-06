/**
 * Cotizaciones de Recepción (docs/plans/cotizaciones.md). Mismo contrato que
 * el backend (`backend-emd/src/quote`): dos etapas y cuatro subestados por
 * etapa. Cada subestado pertenece a UNA sola etapa, así que el subestado
 * alcanza para saber la etapa.
 */

export const QUOTE_STAGES = ["por_enviar", "enviada"] as const;
export type QuoteStage = (typeof QUOTE_STAGES)[number];

export const QUOTE_STATUSES_BY_STAGE = {
  por_enviar: ["lista", "pendiente_medidas", "info", "esperando_montaje"],
  enviada: ["esperando_respuesta", "aceptada", "no_aceptada", "comentarios"],
} as const satisfies Record<QuoteStage, readonly string[]>;

export type QuoteStatus = (typeof QUOTE_STATUSES_BY_STAGE)[QuoteStage][number];

export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  ...QUOTE_STATUSES_BY_STAGE.por_enviar,
  ...QUOTE_STATUSES_BY_STAGE.enviada,
];

/** Subestado que toma una cotización al entrar a cada etapa sin indicar uno. */
export const DEFAULT_QUOTE_STATUS: Record<QuoteStage, QuoteStatus> = {
  por_enviar: "lista",
  enviada: "esperando_respuesta",
};

export const QUOTE_STAGE_LABELS: Record<QuoteStage, string> = {
  por_enviar: "Por enviar",
  enviada: "Enviadas",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  lista: "Lista",
  pendiente_medidas: "Pendiente medidas",
  info: "Info",
  esperando_montaje: "Esperando montaje",
  esperando_respuesta: "Esperando respuesta",
  aceptada: "Aceptada",
  no_aceptada: "No aceptada",
  comentarios: "Comentarios",
};

/** Subestados donde el comentario es parte de la información (se muestra siempre). */
export const COMMENT_STATUSES: readonly QuoteStatus[] = ["comentarios", "no_aceptada"];

/** Descripción por defecto cuando no hay texto (el backend la exige). */
export const DEFAULT_QUOTE_DESCRIPTION = "Cotización";

/** Límites del backend (quote.constants.ts). */
export const MAX_QUOTE_CLIENT_NAME_LENGTH = 120;
export const MAX_QUOTE_DESCRIPTION_LENGTH = 1000;
export const MAX_QUOTE_COMMENT_LENGTH = 1000;
export const MAX_QUOTE_BULK_ITEMS = 100;

export interface Quote {
  id: number;
  clientId: number | null;
  clientName: string;
  description: string;
  stage: QuoteStage;
  status: QuoteStatus;
  comment: string | null;
  /** `YYYY-MM-DD`, o null = prioridad normal. */
  priorityDate: string | null;
  sentAt: string | null;
  orderId: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string } | null;
}

export interface CreateQuotePayload {
  clientId?: number | null;
  clientName?: string;
  description: string;
  stage?: QuoteStage;
  status?: QuoteStatus;
  priorityDate?: string | null;
  comment?: string | null;
}

/** `PATCH /quotes/:id`: cualquier campo editable (no `orderId` ni `sentAt`). */
export type UpdateQuotePayload = Partial<CreateQuotePayload>;

export interface QuoteFilters {
  stage?: QuoteStage;
  status?: QuoteStatus;
  q?: string;
}

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);
}

/** Etapa a la que pertenece un subestado. */
export function stageOfStatus(status: QuoteStatus): QuoteStage {
  return (QUOTE_STATUSES_BY_STAGE.por_enviar as readonly string[]).includes(status)
    ? "por_enviar"
    : "enviada";
}

/**
 * Etapa y subestado que quedan después de un PATCH (mismas reglas que
 * `resolveStageStatus` del backend): sólo subestado → su etapa; sólo etapa →
 * se conserva el subestado si es la misma etapa, si no el de por defecto.
 */
export function nextStageStatus(
  current: { stage: QuoteStage; status: QuoteStatus },
  patch: { stage?: QuoteStage; status?: QuoteStatus }
): { stage: QuoteStage; status: QuoteStatus } {
  if (patch.status) return { stage: stageOfStatus(patch.status), status: patch.status };
  if (patch.stage) {
    return patch.stage === current.stage
      ? current
      : { stage: patch.stage, status: DEFAULT_QUOTE_STATUS[patch.stage] };
  }
  return current;
}
