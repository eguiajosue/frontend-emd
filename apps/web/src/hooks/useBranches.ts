"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, type ApiError } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken, useEntityList } from "@/hooks/useEntity";
import type { Branch, BranchEmployee } from "@/types";

/** Sucursal de la cuenta autenticada, con sus empleados ACTIVOS (GET /branches/me). */
export interface MyBranch {
  id: number;
  name: string;
  active: boolean;
  employees: { id: number; name: string }[];
}

export function useMyBranch(enabled: boolean) {
  const token = useAuthToken();
  const query = useQuery<MyBranch>({
    queryKey: [ENDPOINTS.branches, "me"],
    enabled: Boolean(token) && enabled,
    queryFn: () => request<MyBranch>(`${ENDPOINTS.branches}/me`, { token }),
  });
  return { branch: query.data, isLoading: query.isPending && enabled, isError: query.isError };
}

/** Sucursales con TODOS sus empleados (admin, superuser y Recepción). */
export function useBranches(enabled = true) {
  return useEntityList<Branch>("branches", { enabled });
}

/** Alta/edición de sucursales y empleados (sólo admin/superuser en el backend). */
export function useBranchMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.all("branches") });

  const createBranch = useMutation<Branch, ApiError, { name: string }>({
    mutationFn: (body) => request<Branch>(ENDPOINTS.branches, { method: "POST", token, body }),
    onSuccess: invalidate,
  });
  const updateBranch = useMutation<
    Branch,
    ApiError,
    { id: number; payload: { name?: string; active?: boolean } }
  >({
    mutationFn: ({ id, payload }) =>
      request<Branch>(`${ENDPOINTS.branches}/${id}`, { method: "PATCH", token, body: payload }),
    onSuccess: invalidate,
  });
  const createEmployee = useMutation<BranchEmployee, ApiError, { branchId: number; name: string }>({
    mutationFn: ({ branchId, name }) =>
      request<BranchEmployee>(`${ENDPOINTS.branches}/${branchId}/employees`, {
        method: "POST",
        token,
        body: { name },
      }),
    onSuccess: invalidate,
  });
  const updateEmployee = useMutation<
    BranchEmployee,
    ApiError,
    { branchId: number; employeeId: number; payload: { name?: string; active?: boolean } }
  >({
    mutationFn: ({ branchId, employeeId, payload }) =>
      request<BranchEmployee>(`${ENDPOINTS.branches}/${branchId}/employees/${employeeId}`, {
        method: "PATCH",
        token,
        body: payload,
      }),
    onSuccess: invalidate,
  });

  return { createBranch, updateBranch, createEmployee, updateEmployee };
}
