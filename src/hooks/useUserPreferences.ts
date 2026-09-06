"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";

/**
 * Preferencias de usuario (tema, acento, idioma), persistidas en el backend
 * (`GET/PATCH /users/me/preferences`) para que cada cuenta vea su propia
 * configuración al loguearse, sin depender de lo guardado en el navegador.
 */
export interface UserPreferences {
  themePreference: string | null;
  accentColor: string | null;
  languagePreference: string | null;
  /**
   * Legacy: intensidad del antiguo efecto Liquid Glass (0-100), ya retirado
   * del sistema de diseño del frontend. Se mantiene sólo para no romper el
   * contrato con el backend (que todavía persiste este campo) — el frontend
   * ya no lee ni escribe este valor.
   */
  glassIntensity?: number | null;
  /** Densidad de listas/cards ("comfortable" = actual, "compact" = reducida). */
  density?: "comfortable" | "compact" | null;
  /** Si el usuario ya vio el tour de onboarding del dashboard. */
  hasSeenOnboarding?: boolean | null;
}

const PREFERENCES_ENDPOINT = "users/me/preferences";
const PREFERENCES_QUERY_KEY = ["userPreferences"] as const;

export function useUserPreferences() {
  const { data: session } = useSession();
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const query = useQuery<UserPreferences>({
    queryKey: PREFERENCES_QUERY_KEY,
    enabled: !!session && !!token,
    queryFn: () => request<UserPreferences>(PREFERENCES_ENDPOINT, { token }),
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (partial: Partial<UserPreferences>) =>
      request<UserPreferences>(PREFERENCES_ENDPOINT, {
        method: "PATCH",
        token,
        body: partial,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, data);
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isPending,
    // Silencia el rechazo acá: el toast de error ya lo dispara el manejo
    // global de mutaciones (mutationCache.onError en providers.tsx).
    updatePreferences: (partial: Partial<UserPreferences>) =>
      mutation.mutateAsync(partial).catch(() => undefined),
    isUpdating: mutation.isPending,
  };
}
