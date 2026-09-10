import * as SecureStore from 'expo-secure-store';
import { configureApiClient, configureAuthFetch } from '@emd/api-client';

const TOKEN_KEY = 'emd_auth_token';

/**
 * Conecta `@emd/api-client` (compartido con la Web) a lo específico de
 * Mobile: la URL del backend viene de `EXPO_PUBLIC_BACKEND_URL` (Expo inlinea
 * las env vars `EXPO_PUBLIC_*` al bundlear, igual que Next.js con
 * `NEXT_PUBLIC_*`), y un 401 borra el token guardado en vez de llamar a
 * NextAuth (que no existe acá).
 *
 * Debe llamarse una sola vez, antes de la primera pantalla — ver App.tsx.
 */
export function initApiClient() {
  configureApiClient({ backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL });
  configureAuthFetch({
    onUnauthorized: () => {
      void clearToken();
    },
  });
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
