import { buildSentryOptions, getSentryDsn } from "@/lib/sentry";

/**
 * Instrumentación del navegador: corre antes de hidratar la app.
 *
 * Sin `NEXT_PUBLIC_SENTRY_DSN` (incrustado al compilar) no se carga ni se
 * inicializa nada. El SDK pesa ~130 kB gzip, así que tampoco con DSN va en el
 * bundle inicial: se importa en un chunk aparte apenas arranca la página.
 * Errores en los primeros milisegundos (antes de que llegue el chunk) pueden
 * no reportarse; es el precio de no cargarlo a todos los usuarios.
 *
 * Con DSN, los eventos salen por el túnel same-origin (`/monitoring`, ver
 * `lib/sentry.ts`): la CSP no necesita permitir el host de Sentry. El chunk es
 * del propio bundle de Next, así que bajo `'strict-dynamic'` carga igual que
 * el resto (no es un script externo).
 */
type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | undefined;

const dsn = getSentryDsn();
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init(buildSentryOptions(dsn));
    sentry = Sentry;
  });
}

/** Spans de navegación; sólo hacen algo con Sentry cargado y trazas > 0. */
export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
): void {
  sentry?.captureRouterTransitionStart(...args);
}
