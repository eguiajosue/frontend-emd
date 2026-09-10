"use client";

/**
 * Configuración global de la app (fila única `AppSetting`).
 *
 * Se usa tanto para leer `deliveredRetentionHours` (todas las pantallas que
 * necesitan calcular si un pedido entregado ya debe ocultarse del tablero en
 * vivo) como para editarlo (sólo admin/superuser, ver `SettingsController`).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { AppSettings } from "@/types";

/** Valor por defecto (coincide con el default del backend) mientras carga o si falla. */
export const DEFAULT_DELIVERED_RETENTION_HOURS = 48;

export function useAppSettings() {
  const token = useAuthToken();

  const query = useQuery<AppSettings>({
    queryKey: queryKeys.all("settings"),
    enabled: Boolean(token),
    queryFn: () => request<AppSettings>(ENDPOINTS.settings, { token }),
  });

  return {
    ...query,
    deliveredRetentionHours:
      query.data?.deliveredRetentionHours ?? DEFAULT_DELIVERED_RETENTION_HOURS,
  };
}

export function useUpdateAppSettings() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation<AppSettings, unknown, { deliveredRetentionHours: number }>({
    mutationFn: (payload) =>
      request<AppSettings>(ENDPOINTS.settings, {
        method: "PATCH",
        token,
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("settings") });
    },
  });

  return {
    update: (payload: { deliveredRetentionHours: number }) => mutation.mutateAsync(payload),
    isUpdating: mutation.isPending,
  };
}
