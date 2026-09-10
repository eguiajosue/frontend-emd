/**
 * Punto único de acceso a la configuración pública del cliente HTTP.
 *
 * Portable entre apps (Next.js/Web y Expo/Mobile): cada app lee la URL del
 * backend de su propio mecanismo de env vars (`NEXT_PUBLIC_BACKEND_URL` en
 * Web, `EXPO_PUBLIC_BACKEND_URL` en Mobile) y la inyecta acá con
 * `configureApiClient()` una sola vez al arrancar.
 */

/** Quita los `/` finales de la base. Devuelve "" si no hay valor configurado. */
function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

let backendUrl = "";

export function configureApiClient(options: { backendUrl: string | undefined }): void {
  backendUrl = normalizeBaseUrl(options.backendUrl ?? "");
}

export function getBackendUrl(): string {
  return backendUrl;
}

/** `true` si la app tiene un backend configurado. */
export function isBackendConfigured(): boolean {
  return backendUrl.length > 0;
}

/**
 * Construye una URL absoluta contra el backend.
 * Acepta el path con o sin `/` inicial: `apiUrl("orders")` === `apiUrl("/orders")`.
 */
export function apiUrl(path: string): string {
  if (!isBackendConfigured()) {
    throw new Error(
      "El backend no está configurado: llamá a configureApiClient({ backendUrl }) al arrancar la app."
    );
  }
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${backendUrl}/${suffix}` : backendUrl;
}

/** URL base del servidor de Socket.io (mismo host que la API). */
export function getSocketUrl(): string {
  return backendUrl;
}
