"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, request } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { CoordinationOverview, DelayReason } from "@/lib/coordination";

/** Dentro de "orders": cualquier cambio de pedido/tarea lo refresca. */
export const COORDINATION_KEY = [...queryKeys.all("orders"), "coordination"] as const;

export function useCoordination() {
  const token = useAuthToken();
  return useQuery<CoordinationOverview>({
    queryKey: COORDINATION_KEY,
    enabled: Boolean(token),
    queryFn: () => request<CoordinationOverview>("coordination/overview", { token }),
    refetchInterval: 2 * 60_000,
  });
}

export function useSetDelayReason() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason, note }: { orderId: number; reason: DelayReason | null; note?: string }) =>
      request(`coordination/orders/${orderId}/delay-reason`, { token, method: "PATCH", body: { reason, note } }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: COORDINATION_KEY });
      toast.success(vars.reason ? `Pedido #${vars.orderId}: motivo guardado` : `Pedido #${vars.orderId}: motivo borrado`);
    },
    onError: (error) => toast.error(getErrorMessage(error, "No se pudo guardar el motivo.")),
    meta: { ownErrorToast: true },
  });
}
