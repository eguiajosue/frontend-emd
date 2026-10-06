/**
 * "Copiar para WhatsApp": el listado de cotizaciones en el mismo formato que
 * Recepción ya manda (y que `parseWhatsApp.ts` sabe leer de vuelta):
 *
 *     * OFISDECO . ✅enviada - en espera de montajes
 *     * DDN . ☑️HOY
 *     * IHS . ☑️en espera de montajes *prioridad mañana
 *
 * ✅ = enviada, ☑️ = por enviar. Cliente en mayúsculas (como en el chat), el
 * subestado en palabras, la descripción si dice algo más que "Cotización",
 * el comentario, y la prioridad al final (`*HOY`, `*prioridad mañana`,
 * `*atrasada`). Puro: sin portapapeles ni fecha global (`now` entra como
 * parámetro).
 */
import { priorityTone } from "./priority";
import { DEFAULT_QUOTE_DESCRIPTION, type Quote, type QuoteStatus } from "./types";

const DONE = "✅"; // ✅
const PENDING = "☑️"; // ☑️

/** Cómo se dice cada subestado en el chat (Lista no dice nada: la marca alcanza). */
const STATUS_TEXT: Record<QuoteStatus, string> = {
  lista: "",
  pendiente_medidas: "pendiente medidas",
  info: "pendiente info",
  esperando_montaje: "en espera de montajes",
  esperando_respuesta: "enviada",
  aceptada: "enviada - aceptada",
  no_aceptada: "enviada - no aceptada",
  comentarios: "enviada",
};

type FormattableQuote = Pick<Quote, "clientName" | "description" | "stage" | "status" | "comment" | "priorityDate">;

export function formatWhatsAppLine(quote: FormattableQuote, now: Date = new Date()): string {
  const mark = quote.stage === "enviada" ? DONE : PENDING;
  const description = quote.description.trim();
  const comment = quote.comment?.trim() ?? "";
  const parts = [
    STATUS_TEXT[quote.status],
    description && description !== DEFAULT_QUOTE_DESCRIPTION ? description : "",
    comment,
  ].filter(Boolean);
  if (quote.status === "comentarios" && !comment) parts.push("comentarios");
  let body = parts.join(" - ");

  const tone = priorityTone(quote.priorityDate, now);
  if (tone === "hoy" || tone === "atrasada") {
    const tag = tone === "hoy" ? "HOY" : "atrasada";
    // "☑️HOY" a secas (como en el chat) si no hay nada más que decir.
    body = body ? `${body} *${tag}` : tag;
  } else if (tone === "manana") {
    body = body ? `${body} *prioridad mañana` : " *prioridad mañana";
  }

  const client = quote.clientName.trim().toLocaleUpperCase("es-MX");
  return `* ${client} . ${mark}${body}`;
}

/** Varias cotizaciones, una por línea, en el orden recibido. */
export function formatWhatsAppList(quotes: FormattableQuote[], now: Date = new Date()): string {
  return quotes.map((q) => formatWhatsAppLine(q, now)).join("\n");
}
