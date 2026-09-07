import { statusMap, isDesignFlowStatusName } from "@/lib/orderStatus";
import type { Order } from "@/types";

export interface KanbanColumnData {
  statusId: number;
  label: string;
  orders: Order[];
}

/**
 * Columnas de un tablero a partir de los pedidos que realmente hay.
 *
 * Importante: las columnas NO pueden derivarse sólo de `statusMap`. Ese mapa
 * cubre los estados de producción (1/3/4/5/10) pero deja fuera los 4 del flujo
 * de Diseño, cuyos ids los siembra el backend y varían entre entornos — por eso
 * se resuelven por nombre. Armar el tablero desde `statusMap` hacía que los
 * pedidos "en diseño" aparecieran en la vista de lista pero desaparecieran de
 * la cuadrícula, porque no encajaban en ninguna columna.
 *
 * Los estados de producción conocidos se incluyen aunque estén vacíos, para que
 * el tablero no cambie de forma según haya trabajo o no en cada etapa. Los de
 * Diseño sólo aparecen si hay pedidos en ellos, ya que su id no se conoce de
 * antemano.
 */
export function buildKanbanColumns(orders: Order[]): KanbanColumnData[] {
  const byStatus = new Map<number, { label: string; orders: Order[] }>();

  orders.forEach((order) => {
    const entry = byStatus.get(order.statusId);
    if (entry) {
      entry.orders.push(order);
      return;
    }
    byStatus.set(order.statusId, {
      label:
        order.status?.name ?? statusMap[order.statusId] ?? `Estado ${order.statusId}`,
      orders: [order],
    });
  });

  Object.entries(statusMap).forEach(([id, label]) => {
    const statusId = Number(id);
    if (!byStatus.has(statusId)) {
      byStatus.set(statusId, { label, orders: [] });
    }
  });

  return [...byStatus.entries()]
    .sort(([a], [b]) => a - b)
    .map(([statusId, value]) => ({ statusId, ...value }));
}

/**
 * Parte los pedidos en los dos circuitos del taller: el de Diseño (montajes
 * hasta la autorización del cliente) y el de producción. Son flujos con etapas
 * distintas, así que se muestran como dos tableros separados a quien trabaja en
 * ambos. Ver WORKFLOW.md §4 en el backend.
 */
export function splitDesignAndProduction(orders: Order[]): {
  design: Order[];
  production: Order[];
} {
  const design: Order[] = [];
  const production: Order[] = [];
  orders.forEach((order) => {
    if (isDesignFlowStatusName(order.status?.name)) design.push(order);
    else production.push(order);
  });
  return { design, production };
}
