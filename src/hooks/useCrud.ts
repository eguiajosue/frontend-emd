"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCrud<T = any>(endpoint: string, options?: { auto?: boolean }) {
  const { data: session } = useSession();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const token = session?.user?.token;
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  const auto = options?.auto ?? true;

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await authFetch(`${base}/${endpoint}`, {
        method: "GET",
        headers: authHeaders(token),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json);
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error(`Error fetching ${endpoint}:`, error);
      toast.error(`No se pudo cargar la información de ${endpoint}`);
    } finally {
      setLoading(false);
    }
  }, [token, endpoint, base]);

  useEffect(() => {
    if (auto && token) {
      fetchAll();
    }
  }, [auto, token, fetchAll]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const create = useCallback(async (payload: any) => {
    const res = await authFetch(`${base}/${endpoint}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    await fetchAll();
    return json;
  }, [base, endpoint, token, fetchAll]);

  const update = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (id: number | string, payload: any) => {
      const res = await authFetch(`${base}/${endpoint}/${id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      await fetchAll();
      return json;
    },
    [base, endpoint, token, fetchAll]
  );

  const remove = useCallback(
    async (id: number | string) => {
      const res = await authFetch(`${base}/${endpoint}/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      await fetchAll();
    },
    [base, endpoint, token, fetchAll]
  );

  return { data, setData, loading, fetchAll, create, update, remove };
}
