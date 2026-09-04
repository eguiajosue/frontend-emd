import { signOut } from "next-auth/react";

/**
 * Centralized fetch wrapper for all authenticated backend calls.
 *
 * If the backend responds with 401 (expired/invalid JWT), it signs the
 * user out and redirects to /login with a friendly message, instead of
 * every page having to handle expired sessions individually.
 */

const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró, inicia sesión de nuevo";

let handlingExpiredSession = false;

async function handleUnauthorized() {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;
  try {
    await signOut({ redirect: false });
  } finally {
    if (typeof window !== "undefined") {
      window.location.href = `/login?message=${encodeURIComponent(
        SESSION_EXPIRED_MESSAGE
      )}`;
    }
  }
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
