"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { CreateOrderMaterialItemPayload, OrderMaterialItem, UpdateOrderMaterialItemPayload } from "@/types";

/**
 * Hoja de materiales de un pedido: opcional, no bloquea autorizar el
 * montaje. La carga Recepción (o admin/superuser) cuando el pedido pasa a
 * producción, para que el área sepa qué se va a usar.
 *
 * Endpoints:
 * - `GET    /orders/:id/materials`
 * - `POST   /orders/:id/materials`
 * - `PATCH  /orders/:id/materials/:itemId`
 * - `DELETE /orders/:id/materials/:itemId`
 */

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function orderMaterialsKey(orderId: number) {
  return [...queryKeys.all("orders"), "materials", orderId] as const;
}

export function useOrderMaterials(orderId: number | null) {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const query = useQuery<OrderMaterialItem[]>({
    queryKey: orderMaterialsKey(orderId ?? 0),
    enabled: Boolean(token) && orderId !== null,
    queryFn: async () => {
      try {
        return await request<OrderMaterialItem[]>(
          `${ENDPOINTS.orders}/${orderId}/materials`,
          { token }
        );
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orderMaterialsKey(orderId ?? 0) });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
  };

  const create = useMutation({
    mutationFn: (payload: CreateOrderMaterialItemPayload) =>
      request<OrderMaterialItem>(`${ENDPOINTS.orders}/${orderId}/materials`, {
        token,
        method: "POST",
        body: payload,
      }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: number;
      payload: UpdateOrderMaterialItemPayload;
    }) =>
      request<OrderMaterialItem>(
        `${ENDPOINTS.orders}/${orderId}/materials/${itemId}`,
        { token, method: "PATCH", body: payload }
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (itemId: number) =>
      request<{ success: boolean }>(
        `${ENDPOINTS.orders}/${orderId}/materials/${itemId}`,
        { token, method: "DELETE" }
      ),
    onSuccess: invalidate,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError && !isNotFound(query.error),
    create,
    update,
    remove,
  };
}
