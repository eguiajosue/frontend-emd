/**
 * Conecta el manejo de 401 de `@emd/api-client` con el logout propio de la
 * Web (NextAuth). Ver `@emd/api-client/src/authFetch.ts` para la lógica
 * portable compartida con la futura app Mobile.
 */
import { configureAuthFetch } from "@emd/api-client";
import { logout } from "@/lib/logout";

configureAuthFetch({ onUnauthorized: (message) => logout(message) });

export { authFetch, authHeaders, AuthFetchError } from "@emd/api-client";
