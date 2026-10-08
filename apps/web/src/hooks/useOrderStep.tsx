"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { patchStatusChange } from "@/lib/offlineMutation";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { invalidateSupplyData } from "@/hooks/useAreaSupplies";
import { writeOrderStatus } from "@/hooks/useOrders";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { AREA_TASK_STATUS_BY_ORDER_STATUS, areaTasksToMove } from "@/lib/orderMove";
import { getOrderNextStep, type NextStepViewer, type OrderNextStep } from "@/lib/orderNextStep";
import { statusMap } from "@/lib/orderStatus";
import type { AreaTaskStatus, Order } from "@/types";

/**
 * "Siguiente paso" de las tarjetas de pedidos: se aplica al instante y deja
 * un aviso con "Deshacer" (y la tecla Z) durante unos segundos.
 *
 * Escribe donde el tablero lee (igual que `useMoveOrderStatus`): las tareas de
 * área cuando las hay, el estado del pedido cuando no. Deshacer vuelve cada
 * cosa exactamente a como estaba (cada tarea a su estado anterior).
 */

/** Cuánto dura el aviso con "Deshacer". */
export const UNDO_WINDOW_MS = 8000;

type Snapshot =
  | { kind: "tasks"; orderId: number; tasks: { id: number; status: AreaTaskStatus }[] }
  | { kind: "order"; order: Pick<Order, "id" | "statusId">; previousStatusId: number };

interface OrderStepContextValue {
  viewer: NextStepViewer;
  stepFor: (order: Order) => OrderNextStep;
  /** Da el paso `move` del pedido. Devuelve `true` si se aplicó. */
  advance: (order: Order) => Promise<boolean>;
  /** Deshace el último paso (si sigue dentro de la ventana). */
  undoLast: () => Promise<boolean>;
  canUndo: boolean;
  pendingOrderId: number | null;
}

const OrderStepContext = createContext<OrderStepContextValue | null>(null);

const PRODUCTION_ROLES = new Set<string>(PRODUCTION_AREA_OPTIONS.map((a) => a.value));

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function OrderStepProvider({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { roles, isAdmin, canManageOperations } = usePermissions();
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [last, setLast] = useState<{ snapshot: Snapshot; at: number } | null>(null);
  const lastRef = useRef(last);
  lastRef.current = last;

  const viewer = useMemo<NextStepViewer>(
    () => ({ roles, isAdmin, isManager: canManageOperations }),
    [roles, isAdmin, canManageOperations]
  );
  const stepFor = useCallback((order: Order) => getOrderNextStep(order, viewer), [viewer]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
    queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
    // Terminar (o regresar) una tarea descuenta o devuelve insumos.
    invalidateSupplyData(queryClient);
  }, [queryClient]);

  const writeTasks = useCallback(
    (orderId: number, tasks: { id: number; status: AreaTaskStatus }[]) =>
      Promise.all(
        tasks.map((t) =>
          patchStatusChange(`${ENDPOINTS.orders}/${orderId}/area-tasks/${t.id}/status`, { status: t.status }, token)
        )
      ),
    [token]
  );

  const restore = useCallback(
    async (snapshot: Snapshot) => {
      if (snapshot.kind === "tasks") await writeTasks(snapshot.orderId, snapshot.tasks);
      else await writeOrderStatus(snapshot.order, snapshot.previousStatusId, token);
    },
    [token, writeTasks]
  );

  const undoLast = useCallback(async () => {
    const current = lastRef.current;
    if (!current || Date.now() - current.at > UNDO_WINDOW_MS) return false;
    setLast(null);
    const orderId = current.snapshot.kind === "tasks" ? current.snapshot.orderId : current.snapshot.order.id;
    setPendingOrderId(orderId);
    try {
      await restore(current.snapshot);
      toast.success(`Pedido #${orderId}: cambio deshecho`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo deshacer el cambio."));
      return false;
    } finally {
      setPendingOrderId(null);
      refresh();
    }
  }, [refresh, restore]);

  const advance = useCallback(
    async (order: Order) => {
      const step = getOrderNextStep(order, viewer);
      if (step.action?.kind !== "move") return false;
      const target = step.action.statusId;
      const areaStatus = AREA_TASK_STATUS_BY_ORDER_STATUS[target];
      const areas = viewer.roles.filter((r) => PRODUCTION_ROLES.has(r));
      const tasks = areaStatus
        ? areaTasksToMove(order, { areas, isManager: viewer.isManager }).filter((t) => t.status !== areaStatus)
        : [];

      setPendingOrderId(order.id);
      let snapshot: Snapshot;
      try {
        if (tasks.length > 0 && areaStatus) {
          snapshot = { kind: "tasks", orderId: order.id, tasks: tasks.map((t) => ({ id: t.id, status: t.status })) };
          await writeTasks(
            order.id,
            tasks.map((t) => ({ id: t.id, status: areaStatus }))
          );
        } else {
          snapshot = { kind: "order", order: { id: order.id, statusId: target }, previousStatusId: order.statusId };
          await writeOrderStatus(order, target, token);
        }
      } catch (error) {
        toast.error(errorMessage(error, "No se pudo cambiar el estado del pedido."));
        refresh();
        setPendingOrderId(null);
        return false;
      }
      setPendingOrderId(null);
      refresh();
      setLast({ snapshot, at: Date.now() });
      const toastId = `order-step-${order.id}`;
      toast.success(`Pedido #${order.id} → ${statusMap[target] ?? "actualizado"}`, {
        id: toastId,
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Deshacer",
          onClick: () => {
            // Sólo deshace si sigue siendo el último paso (no el de otro pedido).
            if (lastRef.current?.snapshot === snapshot) void undoLast();
          },
        },
      });
      return true;
    },
    [refresh, token, undoLast, viewer, writeTasks]
  );

  const value = useMemo<OrderStepContextValue>(
    () => ({ viewer, stepFor, advance, undoLast, canUndo: last != null, pendingOrderId }),
    [viewer, stepFor, advance, undoLast, last, pendingOrderId]
  );
  return <OrderStepContext.Provider value={value}>{children}</OrderStepContext.Provider>;
}

/** El contexto del "siguiente paso"; null fuera de la pantalla de Pedidos (las tarjetas quedan de sólo lectura). */
export function useOrderStep(): OrderStepContextValue | null {
  return useContext(OrderStepContext);
}
