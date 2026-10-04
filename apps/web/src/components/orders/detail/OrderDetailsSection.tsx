"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { FileText, Loader2, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadFileButton } from "@/components/ui/download-file-button";
import { OrderAttendance } from "@/components/orders/OrderAttendance";
import { DetailField, DetailSection } from "@/components/orders/detail/DetailSection";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { combineDateAndTime, getAssignedUserName, getOrderProductName } from "@/lib/format";
import { splitDeliveryDate, type OrderDetailPermissions } from "@/lib/orderDetail";
import type { Order, UpdateOrderPayload, User } from "@/types";

const ImageLightbox = dynamic(() => import("../ImageLightbox"), { ssr: false });

/** Radix Select no admite `""` como valor: centinela para "sin asignar". */
const UNASSIGNED = "none";

function userLabel(u: User): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
  return u.isSharedAccount ? `Área: ${name}` : name;
}

/**
 * "Qué hay que hacer": descripción, productos y archivo del cliente, más los
 * datos de gestión (asignado, quién lo creó y quién lo atiende).
 *
 * Se LEE por defecto. Antes era un formulario siempre abierto, con un
 * "Guardar cambios" magenta que era lo más llamativo del diálogo aunque casi
 * nadie viene a editar. Ahora "Editar" lo convierte en formulario en el mismo
 * lugar, y el borrador se arma al entrar a editar — no en cada refetch, que
 * antes pisaba lo que se estaba escribiendo.
 *
 * "Área actual" ya no se edita aquí: dónde está el pedido lo dice la cadena de
 * etapas, y a qué áreas va se decide en "Producción".
 */
export function OrderDetailsSection({
  order,
  permissions,
  editing,
  onEditingChange,
}: {
  order: Order;
  permissions: OrderDetailPermissions;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const products = order.orderProducts ?? [];
  const file = order.clientResourceFile;

  return (
    <DetailSection
      id="order-section-details"
      title="Qué hay que hacer"
      action={
        permissions.canEdit && !editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onEditingChange(true)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar
          </Button>
        ) : null
      }
    >
      {editing ? (
        <DetailsForm order={order} onDone={() => onEditingChange(false)} />
      ) : (
        <div className="space-y-5">
          {order.description?.trim() ? (
            <p className="max-w-prose whitespace-pre-wrap text-[0.95rem] leading-relaxed">
              {order.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin descripción.</p>
          )}

          {products.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-label">Productos</p>
              <ul className="divide-y divide-border/60 rounded-xl bg-muted/50">
                {products.map((op, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{getOrderProductName(op)}</span>
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold tabular-nums shadow-soft">× {op.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lo que mandó el CLIENTE (logo, referencias) para que Diseño
              trabaje. No es el montaje: ese vive en "Diseño". */}
          {file && (
            <div className="space-y-1.5">
              <p className="text-label">Archivo del cliente</p>
              <div className="flex flex-wrap items-center gap-3">
                {file.mimeType.startsWith("image/") ? (
                  <ZoomableImage
                    src={file.dataUrl}
                    alt={file.filename}
                    onZoom={setLightboxSrc}
                    label="Ampliar archivo del cliente"
                    className="rounded-xl"
                    imageClassName="h-24 w-auto max-w-[12rem]"
                  />
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <a href={file.dataUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="mr-2 h-4 w-4" />
                      Ver PDF del cliente
                    </a>
                  </Button>
                )}
                <DownloadFileButton href={file.dataUrl} filename={file.filename} label="Descargar" />
              </div>
            </div>
          )}

          <dl className="grid gap-x-6 gap-y-4 border-t border-border/60 pt-5 sm:grid-cols-2">
            <DetailField label="Asignado a">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {getAssignedUserName(order.assignedUser) ?? "Sin asignar"}
              </span>
            </DetailField>
            <OrderAttendance order={order} />
          </dl>
        </div>
      )}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt="Archivo del cliente" onClose={() => setLightboxSrc(null)} />
      )}
    </DetailSection>
  );
}

function DetailsForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const { data: users } = useEntityList<User>("users");
  const { update, isMutating } = useEntityMutations<Order, UpdateOrderPayload>("orders");
  const initial = splitDeliveryDate(order.deliveryDate);
  const [description, setDescription] = useState(order.description ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial.date);
  const [deliveryTime, setDeliveryTime] = useState(initial.time);
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(
    order.assignedUserId ?? undefined
  );

  // Mientras está en Diseño sólo puede tenerlo alguien de Diseño (el backend
  // lo exige): ofrecer Taller o un admin era un "Guardar" que sólo fallaba.
  const inDesign = order.area === "diseno";
  const hasRoleInfo = users.some((u) => Array.isArray(u.roles));
  const assignableUsers =
    inDesign && hasRoleInfo
      ? users.filter(
          (u) => u.id === order.assignedUserId || u.roles?.some((r) => r.name === "diseno")
        )
      : users;

  const handleSave = async () => {
    try {
      await update(order.id, {
        description,
        deliveryDate: combineDateAndTime(deliveryDate, deliveryTime),
        assignedUserId: assignedUserId ?? null,
      });
      toast.success("Pedido actualizado");
      onDone();
    } catch {
      // El toast de error lo dispara el manejo global de mutaciones.
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <FormField label="Descripción" htmlFor="order-edit-description">
        <Textarea
          id="order-edit-description"
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Fecha de entrega" htmlFor="order-edit-date">
          <Input
            id="order-edit-date"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </FormField>
        <FormField label="Hora (opcional)" htmlFor="order-edit-time">
          <Input
            id="order-edit-time"
            type="time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            disabled={!deliveryDate}
          />
        </FormField>
        <FormField label="Asignado a" htmlFor="order-edit-assignee">
          <Select
            value={assignedUserId != null ? String(assignedUserId) : UNASSIGNED}
            onValueChange={(v) => setAssignedUserId(v === UNASSIGNED ? undefined : Number(v))}
          >
            <SelectTrigger id="order-edit-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
              {assignableUsers.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {inDesign && u.isSharedAccount ? "Cualquiera de Diseño" : userLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isMutating}>
          {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
          {isMutating ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={isMutating}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
