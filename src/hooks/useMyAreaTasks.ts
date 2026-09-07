"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { OrderAreaTask } from "@/types";

/** Tarea de producción con lo mínimo del pedido para mostrarla en la bandeja. */
export interface MyAreaTask extends OrderAreaTask {
  order?: {
    id: number;
    description: string;
    deliveryDate?: string | null;
    statusId: number;
    clientNameOverride?: string | null;
    client?: { first_name: string; last_name?: string | null } | null;
  } | null;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Bandeja de producción del usuario: sólo las tareas de SUS áreas, cada una
 * etiquetada con la suya (ver WORKFLOW.md §4 en el backend). Recepción y admin
 * reciben todas, para seguir el avance global.
 *
 * Se refresca en vivo: `useSocket` invalida la cache de pedidos ante cualquier
 * evento, y esta query cuelga de esa misma clave.
 */
export function useMyAreaTasks() {
  const token = useAuthToken();

  const query = useQuery<MyAreaTask[]>({
    queryKey: [...queryKeys.all("orders"), "my-area-tasks"],
    enabled: Boolean(token),
    queryFn: async () => {
      try {
        return await request<MyAreaTask[]>(`${ENDPOINTS.orders}/my-area-tasks`, {
          token,
        });
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError && !isNotFound(query.error),
    isUnavailable: isNotFound(query.error),
    refetch: query.refetch,
  };
}
