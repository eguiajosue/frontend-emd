"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { CATALOG_STALE_TIME, useAuthToken, useEntityList } from "@/hooks/useEntity";
import type {
  CreateInventoryItemPayload,
  CreateInventoryMovementPayload,
  InventoryArea,
  InventoryItem,
  InventoryMovement,
  UpdateInventoryItemPayload,
} from "@/types";

/**
 * Inventario por departamento (existencias físicas + kardex).
 *
 * Endpoints:
 * - `GET    /inventory?area=`            artículos (recortados a las áreas del usuario)
 * - `GET    /inventory/areas`            departamentos que el usuario puede gestionar
 * - `GET    /inventory/movements?area=`  últimos movimientos
 * - `GET    /inventory/:id/movements`    kardex de un artículo
 * - `POST   /inventory/:id/movements`    entrada / salida / ajuste
 * - `GET    /inventory/export?area=`     CSV
 */

const inventoryKey = queryKeys.all("inventory");

export function useInventoryItems(area?: InventoryArea) {
  return useEntityList<InventoryItem>("inventory", {
    params: area ? { area } : undefined,
  });
}

export function useInventoryAreas() {
  const token = useAuthToken();
  return useQuery<InventoryArea[]>({
    queryKey: [...inventoryKey, "areas"],
    enabled: Boolean(token),
    staleTime: CATALOG_STALE_TIME,
    queryFn: () => request<InventoryArea[]>(`${ENDPOINTS.inventory}/areas`, { token }),
  });
}

/** Kardex de un artículo (`itemId`) o últimos movimientos de los departamentos visibles. */
export function useInventoryMovements(
  filter: { itemId?: number; area?: InventoryArea; limit?: number },
  options: { enabled?: boolean } = {}
) {
  const token = useAuthToken();
  return useQuery<InventoryMovement[]>({
    queryKey: [...inventoryKey, "movements", filter],
    enabled: Boolean(token) && (options.enabled ?? true),
    queryFn: () =>
      filter.itemId !== undefined
        ? request<InventoryMovement[]>(`${ENDPOINTS.inventory}/${filter.itemId}/movements`, {
            token,
          })
        : request<InventoryMovement[]>(`${ENDPOINTS.inventory}/movements`, {
            token,
            params: { area: filter.area, limit: filter.limit },
          }),
  });
}

export function useInventoryMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: inventoryKey });
  // Los diálogos muestran su propio error (ver InventoryItemDialog / InventoryMovementDialog).
  const meta = { ownErrorToast: true };

  const create = useMutation<InventoryItem, ApiError, CreateInventoryItemPayload>({
    mutationFn: (payload) =>
      request<InventoryItem>(ENDPOINTS.inventory, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    meta,
  });

  const update = useMutation<
    InventoryItem,
    ApiError,
    { id: number; payload: UpdateInventoryItemPayload }
  >({
    mutationFn: ({ id, payload }) =>
      request<InventoryItem>(`${ENDPOINTS.inventory}/${id}`, {
        token,
        method: "PATCH",
        body: payload,
      }),
    onSuccess: invalidate,
    meta,
  });

  const remove = useMutation<void, ApiError, number>({
    mutationFn: (id) => request<void>(`${ENDPOINTS.inventory}/${id}`, { token, method: "DELETE" }),
    onSuccess: invalidate,
  });

  const registerMovement = useMutation<
    { movement: InventoryMovement; item: InventoryItem },
    ApiError,
    { id: number; payload: CreateInventoryMovementPayload }
  >({
    mutationFn: ({ id, payload }) =>
      request(`${ENDPOINTS.inventory}/${id}/movements`, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    meta,
  });

  return { create, update, remove, registerMovement };
}

/** Descarga `GET /inventory/export` (CSV); requiere el Bearer, así que no puede ser un link directo. */
export async function downloadInventoryExport(
  token: string | undefined,
  area?: InventoryArea
): Promise<void> {
  const { apiUrl } = await import("@/lib/config");
  const { authFetch, authHeaders } = await import("@/lib/authFetch");
  const url = `${apiUrl(ENDPOINTS.inventory)}/export${area ? `?area=${area}` : ""}`;
  const res = await authFetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new ApiError(`No se pudo exportar (error ${res.status}).`, res.status);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `inventario${area ? `-${area}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
