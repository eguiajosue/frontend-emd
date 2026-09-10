/**
 * Etiquetas legibles de los roles del backend (`src/common/enums/roles.enum.ts`).
 *
 * Los valores del enum son slugs ASCII sin acentos (`diseno`, `laser`) porque
 * viajan en el JWT y en la URL. Nunca deben mostrarse crudos en pantalla: el
 * usuario ve "Diseño" y "Láser", no "diseno" ni "laser". Usar `getRoleLabel`
 * en TODO texto de interfaz que muestre un rol.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  superuser: "Superusuario",
  recepcion: "Recepción",
  diseno: "Diseño",
  taller: "Taller",
  dtf: "DTF",
  bordado: "Bordado",
  laser: "Láser",
  impresiones: "Impresiones",
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
