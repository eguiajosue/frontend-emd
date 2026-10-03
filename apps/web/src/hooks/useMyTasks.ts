"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request, getErrorMessage } from "@/lib/api";
import { patchStatusChange } from "@/lib/offlineMutation";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import { getAreaLabel } from "@/lib/areas";
import type { AreaTaskStatus, MyTask, OrderAreaTask } from "@/types";

/**
 * Clave dentro de "orders": cualquier aviso en vivo de pedidos (socket) ya
 * invalida `queryKeys.all("orders")`, así la bandeja se refresca sola.
 */
export const MY_TASKS_KEY = [...queryKeys.all("orders"), "my-tasks"] as const;

/** Bandeja "Tareas asignadas" (`GET /orders/my-tasks`). */
export function useMyTasks() {
  const token = useAuthToken();
  const query = useQuery<MyTask[]>({
    queryKey: MY_TASKS_KEY,
    enabled: Boolean(token),
    queryFn: () => request<MyTask[]>(`${ENDPOINTS.orders}/my-tasks`, { token }),
  });
  return {
    tasks: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Avanza una tarea de producción desde la bandeja. Pasar a "en proceso" una
 * tarea libre la deja a nombre de quien la empieza (lo hace el backend).
 */
export function useAdvanceMyTask() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ task, status }: { task: MyTask; status: AreaTaskStatus }) =>
      patchStatusChange<OrderAreaTask>(
        `${ENDPOINTS.orders}/${task.order.id}/area-tasks/${task.taskId}/status`,
        { status },
        token
      ),
    onSuccess: (_data, { task, status }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      const area = getAreaLabel(task.area);
      toast.success(
        status === "terminado"
          ? `${area} terminado en el pedido #${task.order.id}`
          : `Empezaste ${area} del pedido #${task.order.id}`
      );
    },
    onError: (error) => toast.error(getErrorMessage(error, "No se pudo actualizar la tarea.")),
    meta: { ownErrorToast: true },
  });
  return {
    advance: (task: MyTask, status: AreaTaskStatus) => mutation.mutate({ task, status }),
    pendingKey: mutation.isPending ? mutation.variables?.task.key ?? null : null,
  };
}
