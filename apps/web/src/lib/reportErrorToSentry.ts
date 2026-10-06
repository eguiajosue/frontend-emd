import { getSentryDsn } from "@/lib/sentry";

/**
 * Reporta un error atrapado por un error boundary (`app/error.tsx`,
 * `app/global-error.tsx`). Sin DSN no hace nada y el SDK nunca se descarga;
 * con DSN reutiliza el chunk que ya pidió `instrumentation-client.ts`.
 *
 * Va aparte de `lib/sentry.ts` porque ése lo importan el middleware y el
 * Service Worker, y no deben arrastrar el `import()` del SDK.
 */
export function reportErrorToSentry(error: unknown): void {
  if (!getSentryDsn()) return;
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error);
    })
    .catch(() => {
      // Sin red para bajar el chunk: no hay a dónde reportar.
    });
}
