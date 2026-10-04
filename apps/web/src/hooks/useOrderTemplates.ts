"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { OrderTemplate, OrderTemplatePayload } from "@/types";

/**
 * Plantillas de pedido por cliente (lo que suele pedir, con nombre).
 *
 * Endpoints (sólo recepcion/admin/superuser):
 * - `GET    /clients/:id/order-templates`
 * - `POST   /clients/:id/order-templates`
 * - `GET    /order-templates/:id`
 * - `PATCH  /order-templates/:id`
 * - `DELETE /order-templates/:id`
 * - `POST   /order-templates/:id/use` (suma un uso: ordena las más usadas primero)
 */
const TEMPLATES = "order-templates";

export const orderTemplateKeys = {
  all: ["orderTemplates"] as const,
  byClient: (clientId: number) => ["orderTemplates", "client", clientId] as const,
  detail: (id: number) => ["orderTemplates", "detail", id] as const,
};

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useClientOrderTemplates(clientId: number | null) {
  const token = useAuthToken();
  const query = useQuery<OrderTemplate[]>({
    queryKey: orderTemplateKeys.byClient(clientId ?? 0),
    enabled: Boolean(token) && clientId !== null,
    queryFn: async () => {
      try {
        return await request<OrderTemplate[]>(
          `${ENDPOINTS.clients}/${clientId}/${TEMPLATES}`,
          { token }
        );
      } catch (error) {
        // Cliente borrado o backend sin plantillas todavía: lista vacía.
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });
  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useOrderTemplate(id: number | undefined, options?: { enabled?: boolean }) {
  const token = useAuthToken();
  return useQuery<OrderTemplate>({
    queryKey: orderTemplateKeys.detail(id ?? 0),
    enabled: Boolean(token) && id !== undefined && (options?.enabled ?? true),
    queryFn: () => request<OrderTemplate>(`${TEMPLATES}/${id}`, { token }),
  });
}

export function useOrderTemplateMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: orderTemplateKeys.all });

  const create = useMutation({
    mutationFn: ({ clientId, payload }: { clientId: number; payload: OrderTemplatePayload }) =>
      request<OrderTemplate>(`${ENDPOINTS.clients}/${clientId}/${TEMPLATES}`, {
        token,
        method: "POST",
        body: payload,
      }),
    onSuccess: invalidate,
    // Quien la usa muestra el error donde corresponde (ej. nombre repetido).
    meta: { ownErrorToast: true },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<OrderTemplatePayload> }) =>
      request<OrderTemplate>(`${TEMPLATES}/${id}`, { token, method: "PATCH", body: payload }),
    onSuccess: invalidate,
    meta: { ownErrorToast: true },
  });

  const remove = useMutation({
    mutationFn: (id: number) => request(`${TEMPLATES}/${id}`, { token, method: "DELETE" }),
    onSuccess: invalidate,
  });

  /** Sin toast si falla: es sólo para ordenar, el pedido ya se creó. */
  const markUsed = useMutation({
    mutationFn: (id: number) => request(`${TEMPLATES}/${id}/use`, { token, method: "POST" }),
    onSuccess: invalidate,
    meta: { ownErrorToast: true },
  });

  return { create, update, remove, markUsed };
}
