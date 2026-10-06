"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { patchStatusChange } from "@/lib/offlineMutation";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { AreaTaskStatus, OrderAreaTask } from "@/types";

/**
 * Tareas de área de un pedido.
 *
 * Un pedido puede necesitar varias áreas de producción (ej. bordado + dtf) y
 * todas avanzan en paralelo, cada una con su estado y su responsable. Cuando
 * todas terminan, el backend deja el pedido listo para entregar; la entrega la
 * confirma Recepción. Ver WORKFLOW.md §3 en el backend.
 *
 * Endpoints:
 * - `GET    /orders/:id/area-tasks`
 * - `POST   /orders/:id/area-tasks`               (sumar áreas)
 * - `PATCH  /orders/:id/area-tasks/:taskId/status`
 * - `PATCH  /orders/:id/area-tasks/:taskId/assign`
 * - `DELETE /orders/:id/area-tasks/:taskId`
 *
 * Mientras el backend no esté desplegado, un 404 se absorbe (cae a "sin
 * tareas") en vez de romper el detalle del pedido.
 */

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function areaTasksKey(orderId: number) {
  return [...queryKeys.all("orders"), "area-tasks", orderId] as const;
}

export function useAreaTasks(orderId: number | null) {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const query = useQuery<OrderAreaTask[]>({
    queryKey: areaTasksKey(orderId ?? 0),
    enabled: Boolean(token) && orderId !== null,
    queryFn: async () => {
      try {
        return await request<OrderAreaTask[]>(
          `${ENDPOINTS.orders}/${orderId}/area-tasks`,
          { token }
        );
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  /**
   * Invalida las tareas y además el pedido: al terminar la última área el
   * backend cambia el estado global, así que la fila/tarjeta también cambia.
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: areaTasksKey(orderId ?? 0) });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
  };

  const setStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: AreaTaskStatus }) =>
      patchStatusChange<OrderAreaTask>(
        `${ENDPOINTS.orders}/${orderId}/area-tasks/${taskId}/status`,
        { status },
        token
      ),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: ({
      taskId,
      assignedUserId,
    }: {
      taskId: number;
      assignedUserId: number | null;
    }) =>
      request<OrderAreaTask>(
        `${ENDPOINTS.orders}/${orderId}/area-tasks/${taskId}/assign`,
        { token, method: "PATCH", body: { assignedUserId } }
      ),
    onSuccess: invalidate,
  });

  const addAreas = useMutation({
    mutationFn: (areas: string[]) =>
      request<OrderAreaTask[]>(`${ENDPOINTS.orders}/${orderId}/area-tasks`, {
        token,
        method: "POST",
        body: { areas },
      }),
    onSuccess: invalidate,
  });

  const removeArea = useMutation({
    mutationFn: (taskId: number) =>
      request<{ deleted: boolean }>(
        `${ENDPOINTS.orders}/${orderId}/area-tasks/${taskId}`,
        { token, method: "DELETE" }
      ),
    onSuccess: invalidate,
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError && !isNotFound(query.error),
    isUnavailable: isNotFound(query.error),
    refetch: query.refetch,
    setStatus,
    assign,
    addAreas,
    removeArea,
  };
}
