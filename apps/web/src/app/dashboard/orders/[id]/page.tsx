"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/states";
import { ForbiddenScreen, NotFoundScreen } from "@/components/feedback/ErrorScreen";
import { OrderDetailHeader } from "@/components/orders/detail/OrderDetailHeader";
import {
  OrderDetailBody,
  useOrderDetailAccess,
} from "@/components/orders/detail/OrderDetailBody";
import { useOrder } from "@/hooks/useOrders";
import { FadeIn } from "@/components/motion";
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
      className="group gap-1.5 text-muted-foreground"
      asChild
    >
      <Link href="/dashboard/orders">
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" aria-hidden />
        Pedidos
      </Link>
    </Button>
  );

  if (isError) {
    const status = error instanceof ApiError ? error.status : undefined;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {back}
        {status === 404 ? (
          <NotFoundScreen
            layout="inline"
            title="No encontramos este pedido"
            description="Puede que el número esté mal o que lo hayan eliminado."
            primary={{ label: "Ver pedidos", href: "/dashboard/orders", icon: ArrowLeft }}
          />
        ) : status === 403 ? (
          <ForbiddenScreen
            layout="inline"
            title="No tienes acceso a este pedido"
            description="Puede que no esté asignado a tu área. Si lo necesitas, pídele a un administrador que te lo comparta."
            primary={{ label: "Ver pedidos", href: "/dashboard/orders", icon: ArrowLeft }}
          />
        ) : (
          <ErrorState
            error={error}
            title="No se pudo cargar el pedido"
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
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 pb-10 text-sm">
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
    </FadeIn>
  );
};

export default OrderDetailPage;
