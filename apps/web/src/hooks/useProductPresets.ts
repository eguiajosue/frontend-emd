"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import type { OrderProductPreset } from "@/types";

/**
 * Crea un producto frecuente nuevo en el catálogo compartido
 * (`POST /order-product-presets {name}`). Es idempotente: si ya existe,
 * el backend devuelve el existente. Refresca el catálogo al terminar.
 */
export function useCreateProductPreset() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const mutation = useMutation<OrderProductPreset, Error, string>({
    // El diálogo muestra el error del backend junto al campo: sin toast duplicado.
    meta: { ownErrorToast: true },
    mutationFn: (name) =>
      request<OrderProductPreset>(ENDPOINTS.orderProductPresets, {
        method: "POST",
        token,
        body: { name },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.all("orderProductPresets") }),
  });

  const { mutateAsync } = mutation;
  const createPreset = useCallback((name: string) => mutateAsync(name), [mutateAsync]);
  return { createPreset, isCreating: mutation.isPending };
}
