"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { isAdminRole } from "@/lib/roleTaskMapping";
import { isBranchOnly } from "@/lib/roles";
import { DESIGN_AREA } from "@/lib/areas";

const NO_ACCESS: string[] = [];

/**
 * Permisos derivados de los roles y las áreas de la sesión.
 * Centraliza los chequeos que antes estaban repetidos en cada pantalla.
 */
export function usePermissions() {
  const { data: session, status } = useSession();

  return useMemo(() => {
    const roles = session?.user?.roles ?? NO_ACCESS;
    const areas = session?.user?.areas ?? NO_ACCESS;
    const isAdmin = isAdminRole(roles);
    const isBranch = isBranchOnly({ roles, areas });
    return {
      roles,
      /** Slugs de las áreas en las que trabaja (ver `Area`). */
      areas,
      isAdmin,
      /** Alta/edición de pedidos, clientes y empresas. */
      canManageOperations: isAdmin || roles.includes("recepcion"),
      /** Mockups 3D: Recepción, administración, Diseño y la cuenta de sucursal. */
      canUseMockups: isAdmin || roles.includes("recepcion") || areas.includes(DESIGN_AREA) || isBranch,
      /** Alta/edición de usuarios y roles. */
      canManageUsers: isAdmin,
      /** Cuenta de sucursal: sólo Nuevo pedido, Mis pedidos y Mockups. */
      isBranch,
      isSessionLoading: status === "loading",
      session,
    };
  }, [session, status]);
}
