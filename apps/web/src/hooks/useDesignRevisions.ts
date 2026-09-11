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

import { useCallback, useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, request } from "@/lib/api";
import { authFetch, authHeaders } from "@/lib/authFetch";
import { apiUrl } from "@/lib/config";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type {
  DesignRevision,
  DesignRevisionFileContent,
  DesignRevisionFileInput,
} from "@/types";

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
export function useDesignRevisions(
  orderId: number | null,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  // `options.enabled` deja apagar el flujo entero para un pedido que NO
  // requiere diseño: el panel no se renderiza, así que pedir las rondas era
  // un GET al pepe por cada pedido abierto.
  const enabled = (options.enabled ?? true) && Boolean(token) && orderId !== null;

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
    // Una hoja de autorización puede ser varias imágenes o un PDF: el montaje
    // viaja siempre como lista (`montageFiles`, 1..10). El campo legacy
    // `montageFile` lo sigue aceptando el backend, pero ya no se manda.
    mutationFn: (montageFiles: DesignRevisionFileInput[]) =>
      request<DesignRevision>(designRevisionsPath(orderId as number), {
        method: "POST",
        token,
        body: { montageFiles },
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
      feedbackFiles,
    }: {
      revisionId: number;
      feedbackText: string;
      feedbackFiles?: DesignRevisionFileInput[];
    }) =>
      request<DesignRevision>(
        `${designRevisionsPath(orderId as number)}/${revisionId}/feedback`,
        { method: "PATCH", token, body: { feedbackText, feedbackFiles } }
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

    /** `true` si la mutación salió bien; `false` si falló (ya avisada con un toast). */
    sendMontage: (montageFiles: DesignRevisionFileInput[]) =>
      sendMontageMutation
        .mutateAsync(montageFiles)
        .then(() => true)
        .catch(() => false),
    isSendingMontage: sendMontageMutation.isPending,

    submitFeedback: (args: {
      revisionId: number;
      feedbackText: string;
      feedbackFiles?: DesignRevisionFileInput[];
    }) =>
      feedbackMutation
        .mutateAsync(args)
        .then(() => true)
        .catch(() => false),
    isSubmittingFeedback: feedbackMutation.isPending,

    approveRevision: (args: { revisionId: number; productionArea?: string }) =>
      approveMutation
        .mutateAsync(args)
        .then(() => true)
        .catch(() => false),
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
const DESIGN_REVISION_FILE_KEY = "designRevisionFile";

/** Clientes ya suscritos, para no encadenar un listener por componente montado. */
const revokeSubscribedClients = new WeakSet<QueryClient>();

/**
 * Las blob URLs que crea `useDesignRevisionFile` viven mientras la entrada
 * siga en la caché de React Query; cuando la caché la tira (gcTime) nadie las
 * revocaba y el documento se quedaba con el blob entero en memoria. Una única
 * suscripción por `QueryClient` las revoca al removerse.
 */
function useRevokeBlobUrlOnCacheRemoval() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (revokeSubscribedClients.has(queryClient)) return;
    revokeSubscribedClients.add(queryClient);
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "removed") return;
      const key = event.query.queryKey;
      if (!Array.isArray(key) || key[0] !== DESIGN_REVISION_FILE_KEY) return;
      const data = event.query.state.data as { url?: string } | null | undefined;
      if (data?.url?.startsWith("blob:")) URL.revokeObjectURL(data.url);
    });
  }, [queryClient]);
}

export function useDesignRevisionFile(
  orderId: number | null,
  revisionId: number | null,
  kind: "montage" | "feedback-file",
  enabled: boolean
) {
  const token = useAuthToken();
  useRevokeBlobUrlOnCacheRemoval();
  const active = enabled && Boolean(token) && orderId !== null && revisionId !== null;

  return useQuery<{ url: string; mime: string } | null>({
    queryKey: [DESIGN_REVISION_FILE_KEY, orderId, revisionId, kind],
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

/**
 * UN archivo concreto de una ronda
 * (`GET /orders/:id/design-revisions/:revisionId/files/:fileId`), con el
 * contenido ya en `dataUrl` — sirve tanto de `src` de un `<img>` como de
 * `href` de un `<a download>`, así que la descarga individual no necesita
 * blobs ni `window.open`.
 */
export function useDesignRevisionFileContent(
  orderId: number | null,
  revisionId: number | null,
  fileId: number | null,
  enabled: boolean
) {
  const token = useAuthToken();
  const active =
    enabled && Boolean(token) && orderId !== null && revisionId !== null && fileId !== null;

  return useQuery<DesignRevisionFileContent>({
    queryKey: ["designRevisionFileContent", orderId, revisionId, fileId],
    enabled: active,
    staleTime: Infinity,
    gcTime: 15 * 60 * 1000,
    queryFn: () =>
      request<DesignRevisionFileContent>(
        `${designRevisionsPath(orderId as number)}/${revisionId}/files/${fileId}`,
        { token }
      ),
  });
}
