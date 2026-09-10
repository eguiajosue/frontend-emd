import {
  statusMap,
  isDesignFlowStatusName,
  DESIGN_BOARD_STATUS_NAMES,
  PRODUCTION_BOARD_STATUS_IDS,
  DESIGN_FLOW_STATUS_NAMES,
  isOrderInDesignStatus,
  CANCELLED_STATUS_ID,
  DELIVERED_STATUS_ID,
} from "./orderStatus";
import type { AreaTaskStatus, Order, Status } from "@emd/types";

export interface KanbanColumnData {
  statusId: number;
  label: string;
  orders: Order[];
}

/**
 * Estado de producción "efectivo" de un pedido para el tablero.
 *
 * `order.statusId` NO alcanza: desde que el cliente autoriza el montaje, el
 * pedido queda en "autorizado" — que es información del circuito de Diseño —
 * mientras el trabajo real de cada área arranca en "pendiente" en su propia
 * `OrderAreaTask` (ver WORKFLOW.md §3). Si el tablero agrupara por `statusId`,
 * un pedido recién autorizado le aparecería a Bordado en una columna
 * "autorizado" en vez de en "pendiente", que es lo que el área espera ver.
 *
 * `viewerAreas` son las áreas del usuario que mira: si tiene tarea en alguna,
 * manda esa. Si no (recepción/admin, que ven todo), manda la tarea MENOS
 * avanzada, porque el pedido no está terminado hasta que terminan todas.
 */
export function effectiveProductionStatusId(
  order: Order,
  viewerAreas: string[] = [],
): number {
  // Entregado y cancelado son estados del pedido entero: ninguna tarea de área
  // los contradice.
  if (order.statusId === DELIVERED_STATUS_ID) return DELIVERED_STATUS_ID;
  if (order.statusId === CANCELLED_STATUS_ID) return CANCELLED_STATUS_ID;

  const tasks = order.areaTasks ?? [];
  if (tasks.length === 0) {
    // Sin tareas por área: un pedido "autorizado" ya está listo para producir,
    // o sea "pendiente" para quien lo va a trabajar.
    if (isOrderInDesignStatus(order.status?.name, DESIGN_FLOW_STATUS_NAMES.AUTORIZADO)) {
      return 1;
    }
    return order.statusId;
  }

  const mine = tasks.filter((task) => viewerAreas.includes(task.area));
  const relevant = mine.length > 0 ? mine : tasks;
  const rank: Record<AreaTaskStatus, number> = {
    pendiente: 0,
    en_proceso: 1,
    terminado: 2,
  };
  const least = relevant.reduce((acc, task) =>
    rank[task.status] < rank[acc.status] ? task : acc,
  );
  return { pendiente: 1, en_proceso: 3, terminado: 4 }[least.status];
}

/**
 * Columnas del tablero de PRODUCCIÓN: siempre las mismas cinco (pendiente, en
 * proceso, terminado, entregado, cancelado), estén vacías o no, para que el
 * tablero no cambie de forma según haya trabajo o no en cada etapa.
 *
 * Los 4 estados del circuito de Diseño NO aparecen acá: son otro flujo, con
 * otro tablero. Mezclarlos era exactamente lo que hacía que la vista de un
 * diseñador que además produce se viera revuelta.
 */
export function buildProductionColumns(
  orders: Order[],
  viewerAreas: string[] = [],
): KanbanColumnData[] {
  const byStatus = new Map<number, Order[]>(
    PRODUCTION_BOARD_STATUS_IDS.map((id) => [id, [] as Order[]]),
  );

  orders.forEach((order) => {
    const statusId = effectiveProductionStatusId(order, viewerAreas);
    const bucket = byStatus.get(statusId);
    if (bucket) bucket.push(order);
    // Un estado que no es de producción no inventa columna: el pedido ya está
    // en el tablero de Diseño.
  });

  return PRODUCTION_BOARD_STATUS_IDS.map((statusId) => ({
    statusId,
    label: statusMap[statusId] ?? `Estado ${statusId}`,
    orders: byStatus.get(statusId) ?? [],
  }));
}

/**
 * Columnas del tablero de DISEÑO: pendiente + las 4 etapas del circuito de
 * montaje, en orden y siempre visibles.
 *
 * Los ids de los estados de Diseño los siembra el backend y cambian entre
 * entornos, así que se resuelven por NOMBRE contra el catálogo de `GET /status`
 * (`statuses`). Mientras ese catálogo no haya cargado se arma con los estados
 * que traigan los propios pedidos, para no dejar el tablero en blanco.
 */
export function buildDesignColumns(
  orders: Order[],
  statuses: Status[] = [],
): KanbanColumnData[] {
  const idByName = new Map<string, number>();
  statuses.forEach((status) => {
    if (status?.name) idByName.set(status.name.toLowerCase(), status.id);
  });
  orders.forEach((order) => {
    const name = order.status?.name?.toLowerCase();
    if (name && !idByName.has(name)) idByName.set(name, order.statusId);
  });

  return DESIGN_BOARD_STATUS_NAMES.map((name) => {
    const statusId = idByName.get(name);
    return {
      // Sin id conocido la columna se muestra igual (vacía) con una clave
      // negativa estable, para no colapsar el tablero por un catálogo que
      // todavía no llegó.
      statusId: statusId ?? -(DESIGN_BOARD_STATUS_NAMES.indexOf(name) + 1),
      label: name,
      orders: orders.filter(
        (order) => (order.status?.name ?? "").toLowerCase() === name,
      ),
    };
  });
}

/**
 * Parte los pedidos en los dos circuitos del taller.
 *
 * Un pedido "autorizado" cae en LOS DOS: para Diseño es el cierre de su
 * trabajo (columna "autorizado") y para el área que lo va a producir es el
 * arranque del suyo (columna "pendiente"). Es el paso que pidió el flujo:
 * recepción → diseño → recepción (autorización) → autorizado en Diseño y
 * pendiente en el área.
 */
export function splitDesignAndProduction(orders: Order[]): {
  design: Order[];
  production: Order[];
} {
  const design: Order[] = [];
  const production: Order[] = [];
  orders.forEach((order) => {
    const name = order.status?.name;
    const inDesignFlow = isDesignFlowStatusName(name);
    if (inDesignFlow) design.push(order);
    if (
      !inDesignFlow ||
      isOrderInDesignStatus(name, DESIGN_FLOW_STATUS_NAMES.AUTORIZADO)
    ) {
      production.push(order);
    }
  });
  return { design, production };
}
