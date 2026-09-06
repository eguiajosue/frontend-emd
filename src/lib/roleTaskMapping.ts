// Mapea cada rol operativo (definido en el backend, ver src/common/enums/roles.enum.ts)
// a la(s) etapa(s)/status de pedido (ver src/lib/orderStatus.ts) que le corresponde atender.
//
// El sistema actual solo maneja 5 estados genéricos de pedido (pendiente, en pruebas,
// en proceso, terminado, entregado) — no hay un status por área de producción (dtf,
// bordado, diseno, laser, impresiones, etc). Mientras el backend no exponga estados más
// granulares, cada rol de producción se asocia a la etapa "en proceso" (donde se realiza
// el trabajo de taller/producción) y "en pruebas" (control de calidad), y "recepcion" se
// asocia a "pendiente" (captura/confirmación de pedidos nuevos) y "entregado" (logística
// de entrega). Ajustar este mapeo aquí si el backend agrega estados específicos por área.
export const roleTaskMapping: { [role: string]: number[] } = {
  recepcion: [1, 5], // pendiente, entregado
  taller: [3], // en proceso
  dtf: [3], // en proceso
  bordado: [3], // en proceso
  diseno: [2], // en pruebas (diseño/aprobación previa)
  laser: [3], // en proceso
  impresiones: [3], // en proceso
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
