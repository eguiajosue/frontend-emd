import { DESIGN_FLOW_STATUS_NAMES, isDesignFlowStatusName } from "@/lib/orderStatus";
import type { Order } from "@/types";

export interface DesignStep {
  /** Texto corto para la tarjeta: quién tiene el pedido ahora. */
  label: string;
  /** `true` si el paso es de quien mira: se resalta ("te toca"). */
  mine: boolean;
  /** Volvió de Recepción con cambios del cliente. */
  returned: boolean;
}

/**
 * Paso del circuito de diseño visto por cada rol, para las tarjetas del
 * tablero. Antes un pedido en diseño mostraba "—" donde va la acción, y un
 * pedido que volvía con cambios se veía igual que uno nuevo.
 */
export function getDesignStep(
  order: Pick<Order, "requiresDesign" | "status">,
  viewer: { roles: string[]; isAdmin: boolean }
): DesignStep | null {
  const name = (order.status?.name ?? "").toLowerCase();
  if (!order.requiresDesign || !isDesignFlowStatusName(name)) return null;
  const isDesigner = viewer.roles.includes("diseno");
  const isReception = viewer.isAdmin || viewer.roles.includes("recepcion");

  if (name === DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS) {
    return isDesigner
      ? { label: "Te toca: corregir", mine: true, returned: true }
      : { label: "Volvió a Diseño con cambios", mine: false, returned: true };
  }
  if (name === DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION) {
    return isReception
      ? { label: "Te toca: respuesta del cliente", mine: true, returned: false }
      : { label: "Esperando al cliente", mine: false, returned: false };
  }
  if (name === DESIGN_FLOW_STATUS_NAMES.EN_DISENO) {
    return isDesigner
      ? { label: "Te toca: montaje", mine: true, returned: false }
      : { label: "En Diseño", mine: false, returned: false };
  }
  return null;
}
