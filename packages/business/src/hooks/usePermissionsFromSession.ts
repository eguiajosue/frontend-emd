import { useMemo } from "react";
import { useAuthSession } from "../session";
import { isAdminRole } from "../roleTaskMapping";

/**
 * Permisos derivados de los roles de la sesión — misma lógica que
 * `usePermissions()` en la Web, pero leyendo del contexto de sesión
 * compartido en vez de `next-auth/react` directamente, para poder usarse
 * también en Mobile.
 */
export function usePermissionsFromSession() {
  const { roles } = useAuthSession();

  return useMemo(() => {
    const isAdmin = isAdminRole(roles);
    return {
      roles,
      isAdmin,
      /** Alta/edición de pedidos, clientes y empresas. */
      canManageOperations: isAdmin || roles.includes("recepcion"),
      /** Alta/edición de usuarios y roles. */
      canManageUsers: isAdmin,
    };
  }, [roles]);
}
