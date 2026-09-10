/**
 * Punto único de acceso a la configuración pública del frontend.
 *
 * Envuelve `@emd/api-client` (compartido con la futura app Mobile): acá sólo
 * se hace la inyección de la URL del backend desde la env var propia de
 * Next.js y se reexpone la misma API que antes para no tocar cada pantalla.
 */
import {
  configureApiClient,
  apiUrl as sharedApiUrl,
  getBackendUrl,
  getSocketUrl,
  isBackendConfigured as sharedIsBackendConfigured,
} from "@emd/api-client";

configureApiClient({ backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL });

export const BACKEND_URL = getBackendUrl();

/** `true` si la app tiene un backend configurado. */
export const isBackendConfigured = sharedIsBackendConfigured();

export const apiUrl = sharedApiUrl;

/** URL base del servidor de Socket.io (mismo host que la API). */
export const SOCKET_URL = getSocketUrl();
