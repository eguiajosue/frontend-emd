"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request, unwrapList, type Paginated } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { Notification } from "@/types";

/**
 * Notificaciones del usuario autenticado.
 *
 * Endpoint nuevo del backend, desplegado en paralelo (ver notas del ticket):
 * - `GET /notifications` (paginado o array plano — `unwrapList` absorbe ambos)
 * - `GET /notifications/unread-count` -> `{ count }`
 * - `PATCH /notifications/:id/read`
 * - `PATCH /notifications/read-all`
 *
 * Mientras el backend no esté desplegado, un 404 se absorbe defensivamente
 * (cae a "sin notificaciones" / conteo 0) en vez de romper el header.
 */

const NOTIFICATIONS_UNREAD_KEY = [...queryKeys.all("notifications"), "unread-count"];

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** `GET /notifications/unread-count`, refrescado por poll + invalidado en vivo por WS. */
export function useUnreadNotificationsCount() {
  const token = useAuthToken();

  const query = useQuery<{ count: number }>({
    queryKey: NOTIFICATIONS_UNREAD_KEY,
    enabled: Boolean(token),
    queryFn: async () => {
      try {
        return await request<{ count: number }>(
          `${ENDPOINTS.notifications}/unread-count`,
          { token }
        );
      } catch (error) {
        if (isNotFound(error)) return { count: 0 };
        throw error;
      }
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  return { count: query.data?.count ?? 0, isLoading: query.isLoading };
}

/** Listado paginado de notificaciones (`GET /notifications`). */
export function useNotifications(page = 1, limit = 20) {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const query = useQuery<Paginated<Notification> | Notification[]>({
    queryKey: [...queryKeys.all("notifications"), "list", page, limit],
    enabled: Boolean(token),
    queryFn: async () => {
      try {
        return await request<Paginated<Notification> | Notification[]>(
          ENDPOINTS.notifications,
          { token, params: { page, limit } }
        );
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    placeholderData: (previous) => previous,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  const notifications = unwrapList<Notification>(query.data);
  const meta = Array.isArray(query.data) ? undefined : query.data?.meta;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.all("notifications") });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: number) =>
      request<Notification>(`${ENDPOINTS.notifications}/${id}/read`, {
        method: "PATCH",
        token,
      }),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      request<void>(`${ENDPOINTS.notifications}/read-all`, {
        method: "PATCH",
        token,
      }),
    onSuccess: invalidate,
  });

  return {
    notifications,
    meta,
    isLoading: query.isLoading,
    isError: query.isError && !isNotFound(query.error),
    isUnavailable: isNotFound(query.error),
    refetch: query.refetch,
    markAsRead: (id: number) => markReadMutation.mutateAsync(id).catch(() => undefined),
    markAllAsRead: () => markAllReadMutation.mutateAsync().catch(() => undefined),
    isMarkingAll: markAllReadMutation.isPending,
  };
}

/** Usado por `useSocket` para refrescar el conteo apenas llega un evento en vivo. */
export function invalidateNotificationsQueryKey() {
  return queryKeys.all("notifications");
}
