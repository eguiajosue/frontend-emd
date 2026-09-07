"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, request, type Paginated } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityDetail, useEntityList } from "@/hooks/useEntity";
import type { Order, OrderAuditLogEntry, OrderHistory, OrderNote } from "@/types";
import { orderStatusUpdatedMessage } from "@/lib/copy";

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

export function useOrderHistories(options?: { enabled?: boolean }) {
  return useEntityList<OrderHistory>("orderHistories", { enabled: options?.enabled });
}

/**
 * `GET /orders/history`: TODOS los pedidos de la empresa (sin filtro de
 * antigüedad de entrega), paginado por el backend. A diferencia de `useOrders`
 * (que trae el array plano completo), acá se pagina explícitamente porque el
 * historial puede crecer indefinidamente.
 */
export function useOrderHistoryList(page: number, limit = 20) {
  const token = useAuthToken();

  const query = useQuery<Paginated<Order>>({
    queryKey: [...queryKeys.all("orderHistory"), page, limit],
    enabled: Boolean(token),
    queryFn: () =>
      request<Paginated<Order>>(ENDPOINTS.orderHistory, {
        token,
        params: { page, limit },
      }),
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    orders: query.data?.data ?? [],
    meta: query.data?.meta,
  };
}

/** Historial de un pedido puntual, ordenado del cambio más reciente al más viejo. */
export function useOrderHistory(orderId: number, options?: { enabled?: boolean }) {
  const query = useOrderHistories({ enabled: options?.enabled });
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
      toast.success(orderStatusUpdatedMessage(orderId));
    },
  });

  return {
    changeStatus: (order: Pick<Order, "id" | "statusId">, newStatusId: number) =>
      mutation.mutateAsync({ order, newStatusId }).catch(() => undefined),
    isChangingStatus: mutation.isPending,
    changingOrderId: mutation.isPending ? mutation.variables?.order.id : null,
  };
}

/** `true` si el error es un 404 (endpoint todavía no desplegado, o recurso inexistente). */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Notas internas de un pedido (`GET/POST /orders/:id/notes`).
 *
 * Endpoint nuevo, desplegado en paralelo por el equipo de backend: si todavía
 * no existe, el 404 se absorbe acá y la pantalla muestra "sin notas" en vez
 * de romper.
 */
export function useOrderNotes(orderId: number | null) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const enabled = Boolean(token) && orderId !== null;

  const query = useQuery<OrderNote[]>({
    queryKey: ["orderNotes", orderId],
    enabled,
    queryFn: async () => {
      try {
        const payload = await request<OrderNote[] | Paginated<OrderNote>>(
          `${ENDPOINTS.orders}/${orderId}/notes`,
          { token }
        );
        return Array.isArray(payload) ? payload : payload?.data ?? [];
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  const mutation = useMutation({
    mutationFn: (text: string) =>
      request<OrderNote>(`${ENDPOINTS.orders}/${orderId}/notes`, {
        method: "POST",
        token,
        body: { text },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orderNotes", orderId] });
    },
    onError: (error) => {
      if (isNotFound(error)) {
        toast.error("Las notas internas todavía no están disponibles.");
      } else {
        toast.error(getNoteErrorMessage(error));
      }
    },
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isUnavailable: isNotFound(query.error),
    addNote: (text: string) => mutation.mutateAsync(text).catch(() => undefined),
    isAdding: mutation.isPending,
  };
}

function getNoteErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.message
    ? error.message
    : "No se pudo agregar la nota.";
}

/**
 * Historial de ediciones de un pedido (`GET /orders/:id/audit-log`).
 * Endpoint nuevo: 404 defensivo mientras no esté desplegado.
 */
export function useOrderAuditLog(orderId: number | null, options?: { enabled?: boolean }) {
  const token = useAuthToken();
  const enabled = Boolean(token) && orderId !== null && (options?.enabled ?? true);

  const query = useQuery<OrderAuditLogEntry[]>({
    queryKey: ["orderAuditLog", orderId],
    enabled,
    queryFn: async () => {
      try {
        const payload = await request<OrderAuditLogEntry[] | Paginated<OrderAuditLogEntry>>(
          `${ENDPOINTS.orders}/${orderId}/audit-log`,
          { token }
        );
        return Array.isArray(payload) ? payload : payload?.data ?? [];
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isUnavailable: isNotFound(query.error),
  };
}

/**
 * Pedidos de un cliente puntual (`GET /clients/:id/orders`).
 * Endpoint nuevo: si aún no existe, cae a array vacío (404 defensivo) en vez
 * de romper la ficha del cliente.
 */
export function useClientOrders(clientId: number | null) {
  const token = useAuthToken();
  const enabled = Boolean(token) && clientId !== null;

  const query = useQuery<Order[]>({
    queryKey: ["clientOrders", clientId],
    enabled,
    queryFn: async () => {
      try {
        const payload = await request<Order[] | Paginated<Order>>(
          `${ENDPOINTS.clients}/${clientId}/orders`,
          { token }
        );
        return Array.isArray(payload) ? payload : payload?.data ?? [];
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError && !isNotFound(query.error),
    isUnavailable: isNotFound(query.error),
    refetch: query.refetch,
  };
}

/**
 * Filtros compartidos por la pantalla de pedidos, reusados como query params
 * de `GET /orders/export`.
 */
export interface OrdersExportFilters {
  clientId?: number;
  statusIds?: number[];
  deliveryFrom?: string;
  deliveryTo?: string;
  area?: string;
  assignedUserId?: number | null;
}

/**
 * Dispara la descarga de `GET /orders/export` (CSV) con los filtros activos.
 * Patrón estándar fetch + blob + <a download>, ya que la respuesta es un
 * archivo generado (no se puede linkear directo por requerir el token Bearer).
 */
export async function downloadOrdersExport(
  token: string | undefined,
  filters: OrdersExportFilters
): Promise<void> {
  const params: Record<string, string> = {};
  if (filters.clientId !== undefined) params.clientId = String(filters.clientId);
  if (filters.statusIds && filters.statusIds.length > 0) {
    params.statusIds = filters.statusIds.join(",");
  }
  if (filters.deliveryFrom) params.deliveryFrom = filters.deliveryFrom;
  if (filters.deliveryTo) params.deliveryTo = filters.deliveryTo;
  if (filters.area) params.area = filters.area;
  if (filters.assignedUserId !== undefined && filters.assignedUserId !== null) {
    params.assignedUserId = String(filters.assignedUserId);
  }

  const { apiUrl } = await import("@/lib/config");
  const { authFetch, authHeaders } = await import("@/lib/authFetch");
  const search = new URLSearchParams(params).toString();
  const url = `${apiUrl(ENDPOINTS.orders)}/export${search ? `?${search}` : ""}`;

  const res = await authFetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new ApiError(
      res.status === 404
        ? "La exportación todavía no está disponible."
        : `No se pudo exportar (error ${res.status}).`,
      res.status
    );
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
