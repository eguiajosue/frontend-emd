"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError, getErrorMessage, request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import type { MockupLogoSummary } from "@/lib/mockups/types";

/**
 * Biblioteca de logos de la empresa (compartida; Recepción/Admin).
 *
 * - `GET    /mockup-logos`            → lista liviana, más usados primero
 * - `GET    /mockup-logos/:id/image`  → { dataUrl }
 * - `POST   /mockup-logos`            → { name, imageDataUrl } (PNG ≤ 2 MB)
 * - `PATCH  /mockup-logos/:id`        → { name }
 * - `POST   /mockup-logos/:id/use`    → suma un uso
 * - `DELETE /mockup-logos/:id`
 */
const LOGOS = "mockup-logos";

export const mockupLogoKeys = {
  all: ["mockupLogos"] as const,
  list: () => ["mockupLogos", "list"] as const,
  image: (id: number) => ["mockupLogos", "image", id] as const,
};

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export const LOGO_TOO_LARGE_MESSAGE = "El logo pesa demasiado (máximo 2 MB). Usa un archivo más ligero.";

export function mockupLogoErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 413) return LOGO_TOO_LARGE_MESSAGE;
  return getErrorMessage(error, fallback);
}

export function useMockupLogos(options?: { enabled?: boolean }) {
  const token = useAuthToken();
  const query = useQuery<MockupLogoSummary[]>({
    queryKey: mockupLogoKeys.list(),
    enabled: Boolean(token) && (options?.enabled ?? true),
    queryFn: async () => {
      try {
        const data = await request<MockupLogoSummary[]>(LOGOS, { token });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
    meta: { silentError: true },
  });
  return {
    logos: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    refetch: query.refetch,
  };
}

function imageQuery(token: string | undefined, id: number) {
  return {
    queryKey: mockupLogoKeys.image(id),
    queryFn: () => request<{ dataUrl: string }>(`${LOGOS}/${id}/image`, { token }),
    // La imagen de un logo no cambia: no se vuelve a bajar.
    staleTime: Infinity,
  };
}

/** Imagen de un logo; `enabled` se prende cuando su tarjeta se ve en pantalla. */
export function useMockupLogoImage(id: number, options?: { enabled?: boolean }) {
  const token = useAuthToken();
  return useQuery<{ dataUrl: string }>({
    ...imageQuery(token, id),
    enabled: Boolean(token) && (options?.enabled ?? true),
    meta: { silentError: true },
  });
}

export function fetchMockupLogoImage(queryClient: QueryClient, token: string | undefined, id: number) {
  return queryClient.fetchQuery<{ dataUrl: string }>(imageQuery(token, id));
}

export function useMockupLogoMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: mockupLogoKeys.list() });

  const upload = useMutation({
    mutationFn: (payload: { name: string; imageDataUrl: string }) =>
      request<MockupLogoSummary>(LOGOS, { token, method: "POST", body: payload }),
    onSuccess: (logo, payload) => {
      // La imagen ya la tenemos: la tarjeta nueva no la vuelve a pedir.
      if (logo?.id) queryClient.setQueryData(mockupLogoKeys.image(logo.id), { dataUrl: payload.imageDataUrl });
      return invalidateList();
    },
    meta: { ownErrorToast: true },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      request<MockupLogoSummary>(`${LOGOS}/${id}`, { token, method: "PATCH", body: { name } }),
    onSuccess: invalidateList,
  });

  const remove = useMutation({
    mutationFn: (id: number) => request<void>(`${LOGOS}/${id}`, { token, method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: mockupLogoKeys.image(id) });
      return invalidateList();
    },
  });

  /** Cuenta un uso (para "más usados primero"); si falla no molesta a nadie. */
  const markUsed = useMutation({
    mutationFn: (id: number) => request<void>(`${LOGOS}/${id}/use`, { token, method: "POST" }),
    onSettled: invalidateList,
    meta: { ownErrorToast: true },
  });

  return { upload, rename, remove, markUsed };
}
