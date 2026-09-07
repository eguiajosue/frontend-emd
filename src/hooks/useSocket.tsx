"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Bell, MessageSquare } from "lucide-react";
import { statusMap } from "@/lib/orderStatus";
import { SOCKET_URL } from "@/lib/config";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { playNotificationSound } from "@/lib/sound";

/** Payload de "chatMessage" (ver ChatService.sendMessage en el backend). */
interface ChatMessagePayload {
  id: number;
  conversationId: number;
  body: string;
  createdAt: string;
  senderId: number;
  senderUsername?: string;
  senderName?: string;
}

interface OrderNotificationPayload {
  id: number | string;
  clientName?: string;
  createdBy?: string;
  status?: string;
}

/** Payload de "newAssignedOrderNotification" (ver contrato del backend). */
interface AssignedOrderNotificationPayload {
  orderId: number | string;
  description?: string;
  area?: string;
  deliveryDate?: string;
  clientName?: string;
}

/** Duración (ms) del toast destacado de pedido asignado/nuevo para el área. */
const HIGHLIGHT_TOAST_DURATION_MS = 9000;

/**
 * Connects to the backend's Socket.io notifications gateway and shows a
 * toast whenever a relevant order notification arrives for the current
 * user's role.
 *
 * Backend events (see notifications.gateway.ts):
 * - "newOrderNotification": emitted a la room del área/rol cuando un pedido se
 *   crea SIN asignar a nadie en particular (además de al admin).
 * - "newAssignedOrderNotification": emitido SOLO al usuario específico cuando
 *   un pedido se crea con `assignedUserId` apuntando a él. Se muestra con un
 *   toast más visible + sonido, porque requiere su atención directa.
 * - "orderStatusChangeNotification": broadcast to every connected client
 *   when an order's status changes.
 * - "chatMessage": mensaje del chat interno, emitido SOLO a las rooms
 *   individuales de los miembros de la conversación (la membresía la resuelve
 *   el backend). Refresca la cache del chat y avisa con un toast cuando el
 *   usuario no está mirando la pantalla del chat.
 *
 * Esta es la ÚNICA conexión de Socket.io de la app (se monta una vez en el
 * layout del dashboard): cualquier feature nueva debe engancharse acá en vez
 * de abrir un segundo socket.
 */
export function useSocket() {
  const { data: session } = useSession();
  const token = session?.user?.token;
  const roles = session?.user?.roles || [];
  const rolesKey = roles.join(",");
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  // La ruta actual se lee por ref para no reconectar el socket al navegar.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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
      // Cualquier evento de pedido implica una notificación nueva en el backend
      // (asignación, cambio de estado): refrescamos la campanita al toque, sin
      // esperar el poll de 30s.
      queryClient.invalidateQueries({ queryKey: queryKeys.all("notifications") });
    };

    // Toast destacado (más duración, ícono grande) + sonido, para notificaciones
    // que requieren atención directa del usuario: un pedido asignado a él, o un
    // pedido nuevo llegado a la room de su área/rol.
    const showHighlightedOrderToast = (
      title: string,
      details: { description?: string | null; area?: string | null; clientName?: string | null }
    ) => {
      playNotificationSound();
      const descriptionParts = [
        details.description || undefined,
        details.area ? `Área: ${details.area}` : undefined,
        details.clientName ? `Cliente: ${details.clientName}` : undefined,
      ].filter(Boolean);
      toast(title, {
        description: descriptionParts.join(" · ") || undefined,
        duration: HIGHLIGHT_TOAST_DURATION_MS,
        icon: <Bell className="h-5 w-5" />,
        className: "text-base",
      });
    };

    const isAdmin = rolesKey.split(",").includes("admin");

    const handleNewOrder = (order: OrderNotificationPayload) => {
      invalidateOrders();
      if (isAdmin) {
        toast.info("Nuevo pedido creado", {
          description: `Pedido #${order.id}${
            order.clientName ? ` de ${order.clientName}` : ""
          }${order.createdBy ? ` creado por ${order.createdBy}` : ""}`,
        });
        return;
      }
      // Llega a esta room (área/rol) porque el pedido se creó sin asignar a
      // nadie en particular y corresponde al área del usuario actual.
      showHighlightedOrderToast(`Nuevo pedido #${order.id} en tu área`, {
        clientName: order.clientName,
      });
    };

    const handleAssignedOrder = (order: AssignedOrderNotificationPayload) => {
      invalidateOrders();
      showHighlightedOrderToast(`Pedido #${order.orderId} asignado a vos`, {
        description: order.description,
        area: order.area,
        clientName: order.clientName,
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

    const handleChatMessage = (message: ChatMessagePayload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
      // Los mensajes propios y los que ya se están viendo no interrumpen.
      if (message.senderId === userId) return;
      if (pathnameRef.current?.startsWith("/dashboard/chat")) return;
      toast(`Mensaje de ${message.senderName || message.senderUsername || "un compañero"}`, {
        description: message.body,
        icon: <MessageSquare className="h-5 w-5" />,
      });
    };

    socket.on("newOrderNotification", handleNewOrder);
    socket.on("newAssignedOrderNotification", handleAssignedOrder);
    socket.on("orderStatusChangeNotification", handleStatusChange);
    socket.on("chatMessage", handleChatMessage);

    socket.on("connect_error", (err) => {
      // No loguear headers/token: sólo el mensaje del error de conexión.
      if (process.env.NODE_ENV === "development") {
        console.error("Socket connection error:", err.message);
      }
    });

    return () => {
      socket.off("newOrderNotification", handleNewOrder);
      socket.off("newAssignedOrderNotification", handleAssignedOrder);
      socket.off("orderStatusChangeNotification", handleStatusChange);
      socket.off("chatMessage", handleChatMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, rolesKey, queryClient, userId]);

  return socketRef;
}
