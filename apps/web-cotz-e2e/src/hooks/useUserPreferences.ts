"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import type { NavPreferences } from "@/lib/navPreferences";

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
  /**
   * Cómo prefiere ver este usuario sus tareas de producción: "unified" muestra
   * todas juntas etiquetadas por área, "split" las agrupa por área. Es
   * preferencia personal de cada uno (ver WORKFLOW.md §4 en el backend).
   */
  areaViewMode?: "unified" | "split" | null;
  /** Formato de hora en toda la app: 24h o 12h con AM/PM. */
  timeFormatPreference?: "24h" | "12h" | null;
  /** Productos frecuentes del alta de pedido elegidos y ordenados por este usuario (null = por defecto). */
  frequentProductIds?: number[] | null;
  /** Barra lateral de este usuario: favoritos, orden, ocultos, expandida (null = por defecto). */
  navPreferences?: NavPreferences | null;
  /** "Mis colores" del estudio de mockups: favoritos y colores propios (hex `#rrggbb`, máx. 48 c/u). */
  mockupColors?: { favorites: string[]; custom: string[] } | null;
  /**
   * Notificaciones (Fase 4). Modo silencio general: si está activo, el
   * backend no persiste ni pushea notificaciones (salvo menciones directas,
   * cuando ese tipo exista).
   */
  notificationsMuted?: boolean | null;
  /**
   * Sólo notificar menciones directas. Hoy no tiene efecto práctico: el
   * sistema todavía no tiene un tipo de notificación de "mención" (no hay
   * @menciones de chat implementadas).
   */
  notifyMentionsOnly?: boolean | null;
  /** Notificar cambios de estado/asignación de pedidos y novedades de producción. */
  notifyProductionUpdates?: boolean | null;
  /** Notificar alertas críticas. */
  notifyCriticalAlerts?: boolean | null;
}

export const PREFERENCES_ENDPOINT = "users/me/preferences";
export const PREFERENCES_QUERY_KEY = ["userPreferences"] as const;
const PREFERENCES_MUTATION_KEY = ["userPreferences", "update"] as const;

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

  // Escrituras optimistas y en serie (R5): la caché cambia en el acto y los
  // PATCH van uno detrás de otro (`scope`), así clics rápidos (estrella,
  // arrastrar) no pueden llegar en desorden ni pisar un estado más nuevo.
  const mutation = useMutation({
    mutationKey: PREFERENCES_MUTATION_KEY,
    scope: { id: "userPreferences" },
    mutationFn: (partial: Partial<UserPreferences>) =>
      request<UserPreferences>(PREFERENCES_ENDPOINT, {
        method: "PATCH",
        token,
        body: partial,
      }),
    onMutate: async (partial) => {
      // Un GET en vuelo pisaría el valor optimista al llegar.
      if (queryClient.isFetching({ queryKey: PREFERENCES_QUERY_KEY }) > 0) {
        await queryClient.cancelQueries({ queryKey: PREFERENCES_QUERY_KEY });
      }
      const previous = queryClient.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<UserPreferences>(PREFERENCES_QUERY_KEY, { ...previous, ...partial });
      }
      return { previous };
    },
    onSuccess: (data) => {
      // Si quedan cambios en la fila, la caché ya tiene su versión optimista
      // (más nueva que esta respuesta): se respeta hasta que llegue la última.
      if (isLastPendingWrite()) queryClient.setQueryData(PREFERENCES_QUERY_KEY, data);
    },
    onError: (_error, _partial, context) => {
      // El toast lo da el manejo global (providers.tsx). Se deshace el cambio
      // sólo si no hay otros detrás (su respuesta traerá el estado real).
      if (context?.previous && isLastPendingWrite()) {
        queryClient.setQueryData(PREFERENCES_QUERY_KEY, context.previous);
      }
    },
  });

  /** La mutación en curso (aún "pending" durante sus callbacks) es la única. */
  function isLastPendingWrite() {
    return queryClient.isMutating({ mutationKey: PREFERENCES_MUTATION_KEY }) <= 1;
  }

  return {
    preferences: query.data,
    isLoading: query.isPending,
    // Silencia el rechazo aquí: el toast de error ya lo dispara el manejo
    // global de mutaciones (mutationCache.onError en providers.tsx).
    updatePreferences: (partial: Partial<UserPreferences>) =>
      mutation.mutateAsync(partial).catch(() => undefined),
    isUpdating: mutation.isPending,
  };
}
