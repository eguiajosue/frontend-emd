"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { statusMap } from "@/lib/orderStatus";
import { SOCKET_URL } from "@/lib/config";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    if (!SOCKET_URL) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      auth: {
        token: `Bearer ${token}`,
      },
    });
    socketRef.current = socket;

    // Cualquier notificación del backend invalida la cache de pedidos, así todas
    // las pantallas abiertas se refrescan solas en background.
    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      queryClient.invalidateQueries({ queryKey: queryKeys.all("orderHistories") });
    };

    const handleNewOrder = (order: OrderNotificationPayload) => {
      invalidateOrders();
      if (!rolesKey.split(",").includes("admin")) return;
      toast.info("Nuevo pedido creado", {
        description: `Pedido #${order.id}${
          order.clientName ? ` de ${order.clientName}` : ""
        }${order.createdBy ? ` creado por ${order.createdBy}` : ""}`,
      });
    };

    const handleStatusChange = (order: OrderNotificationPayload) => {
      invalidateOrders();
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
      // No loguear headers/token: sólo el mensaje del error de conexión.
      if (process.env.NODE_ENV === "development") {
        console.error("Socket connection error:", err.message);
      }
    });

    return () => {
      socket.off("newOrderNotification", handleNewOrder);
      socket.off("orderStatusChangeNotification", handleStatusChange);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, rolesKey, queryClient]);

  return socketRef;
}
