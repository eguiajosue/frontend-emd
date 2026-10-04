"use client";

import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import type { DesignDashboard, ProductionDashboard, ReceptionDashboard } from "@/types";

/**
 * Clave de los Inicio. El socket (`dataChanged`, ver useSocket) la invalida
 * cada vez que cambian pedidos, tareas, inventario o calendario: los
 * tableros se actualizan solos. El refetch periódico es la red de seguridad
 * por si el socket se cae.
 */
export const DASHBOARD_KEY = ["dashboard"] as const;
const SAFETY_REFETCH_MS = 60_000;

/** Medianoche LOCAL de hoy (ISO): el backend corre en UTC y "hoy" es el de quien mira. */
export function localDayStart(now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function useDashboardQuery<T>(kind: "reception" | "design" | "production", enabled: boolean) {
  const token = useAuthToken();
  const query = useQuery<T>({
    queryKey: [...DASHBOARD_KEY, kind],
    enabled: Boolean(token) && enabled,
    refetchInterval: SAFETY_REFETCH_MS,
    refetchOnWindowFocus: true,
    // Se calcula en cada pedido: pasada la medianoche, "hoy" cambia solo.
    queryFn: () =>
      request<T>(`dashboard/${kind}?dayStart=${encodeURIComponent(localDayStart())}`, { token }),
  });
  return {
    data: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}

export const useReceptionDashboard = (enabled = true) =>
  useDashboardQuery<ReceptionDashboard>("reception", enabled);
export const useDesignDashboard = (enabled = true) =>
  useDashboardQuery<DesignDashboard>("design", enabled);
export const useProductionDashboard = (enabled = true) =>
  useDashboardQuery<ProductionDashboard>("production", enabled);
