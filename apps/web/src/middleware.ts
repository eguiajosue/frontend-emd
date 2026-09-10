export { default } from "next-auth/middleware";

/**
 * Protege todas las rutas privadas: sin sesión NextAuth redirige a /login.
 *
 * `/dashboard/:path*` cubre la app entera (todas las pantallas privadas cuelgan
 * de /dashboard). Las rutas públicas —`/`, `/login`, `/api/auth/*` y los assets
 * estáticos— quedan deliberadamente fuera del matcher.
 */
export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
