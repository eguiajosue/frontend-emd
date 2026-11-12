"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";

const PROFILE_AVATAR_KEY = ["profile", "avatar"] as const;

/**
 * Avatar del usuario en sesión. La semilla viene de `GET /auth/profile` (el
 * token de sesión no la lleva) y `reroll` sortea una nueva en el servidor
 * (`PATCH /users/me/avatar`) y la deja en la caché al instante.
 */
export function useMyAvatar() {
  const { data: session } = useSession();
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const busy = useRef(false);

  const query = useQuery({
    queryKey: PROFILE_AVATAR_KEY,
    enabled: !!session && !!token,
    queryFn: () => request<{ avatarSeed: string | null }>("auth/profile", { token }),
    staleTime: 5 * 60_000,
    select: (profile) => profile.avatarSeed,
  });

  const mutation = useMutation({
    mutationFn: () => request<{ avatarSeed: string }>("users/me/avatar", { method: "PATCH", token }),
    onSuccess: (data) => queryClient.setQueryData(PROFILE_AVATAR_KEY, data),
    onSettled: () => {
      busy.current = false;
    },
  });

  return {
    user: { id: session?.user?.id, avatarSeed: query.data ?? null },
    // El ref, no `isPending`: dos clics en el mismo render no ven aún el estado nuevo.
    reroll: () => {
      if (busy.current) return;
      busy.current = true;
      mutation.mutate();
    },
    isRerolling: mutation.isPending,
  };
}
