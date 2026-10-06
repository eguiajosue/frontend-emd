import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/csp";
import { isSentryTunnelPath } from "@/lib/sentry";

/**
 * Dos trabajos en un solo middleware (Next sólo admite uno):
 *
 * 1. CSP con nonce por request (ver `lib/csp.ts`). La cabecera va en la
 *    REQUEST (Next la lee para ponerle el nonce a sus propios scripts) y en la
 *    RESPUESTA (la que aplica el navegador); `x-nonce` lo expone a
 *    `app/layout.tsx` para los scripts inline propios.
 * 2. Protección de las rutas privadas: sin sesión NextAuth redirige a /login.
 *    `/dashboard` cubre la app entera (todas las pantallas privadas cuelgan de
 *    ahí); `/`, `/login`, `/api/auth/*` y los assets quedan fuera.
 */

function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function withCsp(request: NextRequest): NextResponse {
  // El Service Worker no tiene HTML ni scripts inline: CSP sin nonce, con
  // `script-src 'self'` (y el mismo `connect-src`, que limita sus fetch).
  const nonce = request.nextUrl.pathname === "/sw.js" ? undefined : generateNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  });

  const requestHeaders = new Headers(request.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Túnel de Sentry (`/monitoring`, ver `lib/sentry.ts`): Next lo reescribe al
 * ingest de Sentry DESPUÉS del middleware, reenviando las cabeceras de la
 * request. Sin auth (el reporte de un error en /login también debe llegar) ni
 * CSP (no es HTML), y sin `Cookie`/`Authorization`: la cookie de sesión de
 * NextAuth no tiene por qué salir hacia Sentry.
 */
function forSentryTunnel(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("cookie");
  requestHeaders.delete("authorization");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Sólo corre si hay sesión válida; si no, `withAuth` ya respondió con el
// redirect a /login (con callbackUrl), igual que antes.
const authMiddleware = withAuth((request) => withCsp(request));

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isSentryTunnelPath(request.nextUrl.pathname)) {
    return forSentryTunnel(request);
  }
  if (isProtectedPath(request.nextUrl.pathname)) {
    return authMiddleware(request as Parameters<typeof authMiddleware>[0], event);
  }
  return withCsp(request);
}

/**
 * Todo menos los assets estáticos: la CSP sólo importa en documentos HTML (y
 * en `/sw.js`, que el navegador aplica al worker). Los chunks de `_next`, las
 * imágenes y los modelos 3D no necesitan pasar por aquí.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons/|flags/|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|woff2?)$).*)",
  ],
};
