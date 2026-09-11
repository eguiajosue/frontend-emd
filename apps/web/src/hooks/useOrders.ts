"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, getErrorMessage, request, type Paginated } from "@/lib/api";
import { patchStatusChange } from "@/lib/offlineMutation";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityDetail, useEntityList } from "@/hooks/useEntity";
import type {
  AreaTaskStatus,
  Order,
  OrderAuditLogEntry,
  OrderHistory,
  OrderNote,
} from "@/types";
import { orderStatusUpdatedMessage } from "@/lib/copy";
import {
  AREA_TASK_STATUS_BY_ORDER_STATUS,
  areaTasksToMove,
  canApplyOrderMove,
  type MoveActor,
} from "@/lib/orderMove";

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
      await patchStatusChange<Order>(
        `${ENDPOINTS.orders}/${order.id}`,
        { statusId: newStatusId },
        token
      );
      // Sin cambio real no se escribe historial: hasta ahora se creaba una
      // fila por cada click aunque el estado fuera el mismo, y el historial
      // acumulaba entradas "pendiente -> pendiente".
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
    onSuccess: ({ orderId }) => {
      invalidate();
      toast.success(orderStatusUpdatedMessage(orderId));
    },
    // Sin esto el fallo era MUDO: `changeStatus` traga el rechazo con
    // `.catch(() => undefined)` y no había ningún `onError`, así que un 400/403
    // se veía exactamente igual que no hacer nada. Era la razón por la que
    // "no me deja cambiar el estatus" no venía con ningún mensaje.
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "No se pudo cambiar el estado del pedido."
      );
    },
  });

  return {
    changeStatus: (order: Pick<Order, "id" | "statusId">, newStatusId: number) =>
      mutation.mutateAsync({ order, newStatusId }).catch(() => undefined),
    isChangingStatus: mutation.isPending,
    changingOrderId: mutation.isPending ? mutation.variables?.order.id : null,
  };
}

/**
 * Mueve un pedido a otro estado desde el tablero, escribiendo en el MISMO
 * lugar del que el tablero lee.
 *
 * El bug: el tablero de producción ubica cada pedido por el estado de la
 * `OrderAreaTask` del área de quien mira (porque tras autorizar el diseño el
 * pedido queda en "autorizado" mientras cada área arranca en "pendiente"),
 * pero arrastrar la tarjeta escribía `Order.statusId`. `PATCH /orders/:id`
 * devolvía 200 y no tocaba las tareas de área, así que la tarjeta volvía sola
 * a su columna original y parecía que el cambio se hubiera rechazado.
 *
 * `PATCH /orders/:id/area-tasks/:taskId/status` es el camino correcto: el
 * backend, además de mover la tarea, llama a `syncOrderStatusFromTasks` y deja
 * `Order.statusId` coherente. Sólo se cae al PATCH del pedido cuando no hay
 * tarea del área de quien mira (pedidos viejos sin tareas) o cuando el destino
 * es "entregado"/"cancelado", que no existen como estado de área.
 */
export function useMoveOrderStatus(actor: MoveActor) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { changeStatus } = useChangeOrderStatus();

  const mutation = useMutation({
    mutationFn: async ({
      order,
      taskIds,
      status,
    }: {
      order: Order;
      taskIds: number[];
      status: AreaTaskStatus;
    }) => {
      // En paralelo: son tareas independientes y el backend sincroniza el
      // estado del pedido después de cada una.
      await Promise.all(
        taskIds.map((taskId) =>
          patchStatusChange(
            `${ENDPOINTS.orders}/${order.id}/area-tasks/${taskId}/status`,
            { status },
            token
          )
        )
      );
      return { orderId: order.id };
    },
    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
      toast.success(orderStatusUpdatedMessage(orderId));
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "No se pudo cambiar el estado del pedido."
      );
    },
  });

  const canMove = useCallback(
    (order: Order, newStatusId: number) =>
      canApplyOrderMove(order, newStatusId, actor),
    [actor]
  );

  const move = useCallback(
    (order: Order, newStatusId: number) => {
      const areaStatus = AREA_TASK_STATUS_BY_ORDER_STATUS[newStatusId];
      const targets = areaStatus ? areaTasksToMove(order, actor) : [];
      if (targets.length > 0 && areaStatus) {
        return mutation
          .mutateAsync({
            order,
            // Las que ya están en el destino no se vuelven a escribir: evita
            // pisar `startedAt`/`completedAt` y notificaciones repetidas.
            taskIds: targets
              .filter((task) => task.status !== areaStatus)
              .map((task) => task.id),
            status: areaStatus,
          })
          .catch(() => undefined);
      }
      return changeStatus(order, newStatusId);
    },
    [actor, changeStatus, mutation]
  );

  return { move, canMove, isMoving: mutation.isPending };
}

/**
 * "Atender" un pedido ajeno desde Recepción (`POST /orders/:id/take-reception`).
 *
 * Las notificaciones del circuito van a UNA persona, no al rol: la que creó el
 * pedido. Si está de franco, el pedido se traba porque nadie más se entera.
 * Con esto otra recepcionista pasa a ser la destinataria efectiva
 * (`attendedByUserId ?? userId`) sin borrar quién lo creó, que no cambia nunca.
 *
 * Idempotente en el backend: volver a tocarlo estando ya a cargo no rompe.
 */
export function useTakeOrderReception() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (orderId: number) =>
      request<Order>(`${ENDPOINTS.orders}/${orderId}/take-reception`, {
        method: "POST",
        token,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      toast.success(`Atendés el pedido #${order.id}: las notificaciones te llegan a vos.`);
    },
    // El backend explica el rechazo en español (rol sin permiso, pedido
    // inexistente): mostrar SU mensaje, no uno genérico.
    onError: (error) => {
      toast.error(getErrorMessage(error, "No se pudo tomar el pedido."));
    },
  });

  return {
    takeReception: (orderId: number) =>
      mutation.mutateAsync(orderId).then(() => true).catch(() => false),
    isTakingReception: mutation.isPending,
  };
}

/**
 * "Tomar pedido" desde Diseño (`POST /orders/:id/take-design`).
 *
 * Cuando Recepción elige "Cualquier diseñador" el pedido queda a nombre de la
 * cuenta compartida del área; esto lo pasa a nombre de quien lo toma. Es
 * EXPLÍCITO a pedido del dueño: abrir el pedido no se lo adjudica a nadie.
 *
 * El backend responde 400 si ya lo tiene otra persona real — ese mensaje se
 * muestra tal cual, que es el dato útil ("lo tiene Fulano").
 */
export function useTakeOrderDesign() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (orderId: number) =>
      request<Order>(`${ENDPOINTS.orders}/${orderId}/take-design`, {
        method: "POST",
        token,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      toast.success(`Tomaste el pedido #${order.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "No se pudo tomar el pedido."));
    },
  });

  return {
    takeDesign: (orderId: number) =>
      mutation.mutateAsync(orderId).then(() => true).catch(() => false),
    isTakingDesign: mutation.isPending,
  };
}

/**
 * Elimina un pedido (`DELETE /orders/:id`). Sólo recepción/admin/superuser
 * tienen permiso en el backend — la UI que dispara esto debe ocultarse/
 * deshabilitarse para el resto de los roles (ver `OrderDetailDialog`).
 */
export function useDeleteOrder() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (orderId: number) => {
      await request<void>(`${ENDPOINTS.orders}/${orderId}`, {
        method: "DELETE",
        token,
      });
      return { orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
      toast.success("Pedido eliminado correctamente");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "No se pudo eliminar el pedido."
      );
    },
  });

  return {
    deleteOrder: (orderId: number) => mutation.mutateAsync(orderId).catch(() => undefined),
    isDeleting: mutation.isPending,
  };
}

/**
 * Cambio de estado en bloque (bulk actions), optimista: actualiza el/los
 * cache(s) de "orders" apenas se dispara la acción (antes de esperar a que
 * las requests resuelvan), y si alguna falla revierte SOLO esas filas a su
 * estado anterior, sin tocar las que sí tuvieron éxito.
 *
 * Mientras el backend no exponga `POST /orders/bulk-actions`, se sigue
 * disparando una request PATCH + POST de historial por pedido en paralelo
 * (`Promise.allSettled`); si ese endpoint dedicado aparece más adelante,
 * alcanza con reemplazar el cuerpo de `run` acá sin tocar el resto de la
 * pantalla (la UI ya asume una function async que puede fallar parcial).
 */
export function useBulkChangeOrderStatus() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
  }, [queryClient]);

  const applyStatus = useCallback(
    (ids: Set<number>, statusById: Map<number, number>) => {
      queryClient.setQueriesData<Order[]>(
        { queryKey: queryKeys.all("orders") },
        (old) =>
          old?.map((o) =>
            ids.has(o.id) ? { ...o, statusId: statusById.get(o.id) ?? o.statusId } : o
          )
      );
    },
    [queryClient]
  );

  const bulkChangeStatus = useCallback(
    async (orders: Pick<Order, "id" | "statusId">[], newStatusId: number) => {
      const allIds = new Set(orders.map((o) => o.id));
      const newStatusById = new Map(orders.map((o) => [o.id, newStatusId]));

      // 1) Optimista: se ve el cambio de una en la tabla/tarjetas antes de que
      // ninguna request haya vuelto.
      applyStatus(allIds, newStatusById);

      const results = await Promise.allSettled(
        orders.map(async (order) => {
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
        })
      );

      const failedOrders = orders.filter((_, idx) => results[idx].status === "rejected");

      if (failedOrders.length > 0) {
        // 2) Rollback per-row: sólo las filas que fallaron vuelven a su estado
        // original; las que sí se aplicaron quedan como están.
        const failedIds = new Set(failedOrders.map((o) => o.id));
        const revertStatusById = new Map(failedOrders.map((o) => [o.id, o.statusId]));
        applyStatus(failedIds, revertStatusById);
      }

      invalidate();

      return {
        succeeded: orders.length - failedOrders.length,
        failed: failedOrders.length,
      };
    },
    [token, applyStatus, invalidate]
  );

  return { bulkChangeStatus };
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
