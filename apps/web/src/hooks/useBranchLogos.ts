"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, type ApiError } from "@/lib/api";
import { ENDPOINTS } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import { useMyBranch } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import type { BranchLogoVariant, BranchLogos } from "@/types";

/** Los logos casi no cambian (los sube el admin una vez): se cachean 10 min y se invalidan al subir/quitar. */
export const BRANCH_LOGOS_STALE_TIME = 10 * 60_000;

export const BRANCH_LOGOS_KEY = [ENDPOINTS.branches, "logos"] as const;

/**
 * Logos de TODAS las sucursales activas (`GET /branches/logos`, cualquier
 * usuario autenticado). Es UNA sola query compartida por todas las pantallas:
 * cada `<BranchLogo>` busca aquí el suyo por `branchId`, sin pedir nada más.
 *
 * Una cuenta de sucursal sólo ve el logo de LA SUYA: aunque el backend
 * devolviera más, se descartan los ajenos (no deberían llegarle pedidos de
 * otra sucursal, pero tampoco se depende de eso).
 */
export function useBranchLogos() {
  const token = useAuthToken();
  const { isBranch } = usePermissions();
  const { branch: myBranch } = useMyBranch(isBranch);

  const query = useQuery<BranchLogos[]>({
    queryKey: BRANCH_LOGOS_KEY,
    enabled: Boolean(token),
    staleTime: BRANCH_LOGOS_STALE_TIME,
    queryFn: () => request<BranchLogos[]>(`${ENDPOINTS.branches}/logos`, { token }),
  });

  const logos = useMemo(() => {
    const all = query.data ?? [];
    // Mientras no se sabe cuál es SU sucursal, no se muestra ninguno.
    if (isBranch) return myBranch ? all.filter((l) => l.branchId === myBranch.id) : [];
    return all;
  }, [query.data, isBranch, myBranch]);

  const byBranchId = useMemo(() => new Map(logos.map((l) => [l.branchId, l])), [logos]);

  return {
    logos,
    /** Logos de una sucursal, o `undefined` si no tiene (o todavía no cargan). */
    getLogos: (branchId: number | null | undefined) =>
      branchId == null ? undefined : byBranchId.get(branchId),
    isLoading: query.isPending && Boolean(token),
    isError: query.isError,
  };
}

/** Subir y quitar el logo de una sucursal (sólo admin/superuser en el backend). */
export function useBranchLogoMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  // `branches` cubre la lista (hasLogoOnLight/OnDark) y `branches/logos`.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [ENDPOINTS.branches] });

  const upload = useMutation<
    { branchId: number; variant: BranchLogoVariant; updatedAt: string },
    ApiError,
    { branchId: number; variant: BranchLogoVariant; imageDataUrl: string }
  >({
    mutationFn: ({ branchId, variant, imageDataUrl }) =>
      request(`${ENDPOINTS.branches}/${branchId}/logo/${variant}`, {
        method: "PUT",
        token,
        body: { imageDataUrl },
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, ApiError, { branchId: number; variant: BranchLogoVariant }>({
    mutationFn: ({ branchId, variant }) =>
      request<void>(`${ENDPOINTS.branches}/${branchId}/logo/${variant}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });

  return { upload, remove };
}
