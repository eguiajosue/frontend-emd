"use client";

/**
 * Capa de datos de la app, construida sobre React Query.
 *
 * Reemplaza al viejo hook casero `useCrud` (que refetcheaba todo desde cero en
 * cada pantalla y no compartía cache). Los hooks son genéricos y uniformes:
 *
 *   const { data, isLoading, isError, error, refetch } = useEntityList<Order>("orders");
 *   const { data: order } = useEntityDetail<Order>("orders", id);
 *   const { create, update, remove, isMutating } = useEntityMutations<Order>("orders");
 *
 * Todas las llamadas salen por `request()` -> `authFetch` (único punto de salida
 * HTTP, con manejo global del 401). Cada mutación invalida la cache de su
 * entidad, así el resto de las pantallas se refresca sola en background.
 */

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  ApiError,
  isSessionExpiredError,
  request,
  unwrapList,
  type Paginated,
} from "@/lib/api";
import { ENDPOINTS, queryKeys, type EntityKey } from "@/lib/queryKeys";

/** Token del usuario actual; las queries quedan deshabilitadas si no hay sesión. */
export function useAuthToken(): string | undefined {
  const { data: session } = useSession();
  return session?.user?.token;
}

/**
 * `staleTime` sugerido para catálogos de bajo cambio (categorías/unidades de
 * materiales, presets de producto, roles, estados, proveedores, áreas): datos
 * que casi no cambian y no necesitan refetchear cada vez que se vuelve a
 * montar la pantalla que los usa (el `staleTime` global es de 30s).
 */
export const CATALOG_STALE_TIME = 5 * 60_000;

export interface EntityListOptions {
  /** Permite desactivar la query (ej. una pantalla que sólo la usa si sos admin). */
  enabled?: boolean;
  /** Query params opcionales (paginación/filtros del backend). */
  params?: Record<string, string | number | boolean | undefined>;
  /**
   * Override puntual del `staleTime` global (30s, ver `providers.tsx`). Pensado
   * para catálogos de bajo cambio (categorías/unidades de materiales, presets
   * de producto, roles, estados, áreas) que no necesitan refetchear en cada
   * mount — no lo uses para pedidos ni nada que deba sentirse "en vivo".
   */
  staleTime?: number;
}

/** Listado de una entidad. Devuelve siempre un array (nunca `undefined`). */
export function useEntityList<T>(
  entity: EntityKey,
  options: EntityListOptions = {}
): UseQueryResult<T[]> & { data: T[] } {
  const token = useAuthToken();
  const { enabled = true, params, staleTime } = options;

  const query = useQuery<T[]>({
    queryKey: queryKeys.list(entity, params),
    enabled: Boolean(token) && enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
    queryFn: async () => {
      const payload = await request<T[] | Paginated<T>>(ENDPOINTS[entity], {
        token,
        params,
      });
      return unwrapList<T>(payload);
    },
  });

  return { ...query, data: query.data ?? [] } as UseQueryResult<T[]> & { data: T[] };
}

/** Detalle de una entidad por id. */
export function useEntityDetail<T>(
  entity: EntityKey,
  id: number | string | undefined,
  options: { enabled?: boolean } = {}
) {
  const token = useAuthToken();
  const validId = id !== undefined && id !== null && id !== "" && !Number.isNaN(Number(id));

  return useQuery<T>({
    queryKey: queryKeys.detail(entity, id ?? "none"),
    enabled: Boolean(token) && validId && (options.enabled ?? true),
    queryFn: () => request<T>(`${ENDPOINTS[entity]}/${id}`, { token }),
  });
}

/** Mutaciones CRUD de una entidad, con invalidación de cache incluida. */
export function useEntityMutations<T = unknown, P = Record<string, unknown>>(
  entity: EntityKey
) {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.all(entity) }),
    [queryClient, entity]
  );

  const createMutation = useMutation<T, ApiError, P>({
    mutationFn: (payload: P) =>
      request<T>(ENDPOINTS[entity], { method: "POST", token, body: payload }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation<T, ApiError, { id: number | string; payload: P }>({
    mutationFn: ({ id, payload }) =>
      request<T>(`${ENDPOINTS[entity]}/${id}`, {
        method: "PATCH",
        token,
        body: payload,
      }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation<void, ApiError, number | string>({
    mutationFn: (id) =>
      request<void>(`${ENDPOINTS[entity]}/${id}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });

  return useMemo(
    () => ({
      create: (payload: P) => createMutation.mutateAsync(payload),
      update: (id: number | string, payload: P) =>
        updateMutation.mutateAsync({ id, payload }),
      remove: (id: number | string) => removeMutation.mutateAsync(id),
      invalidate,
      isMutating:
        createMutation.isPending ||
        updateMutation.isPending ||
        removeMutation.isPending,
    }),
    [createMutation, updateMutation, removeMutation, invalidate]
  );
}

export { isSessionExpiredError };
