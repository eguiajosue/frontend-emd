/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import { listPendingMutations, removePendingMutation } from "@/lib/offlineQueue";
import { isSentryTunnelPath } from "@/lib/sentry";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Túnel de Sentry (POST same-origin con el reporte de error, ver
    // lib/sentry.ts): siempre a la red, nunca a Cache Storage. Va primero para
    // que ninguna regla de abajo (ni `defaultCache`) lo intercepte.
    ...(["POST", "GET"] as const).map((method) => ({
      matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
        sameOrigin && isSentryTunnelPath(url.pathname),
      method,
      handler: new NetworkOnly(),
    })),
    // Payloads pesados de mockups (plantilla con su config, imagen/miniatura
    // de un logo, detalle de un mockup del pedido): pueden pesar varios MB y
    // no sirven offline. Sólo red, nunca a Cache Storage (decisión R8).
    {
      matcher: ({ url, sameOrigin }) =>
        !sameOrigin &&
        (/\/mockup-templates\/\d+\/?$/.test(url.pathname) ||
          /\/mockup-logos\/\d+\/(image|thumbnail)\/?$/.test(url.pathname) ||
          /\/orders\/\d+\/mockups\/\d+\/?$/.test(url.pathname)),
      handler: new NetworkOnly(),
    },
    // Banderas y modelos 3D (fuera del precache, R9): se guardan al verlos.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/(flags|models)\//.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "emd-mockup-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Datos vivos del kanban/pedidos: red primero, caché como respaldo offline.
    // Con tope (R8) para que Cache Storage no crezca sin límite.
    {
      matcher: ({ url, sameOrigin }) =>
        !sameOrigin ||
        /\/(orders|order-area-tasks)(\/|$|\?)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "emd-live-data",
        networkTimeoutSeconds: 4,
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    // Dashboards/analíticas: red primero (igual que los pedidos en vivo). Con
    // stale-while-revalidate se veía SIEMPRE la versión cacheada de la visita
    // anterior en cada navegación — un fix recién desplegado, o un dato que
    // acaba de cambiar, no se reflejaban hasta la SEGUNDA vez que se entraba
    // a la pantalla. El fallback a caché (si la red tarda o falla) es lo que
    // preserva el soporte offline.
    {
      matcher: ({ url }) => /\/dashboard(\/|$)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "emd-dashboard",
        networkTimeoutSeconds: 4,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Web Push (Fase 3): el backend manda `JSON.stringify({ title, body, orderId })`
 * (ver `PushService.notifyUser` en backend-emd) dentro del payload del push.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; orderId?: number };
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "EMD HUB";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      data: { orderId: payload.orderId },
    }),
  );
});

/** Al hacer click, enfoca una pestaña abierta o abre el pedido en una nueva. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const orderId = (event.notification.data as { orderId?: number } | undefined)
    ?.orderId;
  const targetUrl = orderId ? `/dashboard/orders/${orderId}` : "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clientsList.find((c) => "focus" in c) as
        | WindowClient
        | undefined;
      if (existing) {
        await existing.navigate(targetUrl);
        await existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// --- Cola de mutaciones offline (Fase 2: ver src/lib/offlineQueue.ts) ---
//
// Background Sync: cuando el navegador detecta que volvió la red (incluso con
// la pestaña cerrada), dispara este evento con el tag que registró el cliente
// (`scheduleBackgroundSync` en src/lib/backgroundSync.ts). Reenviamos cada
// mutación pendiente contra el backend real y sacamos de la cola sólo las que
// se aplicaron con éxito; las demás quedan para el próximo intento (falta de
// red de nuevo, o el fallback `online` del lado del cliente).
const SYNC_TAG = "sync-pending-mutations";

// La Background Sync API (evento `sync`, `SyncEvent`) no está en los tipos
// DOM que trae TypeScript todavía: se tipa mínimamente aquí en vez de sumar
// una lib externa sólo por esto.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

self.addEventListener("sync", ((event: SyncEvent) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(drainPendingMutationsInSW());
  }
}) as EventListener);

async function drainPendingMutationsInSW(): Promise<void> {
  const pending = await listPendingMutations();
  for (const mutation of pending) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body !== undefined ? JSON.stringify(mutation.body) : undefined,
      });
      if (res.ok) {
        await removePendingMutation(mutation.id);
      }
      // Error real del backend: se deja en la cola, no se pierde el cambio.
    } catch {
      // Seguimos sin red: se reintenta en el próximo evento `sync`.
      break;
    }
  }
}
