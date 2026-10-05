"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, getErrorMessage, request, unwrapList } from "@/lib/api";
import { ENDPOINTS } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import { MOCKUP_TOO_LARGE_MESSAGE } from "@/lib/mockups/studio";
import type {
  CreateOrderMockupPayload,
  OrderMockupDetail,
  OrderMockupSummary,
} from "@/lib/mockups/types";

/**
 * Mockups guardados en un pedido (docs/plans/mockups-3d.md).
 *
 * - `GET    /orders/:id/mockups`            → lista sin imagen (liviana)
 * - `GET    /orders/:id/mockups/:mockupId`  → imagen + configuración
 * - `POST   /orders/:id/mockups`            → guarda uno (≤ 8 MB, R1)
 * - `DELETE /orders/:id/mockups/:mockupId`
 */

/**
 * Raíz propia (no bajo "orders"): cada invalidación de pedidos volvería a
 * bajar imágenes de varios MB que no cambian.
 */
export function orderMockupsKey(orderId: number) {
  return ["orderMockups", orderId] as const;
}

export function orderMockupDetailKey(orderId: number, mockupId: number) {
  return [...orderMockupsKey(orderId), mockupId] as const;
}

function mockupsPath(orderId: number) {
  return `${ENDPOINTS.orders}/${orderId}/mockups`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Mensaje para un fallo al guardar: el 413 (demasiado pesado) con su explicación. */
export function mockupErrorMessage(error: unknown, fallback = "No se pudo guardar el mockup."): string {
  if (error instanceof ApiError && error.status === 413) return MOCKUP_TOO_LARGE_MESSAGE;
  return getErrorMessage(error, fallback);
}

/** POST suelto (sin React Query): lo usa el alta de pedido para reintentar desde memoria (R2). */
export function postOrderMockup(
  token: string | null | undefined,
  orderId: number,
  payload: CreateOrderMockupPayload
): Promise<OrderMockupSummary> {
  return request<OrderMockupSummary>(mockupsPath(orderId), { token, method: "POST", body: payload });
}

export function useOrderMockups(orderId: number | null, options?: { enabled?: boolean }) {
  const token = useAuthToken();
  const query = useQuery<OrderMockupSummary[]>({
    queryKey: orderMockupsKey(orderId ?? 0),
    enabled: Boolean(token) && orderId !== null && (options?.enabled ?? true),
    queryFn: async () => {
      try {
        const data = await request<OrderMockupSummary[]>(mockupsPath(orderId!), { token });
        return unwrapList(data);
      } catch (error) {
        // Backend sin el módulo todavía o pedido borrado: sección vacía.
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
    meta: { silentError: true },
  });
  return {
    mockups: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Detalle (imagen) de un mockup; se pide sólo cuando hace falta verlo. */
export function useOrderMockupDetail(
  orderId: number,
  mockupId: number,
  options?: { enabled?: boolean }
) {
  const token = useAuthToken();
  return useQuery<OrderMockupDetail>({
    queryKey: orderMockupDetailKey(orderId, mockupId),
    enabled: Boolean(token) && (options?.enabled ?? true),
    queryFn: () => request<OrderMockupDetail>(`${mockupsPath(orderId)}/${mockupId}`, { token }),
    // Un mockup guardado no cambia: no se vuelve a bajar mientras esté en caché.
    staleTime: Infinity,
    meta: { silentError: true },
  });
}

export function useCreateOrderMockup() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: CreateOrderMockupPayload }) =>
      postOrderMockup(token, orderId, payload),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderMockupsKey(orderId), exact: true });
    },
    // Cada pantalla muestra su propio error (con el mensaje del 413).
    meta: { ownErrorToast: true },
  });
}

export function useDeleteOrderMockup() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, mockupId }: { orderId: number; mockupId: number }) =>
      request<void>(`${mockupsPath(orderId)}/${mockupId}`, { token, method: "DELETE" }),
    onSuccess: (_data, { orderId, mockupId }) => {
      queryClient.removeQueries({ queryKey: orderMockupDetailKey(orderId, mockupId) });
      queryClient.invalidateQueries({ queryKey: orderMockupsKey(orderId), exact: true });
    },
  });
}
