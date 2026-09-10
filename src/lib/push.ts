/**
 * Web Push (Fase 3): suscribir/desuscribir el navegador a notificaciones
 * push reales, además del Socket.io en vivo existente.
 *
 * No expone UI: eso es Fase 4 (panel en /dashboard/configuracion). Acá sólo
 * quedan las dos funciones listas para que ese panel las llame.
 */

import { request } from "@/lib/api";

/** Convierte la clave pública VAPID (base64url) al formato que pide `pushManager.subscribe`. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** `true` si el navegador soporta Service Worker + Push API. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * `true` si estamos en Safari/iOS pero la PWA no está instalada a la pantalla
 * de inicio. iOS sólo permite Web Push a PWAs instaladas (16.4+); si no está
 * instalada, `subscribeToPush` va a fallar aunque el resto del flujo esté bien.
 */
export function isIOSInstallRequired(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS) return false;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

interface VapidPublicKeyResponse {
  publicKey: string | null;
}

/**
 * Pide permiso de notificaciones, obtiene la clave pública VAPID del backend
 * y crea (o reutiliza) la suscripción push del navegador, mandándola a
 * `POST /push/subscribe`. Devuelve `null` si el navegador no soporta push,
 * el usuario rechaza el permiso, o el backend no tiene VAPID configurado.
 */
export async function subscribeToPush(
  token: string | null | undefined
): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const { publicKey } = await request<VapidPublicKeyResponse>(
    "push/vapid-public-key"
  );
  if (!publicKey) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return subscription;
  }

  await request("push/subscribe", {
    method: "POST",
    token,
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });

  return subscription;
}

/**
 * Cancela la suscripción push del navegador y avisa al backend
 * (`DELETE /push/subscribe`) para que borre la fila correspondiente.
 */
export async function unsubscribeFromPush(
  token: string | null | undefined
): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await request("push/subscribe", {
    method: "DELETE",
    token,
    body: { endpoint },
  });
}
