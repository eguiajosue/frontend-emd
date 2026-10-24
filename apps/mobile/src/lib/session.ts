import * as SecureStore from 'expo-secure-store';
import { configureApiClient, configureAuthFetch } from '@emd/api-client';
import { normalizeSessionAccess } from '@emd/business';

const TOKEN_KEY = 'emd_auth_token';
const ROLES_KEY = 'emd_auth_roles';
const AREAS_KEY = 'emd_auth_areas';

export interface StoredSession {
  token: string;
  roles: string[];
  /** Slugs de las áreas en las que trabaja (separadas de los roles). */
  areas: string[];
}

function parseList(json: string | null): string[] | undefined {
  if (!json) return undefined;
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Conecta `@emd/api-client` (compartido con la Web) a lo específico de
 * Mobile: la URL del backend viene de `EXPO_PUBLIC_BACKEND_URL` (Expo inlinea
 * las env vars `EXPO_PUBLIC_*` al bundlear, igual que Next.js con
 * `NEXT_PUBLIC_*`), y un 401 borra la sesión guardada en vez de llamar a
 * NextAuth (que no existe aquí).
 *
 * Debe llamarse una sola vez, antes de la primera pantalla — ver App.tsx.
 */
export function initApiClient() {
  configureApiClient({ backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL });
  configureAuthFetch({
    onUnauthorized: () => {
      void clearSession();
    },
  });
}

export async function getSession(): Promise<StoredSession | null> {
  const [token, rolesJson, areasJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(ROLES_KEY),
    SecureStore.getItemAsync(AREAS_KEY),
  ]);
  if (!token) return null;
  // Una sesión guardada antes de separar áreas y roles no tiene `areas`: las
  // áreas venían dentro de `roles`.
  const { roles, areas } = normalizeSessionAccess({
    roles: parseList(rolesJson),
    areas: parseList(areasJson),
  });
  return { token, roles, areas };
}

export async function setSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(ROLES_KEY, JSON.stringify(session.roles)),
    SecureStore.setItemAsync(AREAS_KEY, JSON.stringify(session.areas)),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(ROLES_KEY),
    SecureStore.deleteItemAsync(AREAS_KEY),
  ]);
}
