"use client";

import { useMemo, useState } from "react";
import { GripVertical, Search } from "lucide-react";
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
import { OrderMaterialsChecklistTable } from "@/components/orders/OrderMaterialsChecklistTable";
import { useOrders, useReorderMaterialsPriority } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { getOrderClientName, formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import { isDeliveredStatus, isCancelledStatus } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { Order } from "@/types";

/** Pedido a abrir de una (llegando desde "Ver hoja de materiales" del detalle del pedido). */
function initialOrderFromUrl(): string[] {
  if (typeof window === "undefined") return [];
  const order = new URLSearchParams(window.location.search).get("order");
  return order ? [order] : [];
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
      // El error ya se avisa por toast dentro del hook; no hay nada más que hacer acá.
    });
  };

  const draggedOrder = activeDragId != null ? activeOrders.find((o) => o.id === activeDragId) : null;

  return (
    <div className="space-y-4">
      <div>
        <Title title="Hoja de Materiales" />
        <p className="text-muted-foreground">
          Elegí un pedido para ver y marcar los materiales que hay que comprar.
          {canManageOperations && (
            <>
              {" "}
              Arrastrá <GripVertical className="mb-0.5 inline h-3.5 w-3.5" aria-hidden /> para
              definir el orden de prioridad de compra.
            </>
          )}
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
      {canManageOperations && query && activeOrders.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Limpiá la búsqueda para poder reordenar la prioridad de compra.
        </p>
      )}

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
            <Accordion type="multiple" className="space-y-2" defaultValue={initialOrderFromUrl()}>
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
              <div className="elevation-2 flex -rotate-1 items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-soft-md">
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
      value={String(order.id)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card px-4 shadow-soft",
        isDragging && "opacity-40",
        isBeingDragged && "opacity-40"
      )}
    >
      <div className="flex items-center gap-1">
        {draggable && (
          <button
            type="button"
            className="-ml-1 shrink-0 touch-none rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Arrastrar para cambiar la prioridad del pedido #${order.id}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 cursor-grab" aria-hidden />
          </button>
        )}
        {draggable && (
          <span
            className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground/70"
            aria-hidden
          >
            {priorityRank}
          </span>
        )}
        <AccordionTrigger className="py-3 hover:no-underline">
          <OrderRowSummary order={order} timeFormat={timeFormat} />
        </AccordionTrigger>
      </div>
      <AccordionContent className="border-t">
        <OrderMaterialsChecklistTable orderId={order.id} />
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
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        Entrega: {formatDeliveryDate(order.deliveryDate, timeFormat)}
        <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
      </span>
    </span>
  );
}
