"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError, getErrorMessage, request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import type {
  CreateMockupTemplatePayload,
  MockupTemplateDetail,
  MockupTemplateSummary,
} from "@/lib/mockups/types";

/**
 * Plantillas de mockup, compartidas por toda la empresa (Recepción/Admin).
 *
 * - `GET    /mockup-templates`      → lista con miniatura (sin config)
 * - `GET    /mockup-templates/:id`  → + config
 * - `POST   /mockup-templates`      → { name, garment, config, thumbnailDataUrl }
 * - `PATCH  /mockup-templates/:id`  → { name }
 * - `DELETE /mockup-templates/:id`
 */
const TEMPLATES = "mockup-templates";

export const mockupTemplateKeys = {
  all: ["mockupTemplates"] as const,
  list: () => ["mockupTemplates", "list"] as const,
  detail: (id: number) => ["mockupTemplates", "detail", id] as const,
};

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export const TEMPLATE_TOO_LARGE_MESSAGE =
  "La plantilla pesa demasiado para guardarse. Quita algún diseño o usa archivos más ligeros.";

export function mockupTemplateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 413) return TEMPLATE_TOO_LARGE_MESSAGE;
  return getErrorMessage(error, fallback);
}

export function useMockupTemplates(options?: { enabled?: boolean }) {
  const token = useAuthToken();
  const query = useQuery<MockupTemplateSummary[]>({
    queryKey: mockupTemplateKeys.list(),
    enabled: Boolean(token) && (options?.enabled ?? true),
    queryFn: async () => {
      try {
        const data = await request<MockupTemplateSummary[]>(TEMPLATES, { token });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        // Backend todavía sin el módulo: lista vacía.
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
    meta: { silentError: true },
  });
  return {
    templates: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Pide (o toma de la caché) la plantilla completa, con su config. */
export function fetchMockupTemplate(queryClient: QueryClient, token: string | undefined, id: number) {
  return queryClient.fetchQuery<MockupTemplateDetail>({
    queryKey: mockupTemplateKeys.detail(id),
    queryFn: () => request<MockupTemplateDetail>(`${TEMPLATES}/${id}`, { token }),
    staleTime: 60_000,
  });
}

export function useMockupTemplateMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: mockupTemplateKeys.all });

  const create = useMutation({
    mutationFn: (payload: CreateMockupTemplatePayload) =>
      request<MockupTemplateSummary>(TEMPLATES, { token, method: "POST", body: payload }),
    onSuccess: invalidate,
    // El diálogo muestra su propio error (con el mensaje del 413).
    meta: { ownErrorToast: true },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      request<MockupTemplateSummary>(`${TEMPLATES}/${id}`, { token, method: "PATCH", body: { name } }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => request<void>(`${TEMPLATES}/${id}`, { token, method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: mockupTemplateKeys.detail(id) });
      return invalidate();
    },
  });

  return { create, rename, remove };
}
