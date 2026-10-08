"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";

/** `GET /orders/area-scoreboard`: el marcador del equipo en el Modo TV. */
export interface AreaScoreboard {
  today: { done: number; onTime: number };
  week: { done: number; onTime: number };
  bestDay: { date: string; done: number } | null;
  streakDays: number;
}

/** Dentro de "orders": cada tarea terminada (aviso en vivo) lo refresca. */
export function useAreaScoreboard(area: string | null, enabled = true) {
  const token = useAuthToken();
  return useQuery<AreaScoreboard | null>({
    queryKey: [...queryKeys.all("orders"), "area-scoreboard", area ?? "todas"],
    enabled: enabled && Boolean(token),
    refetchInterval: 5 * 60_000,
    meta: { silentError: true },
    queryFn: async () => {
      try {
        const qs = area ? `?area=${encodeURIComponent(area)}` : "";
        return await request<AreaScoreboard>(`${ENDPOINTS.orders}/area-scoreboard${qs}`, { token });
      } catch (error) {
        // Backend sin el marcador todavía, o rol sin acceso: no se muestra.
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
        throw error;
      }
    },
  });
}
