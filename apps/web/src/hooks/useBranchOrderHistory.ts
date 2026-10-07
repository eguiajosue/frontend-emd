"use client";

import { useQuery } from "@tanstack/react-query";
import { request, type Paginated } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import {
  BRANCH_HISTORY_PAGE_SIZE,
  buildBranchHistoryParams,
  parseBranchOrderHistory,
  type BranchHistoryFilters,
  type BranchHistoryPage,
} from "@/lib/branchOrderHistory";
import type { Order } from "@/types";

/**
 * Historial de pedidos de la sucursal (activos y terminados): `GET /orders`
 * ya viene limitado a su sucursal. El contrato (params y forma de la
 * respuesta) está en `lib/branchOrderHistory.ts`; este hook sólo lo pide.
 *
 * La clave empieza con `orders`, así que crear o cambiar un pedido refresca
 * también el historial.
 */
export function useBranchOrderHistory(
  filters: BranchHistoryFilters,
  page: number,
  options: { enabled?: boolean; limit?: number } = {}
) {
  const token = useAuthToken();
  const limit = options.limit ?? BRANCH_HISTORY_PAGE_SIZE;

  const query = useQuery<BranchHistoryPage>({
    queryKey: [...queryKeys.all("orders"), "branch-history", page, limit, filters],
    enabled: Boolean(token) && (options.enabled ?? true),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const payload = await request<Order[] | Paginated<Order>>(ENDPOINTS.orders, {
        token,
        params: buildBranchHistoryParams(filters, page, limit),
      });
      return parseBranchOrderHistory(payload, filters, page, limit);
    },
  });

  return {
    ...query,
    orders: query.data?.orders ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
  };
}
