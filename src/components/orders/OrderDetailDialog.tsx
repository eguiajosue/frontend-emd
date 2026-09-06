"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, getClientName, getUserName } from "@/lib/format";
import { useOrderHistory, useOrder } from "@/hooks/useOrders";
import { FileText, ZoomIn } from "lucide-react";

// Lightbox pesado (framer-motion img) sólo se carga si el usuario amplía la imagen.
const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

interface OrderDetailDialogProps {
  orderId: number | null;
  onClose: () => void;
}

/**
 * Vista completa de un pedido en un modal animado (fade+scale vía Radix Dialog +
 * framer-motion en su contenido). Pide el detalle completo (GET /orders/:id) sólo
 * cuando se abre, así "Estatus de Pedidos" no dispara N requests de detalle de una.
 */
export function OrderDetailDialog({ orderId, onClose }: OrderDetailDialogProps) {
  const open = orderId !== null;
  const { data: order, isPending } = useOrder(orderId ?? undefined, {
    enabled: open,
  });
  const { histories } = useOrderHistory(orderId ?? -1);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <AnimatePresence mode="wait">
            {isPending || !order ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 py-4"
              >
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </motion.div>
            ) : (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.97, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Pedido #{order.id} <StatusBadge statusId={order.statusId} />
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid gap-1">
                    <p>
                      <b>Cliente:</b> {getClientName(order.client)}
                    </p>
                    <p>
                      <b>Descripción:</b> {order.description}
                    </p>
                    <p>
                      <b>Creado por:</b> {getUserName(order.user)}
                    </p>
                    <p>
                      <b>Fecha de creación:</b> {formatDateTime(order.creationDate)}
                    </p>
                    <p>
                      <b>Fecha de entrega:</b> {formatDate(order.deliveryDate)}
                    </p>
                  </div>

                  {order.orderProducts && order.orderProducts.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-semibold">Productos</h4>
                      <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                        {order.orderProducts.map((op, i) => (
                          <li key={i}>
                            {op.product?.code || `Producto #${op.productId}`} × {op.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {order.authorizationFile && (
                    <div>
                      <h4 className="mb-2 font-semibold">Hoja de Autorización</h4>
                      {order.authorizationFile.mimeType.startsWith("image/") ? (
                        <button
                          type="button"
                          className="group relative inline-block overflow-hidden rounded-md border"
                          onClick={() =>
                            setLightboxSrc(order.authorizationFile!.dataUrl)
                          }
                        >
                          <img
                            src={order.authorizationFile.dataUrl}
                            alt={order.authorizationFile.filename}
                            loading="lazy"
                            className="max-h-64 max-w-full object-contain"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                            <ZoomIn className="h-6 w-6" />
                          </span>
                        </button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={order.authorizationFile.dataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver hoja de autorización (PDF)
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="mb-2 font-semibold">Historial de Estados</h4>
                    {histories.length === 0 ? (
                      <p className="text-muted-foreground">Sin historial aún.</p>
                    ) : (
                      <ul className="space-y-2">
                        {histories.map((h) => (
                          <li key={h.id} className="border-l-2 pl-3">
                            <span className="flex flex-wrap items-center gap-1 font-medium">
                              <StatusBadge statusId={h.previousStatusId} /> →{" "}
                              <StatusBadge statusId={h.newStatusId} />
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(h.changeDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Hoja de autorización"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
