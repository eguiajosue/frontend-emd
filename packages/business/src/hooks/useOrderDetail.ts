import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { request, unwrapList, ApiError, type Paginated } from "@emd/api-client";
import type { Order, OrderHistory } from "@emd/types";
import { useAuthSession } from "../session";
import { ENDPOINTS, queryKeys } from "../queryKeys";

/**
 * Hooks de "detalle de pedido" compartidos entre Web y Mobile.
 *
 * Cubren el camino simple (ver el pedido, su historial, editar datos
 * generales, avanzar el estado) — NO el movimiento por tareas de área del
 * tablero de producción (`useMoveOrderStatus` en la Web), que sigue siendo
 * exclusivo de la Web por ahora: esa lógica está atada al tablero kanban y
 * a los roles de área, no a una pantalla de detalle.
 */

export function useOrder(
  id: number | string | undefined
): UseQueryResult<Order> {
  const { token } = useAuthSession();

  return useQuery<Order>({
    queryKey: queryKeys.detail("orders", id ?? ""),
    enabled: Boolean(token) && id !== undefined && !Number.isNaN(Number(id)),
    queryFn: () => request<Order>(`${ENDPOINTS.orders}/${id}`, { token }),
  });
}

/** Historial de un pedido puntual, más reciente primero. */
export function useOrderHistoryForOrder(orderId: number | undefined) {
  const { token } = useAuthSession();

  const query = useQuery<OrderHistory[]>({
    queryKey: queryKeys.all("orderHistories"),
    enabled: Boolean(token) && orderId !== undefined,
    queryFn: async () => {
      const payload = await request<OrderHistory[] | Paginated<OrderHistory>>(
        ENDPOINTS.orderHistories,
        { token }
      );
      return unwrapList<OrderHistory>(payload);
    },
  });

  const histories = useMemo(
    () =>
      (query.data ?? [])
        .filter((h) => h.orderId === orderId)
        .sort(
          (a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
        ),
    [query.data, orderId]
  );

  return { ...query, histories };
}

/** Actualiza datos generales del pedido (descripción, fecha de entrega, etc.). */
export function useUpdateOrder() {
  const { token } = useAuthSession();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<Pick<Order, "description" | "deliveryDate">>;
    }) => request<Order>(`${ENDPOINTS.orders}/${id}`, { method: "PATCH", token, body: payload }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.detail("orders", id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
    },
  });

  return {
    updateOrder: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

/**
 * Cambio de estado simple: PATCH del pedido + alta del registro de
 * historial. Sin cola offline (esa es una mejora específica de la Web, ver
 * `apps/web/src/lib/offlineMutation.ts`) — en Mobile, sin conexión, la
 * mutación simplemente falla y se puede reintentar.
 */
export function useChangeOrderStatusSimple() {
  const { token } = useAuthSession();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async ({
      order,
      newStatusId,
    }: {
      order: Pick<Order, "id" | "statusId">;
      newStatusId: number;
    }) => {
      await request(`${ENDPOINTS.orders}/${order.id}`, {
        method: "PATCH",
        token,
        body: { statusId: newStatusId },
      });
      if (order.statusId !== newStatusId) {
        await request<OrderHistory>(ENDPOINTS.orderHistories, {
          method: "POST",
          token,
          body: {
            orderId: order.id,
            previousStatusId: order.statusId,
            newStatusId,
          },
        });
      }
      return { orderId: order.id };
    },
    onSuccess: invalidate,
  });

  return {
    changeStatus: (order: Pick<Order, "id" | "statusId">, newStatusId: number) =>
      mutation.mutateAsync({ order, newStatusId }),
    isChangingStatus: mutation.isPending,
    error: mutation.error as ApiError | null,
  };
}
