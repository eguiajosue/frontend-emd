"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { AreaSupplySheet } from "@/types";

/**
 * Hoja de materiales por área de un pedido (origen de insumos, apartado /
 * descontado y movimientos de inventario): `GET /orders/:id/area-supplies`.
 * Un 404 (backend viejo) se absorbe como "sin hoja".
 */
export function useAreaSupplies(orderId: number | null) {
  const token = useAuthToken();
  return useQuery<AreaSupplySheet>({
    queryKey: [...queryKeys.all("orders"), "area-supplies", orderId ?? 0],
    enabled: Boolean(token) && orderId !== null,
    queryFn: async () => {
      try {
        return await request<AreaSupplySheet>(`${ENDPOINTS.orders}/${orderId}/area-supplies`, { token });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return { areas: [], movements: [] };
        throw error;
      }
    },
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
