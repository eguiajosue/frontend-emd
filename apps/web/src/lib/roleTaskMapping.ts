// Mapea cada rol (ver backend src/common/enums/roles.enum.ts) a los estados de
// pedido (src/lib/orderStatus.ts) a los que ese rol puede mover un pedido.

/**
 * Estados del flujo de PRODUCCIÓN que un rol operativo puede fijar en un
 * pedido que ya tiene a la vista.
 *
 * Antes cada área estaba clavada a un solo estado (`[3]`, "en proceso") y
 * Diseño al estado 2 ("en pruebas"), que fue RETIRADO del flujo — o sea que un
 * usuario con rol `diseno` no podía tocar el estado de NINGÚN pedido, y quien
 * trabajaba un área no podía sacar de "pendiente" ni marcar "terminado" lo que
 * ya tenía asignado. Ese era el bug de "no me deja modificar el estatus".
 *
 * Qué pedidos ve cada quien ya lo decide el backend (`GET /orders` filtra por
 * rol, área y asignación); acá sólo se decide, sobre lo que YA puede ver, a
 * qué estados puede moverlo. Cancelado (10) queda fuera a propósito: dar de
 * baja un pedido es decisión de Recepción, no del área que lo produce.
 */
const PRODUCTION_FLOW_STATUS_IDS = [1, 3, 4];

export const roleTaskMapping: { [role: string]: number[] } = {
  recepcion: [1, 3, 4, 5, 10], // todo el circuito, incluida la entrega y la baja
  taller: PRODUCTION_FLOW_STATUS_IDS,
  dtf: PRODUCTION_FLOW_STATUS_IDS,
  bordado: PRODUCTION_FLOW_STATUS_IDS,
  laser: PRODUCTION_FLOW_STATUS_IDS,
  impresiones: PRODUCTION_FLOW_STATUS_IDS,
  // Diseño avanza su propio circuito con las acciones de "Proceso de diseño"
  // (montaje -> esperando autorización -> autorizado), no con el selector
  // manual de estado. Pero cuando además produce un área, sigue el mismo
  // flujo de producción que el resto.
  diseno: PRODUCTION_FLOW_STATUS_IDS,
};

// Roles que tienen acceso administrativo total (ven el Panel General en vez de "Estatus de Pedidos").
export const ADMIN_ROLES = ["admin", "superuser"];

// Roles puramente operativos/de producción: sólo necesitan ver "Estatus de Pedidos"
// (antes "Mis Tareas") y "Ayuda" en el sidebar — nada de gestión ni métricas.
export const OPERATIONAL_ROLES = [
  "dtf",
  "bordado",
  "diseno",
  "laser",
  "taller",
  "impresiones",
];

export function isAdminRole(roles: string[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** true si el usuario tiene al menos un rol y TODOS sus roles son operativos (sin admin/recepcion). */
export function isOperationalOnly(roles: string[] | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.every((r) => OPERATIONAL_ROLES.includes(r));
}

export function statusIdsForRoles(roles: string[] | undefined): number[] {
  if (!roles) return [];
  const ids = new Set<number>();
  roles.forEach((role) => {
    (roleTaskMapping[role] || []).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
}
