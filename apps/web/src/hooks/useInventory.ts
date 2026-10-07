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
  InventoryMovementResult,
  InventoryMovementsFilter,
  CreateRestockRequestPayload,
  RestockRequest,
  RestockRequestStatus,
  UpdateRestockRequestStatusPayload,
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
 * - `GET    /inventory/items/by-barcode/:code`            artículo por código de barras
 * - `POST   /inventory/items/by-barcode/:code/movements`  movimiento al escanear
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
  filter: InventoryMovementsFilter,
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
            params: {
              area: filter.area,
              limit: filter.limit,
              userId: filter.userId,
              type: filter.type,
              from: filter.from,
              to: filter.to,
            },
          }),
  });
}

/** Solicitudes de reabasto (Recepción todas; cada área las suyas). */
export function useRestockRequests(
  filter: { status?: RestockRequestStatus; open?: boolean; area?: InventoryArea } = {},
  options: { enabled?: boolean } = {}
) {
  const token = useAuthToken();
  return useQuery<RestockRequest[]>({
    queryKey: [...inventoryKey, "restock", filter],
    enabled: Boolean(token) && (options.enabled ?? true),
    queryFn: () =>
      request<RestockRequest[]>(`${ENDPOINTS.inventory}/restock-requests`, {
        token,
        params: {
          status: filter.status,
          open: filter.open === undefined ? undefined : String(filter.open),
          area: filter.area,
        },
      }),
  });
}

/** Para el badge de la pestaña: pendientes y abiertas. */
export function useRestockCount(options: { enabled?: boolean } = {}) {
  const token = useAuthToken();
  return useQuery<{ pending: number; open: number }>({
    queryKey: [...inventoryKey, "restock-count"],
    enabled: Boolean(token) && (options.enabled ?? true),
    queryFn: () => request(`${ENDPOINTS.inventory}/restock-requests/count`, { token }),
  });
}

export function useRestockMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: inventoryKey });
  const meta = { ownErrorToast: true };

  const create = useMutation<RestockRequest, ApiError, CreateRestockRequestPayload>({
    mutationFn: (payload) =>
      request(`${ENDPOINTS.inventory}/restock-requests`, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    meta,
  });
  const updateStatus = useMutation<
    RestockRequest,
    ApiError,
    { id: number; payload: UpdateRestockRequestStatusPayload }
  >({
    mutationFn: ({ id, payload }) =>
      request(`${ENDPOINTS.inventory}/restock-requests/${id}`, { token, method: "PATCH", body: payload }),
    onSuccess: invalidate,
    meta,
  });
  return { create, updateStatus };
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
    InventoryMovementResult,
    ApiError,
    { id: number; payload: CreateInventoryMovementPayload }
  >({
    mutationFn: ({ id, payload }) =>
      request(`${ENDPOINTS.inventory}/${id}/movements`, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    meta,
  });

  /** Escaneo: ubica el artículo por su código y registra el movimiento en una sola petición. */
  const scanMovement = useMutation<
    InventoryMovementResult,
    ApiError,
    { code: string; payload: CreateInventoryMovementPayload }
  >({
    mutationFn: ({ code, payload }) =>
      request(inventoryBarcodePath(code, "/movements"), { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    meta,
  });

  return { create, update, remove, registerMovement, scanMovement };
}

/**
 * Ruta por código de barras. El código puede traer `/`, espacios o `#`
 * (Code 128 admite todo el ASCII imprimible): siempre va codificado.
 */
export function inventoryBarcodePath(code: string, suffix = ""): string {
  return `${ENDPOINTS.inventory}/items/by-barcode/${encodeURIComponent(code)}${suffix}`;
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
