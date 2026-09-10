"use client";

/**
 * Flujo de diseño de un pedido (`Order.requiresDesign`):
 *
 *   Recepción → Diseño arma montaje → Recepción → cliente autoriza (o pide
 *   cambios, vuelve a Diseño) → autorizado → pasa a producción.
 *
 * Endpoints nuevos, desplegados en paralelo por el equipo de backend
 * (`GET/POST /orders/:id/design-revisions`, `PATCH .../feedback`,
 * `PATCH .../approve`): si todavía no existen, un 404 en el listado se
 * absorbe acá y la UI muestra el empty state en vez de romper.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, request } from "@/lib/api";
import { authFetch, authHeaders } from "@/lib/authFetch";
import { apiUrl } from "@/lib/config";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type { DesignRevision, DesignRevisionFileInput } from "@/types";

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function getDesignErrorMessage(error: unknown): string {
  if (isNotFound(error)) {
    return "El flujo de diseño todavía no está disponible en el servidor.";
  }
  return error instanceof ApiError && error.message
    ? error.message
    : "No se pudo completar la acción.";
}

function designRevisionsPath(orderId: number) {
  return `${ENDPOINTS.orders}/${orderId}/design-revisions`;
}

/**
 * Rondas de diseño de un pedido, ordenadas por el backend (ronda 1 primero),
 * más las 3 mutations del flujo. Invalida revisiones + pedido (detalle y
 * lista) tras cada acción, así el estado/área del pedido se refresca solo.
 */
export function useDesignRevisions(orderId: number | null) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const enabled = Boolean(token) && orderId !== null;

  const query = useQuery<DesignRevision[]>({
    queryKey: ["designRevisions", orderId],
    enabled,
    queryFn: async () => {
      try {
        return await request<DesignRevision[]>(designRevisionsPath(orderId as number), {
          token,
        });
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["designRevisions", orderId] });
    if (orderId !== null) {
      queryClient.invalidateQueries({ queryKey: queryKeys.detail("orders", orderId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
  }, [queryClient, orderId]);

  const sendMontageMutation = useMutation({
    mutationFn: (montageFile: DesignRevisionFileInput) =>
      request<DesignRevision>(designRevisionsPath(orderId as number), {
        method: "POST",
        token,
        body: { montageFile },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Montaje enviado a Recepción");
    },
    onError: (error) => toast.error(getDesignErrorMessage(error)),
  });

  const feedbackMutation = useMutation({
    mutationFn: ({
      revisionId,
      feedbackText,
      feedbackFile,
    }: {
      revisionId: number;
      feedbackText: string;
      feedbackFile?: DesignRevisionFileInput;
    }) =>
      request<DesignRevision>(
        `${designRevisionsPath(orderId as number)}/${revisionId}/feedback`,
        { method: "PATCH", token, body: { feedbackText, feedbackFile } }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Cambios del cliente registrados, vuelve a Diseño");
    },
    onError: (error) => toast.error(getDesignErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: ({
      revisionId,
      productionArea,
    }: {
      revisionId: number;
      productionArea?: string;
    }) =>
      request<DesignRevision>(
        `${designRevisionsPath(orderId as number)}/${revisionId}/approve`,
        { method: "PATCH", token, body: { productionArea } }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Pedido autorizado: pasa a producción");
    },
    onError: (error) => toast.error(getDesignErrorMessage(error)),
  });

  return {
    revisions: query.data ?? [],
    isLoading: query.isLoading,
    isUnavailable: isNotFound(query.error),

    sendMontage: (montageFile: DesignRevisionFileInput) =>
      sendMontageMutation.mutateAsync(montageFile).catch(() => undefined),
    isSendingMontage: sendMontageMutation.isPending,

    submitFeedback: (args: {
      revisionId: number;
      feedbackText: string;
      feedbackFile?: DesignRevisionFileInput;
    }) => feedbackMutation.mutateAsync(args).catch(() => undefined),
    isSubmittingFeedback: feedbackMutation.isPending,

    approveRevision: (args: { revisionId: number; productionArea?: string }) =>
      approveMutation.mutateAsync(args).catch(() => undefined),
    isApproving: approveMutation.isPending,
  };
}

/**
 * Trae el archivo binario (montaje o adjunto de feedback) de una ronda como
 * blob URL, para mostrarlo en un `<img>` o abrirlo en una pestaña nueva —
 * mismo patrón que `downloadOrdersExport` (requiere el header Bearer, así que
 * no se puede linkear directo). `enabled=false` mientras no haga falta
 * (ej. antes de expandir la ronda) para no traer archivos de más.
 */
export function useDesignRevisionFile(
  orderId: number | null,
  revisionId: number | null,
  kind: "montage" | "feedback-file",
  enabled: boolean
) {
  const token = useAuthToken();
  const active = enabled && Boolean(token) && orderId !== null && revisionId !== null;

  return useQuery<{ url: string; mime: string } | null>({
    queryKey: ["designRevisionFile", orderId, revisionId, kind],
    enabled: active,
    staleTime: Infinity,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const res = await authFetch(
        apiUrl(`${designRevisionsPath(orderId as number)}/${revisionId}/${kind}`),
        { headers: authHeaders(token) }
      );
      if (!res.ok) {
        throw new ApiError(`No se pudo cargar el archivo (error ${res.status}).`, res.status);
      }
      const blob = await res.blob();
      return { url: URL.createObjectURL(blob), mime: blob.type };
    },
  });
}
