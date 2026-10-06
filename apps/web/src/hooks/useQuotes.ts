"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import {
  nextStageStatus,
  type CreateQuotePayload,
  type Quote,
  type QuoteFilters,
  type UpdateQuotePayload,
} from "@/lib/quotes/types";

/**
 * Cotizaciones de Recepción (`/quotes`, roles recepcion/admin/superuser).
 *
 * - `GET    /quotes?stage=&status=&q=` (orden: prioridad más vieja primero, luego lo último movido)
 * - `POST   /quotes`, `POST /quotes/bulk` (1..100, todas o ninguna)
 * - `PATCH  /quotes/:id` (con sólo `status` también cambia la etapa)
 * - `POST   /quotes/:id/link-order` (sólo aceptadas; 409 si el pedido ya está ligado)
 * - `DELETE /quotes/:id`
 */
export const quoteKeys = {
  all: queryKeys.all("quotes") as QueryKey,
  list: (filters: QuoteFilters = {}) => queryKeys.list("quotes", cleanFilters(filters)),
};

function cleanFilters(filters: QuoteFilters): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  if (filters.stage) out.stage = filters.stage;
  if (filters.status) out.status = filters.status;
  if (filters.q?.trim()) out.q = filters.q.trim();
  return Object.keys(out).length ? out : undefined;
}

export function useQuotes(filters: QuoteFilters = {}, options: { enabled?: boolean } = {}) {
  const token = useAuthToken();
  const params = cleanFilters(filters);
  const query = useQuery<Quote[]>({
    queryKey: quoteKeys.list(filters),
    enabled: Boolean(token) && (options.enabled ?? true),
    queryFn: () => request<Quote[]>(ENDPOINTS.quotes, { token, params }),
  });
  return {
    quotes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

type ListSnapshot = [QueryKey, Quote[] | undefined][];

/** Aplica `fn` a cada lista de cotizaciones en caché y devuelve cómo estaban. */
function patchLists(
  queryClient: ReturnType<typeof useQueryClient>,
  fn: (list: Quote[]) => Quote[]
): ListSnapshot {
  const snapshot = queryClient.getQueriesData<Quote[]>({ queryKey: quoteKeys.all });
  for (const [key, data] of snapshot) {
    if (Array.isArray(data)) queryClient.setQueryData<Quote[]>(key, fn(data));
  }
  return snapshot;
}

function restore(queryClient: ReturnType<typeof useQueryClient>, snapshot: ListSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/** Cómo queda una cotización con el PATCH aplicado (para la vista optimista). */
export function applyQuotePatch(quote: Quote, patch: UpdateQuotePayload): Quote {
  const { stage, status } = nextStageStatus(quote, { stage: patch.stage, status: patch.status });
  return {
    ...quote,
    ...(patch.clientName !== undefined && patch.clientName.trim() ? { clientName: patch.clientName.trim() } : {}),
    ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
    ...(patch.priorityDate !== undefined ? { priorityDate: patch.priorityDate } : {}),
    ...(patch.comment !== undefined ? { comment: patch.comment?.trim() || null } : {}),
    stage,
    status,
  };
}

export function useQuoteMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: quoteKeys.all });

  const create = useMutation({
    mutationFn: (payload: CreateQuotePayload) =>
      request<Quote>(ENDPOINTS.quotes, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
  });

  const bulkCreate = useMutation({
    mutationFn: (items: CreateQuotePayload[]) =>
      request<Quote[]>(`${ENDPOINTS.quotes}/bulk`, { token, method: "POST", body: { items } }),
    onSuccess: invalidate,
  });

  /**
   * Edición con vista optimista: el cambio de subestado (un clic) se ve al
   * instante en todas las listas en caché; si el backend lo rechaza se
   * vuelve a como estaba (y el toast de error lo pone el feedback global).
   */
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateQuotePayload }) =>
      request<Quote>(`${ENDPOINTS.quotes}/${id}`, { token, method: "PATCH", body: payload }),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: quoteKeys.all });
      const snapshot = patchLists(queryClient, (list) =>
        list.map((q) => (q.id === id ? applyQuotePatch(q, payload) : q))
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => restore(queryClient, context?.snapshot),
    onSuccess: (saved) => {
      patchLists(queryClient, (list) => list.map((q) => (q.id === saved.id ? saved : q)));
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => request(`${ENDPOINTS.quotes}/${id}`, { token, method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: quoteKeys.all });
      const snapshot = patchLists(queryClient, (list) => list.filter((q) => q.id !== id));
      return { snapshot };
    },
    onError: (_error, _id, context) => restore(queryClient, context?.snapshot),
    onSettled: invalidate,
  });

  const linkOrder = useMutation({
    mutationFn: ({ id, orderId }: { id: number; orderId: number }) =>
      request<Quote>(`${ENDPOINTS.quotes}/${id}/link-order`, { token, method: "POST", body: { orderId } }),
    onSuccess: (saved) => {
      patchLists(queryClient, (list) => list.map((q) => (q.id === saved.id ? saved : q)));
      void invalidate();
    },
  });

  return { create, bulkCreate, update, remove, linkOrder };
}
