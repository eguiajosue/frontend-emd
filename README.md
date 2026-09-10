# EMD Bordados

Monorepo (pnpm + Turborepo) para el sistema interno de gestión de pedidos de EMD Bordados.

```
apps/
  web/      Next.js (App Router) — la app web actual, desplegada en Vercel
  mobile/   Expo/React Native — app móvil (iOS/Android): login + lista de pedidos

packages/   Código compartido entre apps (tipos, lógica de negocio, API client)
```

El backend (NestJS + Prisma + Postgres, desplegado en Render) vive en un repo aparte (`backend-emd`) y es compartido por `apps/web` y `apps/mobile`.

> **`apps/mobile` no es parte del workspace de pnpm.** Expo (React 19) y Next.js
> (React 18) no pueden convivir en el mismo store de pnpm sin romper el chequeo
> de tipos de Next.js (conflicto de versiones de `@types/react`). Por eso
> `apps/mobile` tiene su propio `node_modules` aislado (instalado con `npm`,
> no `pnpm`) y consume `packages/*` vía dependencias `file:`, no `workspace:*`.
> Esto significa: `pnpm install`/`pnpm turbo run ...` en la raíz **no** tocan
> `apps/mobile` — necesita sus propios comandos, ver abajo.

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

Para trabajar con Mobile (necesita la app **Expo Go** en tu celular, o un simulador):

```bash
cd apps/mobile
npm install            # instalación aislada, NO pnpm (ver nota arriba)
cp .env.example .env   # completar EXPO_PUBLIC_BACKEND_URL (ver abajo)
npm start
```

Si editás algo en `packages/*` mientras trabajás en Mobile, corré `npm install` de nuevo en `apps/mobile` para que la copia `file:` se actualice.

Escaneá el QR con Expo Go (Android) o la cámara (iOS). `EXPO_PUBLIC_BACKEND_URL` debe apuntar a un backend alcanzable desde tu celular — `http://localhost:...` no funciona porque el celular no es la misma máquina; usá la IP de tu red local (`http://192.168.x.x:3000`) o directamente el backend de Render.

## Build, lint y tests

Desde la raíz (corre en `apps/web` y `packages/*` vía Turborepo; **no incluye `apps/mobile`**, ver nota arriba):

```bash
pnpm build
pnpm lint
pnpm test
```

Para Mobile:

```bash
cd apps/mobile
npm run lint   # tsc --noEmit
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
