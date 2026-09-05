"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusMap, statusOptions } from "@/lib/orderStatus";
import { isAdminRole, statusIdsForRoles } from "@/lib/roleTaskMapping";
import { useCrud } from "@/hooks/useCrud";
import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";

interface OrderProduct {
  productId: number;
  quantity: number;
  product?: { code?: string; productType?: { name: string } };
}

interface OrderDetail {
  id: number;
  description: string;
  creationDate: string;
  deliveryDate?: string;
  statusId: number;
  client?: { first_name: string; last_name: string };
  user?: { firstName: string; lastName: string };
  orderProducts?: OrderProduct[];
}

interface OrderHistoryEntry {
  id: number;
  orderId: number;
  previousStatusId: number;
  newStatusId: number;
  changeDate: string;
}

const dateFormat: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const OrderDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const orderId = Number(params?.id);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [newStatusId, setNewStatusId] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const { data: allHistories } = useCrud<OrderHistoryEntry>("order-histories");

  const token = session?.user?.token;
  const roles = session?.user?.roles || [];
  const canEdit = isAdminRole(roles) || roles.includes("recepcion");
  // Los roles operativos (dtf, bordado, taller, etc.) pueden avanzar el estado del
  // pedido cuando este se encuentra en la etapa que les corresponde, aunque no puedan
  // editar los detalles generales del pedido.
  const myStageIds = statusIdsForRoles(roles);
  const canChangeStatus =
    canEdit || (!!order && myStageIds.includes(order.statusId));

  const histories = useMemo(
    () =>
      allHistories
        .filter((h) => h.orderId === orderId)
        .sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()),
    [allHistories, orderId]
  );

  const fetchOrder = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      setLoading(true);
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/orders/${orderId}`,
        {
          headers: authHeaders(token),
        }
      );
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setOrder(json);
      setDescription(json.description ?? "");
      setDeliveryDate(json.deliveryDate ? json.deliveryDate.slice(0, 10) : "");
      setNewStatusId(json.statusId);
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error al obtener el pedido:", error);
      toast.error("No se pudo cargar el pedido");
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleSaveDetails = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/orders/${order.id}`,
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({
            description,
            deliveryDate: deliveryDate || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      toast.success("Pedido actualizado correctamente");
      fetchOrder();
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error al actualizar el pedido:", error);
      toast.error("Ocurrió un error al actualizar el pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!order || newStatusId === undefined || newStatusId === order.statusId) return;
    setSaving(true);
    try {
      const previousStatusId = order.statusId;
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/orders/${order.id}`,
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ statusId: newStatusId }),
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/order-histories`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          orderId: order.id,
          previousStatusId,
          newStatusId,
        }),
      });

      toast.success("Estado actualizado correctamente");
      fetchOrder();
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error al actualizar el estado:", error);
      toast.error("Ocurrió un error al actualizar el estado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-10" />
        <Skeleton className="w-full h-40" />
      </div>
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
              <b>Cliente:</b> {order.client?.first_name} {order.client?.last_name}
            </p>
            <p>
              <b>Creado por:</b> {order.user?.firstName} {order.user?.lastName}
            </p>
            <p>
              <b>Fecha de Creación:</b>{" "}
              {new Date(order.creationDate).toLocaleDateString("es-MX", dateFormat)}
            </p>
            <p>
              <b>Estado actual:</b> {(statusMap[order.statusId] || "desconocido").toUpperCase()}
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
                disabled={saving || newStatusId === order.statusId}
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
                        {new Date(h.changeDate).toLocaleDateString("es-MX", dateFormat)}
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
                <li key={op.productId} className="flex justify-between text-sm border-b pb-1">
                  <span>
                    {op.product?.code || op.product?.productType?.name || `Producto #${op.productId}`}
                  </span>
                  <span>Cantidad: {op.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Este pedido no tiene productos asociados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetailPage;
