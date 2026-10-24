import type { SessionAccess } from "@emd/business/src/areas";
import { isAdminRole } from "@/lib/roleTaskMapping";
import { formatAreaList, productionAreasOf } from "@/lib/areas";

/**
 * Cómo se llama la pantalla de pedidos según quién la mira.
 *
 * Es una sola pantalla — la misma lista y el mismo tablero — pero no significa
 * lo mismo para todos. Recepción administra pedidos de punta a punta: para
 * ellos es "Pedidos". Un bordador no administra nada, sólo ve el trabajo que le
 * toca: llamarle "Pedidos" le sugiere un alcance que no tiene.
 *
 * Antes esto se resolvía con DOS pantallas ("Mi trabajo" y "Pedidos") que para
 * un rol operativo mostraban el mismo trabajo con otra forma.
 */
export interface OrdersScreenCopy {
  title: string;
  description: string;
}

/** Áreas de producción propias del usuario (vacío para recepción/admin sin áreas). */
export function ownProductionAreas(areas: string[]): string[] {
  return productionAreasOf(areas);
}

export function ordersScreenCopy(
  { roles, areas }: SessionAccess,
  options: { canManageOperations: boolean; pendingCount?: number } = {
    canManageOperations: false,
  },
): OrdersScreenCopy {
  if (options.canManageOperations || isAdminRole(roles)) {
    return {
      title: "Pedidos",
      description: "Todos los pedidos de la empresa.",
    };
  }

  const pending = options.pendingCount;
  const description =
    pending === undefined
      ? `El trabajo asignado a tu área: ${formatAreaList(areas)}.`
      : pending === 0
        ? "Sin pendientes por ahora."
        : `${pending} pendiente${pending === 1 ? "" : "s"} en tu${
            areas.length > 1 ? "s áreas" : " área"
          }: ${formatAreaList(areas)}.`;

  return { title: "Tareas asignadas", description };
}

/** Sólo el nombre, para el menú lateral. */
export function ordersScreenTitle(access: SessionAccess): string {
  return ordersScreenCopy(access, {
    canManageOperations: access.roles.includes("recepcion"),
  }).title;
}
