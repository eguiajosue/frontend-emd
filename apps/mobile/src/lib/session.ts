import * as SecureStore from 'expo-secure-store';
import { configureApiClient, configureAuthFetch } from '@emd/api-client';

const TOKEN_KEY = 'emd_auth_token';
const ROLES_KEY = 'emd_auth_roles';

export interface StoredSession {
  token: string;
  roles: string[];
}

/**
 * Conecta `@emd/api-client` (compartido con la Web) a lo específico de
 * Mobile: la URL del backend viene de `EXPO_PUBLIC_BACKEND_URL` (Expo inlinea
 * las env vars `EXPO_PUBLIC_*` al bundlear, igual que Next.js con
 * `NEXT_PUBLIC_*`), y un 401 borra la sesión guardada en vez de llamar a
 * NextAuth (que no existe acá).
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
  const [token, rolesJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(ROLES_KEY),
  ]);
  if (!token) return null;
  let roles: string[] = [];
  try {
    roles = rolesJson ? JSON.parse(rolesJson) : [];
  } catch {
    roles = [];
  }
  return { token, roles };
}

export async function setSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(ROLES_KEY, JSON.stringify(session.roles)),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(ROLES_KEY),
  ]);
}
