"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderDetailHeader } from "@/components/orders/detail/OrderDetailHeader";
import { OrderDetailBody, useOrderDetailAccess } from "@/components/orders/detail/OrderDetailBody";
import { useOrder } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";

interface OrderDetailDialogProps {
  orderId: number | null;
  onClose: () => void;
}

/**
 * Detalle de un pedido en un modal. Pide el detalle completo (GET /orders/:id)
 * sólo cuando se abre. El contenido (cabecera + cuerpo) es el mismo que usa la
 * página `/dashboard/orders/[id]`.
 */
export function OrderDetailDialog({ orderId, onClose }: OrderDetailDialogProps) {
  const open = orderId !== null;
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId ?? undefined, {
    enabled: open,
  });
  const { viewer, permissions } = useOrderDetailAccess(order);
  const [editing, setEditing] = useState(false);

  // Cada pedido abre en modo lectura.
  useEffect(() => setEditing(false), [orderId]);

  // 403/404 no son un problema de conexión: reintentar no lo arregla.
  const forbidden =
    isError && error instanceof ApiError && (error.status === 403 || error.status === 404);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* Lienzo gris con bloques blancos, como la página: `!bg-background` gana
          a la elevación oscura del diálogo. En móvil es pantalla completa. */}
      <DialogContent className="!bg-background p-0 sm:max-h-[90vh] sm:max-w-2xl sm:overflow-y-auto sm:border-border/60 sm:p-0 lg:max-w-3xl">
        <AnimatePresence mode="wait">
          {isError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <DialogTitle className="sr-only">Pedido no disponible</DialogTitle>
              {forbidden ? (
                <EmptyState
                  icon={Lock}
                  title="No tenés acceso a este pedido"
                  description="Puede que no esté asignado a tu área o que ya no exista."
                />
              ) : (
                <ErrorState
                  title="No se pudo cargar el detalle del pedido."
                  description="Revisá tu conexión e intentá nuevamente."
                  onRetry={() => refetch()}
                />
              )}
            </motion.div>
          ) : isPending || !order || !permissions ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 p-6"
            >
              <DialogTitle className="sr-only">Cargando pedido</DialogTitle>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-24 w-full" />
            </motion.div>
          ) : (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              {/* Quién es y cuánto falta quedan a la vista al bajar (sólo en
                  escritorio: en móvil la cabecera fija ocuparía un cuarto de
                  pantalla). */}
              <DialogHeader className="relative z-10 sm:sticky sm:top-0 -mx-4 -mt-4 space-y-0 bg-background px-4 pb-4 pr-14 pt-4 sm:mx-0 sm:shadow-[0_1px_0_hsl(var(--border)/0.6)] sm:mt-0 sm:px-6 sm:pb-5 sm:pr-16 sm:pt-6">
                <OrderDetailHeader
                  order={order}
                  permissions={permissions}
                  onEdit={() => {
                    setEditing(true);
                    document
                      .getElementById("order-section-details")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onDeleted={onClose}
                  showFullPageLink
                  Title={DialogTitle}
                />
              </DialogHeader>
              <div className="pb-6 pt-4 text-sm sm:px-6 sm:pt-5">
                <OrderDetailBody
                  order={order}
                  viewer={viewer}
                  permissions={permissions}
                  editing={editing}
                  onEditingChange={setEditing}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
