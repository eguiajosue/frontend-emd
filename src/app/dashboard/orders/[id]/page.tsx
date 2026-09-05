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
import { statusMap, statusOptions } from "@/lib/orderStatus";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { formatDateTime, getClientName, getUserName } from "@/lib/format";
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
  const [newStatusId, setNewStatusId] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Sincroniza el formulario con el pedido cada vez que llega/cambia del servidor.
  useEffect(() => {
    if (!order) return;
    setDescription(order.description ?? "");
    setDeliveryDate(order.deliveryDate ? order.deliveryDate.slice(0, 10) : "");
    setNewStatusId(order.statusId);
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

  const handleStatusChange = async () => {
    if (!order || newStatusId === undefined || newStatusId === order.statusId) return;
    await changeStatus(order, newStatusId);
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
              <b>Cliente:</b> {getClientName(order.client)}
            </p>
            <p>
              <b>Creado por:</b> {getUserName(order.user)}
            </p>
            <p>
              <b>Fecha de Creación:</b> {formatDateTime(order.creationDate)}
            </p>
            <p>
              <b>Estado actual:</b>{" "}
              {(statusMap[order.statusId] || "desconocido").toUpperCase()}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cambiar Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              value={newStatusId ?? ""}
              disabled={!canChangeStatus}
              onChange={(e) => setNewStatusId(Number(e.target.value))}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label.toUpperCase()}
                </option>
              ))}
            </select>
            {canChangeStatus && (
              <Button
                onClick={handleStatusChange}
                disabled={isChangingStatus || newStatusId === order.statusId}
              >
                Actualizar Estado
              </Button>
            )}

            <div className="pt-4">
              <h3 className="font-semibold mb-2">Historial de Estados</h3>
              {histories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin historial aún.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {histories.map((h) => (
                    <li key={h.id} className="border-l-2 pl-3">
                      <span className="font-medium">
                        {(statusMap[h.previousStatusId] || "?").toUpperCase()} →{" "}
                        {(statusMap[h.newStatusId] || "?").toUpperCase()}
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
              {order.orderProducts.map((op) => (
                <li
                  key={op.productId}
                  className="flex justify-between text-sm border-b pb-1"
                >
                  <span>
                    {op.product?.code ||
                      op.product?.productType?.name ||
                      `Producto #${op.productId}`}
                  </span>
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
