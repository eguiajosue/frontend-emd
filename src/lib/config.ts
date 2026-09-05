/**
 * Punto único de acceso a la configuración pública del frontend.
 *
 * Antes cada pantalla leía `process.env.NEXT_PUBLIC_BACKEND_URL` a mano y
 * concatenaba rutas con `/`, lo que rompió producción cuando la variable venía
 * con slash final (`https://api.example.com/` + `/orders` => `//orders`).
 * Acá la URL se normaliza una sola vez y se construyen las rutas con `apiUrl()`.
 */

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

/** Quita los `/` finales de la base. Devuelve "" si no hay valor configurado. */
function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export const BACKEND_URL = normalizeBaseUrl(RAW_BACKEND_URL);

/** `true` si la app tiene un backend configurado. */
export const isBackendConfigured = BACKEND_URL.length > 0;

/**
 * Construye una URL absoluta contra el backend.
 * Acepta el path con o sin `/` inicial: `apiUrl("orders")` === `apiUrl("/orders")`.
 */
export function apiUrl(path: string): string {
  if (!isBackendConfigured) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL no está configurada. Definila en el entorno antes de hacer llamadas al backend."
    );
  }
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${BACKEND_URL}/${suffix}` : BACKEND_URL;
}

/** URL base del servidor de Socket.io (mismo host que la API). */
export const SOCKET_URL = BACKEND_URL;
