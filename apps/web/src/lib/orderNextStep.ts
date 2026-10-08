import { getAreaLabel, PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { getDesignStep } from "@/lib/designStep";
import { effectiveProductionStatusId } from "@/lib/kanbanColumns";
import { canApplyOrderMove } from "@/lib/orderMove";
import {
  CANCELLED_STATUS_ID,
  DELIVERED_STATUS_ID,
  DESIGN_FLOW_STATUS_NAMES,
  FINISHED_STATUS_ID,
  isDesignFlowStatusName,
  statusMap,
} from "@/lib/orderStatus";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import type { Order } from "@/types";

/**
 * "Qué sigue" de un pedido, visto por quien lo mira: la línea de etapas, de
 * quién es el turno y el botón con el verbo de lo que toca. Lo comparten las
 * tarjetas de la vista Lista, la Cuadrícula y el Modo TV.
 *
 * El botón sólo aparece si esta persona puede dar el paso (mismas reglas que
 * el tablero y el detalle: `statusIdsForRoles` + `canApplyOrderMove`), así no
 * se ofrecen acciones que el backend rechaza. Si no le toca, la tarjeta dice
 * a quién sí.
 */

export interface NextStepViewer {
  roles: string[];
  isAdmin: boolean;
  /** Recepción/admin/superuser: siguen y mueven todo el circuito. */
  isManager: boolean;
}

export interface OrderStage {
  key: "diseno" | "pendiente" | "en_proceso" | "terminado" | "entregado";
  label: string;
}

export type OrderStepAction =
  /** Cambio de estado directo (pendiente → en proceso → terminado → entregado). */
  | { kind: "move"; statusId: number; label: string }
  /** El paso se da en el detalle del pedido (diseño, autorización, pruebas de Bordado). */
  | { kind: "open"; label: string };

export interface OrderNextStep {
  stages: OrderStage[];
  /** Índice de la etapa actual en `stages`; -1 si el pedido se canceló. */
  current: number;
  /** De quién es el turno; null si ya no hay nada pendiente (entregado / cancelado). */
  turn: { label: string; mine: boolean } | null;
  action: OrderStepAction | null;
}

const STAGE_BY_STATUS: Record<number, OrderStage["key"]> = {
  1: "pendiente",
  3: "en_proceso",
  4: "terminado",
  5: "entregado",
};

const STAGE_LABEL: Record<OrderStage["key"], string> = {
  diseno: "Diseño",
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
};

/** Verbo del botón según el estado al que lleva. */
export const MOVE_VERB: Record<number, string> = {
  3: "Empezar producción",
  4: "Marcar terminado",
  5: "Entregar",
};

const NEXT_STATUS: Record<number, number> = { 1: 3, 3: 4, 4: 5 };

const PRODUCTION_ROLES = new Set<string>(PRODUCTION_AREA_OPTIONS.map((a) => a.value));

function listAreas(areas: string[]): string {
  const labels = areas.map(getAreaLabel);
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

export function getOrderNextStep(order: Order, viewer: NextStepViewer): OrderNextStep {
  const viewerAreas = viewer.roles.filter((r) => PRODUCTION_ROLES.has(r));
  const stages: OrderStage[] = (
    [...(order.requiresDesign ? ["diseno"] : []), "pendiente", "en_proceso", "terminado", "entregado"] as OrderStage["key"][]
  ).map((key) => ({ key, label: STAGE_LABEL[key] }));
  const indexOf = (key: OrderStage["key"]) => stages.findIndex((s) => s.key === key);

  if (order.statusId === CANCELLED_STATUS_ID) {
    return { stages, current: -1, turn: null, action: null };
  }

  // Circuito de Diseño: se avanza con sus propias acciones, en el detalle.
  const statusName = (order.status?.name ?? "").toLowerCase();
  if (order.requiresDesign && isDesignFlowStatusName(statusName) && statusName !== DESIGN_FLOW_STATUS_NAMES.AUTORIZADO) {
    const step = getDesignStep(order, viewer);
    const designer = viewer.roles.includes("diseno");
    const reception = viewer.isManager;
    let action: OrderStepAction | null = null;
    if (statusName === DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION) {
      if (reception) action = { kind: "open", label: "Registrar respuesta" };
    } else if (designer) {
      action = {
        kind: "open",
        label: statusName === DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS ? "Corregir diseño" : "Abrir diseño",
      };
    }
    return {
      stages,
      current: indexOf("diseno"),
      turn: step ? { label: step.label, mine: step.mine } : { label: "Turno de: Diseño", mine: designer },
      action,
    };
  }

  const effective = effectiveProductionStatusId(order, viewerAreas);
  const stageKey = STAGE_BY_STATUS[effective] ?? "pendiente";
  const current = indexOf(stageKey);

  if (effective === DELIVERED_STATUS_ID) return { stages, current, turn: null, action: null };

  // ¿De quién es el turno? Las áreas con trabajo abierto; sin trabajo abierto,
  // Recepción (entregar).
  const tasks = order.areaTasks ?? [];
  const openTasks = tasks.filter((t) => t.status !== "terminado");
  const myOpen = openTasks.filter((t) => viewerAreas.includes(t.area));
  const productionDone = tasks.length > 0 ? openTasks.length === 0 : order.statusId === FINISHED_STATUS_ID;
  let turn: OrderNextStep["turn"];
  if (productionDone) {
    turn = viewer.isManager ? { label: "Te toca: entregar", mine: true } : { label: "Turno de: Recepción (entregar)", mine: false };
  } else if (myOpen.length > 0) {
    const inPrep = myOpen.find((t) => t.prepStage);
    turn = inPrep
      ? { label: `Te toca: ${inPrep.prepStage === "en_pruebas" ? "prueba de bordado" : "digitalizar"}`, mine: true }
      : { label: "Te toca", mine: true };
  } else if (openTasks.length > 0) {
    turn = { label: `Turno de: ${listAreas(Array.from(new Set(openTasks.map((t) => t.area))))}`, mine: false };
  } else {
    // Sin tareas por área: lo produce el área del pedido.
    const area = order.area && order.area !== "diseno" ? order.area : null;
    const mine = viewer.isManager || (!!area && viewerAreas.includes(area));
    turn = { label: mine ? "Te toca" : `Turno de: ${area ? getAreaLabel(area) : "Producción"}`, mine };
  }

  // Bordado en digitalización / pruebas: el paso se da en el detalle.
  if (myOpen.some((t) => t.prepStage)) {
    return { stages, current, turn, action: { kind: "open", label: "Ver pruebas" } };
  }

  const next = NEXT_STATUS[effective];
  if (!next) return { stages, current, turn, action: null };
  const allowedIds = statusIdsForRoles(viewer.roles);
  // Recepción/admin mueven todo; un área, sólo lo que le toca a ella.
  const allowed = viewer.isManager || (allowedIds.includes(next) && turn?.mine === true);
  const actor = { areas: viewerAreas, isManager: viewer.isManager };
  const action: OrderStepAction | null =
    allowed && canApplyOrderMove(order, next, actor)
      ? { kind: "move", statusId: next, label: MOVE_VERB[next] ?? `Marcar ${statusMap[next]}` }
      : null;
  return { stages, current, turn, action };
}
