"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { ShareState } from "@/lib/clientPortal";

/**
 * Recepción y el portal del cliente: el enlace privado del pedido
 * (crear / regenerar / desactivar), si el cliente ya lo abrió y lo que
 * respondió sobre el diseño (pendiente de confirmar). Backend: src/client-portal.
 */
export const shareStateKey = (orderId: number) => [...queryKeys.all("orders"), "share-link", orderId] as const;

export function useShareState(orderId: number, enabled = true) {
  const token = useAuthToken();
  return useQuery<ShareState>({
    queryKey: shareStateKey(orderId),
    enabled: enabled && Boolean(token),
    queryFn: () => request<ShareState>(`${ENDPOINTS.orders}/${orderId}/share-link`, { token }),
    meta: { silentError: true },
  });
}

export function useShareLinkActions(orderId: number) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const base = `${ENDPOINTS.orders}/${orderId}`;
  const setState = (data: ShareState) => queryClient.setQueryData(shareStateKey(orderId), data);
  const onError = (fallback: string) => (error: unknown) => toast.error(getErrorMessage(error, fallback));

  const create = useMutation({
    mutationFn: () => request<ShareState>(`${base}/share-link`, { token, method: "POST" }),
    onSuccess: setState,
    onError: onError("No se pudo crear el enlace."),
    meta: { ownErrorToast: true },
  });
  const regenerate = useMutation({
    mutationFn: () => request<ShareState>(`${base}/share-link/regenerate`, { token, method: "POST" }),
    onSuccess: (data) => {
      setState(data);
      toast.success("Enlace nuevo listo: el anterior ya no funciona");
    },
    onError: onError("No se pudo generar el enlace."),
    meta: { ownErrorToast: true },
  });
  const revoke = useMutation({
    mutationFn: () => request(`${base}/share-link`, { token, method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<ShareState>(shareStateKey(orderId), (prev) => ({
        link: null,
        pendingResponse: prev?.pendingResponse ?? null,
      }));
      toast.success("Enlace desactivado");
    },
    onError: onError("No se pudo desactivar el enlace."),
    meta: { ownErrorToast: true },
  });
  const discard = useMutation({
    mutationFn: (responseId: number) =>
      request(`${base}/client-responses/${responseId}/discard`, { token, method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shareStateKey(orderId) });
      toast.success("Respuesta del cliente descartada");
    },
    onError: onError("No se pudo descartar la respuesta."),
    meta: { ownErrorToast: true },
  });
  return { create, regenerate, revoke, discard };
}
