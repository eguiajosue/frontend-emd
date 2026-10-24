// Decide, a partir de los roles y las áreas de la sesión, a qué estados de
// pedido (src/lib/orderStatus.ts) puede mover un pedido cada quien.
import type { SessionAccess } from "./areas";

/**
 * Estados del flujo de PRODUCCIÓN que quien trabaja en un área puede fijar en
 * un pedido que ya tiene a la vista.
 *
 * Antes cada área estaba clavada a un solo estado (`[3]`, "en proceso") y
 * Diseño al estado 2 ("en pruebas"), que fue RETIRADO del flujo — o sea que un
 * usuario de Diseño no podía tocar el estado de NINGÚN pedido, y quien
 * trabajaba un área no podía sacar de "pendiente" ni marcar "terminado" lo que
 * ya tenía asignado. Ese era el bug de "no me deja modificar el estatus".
 *
 * Qué pedidos ve cada quien ya lo decide el backend (`GET /orders` filtra por
 * rol, área y asignación); aquí sólo se decide, sobre lo que YA puede ver, a
 * qué estados puede moverlo. Cancelado (10) queda fuera a propósito: dar de
 * baja un pedido es decisión de Recepción, no del área que lo produce.
 *
 * Diseño avanza su propio circuito con las acciones de "Proceso de diseño"
 * (montaje -> esperando autorización -> autorizado), no con el selector
 * manual de estado. Pero cuando además produce un área, sigue el mismo flujo
 * de producción que el resto: por eso cualquier área da estos estados.
 */
const PRODUCTION_FLOW_STATUS_IDS = [1, 3, 4];

/** Estados que da cada ROL (las áreas dan `PRODUCTION_FLOW_STATUS_IDS`). */
export const roleTaskMapping: { [role: string]: number[] } = {
  recepcion: [1, 3, 4, 5, 10], // todo el circuito, incluida la entrega y la baja
};

// Roles que tienen acceso administrativo total (ven el Panel General en vez de "Estatus de Pedidos").
export const ADMIN_ROLES = ["admin", "superuser"];

/** Roles de la matriz y de sucursal: quien tiene alguno no es "sólo operativo". */
const NON_OPERATIONAL_ROLES = ["admin", "superuser", "recepcion", "sucursal"];

export function isAdminRole(roles: string[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/**
 * true si trabaja en al menos un área y no tiene ningún rol de gestión ni de
 * sucursal: sólo necesita ver "Estatus de Pedidos" (antes "Mis Tareas") y
 * "Ayuda" en el sidebar — nada de gestión ni métricas.
 */
export function isOperationalOnly(access: SessionAccess | undefined): boolean {
  if (!access || access.areas.length === 0) return false;
  return !access.roles.some((r) => NON_OPERATIONAL_ROLES.includes(r));
}

/** Estados a los que puede mover un pedido quien tiene estos roles y áreas. */
export function statusIdsFor(access: SessionAccess | undefined): number[] {
  if (!access) return [];
  const ids = new Set<number>();
  access.roles.forEach((role) => {
    (roleTaskMapping[role] || []).forEach((id) => ids.add(id));
  });
  if (access.areas.length > 0) {
    PRODUCTION_FLOW_STATUS_IDS.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}
