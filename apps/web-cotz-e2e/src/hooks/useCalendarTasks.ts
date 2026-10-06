"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityList, useEntityMutations } from "@/hooks/useEntity";
import type { CalendarTask, CreateCalendarTaskPayload, UpdateCalendarTaskPayload } from "@/types";

/** Lista de tareas pendientes del calendario de equipo: hooks específicos sobre la capa genérica. */

export function useCalendarTasks(options?: { enabled?: boolean }) {
  return useEntityList<CalendarTask>("calendarTasks", { enabled: options?.enabled });
}

export function useCalendarTaskMutations() {
  return useEntityMutations<CalendarTask, CreateCalendarTaskPayload | UpdateCalendarTaskPayload>(
    "calendarTasks"
  );
}

/** Marca (o desmarca) una tarea como completada. Endpoint dedicado, igual patrón que el de eventos. */
export function useUpdateCalendarTaskComplete() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      request<CalendarTask>(`${ENDPOINTS.calendarTasks}/${id}/complete`, {
        method: "PATCH",
        token,
        body: { completed },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("calendarTasks") });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "No se pudo actualizar la tarea."));
    },
  });

  return {
    setCompleted: (id: number, completed: boolean) =>
      mutation.mutateAsync({ id, completed }).catch(() => undefined),
    isUpdating: mutation.isPending,
  };
}
