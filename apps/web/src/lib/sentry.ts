import type { Event } from "@sentry/nextjs";

/**
 * Configuración compartida de Sentry (cliente, servidor Node y edge).
 *
 * Sentry está APAGADO por completo salvo que exista `NEXT_PUBLIC_SENTRY_DSN`:
 * sin DSN no se llama a `Sentry.init` en ningún runtime, `next.config.ts` no
 * aplica `withSentryConfig` y no hay ruta de túnel. Ver docs/monitoring.md.
 *
 * Este módulo NO importa el SDK en runtime (sólo tipos): lo usan también el
 * middleware y el Service Worker para conocer la ruta del túnel sin cargar
 * Sentry.
 */

/**
 * Ruta del túnel (`tunnelRoute` de withSentryConfig). El navegador manda los
 * eventos a este path del propio origen y Next los reenvía a Sentry: así la
 * CSP no necesita abrir `connect-src` a `*.ingest.sentry.io` y los bloqueadores
 * de anuncios no los tiran. Tiene que coincidir con `SENTRY_TUNNEL_ROUTE` en
 * `next.config.ts` (ese archivo no puede importar código de `src/`).
 */
export const SENTRY_TUNNEL_ROUTE = "/monitoring";

export function isSentryTunnelPath(pathname: string): boolean {
  return pathname === SENTRY_TUNNEL_ROUTE || pathname === `${SENTRY_TUNNEL_ROUTE}/`;
}

/**
 * Tasa de muestreo de trazas de rendimiento: número entre 0 y 1. Cualquier
 * otra cosa (vacío, texto, fuera de rango) cuenta como 0 — sólo errores.
 */
export function parseSampleRate(raw: string | undefined): number {
  if (!raw || raw.trim() === "") return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 0;
  return value;
}

/** Cabeceras que nunca deben salir hacia Sentry (comparación sin mayúsculas). */
const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
]);

/**
 * `beforeSend` / `beforeSendTransaction`: quita del evento cookies, cabeceras
 * de autenticación y el cuerpo de la request. `sendDefaultPii: false` ya evita
 * la mayoría, pero algunas integraciones (p. ej. el `onRequestError` del
 * servidor) adjuntan las cabeceras tal cual; esto es la red de seguridad.
 */
export function scrubEvent<T extends Event>(event: T): T {
  const request = event.request;
  if (!request) return event;

  delete request.cookies;
  delete request.data;

  if (request.headers) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!SENSITIVE_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    request.headers = headers;
  }
  return event;
}

/**
 * DSN configurado, o `undefined` si Sentry está apagado. Se lee como
 * `process.env.NEXT_PUBLIC_SENTRY_DSN` literal para que Next lo incruste en
 * el bundle del cliente al compilar.
 */
export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

/** Opciones comunes de `Sentry.init` para los tres runtimes. */
export function buildSentryOptions(dsn: string) {
  // Sin entorno explícito el SDK usa VERCEL_ENV / NODE_ENV. Ojo: la clave no
  // debe ir con `undefined`, el SDK la esparce encima de su propio default.
  const environment = process.env.SENTRY_ENVIRONMENT || undefined;
  // Con muestreo 0 la clave se omite: así el SDK ni siquiera crea spans (con
  // `tracesSampleRate: 0` los crea, los descarta y manda un "client report"
  // por cada página) ni agrega `sentry-trace`/`baggage` a las requests.
  const tracesSampleRate = parseSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  return {
    dsn,
    ...(environment ? { environment } : {}),
    ...(tracesSampleRate > 0 ? { tracesSampleRate } : {}),
    // Sin IPs, cookies ni cuerpos de request; sin Session Replay (no se
    // agrega `replayIntegration`) ni Sentry Logs.
    sendDefaultPii: false,
    // Sin "client reports" (estadísticas de eventos descartados): sólo
    // generan un POST extra al túnel en cada navegación.
    sendClientReports: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
