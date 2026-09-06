"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useClientOrders } from "@/hooks/useOrders";
import { useEntityDetail } from "@/hooks/useEntity";
import { getClientName } from "@/lib/format";
import { useMotionPreset } from "@/lib/motion";
import { motion } from "framer-motion";
import type { Client } from "@/types";

interface ClientOrdersDialogProps {
  clientId: number | null;
  onClose: () => void;
}

/**
 * Historial de pedidos de un cliente puntual (`GET /clients/:id/orders`,
 * endpoint nuevo del backend). Reusa `OrderCard` para consistencia visual con
 * el resto de la app; el click en una tarjeta abre el detalle completo del
 * pedido en su propio diálogo.
 */
export function ClientOrdersDialog({ clientId, onClose }: ClientOrdersDialogProps) {
  const open = clientId !== null;
  const { data: client } = useEntityDetail<Client>("clients", clientId ?? undefined, {
    enabled: open,
  });
  const { orders, isLoading, isError, isUnavailable, refetch } = useClientOrders(
    open ? clientId : null
  );
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const { staggerItemVariants } = useMotionPreset();

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pedidos de {client ? getClientName(client) : "cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : isUnavailable ? (
              <p className="text-sm text-muted-foreground">
                El historial de pedidos por cliente todavía no está disponible.
              </p>
            ) : isError ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">No se pudo cargar el historial.</p>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => refetch()}
                >
                  Reintentar
                </button>
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este cliente todavía no tiene pedidos.
              </p>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                className="grid gap-3 sm:grid-cols-2"
              >
                {orders.map((order) => (
                  <motion.div key={order.id} variants={staggerItemVariants}>
                    <OrderCard order={order} onOpen={setOpenOrderId} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </>
  );
}
