import {
  DESIGN_FLOW_STATUS_NAMES,
  isDesignFlowStatusName,
  isOrderInDesignStatus,
} from "@/lib/orderStatus";
import type { Order } from "@/types";

/**
 * Áreas que hay que mostrar como etiqueta en la tarjeta de un pedido.
 *
 * `Order.area` sola no alcanza. Es un campo singular, anterior al modelo
 * multi-área: un pedido que va a Bordado Y DTF mostraba una sola de las dos.
 * Y mientras el pedido pasa por el circuito de diseño el área que importa es
 * Diseño, sin importar qué destino ya tenga planificado — el trabajo todavía es
 * de Diseño.
 *
 * Al autorizarse, la etiqueta de Diseño desaparece y entran las de las áreas
 * que efectivamente lo van a producir, que son sus `OrderAreaTask`.
 */
export function orderAreaTags(order: Order): string[] {
  const statusName = order.status?.name;
  const authorized = isOrderInDesignStatus(
    statusName,
    DESIGN_FLOW_STATUS_NAMES.AUTORIZADO,
  );

  // En diseño (montaje, espera de autorización, cambios): el pedido es de
  // Diseño, aunque el destino de producción ya esté elegido.
  if (isDesignFlowStatusName(statusName) && !authorized) return ["diseno"];

  const taskAreas = (order.areaTasks ?? []).map((task) => task.area);
  if (taskAreas.length > 0) return [...new Set(taskAreas)];

  // Sin tareas todavía: el destino planificado, o el área cruda del pedido.
  const fallback = authorized
    ? (order.productionArea ?? order.area)
    : (order.area ?? order.productionArea);
  return fallback ? [fallback] : [];
}
