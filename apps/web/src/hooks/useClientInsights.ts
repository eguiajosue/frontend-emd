"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { ClientInsights } from "@/types";

export const clientInsightsKey = (clientId: number) => ["clientInsights", clientId] as const;

/** Query de insights (compartida por el hook y el prefetch al pasar por un cliente). */
export function clientInsightsQueryOptions(token: string | undefined, clientId: number | null) {
  return {
    queryKey: clientInsightsKey(clientId ?? 0),
    enabled: Boolean(token) && clientId !== null,
    staleTime: 60_000,
    retry: false,
    meta: { silentError: true },
    queryFn: async (): Promise<ClientInsights | null> => {
      try {
        return await request<ClientInsights>(`${ENDPOINTS.clients}/${clientId}/insights`, { token });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
        throw error;
      }
    },
  };
}

/**
 * Lo que el sistema aprendió de un cliente (`GET /clients/:id/insights`):
 * qué suele pedir y cuánto, por dónde va, con cuánta anticipación. Un fallo
 * no es crítico: el alta sigue funcionando sin sugerencias.
 */
export function useClientInsights(clientId: number | null) {
  const token = useAuthToken();
  const query = useQuery<ClientInsights | null>(clientInsightsQueryOptions(token, clientId));
  return { insights: query.data ?? null, isLoading: query.isLoading };
}
