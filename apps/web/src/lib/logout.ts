import { signOut } from "next-auth/react";

/**
 * Cierra la sesión y vuelve al login.
 *
 * NO se usa `signOut({ callbackUrl })`: con esa forma next-auth arma la URL de
 * destino a partir de `NEXTAUTH_URL`, que en Vercel suele quedar apuntando a la
 * URL única de un deploy viejo. Cuando ese deploy ya no existe, el logout
 * terminaba en la pantalla de Vercel "404: NOT_FOUND / DEPLOYMENT_NOT_FOUND"
 * en vez de en /login.
 *
 * Cerrando con `redirect: false` y redirigiendo a mano, el destino siempre es
 * el origen que el usuario tiene abierto, sea el dominio de producción o una
 * preview.
 */
/**
 * Cachés del service worker (src/app/sw.ts) que guardan respuestas del backend
 * autenticadas o pantallas privadas. Se borran al cerrar sesión: si no, en un
 * equipo compartido el siguiente usuario (o cualquiera con DevTools) veía los
 * datos del anterior vía el fallback offline de NetworkFirst.
 */
export const PRIVATE_CACHE_NAMES = ["emd-live-data", "emd-dashboard"] as const;

export async function clearPrivateCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  await Promise.all(
    PRIVATE_CACHE_NAMES.map((name) => caches.delete(name).catch(() => false)),
  );
}

export async function logout(message?: string): Promise<void> {
  try {
    await signOut({ redirect: false });
  } finally {
    await clearPrivateCaches().catch(() => undefined);
    if (typeof window !== "undefined") {
      const query = message ? `?message=${encodeURIComponent(message)}` : "";
      window.location.href = `/login${query}`;
    }
  }
}
