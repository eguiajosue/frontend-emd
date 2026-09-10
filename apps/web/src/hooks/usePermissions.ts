"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { isAdminRole } from "@/lib/roleTaskMapping";

/**
 * Permisos derivados de los roles de la sesión.
 * Centraliza los chequeos que antes estaban repetidos en cada pantalla.
 */
export function usePermissions() {
  const { data: session, status } = useSession();

  return useMemo(() => {
    const roles = session?.user?.roles ?? [];
    const isAdmin = isAdminRole(roles);
    return {
      roles,
      isAdmin,
      /** Alta/edición de pedidos, clientes y empresas. */
      canManageOperations: isAdmin || roles.includes("recepcion"),
      /** Alta/edición de usuarios y roles. */
      canManageUsers: isAdmin,
      isSessionLoading: status === "loading",
      session,
    };
  }, [session, status]);
}
