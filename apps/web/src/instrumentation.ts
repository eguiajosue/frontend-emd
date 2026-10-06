import type { Instrumentation } from "next";
import { buildSentryOptions, getSentryDsn } from "@/lib/sentry";

/**
 * Hook de instrumentación de Next (servidor Node y edge). Sólo inicializa
 * Sentry si hay `NEXT_PUBLIC_SENTRY_DSN`; sin DSN ni siquiera se carga el SDK
 * (import dinámico), así que no agrega nada al arranque del servidor.
 * Ver docs/monitoring.md.
 */
export async function register() {
  const dsn = getSentryDsn();
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(buildSentryOptions(dsn));
  }
}

/**
 * Errores de Server Components, route handlers, server actions y middleware
 * que Next reporta aquí. Las cabeceras de la request (cookies, Authorization)
 * se limpian en `beforeSend` (`scrubEvent`).
 */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!getSentryDsn()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
