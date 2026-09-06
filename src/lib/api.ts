/**
 * Cliente HTTP único de la app.
 *
 * Todas las llamadas al backend pasan por acá, que a su vez usa `authFetch`
 * (el único punto de salida HTTP, responsable del 401 -> signOut).
 *
 * Diseñado para absorber los cambios que está haciendo el backend sin tocar
 * las pantallas:
 *  - `ApiError` ya normaliza el shape de error (message/status/code/details),
 *    entienda o no el backend el formato viejo (`{ message }`) o el nuevo.
 *  - `unwrapList()` acepta tanto un array plano (comportamiento actual) como
 *    un envelope paginado `{ data, meta }` (paginación opt-in futura).
 *  - Si más adelante se agregan refresh tokens, el único lugar a tocar es
 *    `authFetch` + `request()`.
 */

import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";
import { apiUrl } from "@/lib/config";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; details?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

/** Mensaje amigable y uniforme para cualquier error de red/API. */
export function getErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado. Intentá de nuevo."
): string {
  if (error instanceof AuthFetchError) return "Tu sesión expiró.";
  if (error instanceof ApiError) {
    if (error.status === 0) return "No se pudo conectar con el servidor.";
    if (error.status === 403) return "No tenés permisos para realizar esta acción.";
    if (error.status === 404) return "No se encontró el recurso solicitado.";
    // El backend manda mensajes específicos y en español incluso para 5xx
    // deliberados (ej. "servicio no configurado todavía", "no se pudo
    // enviar el reporte") — sólo caemos al genérico cuando no hay mensaje
    // útil (crash no controlado, que en producción el backend oculta como
    // "Error interno del servidor").
    if (error.status >= 500 && (!error.message || error.message === "Error interno del servidor")) {
      return "El servidor tuvo un problema. Intentá más tarde.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Un 401 ya se maneja globalmente (signOut + redirect): no mostrar toasts. */
export function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof AuthFetchError ||
    (error instanceof ApiError && error.status === 401)
  );
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
  /** Query params opcionales (soporta la paginación opt-in del backend). */
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = apiUrl(path);
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}: ${res.statusText || "solicitud fallida"}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = await res.json();
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      // Shape actual de Nest: { message: string | string[], error, statusCode }
      // Shape normalizado futuro: { error: { message, code, details } }
      const nested = (b.error as Record<string, unknown> | undefined) ?? undefined;
      const rawMessage =
        (typeof b.message === "string" || Array.isArray(b.message)
          ? b.message
          : undefined) ??
        (nested && typeof nested.message === "string" ? nested.message : undefined);
      if (Array.isArray(rawMessage)) message = rawMessage.join(", ");
      else if (typeof rawMessage === "string" && rawMessage) message = rawMessage;
      if (typeof b.code === "string") code = b.code;
      else if (nested && typeof nested.code === "string") code = nested.code;
      details = nested?.details ?? b.details;
    }
  } catch {
    // Respuesta sin cuerpo JSON: se queda el mensaje genérico.
  }
  return new ApiError(message, res.status, { code, details });
}

/** Ejecuta una request autenticada y devuelve el JSON parseado. */
export async function request<T>(
  path: string,
  { method = "GET", token, body, signal, params }: RequestOptions = {}
): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(buildUrl(path, params), {
      method,
      headers: authHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    // authFetch lanza AuthFetchError en 401: se propaga tal cual para que el
    // manejo global (signOut + redirect) no se pise con un toast de red.
    if (error instanceof AuthFetchError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Fallo de red",
      0
    );
  }

  if (!res.ok) {
    throw await parseErrorBody(res);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("La respuesta del servidor no es JSON válido", res.status);
  }
}

/** Envelope paginado que el backend expondrá de forma opt-in. */
export interface Paginated<T> {
  data: T[];
  meta?: { total?: number; page?: number; pageSize?: number };
}

/**
 * Acepta tanto `T[]` (respuesta actual) como `{ data: T[] }` (paginación futura)
 * y siempre devuelve un array. Evita tener que migrar las pantallas cuando el
 * backend cambie el shape de los listados.
 */
export function unwrapList<T>(payload: T[] | Paginated<T> | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as Paginated<T>).data)) {
    return (payload as Paginated<T>).data;
  }
  return [];
}
