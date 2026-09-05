"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { statusMap } from "@/lib/orderStatus";

interface OrderNotificationPayload {
  id: number | string;
  clientName?: string;
  createdBy?: string;
  status?: string;
}

/**
 * Connects to the backend's Socket.io notifications gateway and shows a
 * toast whenever a relevant order notification arrives for the current
 * user's role.
 *
 * Backend events (see notifications.gateway.ts):
 * - "newOrderNotification": emitted only to the "admin" room when a new
 *   order is created.
 * - "orderStatusChangeNotification": broadcast to every connected client
 *   when an order's status changes.
 */
export function useSocket() {
  const { data: session } = useSession();
  const token = session?.user?.token;
  const roles = session?.user?.roles || [];
  const rolesKey = roles.join(",");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!base) return;

    const socket = io(base, {
      transports: ["websocket"],
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      auth: {
        token: `Bearer ${token}`,
      },
    });
    socketRef.current = socket;

    const handleNewOrder = (order: OrderNotificationPayload) => {
      if (!rolesKey.split(",").includes("admin")) return;
      toast.info("Nuevo pedido creado", {
        description: `Pedido #${order.id}${
          order.clientName ? ` de ${order.clientName}` : ""
        }${order.createdBy ? ` creado por ${order.createdBy}` : ""}`,
      });
    };

    const handleStatusChange = (order: OrderNotificationPayload) => {
      const statusLabel = order.status
        ? statusMap[Number(order.status)] || order.status
        : "desconocido";
      toast.info(`Pedido #${order.id} actualizado`, {
        description: `Nuevo estado: ${statusLabel.toString().toUpperCase()}`,
      });
    };

    socket.on("newOrderNotification", handleNewOrder);
    socket.on("orderStatusChangeNotification", handleStatusChange);

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    return () => {
      socket.off("newOrderNotification", handleNewOrder);
      socket.off("orderStatusChangeNotification", handleStatusChange);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, rolesKey]);

  return socketRef;
}
