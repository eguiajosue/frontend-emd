import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import {
  DESIGN_FLOW_STATUS_NAMES,
  getNextStatusOption,
  isCancelledStatus,
  isDeliveredStatus,
  isDesignFlowStatusName,
  isOrderInDesignStatus,
} from "@/lib/orderStatus";
import type { OrderHandoff } from "@/lib/orderHandoff";
import type { Order } from "@/types";

/**
 * Reglas del detalle de pedido, fuera del JSX: las comparten el diálogo y la
 * página `/dashboard/orders/[id]`, que antes tenían cada una su copia (y la
 * de la página ya no bloqueaba el circuito de diseño).
 */

export interface OrderDetailViewer {
  roles: string[];
  isAdmin: boolean;
  canManageOperations: boolean;
}

export interface OrderDetailPermissions {
  /** Editar descripción, fecha y asignado (admin/superuser/recepción). */
  canEdit: boolean;
  canDelete: boolean;
  /** Historial de estados y de cambios: sólo quien gestiona pedidos. */
  canSeeHistory: boolean;
  /** Puede mover el estado general del pedido a mano. */
  canChangeStatus: boolean;
  /** Estados a los que puede moverlo (`undefined` = todos). */
  allowedStatusIds?: number[];
  /**
   * El pedido está dentro del circuito de diseño (todavía sin autorizar): el
   * estado se avanza sólo con las acciones de "Diseño", nunca a mano, para no
   * saltear la autorización del cliente. Una vez autorizado ya está en
   * producción y Recepción/admin pueden forzar "listo para entregar".
   */
  isInDesignLimbo: boolean;
}

export function getOrderDetailPermissions(
  order: Order,
  viewer: OrderDetailViewer
): OrderDetailPermissions {
  const canSeeHistory = viewer.isAdmin || viewer.roles.includes("recepcion");
  const canEdit = canSeeHistory;
  const myStageIds = statusIdsForRoles(viewer.roles);
  const statusName = order.status?.name;
  const isInDesignLimbo =
    !!order.requiresDesign &&
    isDesignFlowStatusName(statusName) &&
    !isOrderInDesignStatus(statusName, DESIGN_FLOW_STATUS_NAMES.AUTORIZADO);
  return {
    canEdit,
    canDelete: viewer.canManageOperations,
    canSeeHistory,
    canChangeStatus: !isInDesignLimbo && (canEdit || myStageIds.includes(order.statusId)),
    allowedStatusIds: canEdit ? undefined : myStageIds,
    isInDesignLimbo,
  };
}

/**
 * Fecha y hora de entrega para los inputs `date`/`time`, en hora LOCAL.
 *
 * Antes la fecha salía de `iso.slice(0, 10)` (fecha UTC) y la hora de
 * `getHours()` (local): en UTC-6 una entrega a las 20:00 aparecía al día
 * siguiente, y al guardar quedaba corrida de verdad.
 */
export function splitDeliveryDate(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return { date, time: hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "" };
}

/**
 * El botón principal del detalle: lo único que este usuario puede hacer
 * ahora para que el pedido avance.
 *
 * - `section`: la acción vive en una sección del detalle (subir montaje,
 *   registrar la respuesta del cliente, definir áreas); el botón lleva ahí.
 * - `status`: el siguiente estado del flujo lineal, si este rol puede fijarlo.
 * - `null`: no le toca a este usuario; se muestra a quién espera.
 */
export type OrderNextAction =
  | { kind: "section"; section: "design" | "areas"; label: string }
  | { kind: "status"; statusId: number; label: string }
  | null;

export function getOrderNextAction(
  order: Order,
  handoff: OrderHandoff,
  permissions: OrderDetailPermissions,
  viewer: OrderDetailViewer,
  areaTaskCount: number
): OrderNextAction {
  if (isCancelledStatus(order.statusId) || isDeliveredStatus(order.statusId)) return null;
  const stage = handoff.current.key;
  const canDesign = viewer.isAdmin || viewer.roles.includes("diseno");
  const canReception = viewer.isAdmin || viewer.roles.includes("recepcion");

  if (stage === "diseno") {
    return canDesign ? { kind: "section", section: "design", label: "Subir montaje" } : null;
  }
  if (stage === "autorizacion") {
    return canReception
      ? { kind: "section", section: "design", label: "Registrar respuesta del cliente" }
      : null;
  }
  if (stage === "produccion" && areaTaskCount === 0 && permissions.canEdit) {
    return { kind: "section", section: "areas", label: "Definir áreas" };
  }

  if (!permissions.canChangeStatus) return null;
  const next = getNextStatusOption(order.statusId);
  if (!next) return null;
  const allowed =
    viewer.canManageOperations || !permissions.allowedStatusIds || permissions.allowedStatusIds.includes(next.value);
  return allowed ? { kind: "status", statusId: next.value, label: `Marcar ${next.label}` } : null;
}
