"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderDetailHeader } from "@/components/orders/detail/OrderDetailHeader";
import {
  OrderDetailBody,
  useOrderDetailAccess,
} from "@/components/orders/detail/OrderDetailBody";
import { useOrder } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";

/**
 * Página completa de un pedido (link compartible). Mismo contenido que el
 * diálogo de detalle — antes tenía su propia copia de la lógica, que ya se
 * había separado (no bloqueaba el circuito de diseño ni guardaba el asignado).
 */
const OrderDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params?.id);
  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useOrder(Number.isNaN(orderId) ? undefined : orderId);
  const { viewer, permissions } = useOrderDetailAccess(order);
  const [editing, setEditing] = useState(false);

  const back = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      asChild
    >
      <Link href="/dashboard/orders">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Pedidos
      </Link>
    </Button>
  );

  if (isError) {
    const forbidden =
      error instanceof ApiError &&
      (error.status === 403 || error.status === 404);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {back}
        {forbidden ? (
          <EmptyState
            icon={Lock}
            title="No tienes acceso a este pedido"
            description="Puede que no esté asignado a tu área o que ya no exista."
          />
        ) : (
          <ErrorState
            title="No se pudo cargar el pedido"
            description="Revisa tu conexión e intenta nuevamente."
            onRetry={() => refetch()}
          />
        )}
      </div>
    );
  }

  if (isPending || !order || !permissions) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10 text-sm">
      <div className="space-y-3">
        {back}
        <OrderDetailHeader
          order={order}
          permissions={permissions}
          onEdit={() => setEditing(true)}
          onDeleted={() => router.push("/dashboard/orders")}
          Title="h1"
        />
      </div>
      <OrderDetailBody
        order={order}
        viewer={viewer}
        permissions={permissions}
        editing={editing}
        onEditingChange={setEditing}
      />
    </div>
  );
};

export default OrderDetailPage;
