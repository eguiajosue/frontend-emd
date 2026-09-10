/**
 * Centralized fetch wrapper for all authenticated backend calls.
 *
 * If the backend responds with 401 (expired/invalid JWT), it runs the
 * `onUnauthorized` handler configured via `configureAuthFetch()` instead of
 * hard-coding a web-specific sign-out — cada app (Next.js/Web, Expo/Mobile)
 * conecta su propia forma de cerrar sesión al arrancar.
 */

const SESSION_EXPIRED_MESSAGE = "La sesión expiró, iniciar sesión de nuevo";

let onUnauthorized: (message: string) => void | Promise<void> = () => {};
let handlingExpiredSession = false;

export function configureAuthFetch(options: {
  onUnauthorized: (message: string) => void | Promise<void>;
}): void {
  onUnauthorized = options.onUnauthorized;
}

async function handleUnauthorized() {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;
  await onUnauthorized(SESSION_EXPIRED_MESSAGE);
}

export class AuthFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthFetchError";
  }
}

export async function authFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    await handleUnauthorized();
    throw new AuthFetchError("Sesión expirada", 401);
  }

  return res;
}

export function authHeaders(token?: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
