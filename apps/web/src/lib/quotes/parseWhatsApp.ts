/**
 * "Pegar de WhatsApp": convierte el listado que Recepción manda por WhatsApp
 * en cotizaciones listas para `POST /quotes/bulk`. Puro (sin React ni red):
 * la pantalla muestra el resultado en una vista previa editable antes de
 * guardar, así que una línea ambigua se corrige ahí, no aquí.
 *
 * Formato de cada línea (el real del equipo):
 *
 *     * OFISDECO .✅enviada -en espera de montajes
 *     * ESTEBAN TALAMAS . ☑️pendiente lleve la camioneta para medir
 *     * BRICER ☑️.  *prioridad mañana
 *
 * Heurísticas, en orden:
 *
 * 1. Viñeta: se quita una viñeta inicial (`*`, `•`, `-`, `1.`, `1)`). Líneas
 *    vacías, sin letras, o que parecen un encabezado (todo en `*negritas*` o
 *    terminadas en `:` y sin marca) se saltan.
 * 2. Cliente: el texto ANTES del primer separador — " ." (espacio + punto),
 *    "☑️" o "✅" (lo que aparezca primero) — sin espacios ni puntuación de
 *    sobra, con las mayúsculas tal cual. Sin separador, toda la línea es el
 *    cliente (y se avisa).
 * 3. Marca: ✅ (o ✔️) = hecha; ☑️ = pendiente. La marca sola no decide la
 *    etapa: deciden las palabras (paso 5); sólo cuando no hay ninguna palabra
 *    clave, ✅ se toma como enviada.
 * 4. Prioridad: "prioridad mañana" / "mañana" → mañana; "prioridad hoy" /
 *    "HOY" → hoy; si no, normal. Se quitan del texto.
 * 5. Subestado (la primera regla que aplica):
 *    - "enviada" + "en espera de montaje(s)" → enviada · Comentarios, con
 *      el comentario "en espera de montajes".
 *    - "enviada" → enviada · Esperando respuesta (o Aceptada / No aceptada
 *      si además lo dice: "aceptada", "no aceptada", "rechazada").
 *    - "en espera de montaje(s)" / "esperando montaje" (sin "enviada", con
 *      ✅ o ☑️) → por enviar · Esperando montaje.
 *    - "medir" / "medidas" → por enviar · Pendiente medidas.
 *    - "info" / "información" → por enviar · Info.
 *    - sólo ✅, sin palabras → enviada · Esperando respuesta.
 *    - nada → por enviar · Lista.
 * 6. Descripción: lo que queda del texto después de quitar la marca, la
 *    prioridad y las frases de estado puras ("enviada", "en espera de
 *    montajes"). Una frase con más contexto (p. ej. "pendiente lleve la
 *    camioneta para medir") se queda entera. Vacía → "Cotización" (el
 *    backend exige descripción).
 * 7. Avisos: lo que es razonable pero dudoso (☑️ que dice "enviada", ✅ sin
 *    "enviada", sin separador, varios estados a la vez) sale en `warnings`
 *    para resaltar la fila en la vista previa.
 */
import { DEFAULT_QUOTE_DESCRIPTION, MAX_QUOTE_CLIENT_NAME_LENGTH, stageOfStatus } from "./types";
import type { QuoteStage, QuoteStatus } from "./types";
import type { PriorityChoice } from "./priority";

export interface ParsedQuoteLine {
  /** Número de línea en el texto pegado (desde 1). */
  line: number;
  raw: string;
  clientName: string;
  description: string;
  stage: QuoteStage;
  status: QuoteStatus;
  priority: PriorityChoice;
  comment: string | null;
  /** Marca de la línea: ✅ hecha, ☑️ pendiente, o ninguna. */
  mark: "done" | "pending" | null;
  /** Dudas razonables para revisar en la vista previa. */
  warnings: string[];
}

const DONE_MARK = /[\u2705\u2714]/u; // ✅ ✔
const PENDING_MARK = /[☑☐]/u; // ☑ ☐
const ANY_MARK = /[✅✔☑☐]️?/gu;
const HAS_MARK = /[✅✔☑☐]/u;
const VARIATION = /️/gu;

/** Expresión de palabra completa, sin distinguir mayúsculas, que entiende acentos. */
function word(source: string, flags = "iu"): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, flags);
}

const ENVIADA = word("env[ií]ad[ao]s?");
const MONTAJE = word("(?:en\\s+)?(?:espera|esperando)\\s+(?:de\\s+)?(?:(?:el|los)\\s+)?montajes?");
const MEDIDAS = word("medir|medidas?");
const INFO = word("info(?:rmaci[oó]n)?");
const NO_ACEPTADA = word("no\\s+acept(?:ad[ao]|[oó])|rechazad[ao]");
const ACEPTADA = word("aceptad[ao]");
const PRIORIDAD_MANANA = /\*?\s*prioridad\s+(?:para\s+)?ma[ñn]ana(?![\p{L}\p{N}])/iu;
const PRIORIDAD_HOY = /\*?\s*prioridad\s+(?:para\s+)?hoy(?![\p{L}\p{N}])/iu;
const MANANA = /\*?(?<![\p{L}\p{N}])ma[ñn]ana(?![\p{L}\p{N}])/iu;
const HOY = /\*?(?<![\p{L}\p{N}])hoy(?![\p{L}\p{N}])/iu;

/** Texto que, solo, no dice nada más que el subestado: no sirve de descripción. */
const STATUS_ONLY = word(
  "(?:pendientes?\\s+(?:de\\s+)?)?(?:medir|medidas?|info(?:rmaci[oó]n)?)|pendientes?|lista|listas|aceptad[ao]|no\\s+aceptad[ao]|rechazad[ao]|comentarios?"
);

const BULLET = /^\s*(?:[*•·\-–—]|\d{1,3}[.)])\s*/u;
const EDGE_PUNCTUATION = /^[\s.*\-–—,:;·]+|[\s.*\-–—,:;·]+$/gu;

function tidy(text: string): string {
  return text.replace(ANY_MARK, " ").replace(VARIATION, "").replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").trim();
}

function isStatusOnly(text: string): boolean {
  const match = text.match(STATUS_ONLY);
  return Boolean(match && match[0].length === text.length);
}

/** Índice del primer separador entre cliente y estado: " .", ☑️ o ✅. -1 si no hay. */
function separatorIndex(body: string): number {
  const candidates = [body.indexOf(" ."), body.search(ANY_MARK)].filter((i) => i >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function looksLikeHeading(body: string): boolean {
  if (HAS_MARK.test(body) || body.includes(" .")) return false;
  return /^\*[^*]+\*$/.test(body.trim()) || /:\s*$/.test(body);
}

/** Parsea UNA línea; `null` si no es una cotización (vacía, encabezado). */
export function parseWhatsAppLine(raw: string, line = 1): ParsedQuoteLine | null {
  if (!/\p{L}/u.test(raw)) return null;
  if (looksLikeHeading(raw)) return null;
  const body = raw.replace(BULLET, "").trim();
  if (!body || !/\p{L}/u.test(body)) return null;

  const warnings: string[] = [];
  const sep = separatorIndex(body);
  let clientName = tidy(sep >= 0 ? body.slice(0, sep) : body);
  let rest = sep >= 0 ? body.slice(sep) : "";
  if (sep < 0) warnings.push("No se encontró el separador « . »: revisa el cliente y el estado.");
  if (!clientName) warnings.push("Falta el cliente.");
  if (clientName.length > MAX_QUOTE_CLIENT_NAME_LENGTH) {
    clientName = clientName.slice(0, MAX_QUOTE_CLIENT_NAME_LENGTH).trim();
    warnings.push("El cliente era muy largo y se recortó.");
  }

  const mark: ParsedQuoteLine["mark"] = DONE_MARK.test(rest) ? "done" : PENDING_MARK.test(rest) ? "pending" : null;

  // Prioridad (y se quita del texto).
  let priority: PriorityChoice = "normal";
  for (const [re, choice] of [
    [PRIORIDAD_MANANA, "manana"],
    [PRIORIDAD_HOY, "hoy"],
    [MANANA, "manana"],
    [HOY, "hoy"],
  ] as const) {
    if (re.test(rest)) {
      if (priority === "normal") priority = choice;
      rest = rest.replace(re, " ");
    }
  }

  const hasEnviada = ENVIADA.test(rest);
  const montaje = rest.match(MONTAJE);
  const hasMedidas = MEDIDAS.test(rest);
  const hasInfo = INFO.test(rest);
  const hasNoAceptada = NO_ACEPTADA.test(rest);
  const hasAceptada = !hasNoAceptada && ACEPTADA.test(rest);

  let status: QuoteStatus;
  let comment: string | null = null;
  if (hasEnviada && montaje) {
    status = "comentarios";
    comment = tidy(montaje[0]).toLowerCase();
    rest = rest.replace(ENVIADA, " ").replace(MONTAJE, " ");
  } else if (hasEnviada) {
    status = hasNoAceptada ? "no_aceptada" : hasAceptada ? "aceptada" : "esperando_respuesta";
    rest = rest.replace(ENVIADA, " ");
    if (mark === "pending") warnings.push("Tiene ☑️ pero dice «enviada»: se tomó como enviada.");
  } else if (montaje) {
    status = "esperando_montaje";
    rest = rest.replace(MONTAJE, " ");
    if (mark === "done") warnings.push("Tiene ✅ pero no dice «enviada»: quedó por enviar, esperando montaje.");
  } else if (hasMedidas) {
    status = "pendiente_medidas";
  } else if (hasInfo) {
    status = "info";
  } else if (hasNoAceptada || hasAceptada) {
    status = hasNoAceptada ? "no_aceptada" : "aceptada";
  } else if (mark === "done") {
    status = "esperando_respuesta";
    warnings.push("Sólo tiene ✅: se tomó como enviada.");
  } else {
    status = "lista";
  }
  if ([Boolean(montaje), hasMedidas, hasInfo].filter(Boolean).length > 1) {
    warnings.push("Menciona varios estados: revisa el subestado.");
  }

  let description = tidy(rest);
  if (isStatusOnly(description)) description = "";

  return {
    line,
    raw,
    clientName,
    description: description || DEFAULT_QUOTE_DESCRIPTION,
    stage: stageOfStatus(status),
    status,
    priority,
    comment,
    mark,
    warnings,
  };
}

/** Parsea el listado completo, una cotización por línea con contenido. */
export function parseWhatsAppList(text: string): ParsedQuoteLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, index) => parseWhatsAppLine(raw, index + 1))
    .filter((q): q is ParsedQuoteLine => q !== null);
}
