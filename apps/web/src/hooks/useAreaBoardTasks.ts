"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import type { AreaBoardTask } from "@/lib/tvBoard";

/** Dentro de "orders": los avisos en vivo de pedidos ya la invalidan solos. */
export const AREA_BOARD_KEY = [...queryKeys.all("orders"), "my-area-tasks"] as const;

const PRODUCTION_ROLES = new Set<string>(PRODUCTION_AREA_OPTIONS.map((a) => a.value));
const MANAGER_ROLES = new Set(["admin", "superuser", "recepcion"]);

/**
 * Todas las tareas de las áreas del usuario (`GET /orders/my-area-tasks`),
 * en los tres estados: lo que necesita la tele del Modo TV para mostrar el
 * área completa y no sólo lo propio. Sólo Diseño no tiene tareas de área (el
 * backend no le abre el endpoint): ahí ni se pide.
 *
 * Un 403/404 (backend viejo o rol sin acceso) devuelve `null`: el tablero
 * cae a "mis tareas" en vez de mostrar un error.
 */
export function useAreaBoardTasks(roles: string[], enabled = true) {
  const token = useAuthToken();
  const canAsk = roles.some((r) => PRODUCTION_ROLES.has(r) || MANAGER_ROLES.has(r));
  const query = useQuery<AreaBoardTask[] | null>({
    queryKey: AREA_BOARD_KEY,
    enabled: enabled && Boolean(token) && canAsk,
    queryFn: async () => {
      try {
        return await request<AreaBoardTask[]>(`${ENDPOINTS.orders}/my-area-tasks`, { token });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
        throw error;
      }
    },
  });
  return {
    areaTasks: canAsk ? query.data ?? null : null,
    isLoading: canAsk && query.isPending && enabled,
    refetch: query.refetch,
  };
}
