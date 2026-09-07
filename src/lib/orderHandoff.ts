import {
  DESIGN_FLOW_STATUS_NAMES,
  isOrderInDesignStatus,
  isDeliveredStatus,
  isCancelledStatus,
  isFinishedStatus,
  isDesignFlowStatusName,
} from "@/lib/orderStatus";

/** Estado inicial: el pedido todavía no entró a ningún circuito. */
const PENDING_STATUS_ID = 1;
import { getAreaLabel } from "@/lib/areas";
import { getAssignedUserName } from "@/lib/format";
import type { Order, OrderAreaTask } from "@/types";

/**
 * El "pase" de un pedido: la cadena de manos por las que va pasando, desde que
 * Recepción lo carga hasta que se entrega.
 *
 * Existe porque el estado del pedido, por sí solo, no dice de quién es el
 * trabajo AHORA. Un pedido "esperando autorización" está en manos de Recepción,
 * no de Diseño, aunque su área siga siendo Diseño; uno "autorizado" ya no es de
 * nadie del circuito de diseño y es de cada área de producción a la vez. Sin
 * esto, cada rol tenía que deducir de qué lado de la pelota estaba mirando un
 * badge de estado y una lista de tareas.
 */
export type HandoffStageKey =
  | "recepcion"
  | "diseno"
  | "autorizacion"
  | "produccion"
  | "entrega";

export type HandoffStageState = "done" | "current" | "pending" | "blocked";

export interface HandoffStage {
  key: HandoffStageKey;
  label: string;
  state: HandoffStageState;
  /** Quién tiene el trabajo en esta etapa, ya en texto legible. */
  holder?: string;
  /** Detalle corto de la etapa (estado del área, ronda de diseño, etc.). */
  detail?: string;
}

export interface OrderHandoff {
  stages: HandoffStage[];
  /** Etapa donde está el pedido ahora. */
  current: HandoffStage;
  /** Frase corta: de quién es el trabajo en este momento. */
  holderLabel: string;
  /** Qué tiene que pasar para que el pedido avance, en lenguaje del taller. */
  nextStep: string;
  /** `true` si el pedido está cancelado: la cadena queda cortada. */
  cancelled: boolean;
}

function taskHolder(task: OrderAreaTask): string {
  const name = getAssignedUserName(task.assignedUser);
  if (!name) return "sin asignar";
  return task.assignedUser?.isSharedAccount ? `${getAreaLabel(task.area)}` : name;
}

const AREA_TASK_LABEL: Record<OrderAreaTask["status"], string> = {
  pendiente: "sin empezar",
  en_proceso: "en proceso",
  terminado: "terminado",
};

/** Resumen de producción: qué áreas hay y en qué va cada una. */
function productionDetail(tasks: OrderAreaTask[]): string {
  if (tasks.length === 0) return "sin áreas asignadas";
  return tasks
    .map((task) => `${getAreaLabel(task.area)}: ${AREA_TASK_LABEL[task.status]}`)
    .join(" · ");
}

/** Quién tiene el trabajo de producción: las áreas que todavía no terminaron. */
function productionHolder(tasks: OrderAreaTask[]): string {
  const pending = tasks.filter((task) => task.status !== "terminado");
  if (tasks.length === 0) return "falta definir el área";
  if (pending.length === 0) return "todas terminaron";
  // Dos áreas a nombre de la misma persona no se nombran dos veces.
  return [...new Set(pending.map(taskHolder))].join(", ");
}

/**
 * `tasks` llega aparte y no de `order.areaTasks`: el detalle
 * (`GET /orders/:id`) no las incluye — sólo el listado —, así que quien renderiza
 * pasa las de `useAreaTasks`, que el detalle ya consulta igual.
 */
/**
 * `tasks` llega aparte y no de `order.areaTasks`: el detalle
 * (`GET /orders/:id`) no las incluye — sólo el listado —, así que quien
 * renderiza pasa las de `useAreaTasks`, que el detalle ya consulta igual.
 */
export function buildOrderHandoff(
  order: Order,
  tasks: OrderAreaTask[] = order.areaTasks ?? [],
): OrderHandoff {
  const statusName = order.status?.name;
  const delivered = isDeliveredStatus(order.statusId);
  const cancelled = isCancelledStatus(order.statusId);

  const inDesign =
    isOrderInDesignStatus(statusName, DESIGN_FLOW_STATUS_NAMES.EN_DISENO) ||
    isOrderInDesignStatus(statusName, DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS);
  const changesRequested = isOrderInDesignStatus(
    statusName,
    DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS,
  );
  const waitingAuth = isOrderInDesignStatus(
    statusName,
    DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION,
  );
  const authorized = isOrderInDesignStatus(
    statusName,
    DESIGN_FLOW_STATUS_NAMES.AUTORIZADO,
  );

  const productionDone = tasks.length > 0 && tasks.every((t) => t.status === "terminado");
  const productionStarted = tasks.some((t) => t.status !== "pendiente");
  // El pedido ya dejó atrás el circuito de diseño: o está autorizado, o su
  // estado ya no es ninguno de los cuatro de diseño ni el "pendiente" inicial.
  //
  // NO se puede deducir de que existan tareas de área: Recepción define las
  // áreas destino mientras el pedido todavía está en diseño (es el único lugar
  // donde se eligen), así que un pedido en diseño puede tener tareas ya
  // planificadas sin haber salido del circuito.
  const pastDesign =
    authorized ||
    delivered ||
    isFinishedStatus(order.statusId) ||
    (!isDesignFlowStatusName(statusName) && order.statusId !== PENDING_STATUS_ID);
  // Con diseño pero sin ninguna ronda todavía: sigue en manos de Recepción.
  const beforeDesign = !!order.requiresDesign && !inDesign && !waitingAuth && !pastDesign;

  // El destino ya está elegido pero el trabajo no puede empezar hasta que el
  // cliente autorice. Distinto de "todavía no le toca": el área ya sabe que le
  // va a caer, y decirlo evita que crea que se traspapeló.
  const plannedAreas = tasks.map((task) => task.area);
  const productionBlocked =
    !!order.requiresDesign &&
    !pastDesign &&
    (plannedAreas.length > 0 || !!order.productionArea);

  // Orden de la cadena, y en qué eslabón está el pedido AHORA. Se calcula una
  // sola vez y los estados se derivan de la posición: así nunca hay dos etapas
  // "actuales" ni una etapa encendida detrás de otra.
  const keys: HandoffStageKey[] = order.requiresDesign
    ? ["recepcion", "diseno", "autorizacion", "produccion", "entrega"]
    : ["recepcion", "produccion", "entrega"];

  let currentKey: HandoffStageKey;
  if (delivered) currentKey = "entrega";
  else if (productionDone) currentKey = "entrega";
  else if (inDesign) currentKey = "diseno";
  else if (waitingAuth) currentKey = "autorizacion";
  else if (beforeDesign) currentKey = "recepcion";
  else currentKey = "produccion";

  const currentIndex = keys.indexOf(currentKey);
  const stateFor = (key: HandoffStageKey): HandoffStageState => {
    const index = keys.indexOf(key);
    if (index < currentIndex) return "done";
    if (index === currentIndex) return "current";
    if (key === "produccion" && productionBlocked) return "blocked";
    return "pending";
  };

  const detailFor = (key: HandoffStageKey): string | undefined => {
    switch (key) {
      case "recepcion":
        return beforeDesign ? "falta pasarlo a Diseño" : "pedido cargado";
      case "diseno":
        if (changesRequested) return "el cliente pidió cambios";
        if (inDesign) return "armando el montaje";
        return beforeDesign ? undefined : "montaje enviado";
      case "autorizacion":
        if (waitingAuth) return "esperando respuesta del cliente";
        return pastDesign ? "el cliente autorizó" : undefined;
      case "produccion":
        if (productionBlocked) {
          const areas =
            plannedAreas.length > 0
              ? plannedAreas.map(getAreaLabel).join(", ")
              : getAreaLabel(order.productionArea);
          return `${areas}: no empieza hasta la autorización`;
        }
        if (stateFor("produccion") === "pending") return undefined;
        return productionDetail(tasks);
      case "entrega":
        return delivered ? "entregado" : productionDone ? "listo para entregar" : undefined;
    }
  };

  const holderFor = (key: HandoffStageKey): string => {
    switch (key) {
      case "diseno":
        return getAssignedUserName(order.assignedUser) ?? "Diseño";
      case "produccion":
        return productionHolder(tasks);
      default:
        return "Recepción";
    }
  };

  const stages: HandoffStage[] = keys.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    state: stateFor(key),
    holder: holderFor(key),
    detail: detailFor(key),
  }));

  const current = stages[currentIndex];

  let nextStep: string;
  if (cancelled) nextStep = "El pedido está cancelado.";
  else if (delivered) nextStep = "El pedido ya se entregó.";
  else if (currentKey === "recepcion") nextStep = "Recepción pasa el pedido a Diseño.";
  else if (currentKey === "diseno")
    nextStep = changesRequested
      ? "Diseño corrige el montaje y lo vuelve a mandar a Recepción."
      : "Diseño sube el montaje y lo manda a Recepción.";
  else if (currentKey === "autorizacion")
    nextStep = "Recepción registra la respuesta del cliente: autorizado o cambios.";
  else if (currentKey === "entrega") nextStep = "Recepción confirma la entrega al cliente.";
  else if (tasks.length === 0) nextStep = "Falta definir qué área produce el pedido.";
  else
    nextStep = productionStarted
      ? "Cada área marca su parte como terminada."
      : "El área toma el pedido y lo empieza.";

  return {
    stages,
    current,
    holderLabel: current.holder ?? "sin asignar",
    nextStep,
    cancelled,
  };
}

const STAGE_LABELS: Record<HandoffStageKey, string> = {
  recepcion: "Recepción",
  diseno: "Diseño",
  autorizacion: "Autorización",
  produccion: "Producción",
  entrega: "Entrega",
};
