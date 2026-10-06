# Monitoreo de errores (Sentry)

La app web (`apps/web`) trae integrado `@sentry/nextjs`, pero está **apagado por
completo** mientras no exista `NEXT_PUBLIC_SENTRY_DSN`. Sin esa variable:

- no se llama a `Sentry.init` en ningún runtime (navegador, servidor Node, edge);
- `next.config.ts` no aplica `withSentryConfig` (ni plugin de webpack, ni
  auto-instrumentación, ni túnel): la config queda igual que sin Sentry;
- el build no necesita ninguna variable de Sentry (CI, previews de Vercel, e2e).

## Variables de entorno (Vercel → Project → Settings → Environment Variables)

| Variable | ¿Obligatoria? | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Sí, para encenderlo | DSN del proyecto en Sentry (`https://<clave>@o<org>.ingest.sentry.io/<proyecto>`). Se incrusta en el bundle al compilar: **cambiarla requiere redeploy**. |
| `SENTRY_ENVIRONMENT` | No | Nombre del entorno en Sentry (`production`, `preview`…). Si falta, el SDK usa `VERCEL_ENV` o `NODE_ENV`. También se fija al compilar. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | No | Fracción de trazas de rendimiento, de `0` a `1`. Por defecto `0`: sólo errores; con `0` el SDK ni siquiera crea spans. |
| `SENTRY_AUTH_TOKEN` | No | Token de organización de Sentry para **subir source maps** en el build (stack traces legibles). Sin token no se generan ni suben, y el build no avisa nada. Marcarla como *Sensitive* en Vercel. |
| `SENTRY_ORG` | Con el token | Slug de la organización en Sentry. |
| `SENTRY_PROJECT` | Con el token | Slug del proyecto en Sentry. |

`turbo.json` declara `SENTRY_ENVIRONMENT`, `SENTRY_ORG` y `SENTRY_PROJECT` en
`build.env` y `SENTRY_AUTH_TOKEN` en `passThroughEnv` (el modo estricto de
Turborepo filtra las variables no declaradas; las `NEXT_PUBLIC_*` pasan solas).

## Qué se envía y qué no

- Errores no capturados del navegador, errores atrapados por `app/error.tsx` y
  `app/global-error.tsx`, y errores del servidor vía `onRequestError`
  (`src/instrumentation.ts`).
- `sendDefaultPii: false`: sin IP del usuario ni cookies.
- `beforeSend` / `beforeSendTransaction` (`scrubEvent` en `src/lib/sentry.ts`)
  quitan además `Cookie`, `Set-Cookie`, `Authorization` y similares, las cookies
  y el cuerpo de la request de cada evento.
- **Sin** Session Replay, Sentry Logs ni *client reports* (`sendClientReports: false`).

## CSP y túnel (`/monitoring`)

La CSP (`src/lib/csp.ts`) sólo permite `connect-src` al propio origen y al
backend. Para no abrirla a `*.ingest.sentry.io`, el SDK usa `tunnelRoute`: el
navegador manda los eventos a `/monitoring?o=…&p=…` del propio origen y Next los
reescribe al ingest de Sentry.

- El middleware deja pasar `/monitoring` sin sesión ni CSP, y le **quita
  `Cookie` y `Authorization`** antes de reenviarla (la cookie de NextAuth no
  debe llegar a Sentry).
- El Service Worker la manda siempre a la red (`NetworkOnly`), nunca a caché.
- El SDK del navegador se carga desde `src/instrumentation-client.ts` con un
  `import()` (chunk propio de Next, ~130 kB gzip): bajo `'strict-dynamic'` carga
  como cualquier otro chunk, y sin DSN nunca se descarga (no pesa en el bundle
  inicial). Errores en los primeros milisegundos, antes de que llegue el chunk,
  pueden no reportarse.

El túnel sólo funciona con DSN de Sentry SaaS (`o<n>.ingest[.<región>].sentry.io`).
Con un Sentry auto-alojado el SDK enviaría directo a ese host y la CSP lo
bloquearía: habría que agregar su origen a `connect-src`.

## Archivos

- `apps/web/src/lib/sentry.ts` — opciones comunes, `scrubEvent`, ruta del túnel.
- `apps/web/src/instrumentation.ts` — `register()` (Node/edge) y `onRequestError`.
- `apps/web/src/instrumentation-client.ts` — init del navegador.
- `apps/web/src/app/global-error.tsx` — captura de errores del layout raíz.
- `apps/web/next.config.ts` — `withSentryConfig` condicional.

## Probarlo

1. Configurar `NEXT_PUBLIC_SENTRY_DSN` en un preview y redeployar.
2. En la consola del navegador: `setTimeout(() => { throw new Error("prueba Sentry") })`.
3. En la pestaña Network debe verse un `POST /monitoring?o=…&p=…` con respuesta
   200, y el error aparecer en Sentry sin cookies ni cabecera `Authorization`.
