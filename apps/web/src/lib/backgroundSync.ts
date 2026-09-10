"use client";

/**
 * Drena la cola offline (`offlineQueue.ts`) apenas conviene.
 *
 * Dos caminos, porque Background Sync sólo lo soporta Chrome/Edge:
 *  - `scheduleBackgroundSync()`: pide al service worker que sincronice en
 *    cuanto detecte red, incluso con la pestaña cerrada (`sw.ts` escucha el
 *    evento `sync`).
 *  - `registerOnlineDrainFallback()`: para Safari/Firefox (sin Background
 *    Sync), escucha el evento `online` de `window` y drena la cola desde acá
 *    mismo, con el mismo código (`drainPendingMutations`) que usaría el SW.
 */

import { getSession } from "next-auth/react";
import { authHeaders } from "@/lib/authFetch";
import {
  listPendingMutations,
  removePendingMutation,
  type PendingMutation,
} from "@/lib/offlineQueue";

export const SYNC_TAG = "sync-pending-mutations";

interface SyncManager {
  register(tag: string): Promise<void>;
}

/** Pide al service worker que drene la cola apenas vuelva la red (best-effort). */
export async function scheduleBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (registration as ServiceWorkerRegistration & { sync: SyncManager }).sync.register(
        SYNC_TAG
      );
      return;
    }
  } catch {
    // Sigue al fallback: sin Background Sync, o el registro falló.
  }
  // Sin soporte de Background Sync: si ya hay red ahora mismo, no hace falta
  // esperar al evento `online` (puede que ya haya pasado).
  if (navigator.onLine) {
    void drainPendingMutations();
  }
}

/**
 * Reenvía cada mutación pendiente, en orden, contra el backend real. Saca de
 * la cola las que se aplicaron con éxito; las que el backend rechaza con un
 * error real (400/403/...) se dejan ahí — no hay forma automática de resolver
 * ese conflicto, y borrarlas silenciosamente perdería el cambio sin avisar.
 * Ante un fallo de red se corta: se reintenta la próxima vez que haya señal.
 */
export async function drainPendingMutations(): Promise<void> {
  const pending = await listPendingMutations();
  if (pending.length === 0) return;

  let token: string | undefined;
  try {
    const session = await getSession();
    token = session?.user?.token;
  } catch {
    // Sin sesión disponible (SW, o `getSession` no aplica en este contexto):
    // se intenta sin token: el backend la rechazará como cualquier request
    // no autenticada y la mutación queda en cola para el próximo intento.
  }

  for (const mutation of pending) {
    if (!(await replay(mutation, token))) break;
  }
}

async function replay(mutation: PendingMutation, token: string | undefined): Promise<boolean> {
  try {
    const res = await fetch(mutation.url, {
      method: mutation.method,
      headers: authHeaders(token),
      body: mutation.body !== undefined ? JSON.stringify(mutation.body) : undefined,
    });
    if (res.ok) {
      await removePendingMutation(mutation.id);
    }
    return true;
  } catch {
    // Seguimos sin red: no tiene sentido intentar las siguientes ahora.
    return false;
  }
}

/** Fallback para navegadores sin Background Sync: drena en cuanto vuelve la red. */
export function registerOnlineDrainFallback(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => void drainPendingMutations();
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
