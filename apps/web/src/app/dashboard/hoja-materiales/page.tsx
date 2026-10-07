"use client";

import { Button } from "@/components/ui/button";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, GripVertical, Search } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { AreaSuppliesPanel } from "@/components/orders/AreaSuppliesPanel";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { OrderSizesList } from "@/components/sizes/OrderSizesList";
import { OrderMaterialsChecklistTable } from "@/components/orders/OrderMaterialsChecklistTable";
import { useOrders, useReorderMaterialsPriority } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { getOrderClientName, formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isDeliveredStatus, isCancelledStatus } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { Order } from "@/types";

/** Pedido a abrir de una (llegando desde "Ver hoja de materiales" del detalle del pedido). */
/**
 * Lee `?order=N` (el "Hoja de materiales" del menú de un pedido). Antes se
 * leía `window.location` durante el render: con navegación del lado del
 * cliente el pedido no se abría. Va aparte y dentro de `<Suspense>` por
 * `useSearchParams`, igual que en Pedidos.
 */
function OrderParamListener({ onOrder }: { onOrder: (orderId: string) => void }) {
  const searchParams = useSearchParams();
  const order = searchParams?.get("order") ?? null;
  useEffect(() => {
    if (order) onOrder(order);
  }, [order, onOrder]);
  return null;
}

/**
 * Ordena por prioridad de compra elegida a mano (`materialsPriority`, chico =
 * más urgente). Los pedidos que todavía no se reordenaron (`null`) van al
 * final, entre ellos por id — mismo criterio que antes de que existiera el
 * reordenamiento manual.
 */
function sortByMaterialsPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const pa = a.materialsPriority;
    const pb = b.materialsPriority;
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    return a.id - b.id;
  });
}

/**
 * Hoja de materiales por pedido: un pedido por fila, enfocada sólo en su
 * lista de material — al abrirla se despliega el checklist de compra
 * (cantidad/material/proveedor/precio) con el total de lo ya comprado.
 * Reemplaza la sección que antes vivía dentro del detalle de cada pedido.
 * Sólo pedidos activos (ni entregados ni cancelados): una vez entregado, la
 * hoja de materiales de ese pedido ya no importa para planificar compras.
 *
 * El orden de la lista define la prioridad de compra: se puede arrastrar
 * (ícono ⠿) para reordenar, lo que persiste en `Order.materialsPriority`
 * (PATCH /orders/materials-priority) y se comparte con todo el equipo.
 */
export default function HojaMaterialesPage() {
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { canManageOperations } = usePermissions();
  const { reorder } = useReorderMaterialsPriority();
  const { timeFormat } = useTimeFormat();
  const [search, setSearch] = useState("");
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  const activeOrders = useMemo(
    () =>
      sortByMaterialsPriority(
        orders.filter((o) => !isDeliveredStatus(o.statusId) && !isCancelledStatus(o.statusId))
      ),
    [orders]
  );

  const query = search.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!query) return activeOrders;
    return activeOrders.filter((order) => {
      const haystack = `${order.id} ${order.description} ${getOrderClientName(order)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeOrders, query]);

  // Sólo se puede reordenar la lista completa (sin filtrar): arrastrar un
  // subconjunto filtrado no define una prioridad global sin ambigüedad.
  const canReorder = canManageOperations && !query;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = activeOrders.map((o) => o.id);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    reorder(arrayMove(ids, oldIndex, newIndex)).catch(() => {
      // El error ya se avisa por toast dentro del hook; no hay nada más que hacer aquí.
    });
  };

  const [openIds, setOpenIds] = useState<string[]>([]);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const focusOrder = useCallback((orderId: string) => {
    setFocusedOrderId(orderId);
    setOpenIds((prev) => (prev.includes(orderId) ? prev : [...prev, orderId]));
  }, []);
  // Llevar a la vista el pedido pedido, recién cuando la lista ya cargó.
  const focusedIsListed = focusedOrderId != null && filteredOrders.some((o) => String(o.id) === focusedOrderId);
  useEffect(() => {
    if (!focusedIsListed || !focusedOrderId) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`materials-order-${focusedOrderId}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedIsListed, focusedOrderId]);

  const draggedOrder = activeDragId != null ? activeOrders.find((o) => o.id === activeDragId) : null;

  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <OrderParamListener onOrder={focusOrder} />
      </Suspense>
      {focusedOrderId && (
        <Button variant="link" size="sm" className="h-auto gap-1.5 px-0" asChild>
          <Link href={`/dashboard/orders/${focusedOrderId}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver al pedido #{focusedOrderId}
          </Link>
        </Button>
      )}
      <div>
        <Title title="Hoja de Materiales" />
        <p className="max-w-prose text-sm text-muted-foreground">
          Elige un pedido para ver y marcar los materiales que hay que comprar.
          {canManageOperations && (
            <>
              {" "}
              Arrastra <GripVertical className="mb-0.5 inline h-3.5 w-3.5" aria-hidden /> para
              definir el orden de prioridad de compra.
            </>
          )}
        </p>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por pedido o cliente..."
          aria-label="Buscar por pedido o cliente"
          className="h-10 rounded-full border-border/60 pl-10 shadow-soft"
        />
      </div>
      {canManageOperations && query && activeOrders.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Limpia la búsqueda para poder reordenar la prioridad de compra.
        </p>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Cargando">
          <Skeleton className="bg-muted h-16 w-full rounded-2xl" />
          <Skeleton className="bg-muted h-16 w-full rounded-2xl" />
          <Skeleton className="bg-muted h-16 w-full rounded-2xl" />
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredOrders.map((o) => o.id)}
            strategy={verticalListSortingStrategy}
          >
            <Accordion type="multiple" className="space-y-3" value={openIds} onValueChange={setOpenIds}>
              {filteredOrders.map((order, index) => (
                <SortableOrderRow
                  key={order.id}
                  order={order}
                  priorityRank={index + 1}
                  timeFormat={timeFormat}
                  draggable={canReorder}
                  isBeingDragged={activeDragId === order.id}
                />
              ))}
            </Accordion>
          </SortableContext>
          <DragOverlay>
            {draggedOrder ? (
              // `elevation-2` (no sólo `shadow-soft-md`): en dark mode una sombra
              // casi no se ve sobre fondo oscuro, así que la elevación real la da
              // el tono más claro (mismo patrón que diálogos/popovers).
              <div className="elevation-2 flex -rotate-1 items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-soft-md">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
                <OrderRowSummary order={draggedOrder} timeFormat={timeFormat} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function SortableOrderRow({
  order,
  priorityRank,
  timeFormat,
  draggable,
  isBeingDragged,
}: {
  order: Order;
  priorityRank: number;
  timeFormat: TimeFormatPreference;
  draggable: boolean;
  isBeingDragged: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    disabled: !draggable,
  });

  return (
    <AccordionItem
      ref={setNodeRef}
      id={`materials-order-${order.id}`}
      value={String(order.id)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/60 bg-card px-3 shadow-soft transition-shadow sm:px-4",
        isDragging && "opacity-40",
        isBeingDragged && "opacity-40"
      )}
    >
      {/* El header del acordeón (h3) ocupa el resto: así la fecha y el estado
          quedan alineados a la derecha en todas las filas. */}
      <div className="flex items-center gap-1 [&>h3]:min-w-0 [&>h3]:flex-1">
        {draggable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 cursor-grab touch-none rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Arrastrar para cambiar la prioridad del pedido #${order.id}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden />
          </Button>
        )}
        {draggable && (
          <span
            className="mr-1 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground"
            aria-hidden
          >
            {priorityRank}
          </span>
        )}
        <AccordionTrigger className="py-4 hover:no-underline">
          <OrderRowSummary order={order} timeFormat={timeFormat} />
        </AccordionTrigger>
      </div>
      <AccordionContent className="border-t border-border/60">
        <div className="space-y-4 pt-3">
          <OrderSizesList products={order.orderProducts} />
          <AreaSuppliesPanel orderId={order.id} />
          <OrderMaterialsChecklistTable orderId={order.id} />
        </div>
      </AccordionContent>
    </AccordionItem>
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
        <BranchBadge order={order} className="ml-2 align-middle" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Entrega: {formatDeliveryDate(order.deliveryDate, timeFormat)}
        </span>
        <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
      </span>
    </span>
  );
}
