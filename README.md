# EMD Bordados

Monorepo (pnpm + Turborepo) para el sistema interno de gestión de pedidos de EMD Bordados.

```
apps/
  web/      Next.js (App Router) — la app web actual, desplegada en Vercel
  mobile/   Expo/React Native — app móvil (iOS/Android), en construcción

packages/   Código compartido entre apps (tipos, lógica de negocio, API client)
```

El backend (NestJS + Prisma + Postgres, desplegado en Render) vive en un repo aparte (`backend-emd`) y es compartido por `apps/web` y `apps/mobile`.

## Desarrollo local

```bash
pnpm install       # instala dependencias de todo el monorepo
pnpm dev           # corre todas las apps en modo desarrollo (turbo)
```

Para trabajar solo con la Web:

```bash
cd apps/web
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Build, lint y tests

Desde la raíz (corre en todos los paquetes vía Turborepo):

```bash
pnpm build
pnpm lint
pnpm test
```

## Tests e2e (Web)

```bash
cd apps/web
pnpm test:e2e   # 3 flujos end-to-end con Playwright
```

Los e2e levantan solos lo que necesitan: un backend de mentira (`e2e/mock-api.mjs`) y la app compilada apuntada a él. No hacen falta red ni el backend real.

En un entorno que ya trae Chromium y no puede descargarlo, apuntalo con
`PLAYWRIGHT_CHROMIUM_PATH=/ruta/al/chrome pnpm test:e2e`. Si no, alcanza con
`npx playwright install chromium` una vez.

## Deploy

- **Web**: Vercel, con **Root Directory = `apps/web`**.
- **Backend**: Render (repo `backend-emd`).
- **Mobile**: Expo EAS Build, distribución interna (TestFlight / Play Internal testing) — sin publicación pública en las stores.
