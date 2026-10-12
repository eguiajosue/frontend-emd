"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { CATALOG_STALE_TIME, entityListQueryFn, useAuthToken } from "@/hooks/useEntity";
import { PREFERENCES_ENDPOINT, PREFERENCES_QUERY_KEY, type UserPreferences } from "@/hooks/useUserPreferences";
import { clientInsightsQueryOptions } from "@/hooks/useClientInsights";
import { clientOrdersQueryOptions } from "@/hooks/useOrders";
import { clientTemplatesQueryOptions } from "@/hooks/useOrderTemplates";

/** Pedidos anteriores que muestra "Empezar desde" (el mismo `limit` que usa el diálogo). */
export const COMPOSER_PREVIOUS_ORDERS_LIMIT = 8;

/**
 * Prefetch de lo que necesita "Nuevo pedido" apenas el usuario muestra la
 * intención de abrirlo (hover/focus en "Nuevo Pedido" o el FAB): clientes,
 * usuarios, productos y preferencias ya están en caché cuando el panel abre.
 * Usa las mismas query keys/queryFn que los hooks, así no hay doble pedido.
 */
export function usePrefetchNewOrder({ isBranch = false }: { isBranch?: boolean } = {}) {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const done = useRef(0);
  return useCallback(() => {
    if (!token) return;
    // Un hover repetido no vuelve a disparar nada durante 30 s.
    if (Date.now() - done.current < 30_000) return;
    done.current = Date.now();
    queryClient.prefetchQuery({ queryKey: queryKeys.list("clients"), queryFn: entityListQueryFn("clients", token) });
    if (!isBranch) {
      queryClient.prefetchQuery({ queryKey: queryKeys.list("users"), queryFn: entityListQueryFn("users", token) });
    }
    queryClient.prefetchQuery({
      queryKey: queryKeys.list("orderProductPresets"),
      queryFn: entityListQueryFn("orderProductPresets", token),
      staleTime: CATALOG_STALE_TIME,
    });
    queryClient.prefetchQuery({
      queryKey: PREFERENCES_QUERY_KEY,
      queryFn: () => request<UserPreferences>(PREFERENCES_ENDPOINT, { token }),
      staleTime: 5 * 60_000,
    });
  }, [queryClient, token, isBranch]);
}

/**
 * Prefetch del contexto de un cliente (lo aprendido, sus últimos pedidos y
 * sus plantillas) al pasar por su opción en el buscador: al elegirlo,
 * "Empezar desde" ya tiene los datos.
 */
export function usePrefetchClientContext() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  return useCallback(
    (clientId: number) => {
      if (!token) return;
      // `enabled` no aplica a un prefetch (se ignora): aquí siempre hay cliente.
      const insights = clientInsightsQueryOptions(token, clientId);
      const orders = clientOrdersQueryOptions(token, clientId, COMPOSER_PREVIOUS_ORDERS_LIMIT);
      const templates = clientTemplatesQueryOptions(token, clientId);
      queryClient.prefetchQuery(insights);
      queryClient.prefetchQuery({ ...orders, staleTime: 30_000 });
      queryClient.prefetchQuery({ ...templates, staleTime: 30_000 });
    },
    [queryClient, token]
  );
}
