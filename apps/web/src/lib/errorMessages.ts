/**
 * Catálogo único de mensajes de error (español, tono cercano).
 *
 * Todo error que llega a la UI (toast, estado de error, pantalla de error)
 * pasa por `describeError()` / `getErrorMessage()`: se clasifica en un
 * `ErrorKind` y se traduce a título + descripción + acción sugerida. Nada de
 * "Failed to fetch", "ThrottlerException" ni volcados de `err.message`.
 *
 * Sin dependencias de React ni de Next: también lo usan los error boundaries
 * y `global-error.tsx`, que no tienen providers.
 */
import { ApiError, AuthFetchError } from "@emd/api-client";

export type ErrorKind =
  | "offline"
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "gone"
  | "conflict"
  | "tooLarge"
  | "validation"
  | "rateLimited"
  | "maintenance"
  | "server"
  | "unknown";

/** Qué debería poder hacer la persona para salir del error. */
export type ErrorActionType = "retry" | "login" | "home" | "wait" | "fix" | "reload" | "none";

export interface ErrorAction {
  type: ErrorActionType;
  label: string;
}

export interface ErrorInfo {
  kind: ErrorKind;
  /** Código HTTP si lo hay (0 = sin respuesta). */
  status?: number;
  title: string;
  description: string;
  action: ErrorAction;
  /** Reintentar tiene sentido (no es un error permanente del cliente). */
  retryable: boolean;
}

type CatalogEntry = Pick<ErrorInfo, "title" | "description" | "action" | "retryable">;

export const ERROR_CATALOG: Record<ErrorKind, CatalogEntry> = {
  offline: {
    title: "Sin conexión",
    description: "Parece que no hay internet. Revisa tu conexión; lo que ya estaba cargado sigue disponible.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
  network: {
    title: "No pudimos conectarnos",
    description: "No logramos comunicarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
  timeout: {
    title: "Tardó demasiado",
    description: "El servidor tardó más de lo normal en responder. Inténtalo de nuevo en unos segundos.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
  unauthorized: {
    title: "Tu sesión expiró",
    description: "Por seguridad cerramos tu sesión. Inicia sesión de nuevo para continuar.",
    action: { type: "login", label: "Iniciar sesión" },
    retryable: false,
  },
  forbidden: {
    title: "No tienes permiso para esto",
    description: "Tu cuenta no tiene acceso a esta sección o acción. Si crees que es un error, avisa a un administrador.",
    action: { type: "home", label: "Volver al inicio" },
    retryable: false,
  },
  notFound: {
    title: "No encontramos lo que buscas",
    description: "Puede que ya no exista o que se haya movido a otro lugar.",
    action: { type: "home", label: "Volver al inicio" },
    retryable: false,
  },
  gone: {
    title: "Este enlace ya no está disponible",
    description: "Venció o fue retirado. Pide uno nuevo y con gusto te lo mandamos.",
    action: { type: "none", label: "" },
    retryable: false,
  },
  conflict: {
    title: "Ya existe o cambió",
    description: "Otra persona modificó esto, o ya existe un registro igual. Actualiza e inténtalo de nuevo.",
    action: { type: "retry", label: "Actualizar" },
    retryable: false,
  },
  tooLarge: {
    title: "El archivo es muy pesado",
    description: "Supera el tamaño permitido. Prueba con uno más ligero o comprímelo.",
    action: { type: "fix", label: "Elegir otro archivo" },
    retryable: false,
  },
  validation: {
    title: "Revisa los datos",
    description: "Algunos datos no son válidos. Corrige los campos marcados e inténtalo de nuevo.",
    action: { type: "fix", label: "Revisar datos" },
    retryable: false,
  },
  rateLimited: {
    title: "Vas muy rápido",
    description: "Hiciste demasiados intentos seguidos. Espera unos segundos y prueba de nuevo.",
    action: { type: "wait", label: "Esperar y reintentar" },
    retryable: true,
  },
  maintenance: {
    title: "Estamos en mantenimiento",
    description: "Estamos mejorando el sistema. Vuelve en unos minutos; tu información está a salvo.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
  server: {
    title: "Algo falló de nuestro lado",
    description: "El servidor tuvo un problema. Ya quedó registrado; inténtalo de nuevo en un momento.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
  unknown: {
    title: "Algo salió mal",
    description: "Ocurrió un error inesperado. Inténtalo de nuevo; si sigue pasando, avisa a un administrador.",
    action: { type: "retry", label: "Reintentar" },
    retryable: true,
  },
};

/**
 * Códigos de error conocidos del backend (Prisma mapeados por el filtro global
 * y códigos propios futuros del shape `{ error: { code } }`) → tipo de error.
 */
export const ERROR_CODE_KINDS: Record<string, ErrorKind> = {
  P2002: "conflict",
  P2025: "notFound",
  P2003: "validation",
  UNIQUE_VIOLATION: "conflict",
  NOT_FOUND: "notFound",
  FORBIDDEN: "forbidden",
  UNAUTHORIZED: "unauthorized",
  VALIDATION_ERROR: "validation",
  RATE_LIMITED: "rateLimited",
  PAYLOAD_TOO_LARGE: "tooLarge",
  MAINTENANCE: "maintenance",
  ECONNABORTED: "timeout",
  ETIMEDOUT: "timeout",
};

/** Clasifica un código HTTP. */
export function kindFromStatus(status: number): ErrorKind {
  if (status === 0) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 408 || status === 504) return "timeout";
  if (status === 409) return "conflict";
  if (status === 410) return "gone";
  if (status === 413) return "tooLarge";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rateLimited";
  if (status === 503) return "maintenance";
  if (status >= 500) return "server";
  return "unknown";
}

// Textos de navegador/librerías (en inglés o crípticos) que nunca se muestran.
const TECHNICAL_PATTERNS: RegExp[] = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /fetch failed/i,
  /unexpected token/i,
  /is not valid json/i,
  /\bundefined\b|\bnull\b|\[object /i,
  /exception/i,
  /^error \d{3}:/i,
  /error interno del servidor|error de base de datos/i,
  /abort(ed)?\b|aborterror/i,
  /timeout|timed out/i,
  /\b(econn|enotfound|etimedout)/i,
  // Frases típicas de class-validator / Nest en inglés.
  /\b(must|should|cannot|can't|failed|invalid|unauthorized|forbidden|not found|too many|too large|bad request|internal server|service unavailable|already exists|is required|required)\b/i,
];

/**
 * ¿El texto es crudo/técnico (inglés, volcado de excepción) y por tanto no
 * apto para mostrarse a una persona? Los mensajes en español del backend
 * ("La plantilla no existe") sí pasan.
 */
export function isTechnicalMessage(message: string | undefined | null): boolean {
  const text = (message ?? "").trim();
  if (!text) return true;
  if (/[áéíóúñ¿¡]/i.test(text)) return false;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

function isTimeoutLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" || /timeout|timed out/i.test(error.message);
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function entry(kind: ErrorKind, status?: number): ErrorInfo {
  return { kind, status, ...ERROR_CATALOG[kind] };
}

/** Clasifica cualquier valor lanzado (ApiError, Error, string, red caída…). */
export function classifyError(error: unknown): { kind: ErrorKind; status?: number } {
  if (error instanceof AuthFetchError) return { kind: "unauthorized", status: 401 };
  if (error instanceof ApiError) {
    if (error.status === 0) {
      if (isOffline()) return { kind: "offline", status: 0 };
      return { kind: isTimeoutLike(error) ? "timeout" : "network", status: 0 };
    }
    const byCode = error.code ? ERROR_CODE_KINDS[error.code] : undefined;
    if (byCode) return { kind: byCode, status: error.status };
    return { kind: kindFromStatus(error.status), status: error.status };
  }
  if (isOffline()) return { kind: "offline" };
  if (error instanceof TypeError) return { kind: "network" }; // fetch sin respuesta
  if (isTimeoutLike(error)) return { kind: "timeout" };
  return { kind: "unknown" };
}

/** Mensaje específico del backend, sólo si es presentable (español, no técnico). */
function friendlyServerMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || error instanceof AuthFetchError) return undefined;
  const message = error.message?.trim();
  return message && !isTechnicalMessage(message) ? message : undefined;
}

/**
 * Título + descripción + acción para un error. Si el backend mandó un mensaje
 * específico en español (400/403/404/409/422/5xx deliberados) se usa como
 * descripción; si no, la del catálogo.
 */
export function describeError(error: unknown): ErrorInfo {
  const { kind, status } = classifyError(error);
  const info = entry(kind, status);
  const specific = friendlyServerMessage(error);
  if (specific && kind !== "unauthorized" && kind !== "rateLimited" && kind !== "maintenance") {
    return { ...info, description: specific };
  }
  return info;
}

/**
 * Mensaje de una sola línea para toasts y errores inline. `fallback` es el
 * texto de contexto de cada pantalla ("No se pudo guardar el material.") y se
 * usa cuando el error no trae nada más útil que el genérico.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const { kind } = classifyError(error);
  const specific = friendlyServerMessage(error);
  switch (kind) {
    case "unauthorized":
      return "Tu sesión expiró. Inicia sesión de nuevo.";
    case "offline":
    case "network":
    case "timeout":
    case "rateLimited":
    case "maintenance":
    case "tooLarge":
      return ERROR_CATALOG[kind].description;
    case "forbidden":
      return specific ?? "No tienes permiso para realizar esta acción.";
    case "notFound":
      return specific ?? fallback ?? "No encontramos lo que buscas. Puede que ya no exista.";
    case "gone":
      return specific ?? ERROR_CATALOG.gone.description;
    case "conflict":
    case "validation":
      return specific ?? fallback ?? ERROR_CATALOG[kind].description;
    case "server":
      return specific ?? ERROR_CATALOG.server.description;
    default:
      return specific ?? fallback ?? ERROR_CATALOG.unknown.description;
  }
}

/** Título corto para `toast.error(title, { description })`. */
export function getErrorTitle(error: unknown): string {
  return describeError(error).title;
}

/**
 * Como `getErrorMessage`, pero también respeta los `Error` propios de la app
 * (validaciones locales como "El 3D no admite SVG") cuando están en español.
 * Un `Error` técnico del navegador cae al `fallback` en vez de mostrarse crudo.
 */
export function getAppErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !(error instanceof ApiError) && !(error instanceof AuthFetchError)) {
    return isTechnicalMessage(error.message) ? getErrorMessage(error, fallback) : error.message;
  }
  return getErrorMessage(error, fallback);
}

/**
 * Mensaje de login a partir del `error` que devuelve `signIn()` de NextAuth
 * ("CredentialsSignin" cuando `authorize` regresa null: credenciales malas o
 * backend caído) o de una excepción de red.
 */
export function getLoginErrorMessage(code?: string | null): string {
  if (!code || code === "CredentialsSignin") {
    return "Usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";
  }
  if (code === "Configuration") return ERROR_CATALOG.server.description;
  if (code === "AccessDenied") return ERROR_CATALOG.forbidden.description;
  if (code === "SessionRequired") return ERROR_CATALOG.unauthorized.description;
  return ERROR_CATALOG.unknown.description;
}
