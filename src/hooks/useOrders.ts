"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityDetail, useEntityList } from "@/hooks/useEntity";
import type { Order, OrderHistory } from "@/types";

/** Hooks específicos del dominio "pedidos", construidos sobre la capa genérica. */

export function useOrders(options?: { enabled?: boolean }) {
  return useEntityList<Order>("orders", { enabled: options?.enabled });
}

export function useOrder(
  id: number | string | undefined,
  options?: { enabled?: boolean }
) {
  return useEntityDetail<Order>("orders", id, options);
}

export function useOrderHistories() {
  return useEntityList<OrderHistory>("orderHistories");
}

/** Historial de un pedido puntual, ordenado del cambio más reciente al más viejo. */
export function useOrderHistory(orderId: number) {
  const query = useOrderHistories();
  const histories = useMemo(
    () =>
      query.data
        .filter((h) => h.orderId === orderId)
        .sort(
          (a, b) =>
            new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
        ),
    [query.data, orderId]
  );
  return { ...query, histories };
}

/**
 * Cambio de estado de un pedido: PATCH del pedido + alta del registro de
 * historial, en una sola operación reutilizable (antes estaba duplicada entre
 * el detalle del pedido y "Mis Tareas").
 */
export function useChangeOrderStatus() {
  const token = useAuthToken();
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
      await request<Order>(`${ENDPOINTS.orders}/${order.id}`, {
        method: "PATCH",
        token,
        body: { statusId: newStatusId },
      });
      await request<OrderHistory>(ENDPOINTS.orderHistories, {
        method: "POST",
        token,
        body: {
          orderId: order.id,
          previousStatusId: order.statusId,
          newStatusId,
        },
      });
      return { orderId: order.id };
    },
    onSuccess: ({ orderId }) => {
      invalidate();
      toast.success(`Pedido #${orderId} actualizado`);
    },
  });

  return {
    changeStatus: (order: Pick<Order, "id" | "statusId">, newStatusId: number) =>
      mutation.mutateAsync({ order, newStatusId }).catch(() => undefined),
    isChangingStatus: mutation.isPending,
    changingOrderId: mutation.isPending ? mutation.variables?.order.id : null,
  };
}
