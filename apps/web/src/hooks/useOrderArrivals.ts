"use client";

import { useContext, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { ChatSocketContext } from "@/hooks/useSocket";
import {
  arrivalFromAssigned,
  arrivalFromNewOrder,
  type AssignedOrderPayload,
  type NewOrderPayload,
  type PackageArrival,
} from "@/lib/packageArrivals";

/** Cada cuánto se revisa si el socket del layout cambió (reconexión con otro token). */
const SOCKET_CHECK_MS = 1000;

/**
 * Escucha los avisos de trabajo nuevo sobre el socket ÚNICO de la app (el de
 * `useSocket`, compartido por `ChatSocketContext`) y los entrega como
 * llegadas de paquete. No abre un segundo socket ni toca los toasts: suma sus
 * propios listeners y los quita al desmontar.
 *
 * El ref del socket se llena en el efecto del layout, que corre DESPUÉS que
 * los de sus hijos; por eso se revisa cada segundo hasta tenerlo (y de nuevo
 * si cambia la instancia).
 */
export function useOrderArrivals(onArrival: (arrival: PackageArrival) => void, enabled = true) {
  const socketRef = useContext(ChatSocketContext);
  const onArrivalRef = useRef(onArrival);
  onArrivalRef.current = onArrival;

  useEffect(() => {
    if (!enabled || !socketRef) return;
    let attached: Socket | null = null;

    const handleNewOrder = (payload: NewOrderPayload) => {
      const arrival = arrivalFromNewOrder(payload);
      if (arrival) onArrivalRef.current(arrival);
    };
    const handleAssigned = (payload: AssignedOrderPayload) => {
      const arrival = arrivalFromAssigned(payload);
      if (arrival) onArrivalRef.current(arrival);
    };

    const detach = () => {
      attached?.off("newOrderNotification", handleNewOrder);
      attached?.off("newAssignedOrderNotification", handleAssigned);
      attached = null;
    };
    const sync = () => {
      const current = socketRef.current;
      if (current === attached) return;
      detach();
      if (!current) return;
      current.on("newOrderNotification", handleNewOrder);
      current.on("newAssignedOrderNotification", handleAssigned);
      attached = current;
    };

    sync();
    const interval = setInterval(sync, SOCKET_CHECK_MS);
    return () => {
      clearInterval(interval);
      detach();
    };
  }, [enabled, socketRef]);
}
