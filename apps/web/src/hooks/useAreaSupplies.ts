"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { AreaSupplySheet } from "@/types";

/** Prefijo de la hoja de materiales de TODOS los pedidos (para invalidar en bloque). */
export const AREA_SUPPLIES_KEY = [...queryKeys.all("orders"), "area-supplies"] as const;

/**
 * Terminar/regresar una tarea (o descontar pendientes) mueve el inventario y
 * el estado de las líneas apartadas: se refrescan la hoja de materiales y las
 * existencias para que no queden datos viejos en pantalla.
 */
export function invalidateSupplyData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: AREA_SUPPLIES_KEY });
  queryClient.invalidateQueries({ queryKey: queryKeys.all("inventory") });
}

/**
 * Hoja de materiales por área de un pedido (origen de insumos, apartado /
 * descontado y movimientos de inventario): `GET /orders/:id/area-supplies`.
 * Un 404 (backend viejo) se absorbe como "sin hoja". Un 403 (cuenta de
 * sucursal, o un área que no es la del usuario) no se reintenta ni avisa: la
 * hoja simplemente no se muestra. `enabled` permite no pedirla (sucursal).
 */
export function useAreaSupplies(orderId: number | null, enabled = true) {
  const token = useAuthToken();
  return useQuery<AreaSupplySheet>({
    queryKey: [...AREA_SUPPLIES_KEY, orderId ?? 0],
    enabled: enabled && Boolean(token) && orderId !== null,
    queryFn: async () => {
      try {
        return await request<AreaSupplySheet>(`${ENDPOINTS.orders}/${orderId}/area-supplies`, { token });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return { areas: [], movements: [] };
        throw error;
      }
    },
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 403)) && failureCount < 2,
    meta: { silentError: true },
  });
}

/**
 * Avisos de la hoja de materiales que el backend pueda mandar junto a la
 * respuesta de un cambio de estado (`supplyWarnings`, como al autorizar).
 * Terminar una tarea ya no falla por falta de stock: si algo no se descontó
 * se avisa a Recepción y la línea queda "Pendiente de descontar".
 */
export function showSupplyWarnings(data: unknown) {
  const warnings = (data as { supplyWarnings?: unknown } | null | undefined)?.supplyWarnings;
  if (!Array.isArray(warnings)) return;
  for (const warning of warnings) if (typeof warning === "string" && warning) toast.warning(warning);
}

/** ¿Alguna línea del área sigue con el descuento pendiente? */
export function sheetHasPending(sheet: AreaSupplySheet | undefined, area?: string): boolean {
  return (sheet?.areas ?? []).some(
    (a) =>
      (!area || a.area === area) &&
      (a.pendingDiscount || a.supply?.lines.some((line) => line.pendingDiscount)),
  );
}

/**
 * Reintenta el descuento de las líneas pendientes de un área
 * (`POST /orders/:id/area-supplies/:area/discount-pending`, sólo
 * Recepción/admin). Tras dar entrada al inventario, descuenta lo que ya alcanza.
 */
export function useDiscountPendingSupplies(orderId: number) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (area: string) =>
      request<AreaSupplySheet>(`${ENDPOINTS.orders}/${orderId}/area-supplies/${area}/discount-pending`, {
        token,
        method: "POST",
      }),
    onSuccess: (sheet, area) => {
      invalidateSupplyData(queryClient);
      if (sheetHasPending(sheet, area)) {
        toast.warning("Todavía falta existencia para descontar algunos insumos.");
      } else {
        toast.success("Insumos pendientes descontados del inventario");
      }
    },
    onError: (error) => toast.error(getErrorMessage(error, "No se pudo descontar los insumos pendientes.")),
    meta: { ownErrorToast: true },
  });
}
