"use client";

/**
 * Envoltorio offline-first para las mutaciones de cambio de estado (pedido u
 * `OrderAreaTask`): si el fetch falla por falta de red, se encola en vez de
 * romper la UI. Se limita a ESTAS mutaciones (no a cualquier PATCH/POST) porque
 * son las únicas donde tiene sentido aplicar el cambio optimista y reintentar
 * después: el resultado no depende de una respuesta que sólo el backend puede
 * calcular (a diferencia de, por ej., crear un pedido con un id que asigna el
 * servidor).
 */

import { apiUrl } from "@/lib/config";
import { ApiError, request } from "@/lib/api";
import { enqueueMutation } from "@/lib/offlineQueue";
import { scheduleBackgroundSync } from "@/lib/backgroundSync";

/**
 * `true` sólo para un fallo de RED puro: el fetch nunca llegó a tener una
 * respuesta HTTP (TypeError del fetch — sin conexión, DNS, CORS por estar
 * offline, etc). `request()` en `lib/api.ts` ya normaliza exactamente ese caso
 * a `ApiError` con `status === 0`; cualquier otro status es una respuesta real
 * del backend (o un 401 de sesión) y tiene que propagarse tal cual, no
 * encolarse como si fuera un problema de conectividad.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 0) return true;
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * PATCH de cambio de estado con fallback offline: intenta la request real y,
 * si falla por red, la encola (`enqueueMutation`) y programa la sincronización
 * (`scheduleBackgroundSync`), devolviendo el body como respuesta optimista
 * para que la UI actualice igual que si hubiera tenido éxito. Un error real
 * del backend (400/403/...) se propaga sin tocar la cola.
 */
export async function patchStatusChange<T>(
  path: string,
  body: unknown,
  token: string | null | undefined
): Promise<T> {
  try {
    return await request<T>(path, { method: "PATCH", token, body });
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    await enqueueMutation(apiUrl(path), "PATCH", body);
    void scheduleBackgroundSync();
    return body as T;
  }
}
