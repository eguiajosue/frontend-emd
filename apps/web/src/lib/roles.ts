import { getAreaLabel, type SessionAccess } from "@emd/business/src/areas";

/**
 * Etiquetas legibles de los roles del backend (`src/common/enums/roles.enum.ts`).
 *
 * Las áreas de trabajo (Taller, Diseño...) ya NO son roles: sus nombres salen
 * del catálogo de áreas (`getAreaLabel` en `@/lib/areas`). Nunca mostrar un
 * rol crudo en pantalla: usar `getRoleLabel` en TODO texto de interfaz.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  superuser: "Superusuario",
  recepcion: "Recepción",
  sucursal: "Sucursal",
};

/** Etiqueta legible de un rol; cae al valor crudo si es uno que no conocemos. */
export function getRoleLabel(role?: string | null): string {
  if (!role) return "Sin rol";
  return ROLE_LABELS[role] ?? role;
}

/** Lista de roles en texto legible, separada por comas. */
export function formatRoleList(
  roles: string[] | undefined | null,
  empty = "sin rol asignado",
): string {
  if (!roles || roles.length === 0) return empty;
  return roles.map(getRoleLabel).join(", ");
}

/** Roles y áreas de una sesión en texto legible ("Recepción, Bordado"). */
export function formatAccessList(
  access: { roles?: string[] | null; areas?: string[] | null },
  empty = "sin rol asignado",
): string {
  const labels = [...(access.roles ?? []).map(getRoleLabel), ...(access.areas ?? []).map(getAreaLabel)];
  return labels.length > 0 ? labels.join(", ") : empty;
}

/**
 * Cuenta de sucursal (ej. "Punto Madero"): sólo levanta pedidos, usa Mockups y
 * ve SUS pedidos. Es "sólo sucursal" cuando ese es su único rol y no trabaja
 * en ningún área.
 */
export function isBranchOnly(access: SessionAccess | null | undefined): boolean {
  if (!access) return false;
  const { roles, areas } = access;
  return roles.length > 0 && roles.every((r) => r === "sucursal") && areas.length === 0;
}
