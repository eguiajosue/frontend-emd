"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AreaOverview, CreateAreaPayload, CreatedArea, SetAreaFieldsPayload, SetAreaMachinesPayload, SetAreaStagesPayload, UpdateAreaPayload, Area } from "@emd/types";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";

/** Misma clave base que el catálogo (`["areas"]`): una escritura refresca ambos. */
const OVERVIEW_KEY = [...queryKeys.all("areas"), "overview"] as const;

/**
 * Todas las áreas (también las desactivadas) con personas y trabajo abierto,
 * para el panel de administración (`GET /areas/overview`, admin/superuser).
 */
export function useAreaOverview(enabled = true) {
  const token = useAuthToken();
  const query = useQuery<AreaOverview[]>({
    queryKey: OVERVIEW_KEY,
    enabled: Boolean(token) && enabled,
    queryFn: () => request<AreaOverview[]>(`${ENDPOINTS.areas}/overview`, { token }),
  });
  return { ...query, areas: query.data ?? [] };
}

/** Alta, edición y (des)activación. Cada una refresca el catálogo y el panel. */
export function useAreaAdminMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.all("areas") });

  const create = useMutation<CreatedArea, ApiError, CreateAreaPayload>({
    mutationFn: (payload) => request<CreatedArea>(ENDPOINTS.areas, { method: "POST", token, body: payload }),
    onSuccess: invalidate,
  });

  const update = useMutation<Area, ApiError, { id: number; payload: UpdateAreaPayload }>({
    mutationFn: ({ id, payload }) =>
      request<Area>(`${ENDPOINTS.areas}/${id}`, { method: "PATCH", token, body: payload }),
    onSuccess: invalidate,
  });

  const stages = useMutation<Area, ApiError, { id: number; payload: SetAreaStagesPayload }>({
    mutationFn: ({ id, payload }) =>
      request<Area>(`${ENDPOINTS.areas}/${id}/stages`, { method: "PUT", token, body: payload }),
    onSuccess: invalidate,
  });

  const machines = useMutation<Area, ApiError, { id: number; payload: SetAreaMachinesPayload }>({
    mutationFn: ({ id, payload }) =>
      request<Area>(`${ENDPOINTS.areas}/${id}/machines`, { method: "PUT", token, body: payload }),
    onSuccess: invalidate,
  });

  const fields = useMutation<Area, ApiError, { id: number; payload: SetAreaFieldsPayload }>({
    mutationFn: ({ id, payload }) =>
      request<Area>(`${ENDPOINTS.areas}/${id}/fields`, { method: "PUT", token, body: payload }),
    onSuccess: invalidate,
  });

  return {
    create: (payload: CreateAreaPayload) => create.mutateAsync(payload),
    setMachines: (id: number, payload: SetAreaMachinesPayload) => machines.mutateAsync({ id, payload }),
    setFields: (id: number, payload: SetAreaFieldsPayload) => fields.mutateAsync({ id, payload }),
    setStages: (id: number, payload: SetAreaStagesPayload) => stages.mutateAsync({ id, payload }),
    update: (id: number, payload: UpdateAreaPayload) => update.mutateAsync({ id, payload }),
    isCreating: create.isPending,
    isUpdating: update.isPending || stages.isPending || machines.isPending || fields.isPending,
  };
}
