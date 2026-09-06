"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDate,
  formatDateTime,
  getAssignedUserName,
  getOrderClientName,
  getOrderProductName,
  getUserName,
} from "@/lib/format";
import { useOrderHistory, useOrder, useChangeOrderStatus } from "@/hooks/useOrders";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { statusOptions } from "@/lib/orderStatus";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { DeliveryProgressBar } from "@/components/orders/DeliveryProgressBar";
import { FileText, UserRound, ZoomIn } from "lucide-react";
import type { Order, UpdateOrderPayload, User } from "@/types";

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
  const { data: users } = useEntityList<User>("users", { enabled: open });
  const { update, isMutating: isSavingDetails } = useEntityMutations<Order, UpdateOrderPayload>(
    "orders"
  );
  const { changeStatus, isChangingStatus } = useChangeOrderStatus();
  const { roles, isAdmin } = usePermissions();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // recepcion/admin pueden editar los campos generales del pedido desde acá mismo;
  // los roles operativos sólo pueden avanzar el estado (si el pedido está en su etapa).
  const canEdit = isAdmin || roles.includes("recepcion");
  const myStageIds = statusIdsForRoles(roles);
  const canChangeStatus = canEdit || (!!order && myStageIds.includes(order.statusId));

  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [area, setArea] = useState<string | undefined>(undefined);
  const [statusId, setStatusId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!order) return;
    setDescription(order.description ?? "");
    setDeliveryDate(order.deliveryDate ? order.deliveryDate.slice(0, 10) : "");
    setAssignedUserId(order.assignedUserId ?? undefined);
    setArea(order.area ?? undefined);
    setStatusId(order.statusId);
  }, [order]);

  const handleSaveDetails = async () => {
    if (!order) return;
    try {
      await update(order.id, {
        description,
        deliveryDate: deliveryDate || undefined,
        assignedUserId: assignedUserId ?? null,
        area,
      });
      toast.success("Pedido actualizado correctamente");
    } catch {
      // El toast de error lo dispara el manejo global de mutaciones.
    }
  };

  const handleStatusChange = async (nextStatusId: number) => {
    if (!order || nextStatusId === order.statusId) return;
    setStatusId(nextStatusId);
    await changeStatus(order, nextStatusId);
  };

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
                      <b>Cliente:</b> {getOrderClientName(order)}
                    </p>
                    <p>
                      <b>Creado por:</b> {getUserName(order.user)}
                    </p>
                    <p>
                      <b>Fecha de creación:</b> {formatDateTime(order.creationDate)}
                    </p>
                    <p className="flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                      <b>Asignado a:</b>{" "}
                      {getAssignedUserName(order.assignedUser) ?? "sin asignar"}
                    </p>
                    {!canEdit && (
                      <p>
                        <b>Área:</b> {getAreaLabel(order.area)}
                      </p>
                    )}
                  </div>

                  <DeliveryProgressBar
                    creationDate={order.creationDate}
                    deliveryDate={order.deliveryDate}
                  />

                  {canEdit ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="space-y-1">
                        <Label>Descripción</Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Fecha de entrega</Label>
                          <Input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Asignar a</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                            value={assignedUserId ?? ""}
                            onChange={(e) =>
                              setAssignedUserId(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                          >
                            <option value="">Sin asignar</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                                  u.username}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Área</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                            value={area ?? ""}
                            onChange={(e) => setArea(e.target.value || undefined)}
                          >
                            <option value="">Sin área</option>
                            {AREA_OPTIONS.map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Button size="sm" onClick={handleSaveDetails} disabled={isSavingDetails}>
                        {isSavingDetails ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </div>
                  ) : (
                    <p>
                      <b>Descripción:</b> {order.description}
                    </p>
                  )}

                  {!canEdit && (
                    <p>
                      <b>Fecha de entrega:</b> {formatDate(order.deliveryDate)}
                    </p>
                  )}

                  {canChangeStatus && (
                    <div className="space-y-1">
                      <Label>Avanzar estado</Label>
                      <Select
                        value={String(statusId ?? order.statusId)}
                        onValueChange={(value) => handleStatusChange(Number(value))}
                      >
                        <SelectTrigger className="w-[200px]" disabled={isChangingStatus}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {order.orderProducts && order.orderProducts.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-semibold">Productos</h4>
                      <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                        {order.orderProducts.map((op, i) => (
                          <li key={i}>
                            {getOrderProductName(op)} × {op.quantity}
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
