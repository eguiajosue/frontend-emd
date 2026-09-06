"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/feedback/states";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderStatusButtons } from "@/components/orders/OrderStatusButtons";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import {
  formatDateTime,
  getAssignedUserName,
  getOrderClientName,
  getOrderProductName,
  getUserName,
} from "@/lib/format";
import { FileText, UserRound } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityMutations } from "@/hooks/useEntity";
import { useChangeOrderStatus, useOrder, useOrderHistory } from "@/hooks/useOrders";
import type { UpdateOrderPayload } from "@/types";

const OrderDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params?.id);

  const { roles, isAdmin } = usePermissions();
  const {
    data: order,
    isPending,
    isError,
    refetch,
  } = useOrder(Number.isNaN(orderId) ? undefined : orderId);
  const { histories } = useOrderHistory(orderId);
  const { update } = useEntityMutations<unknown, UpdateOrderPayload>("orders");
  const { changeStatus, isChangingStatus } = useChangeOrderStatus();

  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Sincroniza el formulario con el pedido cada vez que llega/cambia del servidor.
  useEffect(() => {
    if (!order) return;
    setDescription(order.description ?? "");
    setDeliveryDate(order.deliveryDate ? order.deliveryDate.slice(0, 10) : "");
  }, [order]);

  const canEdit = isAdmin || roles.includes("recepcion");
  // Los roles operativos (dtf, bordado, taller, etc.) pueden avanzar el estado del
  // pedido cuando este se encuentra en la etapa que les corresponde, aunque no puedan
  // editar los detalles generales del pedido.
  const myStageIds = statusIdsForRoles(roles);
  const canChangeStatus =
    canEdit || (!!order && myStageIds.includes(order.statusId));

  const handleSaveDetails = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await update(order.id, {
        description,
        deliveryDate: deliveryDate || undefined,
      });
      toast.success("Pedido actualizado correctamente");
    } catch {
      // El toast de error lo dispara el manejo global de mutaciones.
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (nextStatusId: number) => {
    if (!order || nextStatusId === order.statusId) return;
    await changeStatus(order, nextStatusId);
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-10" />
        <Skeleton className="w-full h-40" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar el pedido"
        description="Verificá tu conexión o volvé a la lista de pedidos."
        onRetry={() => refetch()}
      />
    );
  }

  if (!order) {
    return <p>No se encontró el pedido.</p>;
  }

  return (
    <div className="p-0 w-full space-y-6">
      <div className="flex items-center justify-between">
        <Title title={`Pedido #${order.id}`} />
        <Button variant="secondary" onClick={() => router.push("/dashboard/orders")}>
          Volver
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              <b>Cliente:</b> {getOrderClientName(order)}
            </p>
            <p>
              <b>Creado por:</b> {getUserName(order.user)}
            </p>
            <p>
              <b>Fecha de Creación:</b> {formatDateTime(order.creationDate)}
            </p>
            <p className="flex items-center gap-2">
              <b>Estado actual:</b> <StatusBadge statusId={order.statusId} />
            </p>
            <p className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <b>Asignado a:</b> {getAssignedUserName(order.assignedUser) ?? "sin asignar"}
            </p>

            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Fecha de Entrega</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            {canEdit && (
              <Button onClick={handleSaveDetails} disabled={saving}>
                Guardar Cambios
              </Button>
            )}

            {order.authorizationFile && (
              <div className="space-y-2 pt-2">
                <Label>Hoja de Autorización</Label>
                {order.authorizationFile.mimeType.startsWith("image/") ? (
                  <img
                    src={order.authorizationFile.dataUrl}
                    alt={order.authorizationFile.filename}
                    loading="lazy"
                    className="max-h-64 max-w-full rounded-md border object-contain"
                  />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cambiar Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <OrderStatusButtons
              currentStatusId={order.statusId}
              canChange={canChangeStatus}
              isChanging={isChangingStatus}
              onChange={handleStatusChange}
            />

            <div className="pt-4">
              <h3 className="font-semibold mb-2">Historial de Estados</h3>
              {histories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin historial aún.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {histories.map((h) => (
                    <li key={h.id} className="border-l-2 pl-3">
                      <span className="flex flex-wrap items-center gap-1 font-medium">
                        <StatusBadge statusId={h.previousStatusId} /> →{" "}
                        <StatusBadge statusId={h.newStatusId} />
                      </span>
                      <br />
                      <span className="text-muted-foreground">
                        {formatDateTime(h.changeDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          {order.orderProducts && order.orderProducts.length > 0 ? (
            <ul className="space-y-2">
              {order.orderProducts.map((op, i) => (
                <li
                  key={op.productId ?? `${op.customName}-${i}`}
                  className="flex justify-between text-sm border-b pb-1"
                >
                  <span>{getOrderProductName(op)}</span>
                  <span>Cantidad: {op.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este pedido no tiene productos asociados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetailPage;
