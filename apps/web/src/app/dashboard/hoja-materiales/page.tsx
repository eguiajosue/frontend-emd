"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Title from "@/components/Title";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState, EmptyState } from "@/components/feedback/states";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OrderMaterialsChecklistTable } from "@/components/orders/OrderMaterialsChecklistTable";
import { useOrders } from "@/hooks/useOrders";
import { getOrderClientName, formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isDeliveredStatus, isCancelledStatus } from "@/lib/orderStatus";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { Order } from "@/types";

/** Pedido a abrir de una (llegando desde "Ver hoja de materiales" del detalle del pedido). */
function initialOrderFromUrl(): string[] {
  if (typeof window === "undefined") return [];
  const order = new URLSearchParams(window.location.search).get("order");
  return order ? [order] : [];
}

/**
 * Hoja de materiales por pedido: un pedido por fila, enfocada sólo en su
 * lista de material — al abrirla se despliega el checklist de compra
 * (cantidad/material/proveedor/precio) con el total de lo ya comprado.
 * Reemplaza la sección que antes vivía dentro del detalle de cada pedido.
 * Sólo pedidos activos (ni entregados ni cancelados): una vez entregado, la
 * hoja de materiales de ese pedido ya no importa para planificar compras.
 */
export default function HojaMaterialesPage() {
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { timeFormat } = useTimeFormat();
  const [search, setSearch] = useState("");

  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => !isDeliveredStatus(o.statusId) && !isCancelledStatus(o.statusId))
        .sort((a, b) => a.id - b.id),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeOrders;
    return activeOrders.filter((order) => {
      const haystack = `${order.id} ${order.description} ${getOrderClientName(order)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeOrders, search]);

  return (
    <div className="space-y-4">
      <div>
        <Title title="Hoja de Materiales" />
        <p className="text-muted-foreground">
          Elegí un pedido para ver y marcar los materiales que hay que comprar.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por pedido o cliente..."
          className="pl-9"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          message={
            activeOrders.length === 0
              ? "No hay pedidos activos en este momento."
              : "Ningún pedido coincide con la búsqueda."
          }
        />
      ) : (
        <Accordion type="multiple" className="space-y-2" defaultValue={initialOrderFromUrl()}>
          {filteredOrders.map((order) => (
            <AccordionItem
              key={order.id}
              value={String(order.id)}
              className="rounded-xl border bg-card px-4 shadow-soft"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <OrderRowSummary order={order} timeFormat={timeFormat} />
              </AccordionTrigger>
              <AccordionContent className="border-t">
                <OrderMaterialsChecklistTable orderId={order.id} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

function OrderRowSummary({
  order,
  timeFormat,
}: {
  order: Order;
  timeFormat: TimeFormatPreference;
}) {
  return (
    <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2 text-left">
      <span className="min-w-0">
        <span className="font-semibold">Pedido #{order.id}</span>
        <span className="text-muted-foreground"> · {getOrderClientName(order)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        Entrega: {formatDeliveryDate(order.deliveryDate, timeFormat)}
        <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
      </span>
    </span>
  );
}
