"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useMotionPreset } from "@/lib/motion";
import { OrderStatusButtons } from "@/components/orders/OrderStatusButtons";
import { DesignFlowSection } from "@/components/orders/DesignFlowSection";
import { AreaTasksSection } from "@/components/orders/AreaTasksSection";
import { OrderHandoff } from "@/components/orders/OrderHandoff";
import {
  combineDateAndTime,
  formatDateTime,
  formatDeliveryDate,
  getAssignedUserName,
  getOrderClientName,
  getOrderProductName,
  getUserName,
} from "@/lib/format";
import {
  useOrderHistory,
  useOrder,
  useMoveOrderStatus,
  useDeleteOrder,
  useOrderNotes,
  useOrderAuditLog,
} from "@/hooks/useOrders";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { isDeliveredStatus, isDesignFlowStatusName } from "@/lib/orderStatus";
import {
  AREA_OPTIONS,
  PRODUCTION_AREA_OPTIONS,
  getAreaLabel,
  getAreaIcon,
} from "@/lib/areas";
import { DeliveryProgressBar } from "@/components/orders/DeliveryProgressBar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { FileText, Loader2, Trash2, UserRound, ZoomIn } from "lucide-react";
import { buildAuditLines } from "@/lib/orderAuditLog";
import type { Order, UpdateOrderPayload, User } from "@/types";
import { PreviewImage } from "@/components/ui/preview-image";
import { DownloadFileButton } from "@/components/ui/download-file-button";

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
  const { roles, isAdmin, canManageOperations } = usePermissions();
  // Historial de estados e "Historial de cambios" (audit log) son sólo para
  // quien gestiona pedidos (admin/superuser/recepcion) — los roles operativos
  // no los necesitan ni deben pedir esos endpoints.
  const canSeeHistory = isAdmin || roles.includes("recepcion");
  const { histories } = useOrderHistory(orderId ?? -1, { enabled: open && canSeeHistory });
  const { data: users } = useEntityList<User>("users", { enabled: open });
  const {
    notes,
    isLoading: isLoadingNotes,
    isUnavailable: notesUnavailable,
    addNote,
    isAdding: isAddingNote,
  } = useOrderNotes(open ? orderId : null);
  const {
    entries: auditEntries,
    isLoading: isLoadingAudit,
    isUnavailable: auditUnavailable,
  } = useOrderAuditLog(open ? orderId : null, { enabled: canSeeHistory });
  // Una oración en español por campo cambiado (ver `@/lib/orderAuditLog`).
  const auditLines = useMemo(
    () => auditEntries.flatMap((entry) => buildAuditLines(entry)),
    [auditEntries]
  );
  const [newNote, setNewNote] = useState("");
  const { update, isMutating: isSavingDetails } = useEntityMutations<Order, UpdateOrderPayload>(
    "orders"
  );
  // Áreas propias del usuario: deciden qué tarea de área mueve un cambio de
  // estado (ver `areaTasksToMove`).
  const moveActor = useMemo(
    () => ({
      areas: roles.filter((r) => PRODUCTION_AREA_OPTIONS.some((a) => a.value === r)),
      isManager: canManageOperations,
    }),
    [roles, canManageOperations]
  );
  const { move: moveStatus, isMoving: isChangingStatus } =
    useMoveOrderStatus(moveActor);
  const { deleteOrder, isDeleting } = useDeleteOrder();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Eliminar un pedido es una acción irreversible reservada a quien gestiona
  // pedidos (recepción/admin/superuser) — mismo criterio que `canEdit`.
  const canDelete = canManageOperations;
  const { formButtonMotion } = useMotionPreset();

  // recepcion/admin pueden editar los campos generales del pedido desde acá mismo;
  // los roles operativos sólo pueden avanzar el estado (si el pedido está en su etapa).
  const canEdit = canSeeHistory;
  const myStageIds = statusIdsForRoles(roles);
  // Mientras el pedido está "trabado" en un estado del flujo de diseño (en
  // diseño / esperando autorización / cambios solicitados — todavía no
  // autorizado), el selector manual de estado se deshabilita del todo: se
  // avanza únicamente con las acciones de "Proceso de diseño" para no saltear
  // el loop de autorización del cliente.
  const isInDesignLimbo = !!order?.requiresDesign && isDesignFlowStatusName(order?.status?.name);
  const canChangeStatus =
    !isInDesignLimbo && (canEdit || (!!order && myStageIds.includes(order.statusId)));

  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [area, setArea] = useState<string | undefined>(undefined);
  const [statusId, setStatusId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!order) return;
    setDescription(order.description ?? "");
    if (order.deliveryDate) {
      const d = new Date(order.deliveryDate);
      setDeliveryDate(order.deliveryDate.slice(0, 10));
      const hasTime = !Number.isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0);
      setDeliveryTime(
        hasTime
          ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
          : ""
      );
    } else {
      setDeliveryDate("");
      setDeliveryTime("");
    }
    setAssignedUserId(order.assignedUserId ?? undefined);
    setArea(order.area ?? undefined);
    setStatusId(order.statusId);
  }, [order]);

  const handleSaveDetails = async () => {
    if (!order) return;
    try {
      await update(order.id, {
        description,
        deliveryDate: combineDateAndTime(deliveryDate, deliveryTime),
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
    // `moveStatus`, no `changeStatus`: cuando el pedido tiene tareas de área,
    // el tablero se ubica por ellas. Escribiendo sólo `Order.statusId` la
    // etiqueta del detalle cambiaba y la tarjeta del kanban no se movía.
    await moveStatus(order, nextStatusId);
  };

  const handleConfirmDelete = async () => {
    if (!order) return;
    const result = await deleteOrder(order.id);
    setConfirmDeleteOpen(false);
    if (result !== undefined) {
      onClose();
    }
  };

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    const result = await addNote(text);
    if (result !== undefined) {
      setNewNote("");
      toast.success("Nota agregada");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-h-[85vh] sm:overflow-y-auto sm:max-w-2xl">
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
                  <DialogTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      Pedido #{order.id}{" "}
                      <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
                    </span>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Eliminar pedido"
                        aria-label="Eliminar pedido"
                        onClick={() => setConfirmDeleteOpen(true)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4 text-sm">
                  {/* Primero de quién es el trabajo, después los datos: es lo
                      que cualquiera viene a averiguar al abrir un pedido. */}
                  <OrderHandoff order={order} />

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
                    {!canEdit && (() => {
                      const AreaIcon = getAreaIcon(order.area);
                      return (
                        <p className="flex items-center gap-1">
                          {AreaIcon && (
                            <AreaIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <b>Área:</b> {getAreaLabel(order.area)}
                        </p>
                      );
                    })()}
                  </div>

                  {!isDeliveredStatus(order.statusId) && (
                    <DeliveryProgressBar
                      creationDate={order.creationDate}
                      deliveryDate={order.deliveryDate}
                    />
                  )}

                  {canEdit ? (
                    <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                      <FormField label="Descripción">
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                        />
                      </FormField>
                      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <FormField label="Fecha de entrega">
                          <Input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                          />
                        </FormField>
                        <FormField label="Hora de entrega (opcional)">
                          <Input
                            type="time"
                            value={deliveryTime}
                            onChange={(e) => setDeliveryTime(e.target.value)}
                            disabled={!deliveryDate}
                            className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                          />
                        </FormField>
                        <FormField label="Asignar a">
                          <select
                            className="flex h-9 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
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
                                {u.isSharedAccount
                                  ? `Área: ${[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}`
                                  : [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField
                          label={order.requiresDesign ? "Área actual" : "Área"}
                          hint={
                            order.requiresDesign
                              ? "Dónde está el pedido ahora. El destino en producción se define en \"Proceso de diseño\", más abajo."
                              : undefined
                          }
                        >
                          <select
                            className="flex h-9 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
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
                        </FormField>
                      </div>
                      <motion.div className="inline-block" {...(isSavingDetails ? {} : formButtonMotion)}>
                        <Button size="sm" onClick={handleSaveDetails} disabled={isSavingDetails}>
                          {isSavingDetails && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isSavingDetails ? "Guardando..." : "Guardar cambios"}
                        </Button>
                      </motion.div>
                    </div>
                  ) : (
                    <p>
                      <b>Descripción:</b> {order.description}
                    </p>
                  )}

                  {!canEdit && (
                    <p>
                      <b>Fecha de entrega:</b> {formatDeliveryDate(order.deliveryDate)}
                    </p>
                  )}

                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <OrderStatusButtons
                      currentStatusId={statusId ?? order.statusId}
                      canChange={canChangeStatus}
                      isChanging={isChangingStatus}
                      onChange={handleStatusChange}
                    />
                    {order.requiresDesign && (
                      <p className="text-xs text-muted-foreground">
                        Los estados del flujo de diseño (en diseño, esperando
                        autorización, cambios solicitados, autorizado) se
                        alcanzan sólo con las acciones de la sección
                        &quot;Proceso de diseño&quot; de abajo, no a mano.
                      </p>
                    )}
                  </div>

                  <DesignFlowSection order={order} />

                  {/* Único lugar donde se decide a qué áreas va el pedido:
                      mientras está en diseño define el destino, después muestra
                      el avance de cada una. */}
                  <AreaTasksSection order={order} />

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
                          <PreviewImage
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
                      {/* Recepción la baja para mandársela al cliente por
                          fuera del sistema: abrirla en una pestaña no alcanza. */}
                      <div className="mt-2">
                        <DownloadFileButton
                          href={order.authorizationFile.dataUrl}
                          filename={order.authorizationFile.filename}
                          label="Descargar hoja de autorización"
                        />
                      </div>
                    </div>
                  )}

                  {canSeeHistory && (
                    <div>
                      <h4 className="mb-2 font-semibold">Historial de Estados</h4>
                      {histories.length === 0 ? (
                        <p className="text-muted-foreground">
                          Recién creado, todavía sin cambios de estado.
                        </p>
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
                  )}

                  <div>
                    <h4 className="mb-2 font-semibold">Notas internas</h4>
                    {isLoadingNotes ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : notesUnavailable ? (
                      <p className="text-muted-foreground">
                        Las notas internas todavía no están disponibles.
                      </p>
                    ) : (
                      <>
                        {notes.length === 0 ? (
                          <p className="mb-2 text-muted-foreground">
                            Todavía no hay notas — dejá la primera para el equipo.
                          </p>
                        ) : (
                          <ul className="mb-3 space-y-2">
                            {notes.map((note) => (
                              <li key={note.id} className="rounded-lg border bg-muted/20 p-2.5">
                                <p className="whitespace-pre-wrap">{note.text}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {getAssignedUserName(note.user) ?? "Usuario"} ·{" "}
                                  {formatDateTime(note.createdAt)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="space-y-2">
                          <Textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Agregar una nota interna..."
                            rows={2}
                            className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                          />
                          <motion.div
                            className="inline-block"
                            {...(isAddingNote ? {} : formButtonMotion)}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleAddNote}
                              disabled={isAddingNote || !newNote.trim()}
                            >
                              {isAddingNote && <Loader2 className="h-4 w-4 animate-spin" />}
                              {isAddingNote ? "Enviando..." : "Agregar nota"}
                            </Button>
                          </motion.div>
                        </div>
                      </>
                    )}
                  </div>

                  {canSeeHistory && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="audit-log">
                        <AccordionTrigger className="font-semibold">
                          Historial de cambios
                        </AccordionTrigger>
                        <AccordionContent>
                          {isLoadingAudit ? (
                            <div className="space-y-2">
                              <Skeleton className="h-10 w-full" />
                              <Skeleton className="h-10 w-full" />
                            </div>
                          ) : auditUnavailable ? (
                            <p className="text-muted-foreground">
                              El historial de cambios todavía no está disponible.
                            </p>
                          ) : auditLines.length === 0 ? (
                            <p className="text-muted-foreground">
                              Sin cambios registrados: el pedido está tal cual se creó.
                            </p>
                          ) : (
                            <ul className="space-y-4">
                              {auditLines.map((line) => (
                                <li key={line.key} className="flex items-start gap-3">
                                  <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                      {line.actorInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 space-y-0.5 leading-relaxed">
                                    <p className="break-words">
                                      <span className="font-medium">{line.actorName}</span>{" "}
                                      {line.action}
                                    </p>
                                    <p
                                      className="text-xs text-muted-foreground"
                                      title={line.absoluteTime}
                                    >
                                      {line.relativeTime}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
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

      {order && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          onConfirm={handleConfirmDelete}
          title={`¿Eliminar el pedido #${order.id}?`}
          description="Esta acción no se puede deshacer. El pedido y su historial dejarán de estar disponibles."
        />
      )}
    </>
  );
}

