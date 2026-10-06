import * as Sentry from "@sentry/nextjs";
import { buildSentryOptions, getSentryDsn } from "@/lib/sentry";

/**
 * Instrumentación del navegador: corre antes de hidratar la app. Sin
 * `NEXT_PUBLIC_SENTRY_DSN` (incrustado al compilar) no se inicializa nada.
 *
 * Con DSN, los eventos salen por el túnel same-origin (`/monitoring`, ver
 * `lib/sentry.ts`): la CSP no necesita permitir el host de Sentry. Este
 * archivo va dentro del bundle de Next, así que bajo `'strict-dynamic'` carga
 * igual que el resto de los chunks (no es un script externo).
 */
const dsn = getSentryDsn();
if (dsn) {
  Sentry.init(buildSentryOptions(dsn));
}

// Sólo genera spans de navegación si hay trazas (tracesSampleRate > 0); sin
// cliente inicializado no hace nada.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
