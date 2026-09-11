"use client";

/**
 * Quién se ocupa del pedido del lado de Recepción.
 *
 * El circuito notifica a UNA persona, no al rol: la recepcionista que creó el
 * pedido. Si está de franco, nadie más se entera y el pedido se traba. Por eso
 * se guardan dos cosas distintas:
 *
 *  - `userId` / `user`: quién lo CREÓ. No cambia nunca.
 *  - `attendedByUserId` / `attendedBy`: quién lo ATIENDE hoy, `null` mientras
 *    no lo haya tomado nadie.
 *
 * El destinatario efectivo de las notificaciones es `attendedByUserId ?? userId`
 * — la misma cuenta que hace el backend.
 *
 * Se usa tal cual en el diálogo de detalle y en `/dashboard/orders/[id]`, que
 * muestran la misma información.
 */

import { useSession } from "next-auth/react";
import { Handshake, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useTakeOrderReception } from "@/hooks/useOrders";
import { getAssignedUserName, getUserName } from "@/lib/format";
import type { Order } from "@/types";

/**
 * A propósito NO se usa `canManageOperations` (= admin o recepción): ese
 * permiso sirve para reasignar pedidos a OTRA persona, pero "atender" es
 * tomar el pedido para trabajarlo uno mismo. Admin genera pedidos, no los
 * trabaja — el backend rechaza a admin puro con 403
 * (`@Auth(RECEPCION, SUPERUSER)` en `take-reception`); mostrarle el botón
 * sería ofrecer una acción que sólo puede fallar. El único rol que hace de
 * todo, incluido tomar, es superuser.
 */
function canTakeReceptionRole(roles: string[]): boolean {
  return roles.includes("recepcion") || roles.includes("superuser");
}

/**
 * Destinatario efectivo de las notificaciones del pedido: quien lo atiende si
 * alguien lo tomó, y si no, quien lo creó.
 */
function effectiveReceptionUserId(order: Order): number | null {
  return order.attendedByUserId ?? order.userId ?? null;
}

export function OrderAttendance({ order }: { order: Order }) {
  const { data: session } = useSession();
  const { roles } = usePermissions();
  const { takeReception, isTakingReception } = useTakeOrderReception();

  const currentUserId = session?.user?.id ? Number(session.user.id) : null;
  const attendedByName = getAssignedUserName(order.attendedBy);
  // Sólo se nombra a quien atiende cuando NO es quien lo creó: repetir el
  // mismo nombre dos veces no informa nada.
  const showsAttendedBy =
    attendedByName !== null &&
    order.attendedByUserId != null &&
    order.attendedByUserId !== order.userId;

  const responsibleId = effectiveReceptionUserId(order);
  const isMine = currentUserId !== null && currentUserId === responsibleId;
  const canTake =
    canTakeReceptionRole(roles) && currentUserId !== null && !isMine;

  return (
    <div className="grid gap-1">
      <p>
        <b>Creado por:</b> {getUserName(order.user)}
      </p>
      {showsAttendedBy && (
        <p className="flex items-center gap-1">
          <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
          <b>Lo atiende:</b> {attendedByName}
        </p>
      )}
      {canTake && (
        <div className="pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={isTakingReception}
            onClick={() => void takeReception(order.id)}
          >
            {isTakingReception ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            {isTakingReception ? "Tomando..." : "Atender este pedido"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Pasás a recibir vos los avisos del circuito. Queda registrado quién
            lo creó.
          </p>
        </div>
      )}
    </div>
  );
}
