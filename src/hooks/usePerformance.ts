"use client";

/**
 * GET /performance/summary (solo admin/superuser) — no es un listado como el
 * resto de las entidades (no es un array, es un objeto `{ employees, areas }`),
 * así que usa React Query directo en vez de `useEntityList`.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuthToken } from "@/hooks/useEntity";
import { request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import type { PerformanceSummary } from "@/types";

export function usePerformanceSummary(options: { enabled?: boolean } = {}) {
  const token = useAuthToken();
  const { enabled = true } = options;

  const query = useQuery<PerformanceSummary>({
    queryKey: queryKeys.all("performanceSummary"),
    enabled: Boolean(token) && enabled,
    queryFn: () => request<PerformanceSummary>(ENDPOINTS.performanceSummary, { token }),
  });

  return {
    ...query,
    data: query.data ?? { employees: [], areas: [] },
  };
}
