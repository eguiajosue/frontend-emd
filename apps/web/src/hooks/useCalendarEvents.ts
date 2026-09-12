"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityList, useEntityMutations } from "@/hooks/useEntity";
import type {
  AreaTaskStatus,
  CalendarEvent,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from "@/types";

/** Calendario de equipo de Recepción: hooks específicos sobre la capa genérica. */

export function useCalendarEvents(options?: { enabled?: boolean }) {
  return useEntityList<CalendarEvent>("calendarEvents", { enabled: options?.enabled });
}

export function useCalendarEventMutations() {
  return useEntityMutations<CalendarEvent, CreateCalendarEventPayload | UpdateCalendarEventPayload>(
    "calendarEvents"
  );
}

/**
 * Avance de un evento (pendiente → en_proceso → terminado), mismo ciclo que
 * las tareas de área. Endpoint dedicado porque el backend valida la
 * transición (no se puede saltar de pendiente a terminado).
 */
export function useUpdateCalendarEventStatus() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AreaTaskStatus }) =>
      request<CalendarEvent>(`${ENDPOINTS.calendarEvents}/${id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("calendarEvents") });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "No se pudo cambiar el estado del evento."));
    },
  });

  return {
    updateStatus: (id: number, status: AreaTaskStatus) =>
      mutation.mutateAsync({ id, status }).catch(() => undefined),
    isUpdating: mutation.isPending,
  };
}
