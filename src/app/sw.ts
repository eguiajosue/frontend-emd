/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { listPendingMutations, removePendingMutation } from "@/lib/offlineQueue";

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
    // Datos vivos del kanban/pedidos: red primero, caché como respaldo offline.
    {
      matcher: ({ url, sameOrigin }) =>
        !sameOrigin ||
        /\/(orders|order-area-tasks)(\/|$|\?)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "emd-live-data",
        networkTimeoutSeconds: 4,
      }),
    },
    // Dashboards/analíticas: instantáneo desde caché, se refresca en segundo plano.
    {
      matcher: ({ url }) => /\/dashboard(\/|$)/.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: "emd-dashboard" }),
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

  const title = payload.title || "EMD Bordados";
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
// DOM que trae TypeScript todavía: se tipa mínimamente acá en vez de sumar
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
